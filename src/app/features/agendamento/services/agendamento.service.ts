import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/api/models';
import { unwrapServiceResult } from '../../../core/api/utils/service-result.util';
import { mapMotoristaPorPlacaResponse } from '../../cadastro/mappers/motorista-por-placa.mapper';
import { MotoristaPorPlacaAggregateVm } from '../../cadastro/models/motorista-por-placa.vm';
import { normalizePlaca } from '../../cadastro/utils/placa-br';
import {
  AgendamentoFiltro,
  AgendamentoPagedResult,
  AgendamentoPostInput,
  AgendamentoSearchItem,
  AgendamentoSlotHold,
  AgendamentoSlotHoldPostInput,
  parseEntradaSaidaStatus,
} from '../models/agendamento.models';

export type AgendamentoMutationResult = {
  success: boolean;
  message?: string;
  /** true quando o errorInterceptor já exibiu o toast. */
  toastShown?: boolean;
};

@Injectable({ providedIn: 'root' })
export class AgendamentoService {
  private readonly apiRoot = `${environment.API_BASE_URL}/Agendamento`;
  private readonly http = inject(HttpClient);

  buscar(filtro: AgendamentoFiltro): Observable<AgendamentoPagedResult> {
    let params = new HttpParams()
      .set('NumeroPagina', String(filtro.numeroPagina || 1))
      .set('TamanhoPagina', String(filtro.tamanhoPagina || 20));

    const busca = (filtro.busca ?? filtro.placa ?? '').trim();
    if (busca) {
      // Backend: Descricao casa placa, nome do motorista ou CPF.
      params = params.set('Descricao', busca);
    }
    if (filtro.dataInicial?.trim()) params = params.set('DataInicial', filtro.dataInicial.trim());
    if (filtro.dataFinal?.trim()) params = params.set('DataFinal', filtro.dataFinal.trim());
    if (typeof filtro.transportadoraId === 'number' && filtro.transportadoraId > 0) {
      params = params.set('TransportadoraId', String(filtro.transportadoraId));
    }

    return this.http.get<unknown>(this.apiRoot, { params }).pipe(
      map((body) => this.normalizePaged(body, filtro.numeroPagina, filtro.tamanhoPagina))
    );
  }

  /**
   * GET `/api/Agendamento/por-placa/{placa}` — mesmo contrato de Veiculo/por-placa,
   * sob permissão `agendamento.visualizar` (evita 403 de Motorista/Veiculo).
   */
  obterPorPlaca(placa: string): Observable<MotoristaPorPlacaAggregateVm | null> {
    const norm = normalizePlaca(placa);
    if (norm.length < 7) {
      return of(null);
    }
    return this.http.get<unknown>(`${this.apiRoot}/por-placa/${encodeURIComponent(norm)}`).pipe(
      timeout(15000),
      map((body) => mapMotoristaPorPlacaResponse(body)),
      catchError((err: unknown) => {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        if (status === 404) return of(null);
        return throwError(() => err);
      })
    );
  }

  gravar(input: AgendamentoPostInput): Observable<AgendamentoMutationResult> {
    return this.http.post<unknown>(this.apiRoot, input).pipe(
      map((body) => this.readSuccess(body, 'Agendamento criado.')),
      catchError((err: unknown) => of(this.readHttpFailure(err)))
    );
  }

  /** POST `/api/Agendamento/vagas/holds` — reserva temporária (20 min). */
  criarHold(input: AgendamentoSlotHoldPostInput): Observable<AgendamentoSlotHold> {
    return this.http.post<unknown>(`${this.apiRoot}/vagas/holds`, input).pipe(
      map((body) => this.mapHold(unwrapServiceResult<Record<string, unknown>>(body)))
    );
  }

  obterHold(id: number): Observable<AgendamentoSlotHold> {
    return this.http.get<unknown>(`${this.apiRoot}/vagas/holds/${id}`).pipe(
      map((body) => this.mapHold(unwrapServiceResult<Record<string, unknown>>(body)))
    );
  }

