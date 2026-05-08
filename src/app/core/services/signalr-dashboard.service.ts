import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  IHttpConnectionOptions,
  LogLevel
} from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject, catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AlertaOperacionalPayload,
  DashboardAtualizadoPayload,
  MovimentacoesAtualizadasResponse,
  MovimentacaoAtualizadaPayload
} from '../models/dashboard.models';

@Injectable({
  providedIn: 'root'
})
export class SignalrDashboardService {
  private readonly hubUrl = environment.dashboardHubUrl;
  private readonly movimentacoesValidacaoUrl = environment.movimentacoesAtualizadasUrl;

  private readonly dashboardAtualizadoSubject = new Subject<DashboardAtualizadoPayload>();
  private readonly movimentacaoAtualizadaSubject = new BehaviorSubject<MovimentacaoAtualizadaPayload>([]);
  private readonly alertaOperacionalSubject = new Subject<AlertaOperacionalPayload>();

  private hubConnection: HubConnection | null = null;
  private connectPromise: Promise<void> | null = null;

  readonly dashboardAtualizado$: Observable<DashboardAtualizadoPayload> =
    this.dashboardAtualizadoSubject.asObservable();
  readonly movimentacaoAtualizada$: Observable<MovimentacaoAtualizadaPayload> =
    this.movimentacaoAtualizadaSubject.asObservable();
  readonly alertaOperacional$: Observable<AlertaOperacionalPayload> =
    this.alertaOperacionalSubject.asObservable();

  constructor(private readonly http: HttpClient) {
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

  validarMovimentacoesAtualizadas(limite = 10): Observable<MovimentacaoAtualizadaPayload> {
    return this.http
      .get<MovimentacoesAtualizadasResponse>(`${this.movimentacoesValidacaoUrl}?limite=${limite}`)
      .pipe(
        tap((response) =>
          this.movimentacaoAtualizadaSubject.next(this.normalizeMovimentacaoPayload(response?.movimentacoes))
        ),
        catchError((error: unknown) => {
          this.logError('Falha ao validar movimentacoes atualizadas via HTTP.', error);
          return of([]);
        })
      );
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
      this.validarMovimentacoesAtualizadas().subscribe();
    });

    connection.onclose((error) => {
      this.logError('SignalR desconectado.', error ?? 'sem erro detalhado');
    });
  }

  private registerEventHandlers(connection: HubConnection): void {
    connection.on('dashboardAtualizado', (payload: DashboardAtualizadoPayload) => {
      this.dashboardAtualizadoSubject.next(payload);
    });

    connection.on('movimentacaoAtualizada', (payload: unknown) => {
      const normalized = this.normalizeMovimentacaoPayload(payload);
      this.log(`Evento movimentacaoAtualizada recebido: ${normalized.length} item(ns).`);
      this.movimentacaoAtualizadaSubject.next(normalized);
    });

    connection.on('alertaOperacional', (payload: AlertaOperacionalPayload) => {
      this.alertaOperacionalSubject.next(payload);
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

    const parsed = tryParseString(payload);
    const list =
      (Array.isArray(parsed) && parsed) ||
      unwrapObjectList(parsed) ||
      (parsed && typeof parsed === 'object' ? [parsed] : []) ||
      (Array.isArray(tryParseString(parsed)) ? (tryParseString(parsed) as unknown[]) : []) ||
      [];

    return list
      .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
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
