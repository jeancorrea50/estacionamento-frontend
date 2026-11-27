import { Injectable, inject, signal } from '@angular/core';
import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  IHttpConnectionOptions,
  LogLevel,
} from '@microsoft/signalr';
import { environment } from '../../../../environments/environment';
import { normalizeBearerValue } from '../../../core/auth/auth-token.storage';
import { AuthService } from '../../../core/services/auth.service';

/** Evento do hub emitido pelo backend quando uma janela é alterada. */
export const JANELA_DISPONIBILIDADE_EVENT = 'janelaDisponibilidadeAtualizada';

/**
 * Sinal de "disponibilidade de janelas mudou".
 *
 * - `versao` é incrementada a cada evento do hub (outra aba/usuário) ou por `notifyLocal()`
 *   (CRUD nesta mesma aba). Consumidores usam `effect()` sobre `versao()` para refazer o GET.
 * - Conexão sob demanda no mesmo hub do dashboard (`environment.dashboardHubUrl`).
 * - Stub tolerante: o backend ainda só registra log (`JanelaDisponibilidadeNotifier`); se o hub
 *   estiver offline ou o evento não existir, nada quebra — só não há atualização remota.
 */
@Injectable({ providedIn: 'root' })
export class JanelaDisponibilidadeRealtimeService {
  private static readonly RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000] as const;

  private readonly auth = inject(AuthService);
  private readonly versaoSignal = signal(0);
  private hub: HubConnection | null = null;
  private connectPromise: Promise<void> | null = null;

  /** Contador monotônico; só importa a mudança de valor. */
  readonly versao = this.versaoSignal.asReadonly();

  /** Chamar após CRUD nesta aba para que a UI local recarregue sem esperar o hub. */
  notifyLocal(): void {
    this.bump();
  }

  async connect(): Promise<void> {
    if (this.isBusyOrConnected()) return;
    if (this.connectPromise) return this.connectPromise;

    if (!this.hub) {
      this.hub = this.buildConnection();
      this.hub.on(JANELA_DISPONIBILIDADE_EVENT, (...args: unknown[]) => this.onEvent(args));
    }

    this.connectPromise = this.hub
      .start()
      .catch((error: unknown) => {
        // Hub offline é esperado em ambientes parciais — não propaga (evita ERROR no console).
        this.logWarn('Hub indisponível; atualização em tempo real de janelas desativada.', error);
      })
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  async disconnect(): Promise<void> {
    const hub = this.hub;
    if (!hub || hub.state === HubConnectionState.Disconnected) return;
    try {
      await hub.stop();
    } catch (error: unknown) {
      this.logWarn('Falha ao desconectar do hub de janelas.', error);
    }
  }

  private bump(): void {
    this.versaoSignal.update((v) => v + 1);
  }

  /** Ignora eventos de outro pátio quando o payload informa `estacionamentoId`. */
  private onEvent(args: unknown[]): void {
    const payload = args[0];
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const row = payload as Record<string, unknown>;
      const raw = row['estacionamentoId'] ?? row['EstacionamentoId'];
      const eventId = Number(raw);
      const sessionId = this.auth.resolveEstacionamentoId();
      if (Number.isFinite(eventId) && eventId > 0 && sessionId && eventId !== sessionId) return;
    }
    this.bump();
  }

  private buildConnection(): HubConnection {
    const options: IHttpConnectionOptions = {
      accessTokenFactory: () => normalizeBearerValue(this.auth.getAccessToken() ?? ''),
      withCredentials: false,
      transport:
        HttpTransportType.WebSockets |
        HttpTransportType.ServerSentEvents |
        HttpTransportType.LongPolling,
    };
    return new HubConnectionBuilder()
      .withUrl(environment.dashboardHubUrl, options)
      .withAutomaticReconnect([...JanelaDisponibilidadeRealtimeService.RECONNECT_DELAYS_MS])
      .configureLogging(LogLevel.None)
      .build();
  }

  private isBusyOrConnected(): boolean {
    const state = this.hub?.state;
    return (
      state === HubConnectionState.Connected ||
      state === HubConnectionState.Connecting ||
      state === HubConnectionState.Reconnecting
    );
  }

  private logWarn(message: string, error: unknown): void {
    if (!environment.production) {
      console.warn(`[Janela realtime] ${message}`, error);
    }
  }
}