  /**
   * DELETE `/api/Agendamento/vagas/holds/{id}`.
   * Com `token`, permite cancelamento via beacon sem sessão.
   */
  cancelarHold(id: number, token?: string | null): Observable<AgendamentoMutationResult> {
    let params = new HttpParams();
    const t = (token ?? '').trim();
    if (t) params = params.set('token', t);
    return this.http.delete<unknown>(`${this.apiRoot}/vagas/holds/${id}`, { params }).pipe(
      map((body) => this.readSuccess(body ?? {}, 'Reserva temporária cancelada.')),
      catchError((err: unknown) => of(this.readHttpFailure(err)))
    );
  }

  /** Cancelamento best-effort ao fechar aba/navegador (`fetch` + keepalive; sendBeacon só faz POST). */
  cancelarHoldBeacon(id: number, token: string): void {
    const t = (token ?? '').trim();
    if (!id || !t || typeof fetch !== 'function') return;
    const url = `${this.apiRoot}/vagas/holds/${id}?token=${encodeURIComponent(t)}`;
    try {
      void fetch(url, { method: 'DELETE', keepalive: true, credentials: 'omit' });
    } catch {
      /* best-effort */
    }
  }

  private mapHold(row: Record<string, unknown> | null | undefined): AgendamentoSlotHold {
    const r = row && typeof row === 'object' ? row : {};
    return {
      id: this.pickNumber(r, 'id', 'Id'),
      token: this.pickString(r, 'token', 'Token'),
      estacionamentoId: this.pickNumber(r, 'estacionamentoId', 'EstacionamentoId'),
      transportadoraId: this.pickNumber(r, 'transportadoraId', 'TransportadoraId'),
      usuarioId: this.pickNumber(r, 'usuarioId', 'UsuarioId') || null,
      data: this.pickString(r, 'data', 'Data'),
      modalidadeAgendamento: this.pickNumber(r, 'modalidadeAgendamento', 'ModalidadeAgendamento') || 1,
      horaInicio: this.pickString(r, 'horaInicio', 'HoraInicio'),
      horaFim: this.pickString(r, 'horaFim', 'HoraFim'),
      janelaAgendamentoId: this.pickNumber(r, 'janelaAgendamentoId', 'JanelaAgendamentoId') || null,
      quantidade: this.pickNumber(r, 'quantidade', 'Quantidade'),
      status: this.pickNumber(r, 'status', 'Status'),
      criadoEm: this.pickString(r, 'criadoEm', 'CriadoEm'),
      expiraEm: this.pickString(r, 'expiraEm', 'ExpiraEm'),
    };
  }

  cancelar(id: number): Observable<AgendamentoMutationResult> {
    return this.http.patch<unknown>(`${this.apiRoot}/${id}/cancelar`, {}).pipe(
      map((body) => this.readSuccess(body ?? {}, 'Agendamento cancelado.')),
      catchError((err: unknown) => of(this.readHttpFailure(err)))
    );
  }

  confirmarEntrada(id: number): Observable<AgendamentoMutationResult> {
    return this.http.patch<unknown>(`${this.apiRoot}/${id}/confirmar-entrada`, {}).pipe(
      map((body) => this.readSuccess(body ?? {}, 'Entrada confirmada.')),
      catchError((err: unknown) => of(this.readHttpFailure(err)))
    );
  }

  private normalizePaged(
    body: unknown,
    numeroPagina: number,
    tamanhoPagina: number
  ): AgendamentoPagedResult {
    const source = this.unwrap(body);
    const root = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
    const rows =
      (Array.isArray(root['results']) && root['results']) ||
      (Array.isArray(root['Results']) && root['Results']) ||
      (Array.isArray(root['data']) && root['data']) ||
      (Array.isArray(root['Data']) && root['Data']) ||
      (Array.isArray(source) && source) ||
      [];

    const items = (rows as unknown[])
      .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
      .map((row) => this.mapItem(row));

    return {
      items,
      totalCount:
        Number(
          root['rowCount'] ?? root['RowCount'] ?? root['totalCount'] ?? items.length
        ) || items.length,
      numeroPagina:
        Number(root['currentPage'] ?? root['CurrentPage'] ?? numeroPagina) || numeroPagina,
      tamanhoPagina:
        Number(root['pageSize'] ?? root['PageSize'] ?? tamanhoPagina) || tamanhoPagina,
    };
  }

