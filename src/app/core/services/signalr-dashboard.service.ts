import { ApplicationRef, Injectable, NgZone } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  IHttpConnectionOptions,
  LogLevel
} from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject, filter } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AlertaOperacionalPayload,
  DashboardAtualizadoPayload,
  MovimentacaoAtualizadaPayload
} from '../models/dashboard.models';

/**
 * Hub SignalR do dashboard/movimentos.
 * Fonte de verdade = eventos do hub (dashboardAtualizado / movimentacaoAtualizada).
 * Emite com NgZone + ApplicationRef.tick (app zoneless) para UI atualizar sem clique.
 */
@Injectable({
  providedIn: 'root'
})
export class SignalrDashboardService {
  private readonly hubUrl = environment.dashboardHubUrl;

  private readonly dashboardAtualizadoSubject =
    new BehaviorSubject<DashboardAtualizadoPayload | null>(null);
  private readonly movimentacaoAtualizadaSubject =
    new BehaviorSubject<MovimentacaoAtualizadaPayload>([]);
  private readonly alertaOperacionalSubject = new Subject<AlertaOperacionalPayload>();

  private hubConnection: HubConnection | null = null;
  private connectPromise: Promise<void> | null = null;

  readonly dashboardAtualizado$: Observable<DashboardAtualizadoPayload> =
    this.dashboardAtualizadoSubject.asObservable().pipe(
      filter((payload): payload is DashboardAtualizadoPayload => payload != null)
    );
  readonly movimentacaoAtualizada$: Observable<MovimentacaoAtualizadaPayload> =
    this.movimentacaoAtualizadaSubject.asObservable();
  readonly alertaOperacional$: Observable<AlertaOperacionalPayload> =
    this.alertaOperacionalSubject.asObservable();

  constructor(
    private readonly ngZone: NgZone,
    private readonly appRef: ApplicationRef
  ) {
    void this.connect();
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
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
        this.log('SignalR conectado com sucesso.');
      })
      .catch((error: unknown) => {
        this.logError('Falha ao conectar no SignalR.', error);
        this.connectPromise = null;
        throw error;
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
      this.logError('Falha ao desconectar SignalR.', error);
      throw error;
    }
  }

  private buildConnection(): HubConnection {
    const options: IHttpConnectionOptions = {
      withCredentials: false,
      transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling
    };

    return new HubConnectionBuilder()
      .withUrl(this.hubUrl, options)
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Information)
      .build();
  }

  private registerLifecycleHandlers(connection: HubConnection): void {
    connection.onreconnecting((error) => {
      this.logError('SignalR reconectando...', error ?? 'sem erro detalhado');
    });

    connection.onreconnected((connectionId) => {
      this.log(`SignalR reconectado. ConnectionId: ${connectionId ?? 'indisponivel'}`);
    });

    connection.onclose((error) => {
      this.logError('SignalR desconectado.', error ?? 'sem erro detalhado');
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
      this.emitInAngular(() => this.dashboardAtualizadoSubject.next(payload));
    };

    connection.on('dashboard', handleDashboard);
    connection.on('dashboardAtualizado', handleDashboard);

    connection.on('movimentacaoAtualizada', (...args: unknown[]) => {
      // SignalR: arguments = [[item, item, ...]] → 1º arg é a lista.
      const payload = args.length === 1 ? args[0] : args;
      logDevEvent('movimentacao', payload);
      const normalized = this.normalizeMovimentacaoPayload(payload);
      this.log(`Evento movimentacaoAtualizada recebido: ${normalized.length} item(ns).`);
      this.emitInAngular(() => this.movimentacaoAtualizadaSubject.next(normalized));
    });

    connection.on('alertaOperacional', (payload: AlertaOperacionalPayload) => {
      logDevEvent('alerta', payload);
      this.emitInAngular(() => this.alertaOperacionalSubject.next(payload));
    });
  }

  /**
   * SignalR roda fora do scheduler do Angular zoneless.
   * Sem tick, a UI só atualiza no próximo clique (ex.: menu Movimento).
   */
  private emitInAngular(emit: () => void): void {
    this.ngZone.run(() => {
      emit();
      this.appRef.tick();
    });
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
      .slice(0, 10);
  }

  private isConnected(): boolean {
    return this.hubConnection?.state === HubConnectionState.Connected;
  }

  private log(message: string): void {
    console.info(`[SignalR Dashboard] ${message}`);
  }

  private logError(message: string, error: unknown): void {
    console.error(`[SignalR Dashboard] ${message}`, error);
  }
}
