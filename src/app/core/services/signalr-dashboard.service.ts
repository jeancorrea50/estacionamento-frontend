import { Injectable, computed, inject, signal } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  IHttpConnectionOptions,
  LogLevel
} from '@microsoft/signalr';
import { Observable, filter } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { normalizeBearerValue } from '../auth/auth-token.storage';
import {
  AlertaOperacionalPayload,
  DashboardAtualizadoPayload,
  MovimentacaoAtualizadaPayload
} from '../models/dashboard.models';
import { AuthService } from './auth.service';

/**
 * Hub SignalR do dashboard/movimentos.
 * URL: `environment.dashboardHubUrl` → `/estac/worker/hubs/movimento/entradasaida`
 * Auth: JWT da sessão (EmpresaId/CodExportacao do pátio) via `accessTokenFactory`.
 * Estado em `signal` — sem Zone.js, só signals notificam a UI a cada evento do hub.
 */
@Injectable({
  providedIn: 'root'
})
export class SignalrDashboardService {
  private readonly auth = inject(AuthService);
  private readonly hubUrl = environment.dashboardHubUrl;

  private readonly dashboardSignal = signal<DashboardAtualizadoPayload | null>(null);
  private readonly movimentacoesSignal = signal<MovimentacaoAtualizadaPayload>([]);
  /** Envelope com `at` para reemitir o mesmo texto de alerta consecutivamente. */
  private readonly alertaSignal = signal<{ text: AlertaOperacionalPayload; at: number } | null>(
    null
  );

  private hubConnection: HubConnection | null = null;
  private connectPromise: Promise<void> | null = null;
  /** Evita renegotiate em loop quando o hub está offline (500). */
  private connectFailed = false;

  /** Snapshot atual do dashboard (KPIs). */
  readonly dashboardAtualizado = this.dashboardSignal.asReadonly();
  /** Lista ao vivo do monitoramento (até 10 itens do hub). */
  readonly movimentacoes = this.movimentacoesSignal.asReadonly();
  /** Último alerta operacional textual. */
  readonly alertaOperacional = computed(() => this.alertaSignal()?.text ?? '');

  readonly dashboardAtualizado$: Observable<DashboardAtualizadoPayload> = toObservable(
    this.dashboardSignal
  ).pipe(filter((payload): payload is DashboardAtualizadoPayload => payload != null));

  readonly movimentacaoAtualizada$: Observable<MovimentacaoAtualizadaPayload> = toObservable(
    this.movimentacoesSignal
  );

  readonly alertaOperacional$: Observable<AlertaOperacionalPayload> = toObservable(
    this.alertaOperacional
  ).pipe(filter((alerta): alerta is AlertaOperacionalPayload => !!alerta));

  constructor() {
    void this.connect();
  }

  /** Zera KPIs/monitoramento/alerta (ex.: troca de pátio). */
  clearState(): void {
    this.dashboardSignal.set(null);
    this.movimentacoesSignal.set([]);
    this.alertaSignal.set(null);
  }

  /**
   * Reconecta com o JWT atual (EmpresaId do pátio) e limpa estado antigo.
   * Chamar após `selecionarEstacionamentoSessao`.
   */
  async reconnectForSession(): Promise<void> {
    this.clearState();
    this.connectFailed = false;
    await this.disconnect();
    this.hubConnection = null;
    await this.connect();
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    if (this.connectFailed) {
      return;
    }

    if (!this.hubConnection) {
      this.hubConnection = this.buildConnection();
      this.registerLifecycleHandlers(this.hubConnection);
      this.registerEventHandlers(this.hubConnection);
    }

    this.log(`Conectando ao Hub: ${this.hubUrl}`);
    this.connectPromise = this.hubConnection
      .start()
      .then(() => {
        this.connectFailed = false;
        this.log('SignalR conectado com sucesso.');
      })
      .catch((error: unknown) => {
        this.connectFailed = true;
        this.connectPromise = null;
        // Hub offline/500 é esperado em ambientes parciais — não rethrow (evita ERROR no console Angular).
        this.logWarn('Falha ao conectar no SignalR (hub indisponível).', error);
      });

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.hubConnection) {
      return;
    }