  private mapItem(row: Record<string, unknown>): AgendamentoSearchItem {
    return {
      id: this.pickNumber(row, 'id', 'Id'),
      descricao: this.pickString(row, 'descricao', 'Descricao'),
      motoristaId: this.pickNumber(row, 'motoristaId', 'MotoristaId'),
      nomeMotorista: this.pickString(row, 'nomeMotorista', 'NomeMotorista'),
      cpfMotorista: this.pickStringOrNull(row, 'cpfMotorista', 'CpfMotorista'),
      transportadoraId: this.pickNumber(row, 'transportadoraId', 'TransportadoraId'),
      nomeTransportadora: this.pickString(row, 'nomeTransportadora', 'NomeTransportadora'),
      veiculoId: this.pickNumber(row, 'veiculoId', 'VeiculoId'),
      placaVeiculo: this.pickString(row, 'placaVeiculo', 'PlacaVeiculo'),
      dataHoraEntrada: this.pickString(row, 'dataHoraEntrada', 'DataHoraEntrada'),
      status: parseEntradaSaidaStatus(
        this.pickRaw(row, 'status', 'Status') as number | string | undefined
      ),
      observacao: this.pickStringOrNull(row, 'observacao', 'Observacao'),
    };
  }

  private unwrap(body: unknown): unknown {
    try {
      return unwrapServiceResult(body);
    } catch {
      if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        return b['result'] ?? b['Result'] ?? body;
      }
      return body;
    }
  }

  private readSuccess(body: unknown, fallback: string): AgendamentoMutationResult {
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      const success = b['success'] ?? b['Success'];
      if (success === false) {
        const notes = b['notifications'] ?? b['Notifications'] ?? b['message'] ?? b['Message'];
        const message = Array.isArray(notes)
          ? notes.filter((n): n is string => typeof n === 'string').join(' ')
          : typeof notes === 'string'
            ? notes
            : 'Operação rejeitada.';
        return { success: false, message };
      }
      const notesOk = b['notifications'] ?? b['Notifications'];
      const fromNotes = Array.isArray(notesOk)
        ? notesOk.filter((n): n is string => typeof n === 'string').join(' ').trim()
        : typeof notesOk === 'string'
          ? notesOk.trim()
          : '';
      const message =
        fromNotes || String(b['message'] ?? b['Message'] ?? fallback).trim() || fallback;
      return { success: true, message };
    }
    return { success: true, message: fallback };
  }

  private readHttpFailure(err: unknown): AgendamentoMutationResult {
    // errorInterceptor já converteu HttpErrorResponse → ApiError.
    if (err && typeof err === 'object' && !(err instanceof HttpErrorResponse)) {
      const api = err as ApiError;
      if (typeof api.message === 'string' && api.message.trim()) {
        return {
          success: false,
          message: api.message.trim(),
          toastShown: api.toastShown === true,
        };
      }
    }

    if (err instanceof HttpErrorResponse) {
      let e: unknown = err.error;
      if (typeof e === 'string') {
        const raw = e.trim();
        if (raw) {
          try {
            e = JSON.parse(raw) as unknown;
          } catch {
            return { success: false, message: raw };
          }
        }
      }
      if (e && typeof e === 'object') {
        const b = e as Record<string, unknown>;
        const notes = b['notifications'] ?? b['Notifications'] ?? b['message'] ?? b['Message'];
        if (Array.isArray(notes) && notes.length) {
          return {
            success: false,
            message: notes.filter((n): n is string => typeof n === 'string').join(' '),
          };
        }
        if (typeof notes === 'string' && notes.trim()) {
          return { success: false, message: notes.trim() };
        }
      }
    }

    return { success: false, message: 'Não foi possível concluir a operação.' };
  }

  private pickNumber(row: Record<string, unknown>, ...keys: string[]): number {
    for (const k of keys) {
      const v = row[k];
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  private pickString(row: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
      const v = row[k];
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return String(v);
    }
    return '';
  }

  private pickStringOrNull(row: Record<string, unknown>, ...keys: string[]): string | null {
    const s = this.pickString(row, ...keys).trim();
    return s || null;
  }

  private pickRaw(row: Record<string, unknown>, ...keys: string[]): unknown {
    for (const k of keys) {
      if (k in row) return row[k];
    }
    return undefined;
  }
}
