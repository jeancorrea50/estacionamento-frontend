import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { unwrapServiceResult } from '../../../core/api/utils/service-result.util';
import {
  AgendamentoFiltro,
  AgendamentoPagedResult,
  AgendamentoPostInput,
  AgendamentoSearchItem,
  parseEntradaSaidaStatus,
} from '../models/agendamento.models';

@Injectable({ providedIn: 'root' })
export class AgendamentoService {
  private readonly apiRoot = `${environment.API_BASE_URL}/Agendamento`;
  private readonly http = inject(HttpClient);

  buscar(filtro: AgendamentoFiltro): Observable<AgendamentoPagedResult> {
    let params = new HttpParams()
      .set('NumeroPagina', String(filtro.numeroPagina || 1))
      .set('TamanhoPagina', String(filtro.tamanhoPagina || 20));

    if (filtro.placa?.trim()) params = params.set('Placa', filtro.placa.trim());
    if (filtro.dataInicial?.trim()) params = params.set('DataInicial', filtro.dataInicial.trim());
    if (filtro.dataFinal?.trim()) params = params.set('DataFinal', filtro.dataFinal.trim());
    if (typeof filtro.transportadoraId === 'number' && filtro.transportadoraId > 0) {
      params = params.set('TransportadoraId', String(filtro.transportadoraId));
    }

    return this.http.get<unknown>(this.apiRoot, { params }).pipe(
      map((body) => this.normalizePaged(body, filtro.numeroPagina, filtro.tamanhoPagina))
    );
  }

  gravar(input: AgendamentoPostInput): Observable<{ success: boolean; message?: string }> {
    return this.http.post<unknown>(this.apiRoot, input).pipe(
      map((body) => this.readSuccess(body, 'Agendamento criado.')),
      catchError((err: unknown) => of(this.readHttpFailure(err)))
    );
  }

  cancelar(id: number): Observable<{ success: boolean; message?: string }> {
    return this.http.patch<unknown>(`${this.apiRoot}/${id}/cancelar`, {}).pipe(
      map((body) => this.readSuccess(body, 'Agendamento cancelado.')),
      catchError((err: unknown) => of(this.readHttpFailure(err)))
    );
  }

  confirmarEntrada(id: number): Observable<{ success: boolean; message?: string }> {
    return this.http.patch<unknown>(`${this.apiRoot}/${id}/confirmar-entrada`, {}).pipe(
      map((body) => this.readSuccess(body, 'Entrada confirmada.')),
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

  private readSuccess(
    body: unknown,
    fallback: string
  ): { success: boolean; message?: string } {
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
      const message = String(b['message'] ?? b['Message'] ?? fallback).trim() || fallback;
      return { success: true, message };
    }
    return { success: true, message: fallback };
  }

  private readHttpFailure(err: unknown): { success: boolean; message?: string } {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = (err as { error?: unknown }).error;
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
