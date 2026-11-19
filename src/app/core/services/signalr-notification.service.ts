import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  IRetryPolicy,
  LogLevel,
  RetryContext,
} from '@microsoft/signalr';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { normalizeBearerValue } from '../auth/auth-token.storage';
import type { NotificacaoDto } from '../models/notificacao.models';

/**
 * Hub SignalR de notificações genéricas.
 *
 * Como acessar (PathBase /estac/notification):
 * - Hub: `environment.notificationHubUrl` → `/estac/notification/hubs/notificacao`
 * - HTTP: GET `{notificationApiUrl}/notificacoes`, POST `{notificationApiUrl}/notificacoes/{id}/lida`
 * - Auth: JWT do login via `accessTokenFactory` (query `access_token` no negotiate)
 * - Evento server→client: `notificacaoRecebida`
 * - Role exigida: Admin
 */
@Injectable({ providedIn: 'root' })
export class SignalrNotificationService {
  private static readonly MAX_RECONNECT_ATTEMPTS = 4;
  private static readonly RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000] as const;

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly hubUrl = environment.notificationHubUrl;
  private readonly apiUrl = environment.notificationApiUrl;

  private readonly itensSignal = signal<NotificacaoDto[]>([]);
  private readonly panelOpenSignal = signal(false);
  private hubConnection: HubConnection | null = null;
  private connectPromise: Promise<void> | null = null;
  private listaFalhouOnce = false;
  private hubFalhouOnce = false;
  private reconnectEsgotado = false;

  readonly itens = this.itensSignal.asReadonly();
  readonly panelOpen = this.panelOpenSignal.asReadonly();
  readonly naoLidas = computed(() => this.itensSignal().filter((n) => !n.lida).length);

  async connect(): Promise<void> {
    // Sino e hub de migration/infra: exclusivamente Admin.
    if (!this.auth.isAdmin()) {
      this.itensSignal.set([]);
      return;
    }
    if (this.isBusyOrConnected()) return;
    if (this.connectPromise) return this.connectPromise;

    if (this.reconnectEsgotado || this.hubFalhouOnce) {
      this.reconnectEsgotado = false;
      this.hubFalhouOnce = false;
      if (!this.hubConnection || this.hubConnection.state === HubConnectionState.Disconnected) {
        this.hubConnection = null;
      }
    }

    await this.carregarLista();

    if (!this.hubConnection) {
      this.hubConnection = this.buildConnection();
      this.registerHandlers(this.hubConnection);
    }

    this.connectPromise = this.hubConnection
      .start()
      .then(() => {
        this.hubFalhouOnce = false;
        this.reconnectEsgotado = false;
        if (!environment.production) {
          console.info('[NotificationHub] conectado:', this.hubUrl);
        }
      })
      .catch((err) => {
        this.hubFalhouOnce = true;
        if (!environment.production) {
          console.warn('[NotificationHub] falha ao conectar:', err);
        }
        this.connectPromise = null;
      });

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state === HubConnectionState.Disconnected) return;
    await this.hubConnection.stop();
  }

  togglePanel(): void {
    const opening = !this.panelOpenSignal();
    this.panelOpenSignal.update((v) => !v);
    // Reabre tentativa se o hub tiver pausado após falhas (layout só chama connect no init).
    if (opening) {
      void this.connect();
      void this.carregarLista();
    }
  }

  closePanel(): void {
    this.panelOpenSignal.set(false);
  }

  async carregarLista(): Promise<void> {
    if (!this.auth.isAdmin()) {
      this.itensSignal.set([]);
      return;
    }
    try {
      const body = await firstValueFrom(this.http.get<unknown>(`${this.apiUrl}/notificacoes`));
      const lista = this.peelLista(body);
      // Defesa: tipos de infraestrutura só para Admin (API já restringe).
      this.itensSignal.set(lista);
    } catch (err) {
      // API offline / 401 sem Admin — hub ainda pode empurrar eventos
      if (!environment.production && !this.listaFalhouOnce) {
        this.listaFalhouOnce = true;
        console.warn('[NotificationApi] falha ao listar:', this.apiUrl + '/notificacoes', err);
      }
    }
  }

  marcarLida(id: number): void {
    this.http.post(`${this.apiUrl}/notificacoes/${id}/lida`, {}).subscribe({
      next: () => {
        this.itensSignal.update((list) =>
          list.map((n) => (n.id === id ? { ...n, lida: true } : n))
        );
      },
    });
  }

  marcarTodasLidas(): void {
    for (const n of this.itensSignal().filter((x) => !x.lida)) {
      this.marcarLida(n.id);
    }
  }

  private peelLista(body: unknown): NotificacaoDto[] {
    if (Array.isArray(body)) return body as NotificacaoDto[];
    if (body && typeof body === 'object') {
      const o = body as Record<string, unknown>;
      const raw = o['result'] ?? o['data'] ?? o['Data'] ?? body;
      if (Array.isArray(raw)) return raw as NotificacaoDto[];
    }
    return [];
  }

  private buildConnection(): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => normalizeBearerValue(this.auth.getAccessToken() ?? ''),
        transport:
          HttpTransportType.WebSockets |
          HttpTransportType.ServerSentEvents |
          HttpTransportType.LongPolling,
        withCredentials: false,
      })
      .withAutomaticReconnect(this.buildRetryPolicy())
      // Hub offline/502 no gateway não deve poluir o console do usuário.
      .configureLogging(LogLevel.None)
      .build();
  }

  private buildRetryPolicy(): IRetryPolicy {
    return {
      nextRetryDelayInMilliseconds: (retryContext: RetryContext): number | null => {
        if (retryContext.previousRetryCount >= SignalrNotificationService.MAX_RECONNECT_ATTEMPTS) {
          this.reconnectEsgotado = true;
          if (!environment.production) {
            console.warn(
              '[NotificationHub] reconexões esgotadas; hub pausado até nova tentativa.',
              retryContext.retryReason ?? 'sem detalhe'
            );
          }
          return null;
        }
        const delays = SignalrNotificationService.RECONNECT_DELAYS_MS;
        return delays[Math.min(retryContext.previousRetryCount, delays.length - 1)];
      },
    };
  }

  private registerHandlers(connection: HubConnection): void {
    connection.on('notificacaoRecebida', (payload: NotificacaoDto) => {
      if (!this.auth.isAdmin()) return;
      if (!payload?.id) return;
      this.itensSignal.update((list) => {
        if (list.some((n) => n.id === payload.id)) return list;
        const item: NotificacaoDto = {
          id: payload.id,
          tipo: payload.tipo ?? 'Geral',
          titulo: payload.titulo ?? 'Notificação',
          mensagem: payload.mensagem ?? '',
          dadosJson: payload.dadosJson,
          dataCriacao: payload.dataCriacao ?? new Date().toISOString(),
          lida: false,
          codExportacao: payload.codExportacao,
        };
        return [item, ...list].slice(0, 100);
      });
    });

    connection.onreconnected(() => {
      this.reconnectEsgotado = false;
      void this.carregarLista();
    });
  }

  private isBusyOrConnected(): boolean {
    const state = this.hubConnection?.state;
    return (
      state === HubConnectionState.Connected ||
      state === HubConnectionState.Connecting ||
      state === HubConnectionState.Reconnecting
    );
  }
}
