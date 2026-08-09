import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
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
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly hubUrl = environment.notificationHubUrl;
  private readonly apiUrl = environment.notificationApiUrl;

  private readonly itensSignal = signal<NotificacaoDto[]>([]);
  private readonly panelOpenSignal = signal(false);
  private hubConnection: HubConnection | null = null;
  private connectPromise: Promise<void> | null = null;

  readonly itens = this.itensSignal.asReadonly();
  readonly panelOpen = this.panelOpenSignal.asReadonly();
  readonly naoLidas = computed(() => this.itensSignal().filter((n) => !n.lida).length);

  async connect(): Promise<void> {
    if (this.isConnected()) return;
    if (this.connectPromise) return this.connectPromise;

    await this.carregarLista();

    if (!this.hubConnection) {
      this.hubConnection = this.buildConnection();
      this.registerHandlers(this.hubConnection);
    }

    this.connectPromise = this.hubConnection
      .start()
      .then(() => {
        if (!environment.production) {
          console.log('[NotificationHub] conectado:', this.hubUrl);
        }
      })
      .catch((err) => {
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
    this.panelOpenSignal.update((v) => !v);
  }

  closePanel(): void {
    this.panelOpenSignal.set(false);
  }

  async carregarLista(): Promise<void> {
    try {
      const body = await firstValueFrom(this.http.get<unknown>(`${this.apiUrl}/notificacoes`));
      this.itensSignal.set(this.peelLista(body));
    } catch {
      /* API offline — hub ainda pode empurrar eventos */
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
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(environment.production ? LogLevel.Warning : LogLevel.Information)
      .build();
  }

  private registerHandlers(connection: HubConnection): void {
    connection.on('notificacaoRecebida', (payload: NotificacaoDto) => {
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
      void this.carregarLista();
    });
  }

  private isConnected(): boolean {
    return this.hubConnection?.state === HubConnectionState.Connected;
  }
}