    if (this.hubConnection.state === HubConnectionState.Disconnected) {
      return;
    }

    try {
      await this.hubConnection.stop();
      this.log('SignalR desconectado.');
    } catch (error: unknown) {
      this.logWarn('Falha ao desconectar SignalR.', error);
    }
  }

  private buildConnection(): HubConnection {
    const options: IHttpConnectionOptions = {
      accessTokenFactory: () => normalizeBearerValue(this.auth.getAccessToken() ?? ''),
      withCredentials: false,
      transport:
        HttpTransportType.WebSockets |
        HttpTransportType.ServerSentEvents |
        HttpTransportType.LongPolling
    };

    return new HubConnectionBuilder()
      .withUrl(this.hubUrl, options)
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();
  }

  private registerLifecycleHandlers(connection: HubConnection): void {
    connection.onreconnecting((error) => {
      this.logWarn('SignalR reconectando...', error ?? 'sem erro detalhado');
    });

    connection.onreconnected((connectionId) => {
      this.connectFailed = false;
      this.log(`SignalR reconectado. ConnectionId: ${connectionId ?? 'indisponivel'}`);
    });

    connection.onclose((error) => {
      this.logWarn('SignalR desconectado.', error ?? 'sem erro detalhado');
    });
  }

  private registerEventHandlers(connection: HubConnection): void {
    const logDevEvent = (label: string, data: unknown): void => {
      if (!environment.production) {
        console.log(`${label}:`, data);
      }
    };

    const handleDashboard = (payload: DashboardAtualizadoPayload): void => {
      logDevEvent('dashboard', payload);
      if (!this.payloadMatchesSession(payload)) {
        this.log('Evento dashboard ignorado (fora do pátio da sessão).');
        return;
      }
      this.dashboardSignal.set(payload);
    };

    connection.on('dashboard', handleDashboard);
    connection.on('dashboardAtualizado', handleDashboard);

    connection.on('movimentacaoAtualizada', (...args: unknown[]) => {
      // SignalR: arguments = [[item, item, ...]] → 1º arg é a lista.
      const payload = args.length === 1 ? args[0] : args;
      logDevEvent('movimentacao', payload);
      const normalized = this.normalizeMovimentacaoPayload(payload).filter((item) =>
        this.payloadMatchesSession(item)
      );
      this.log(
        `Evento movimentacaoAtualizada recebido: ${normalized.length} item(ns) no pátio da sessão.`
      );
      this.movimentacoesSignal.set(normalized);
    });

    connection.on('alertaOperacional', (payload: AlertaOperacionalPayload) => {
      logDevEvent('alerta', payload);
      if (this.auth.needsEstacionamentoSelection()) {
        this.log('Evento alertaOperacional ignorado (pátio não selecionado).');
        return;
      }
      this.alertaSignal.set({ text: payload, at: Date.now() });
    });
  }

  /**
   * Escopo do pátio selecionado:
   * - Admin/Transportadora sem pátio → rejeita tudo (evita vazamento ao “Trocar pátio”).
   * - Com `estacionamentoId`/`codExportacao` no payload → só aceita se bater com a sessão.
   * - Sem esses campos + Admin/Transportadora com pátio → rejeita broadcast global.
   * - Usuário com vínculo fixo (sem seleção) → aceita (escopo vem do JWT no hub).
   */
  private payloadMatchesSession(payload: unknown): boolean {
    if (this.auth.needsEstacionamentoSelection()) {
      return false;
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return false;
    }

    const row = payload as Record<string, unknown>;
    const sessionId = this.auth.resolveEstacionamentoId();
    const sessionCod = this.auth.resolveCodExportacao()?.trim().toLowerCase() || null;
    const requiresPatioScope =
      (this.auth.isAdmin() || this.auth.isTransportadoraRole()) && !!sessionId;

    const itemId = this.pickPositiveNumber(
      row,
      'estacionamentoId',
      'EstacionamentoId',
      'empresaId',
      'EmpresaId'
    );
    const itemCod =
      this.pickText(row, 'codExportacao', 'CodExportacao')?.trim().toLowerCase() || null;
    const hasScope = itemId != null || !!itemCod;

    if (!hasScope) {
      return !requiresPatioScope;
    }

    if (sessionId != null && itemId != null && itemId !== sessionId) {
      return false;
    }
    if (sessionCod && itemCod && itemCod !== sessionCod) {
      return false;
    }

    if (requiresPatioScope) {
      if (itemId != null) return itemId === sessionId;
      if (itemCod && sessionCod) return itemCod === sessionCod;
      return false;
    }

    return true;
  }

  private pickPositiveNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
    for (const key of keys) {
      const raw = row[key];
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    }
    return null;
  }

  private pickText(row: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
      const raw = row[key];
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
    }
    return null;
  }

  private normalizeMovimentacaoPayload(payload: unknown): MovimentacaoAtualizadaPayload {
    const tryParseString = (value: unknown): unknown => {
      if (typeof value !== 'string') {
        return value;
      }
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    };

    const unwrapObjectList = (value: unknown): unknown[] | null => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }

      const source = value as Record<string, unknown>;
      const candidates = [
        source['items'],
        source['itens'],
        source['results'],
        source['result'],
        source['movimentacoes'],
        source['movimentacaoAtualizada'],
        source['MovimentacaoAtualizada'],
        source['arguments'],
        source['Arguments'],
        source['data'],
        source['Data']
      ];

      for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
          return candidate;
        }
      }

      return null;
    };

    const flattenLists = (value: unknown): unknown[] => {
      const parsed = tryParseString(value);

      if (Array.isArray(parsed)) {
        // [[ {...}, {...} ]] → achata um nível quando o 1º elemento já é a lista.
        if (parsed.length === 1 && Array.isArray(parsed[0])) {
          return parsed[0] as unknown[];
        }
        if (parsed.every((item) => Array.isArray(item))) {
          return (parsed as unknown[][]).flat();
        }
        return parsed;
      }

      return unwrapObjectList(parsed) ?? (parsed && typeof parsed === 'object' ? [parsed] : []);
    };

    return flattenLists(payload)
      .filter((item): item is Record<string, unknown> => {
        return item != null && typeof item === 'object' && !Array.isArray(item);
      })
      .map((item) => ({ ...item }))
      .sort((a, b) => this.extrairHorarioMs(b) - this.extrairHorarioMs(a));
  }

  /** Ordena pelo campo de data do hub (`horario` / entrada / saída), mais recente primeiro. */
  private extrairHorarioMs(item: Record<string, unknown>): number {
    const candidates = [
      item['horario'],
      item['Horario'],
      item['dataHoraSaida'],
      item['DataHoraSaida'],
      item['dataHoraEntrada'],
      item['DataHoraEntrada'],
      item['entradaEm'],
      item['EntradaEm']
    ];

    for (const candidate of candidates) {
      if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
        return candidate.getTime();
      }
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
      if (typeof candidate === 'string' && candidate.trim()) {
        const parsed = Date.parse(candidate);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }

    return 0;
  }

  private isConnected(): boolean {
    return this.hubConnection?.state === HubConnectionState.Connected;
  }

  private log(message: string): void {
    if (!environment.production) {
      console.info(`[SignalR Dashboard] ${message}`);
    }
  }

  private logWarn(message: string, error: unknown): void {
    if (!environment.production) {
      console.warn(`[SignalR Dashboard] ${message}`, error);
    }
  }
}
