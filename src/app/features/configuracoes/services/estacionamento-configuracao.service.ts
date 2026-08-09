import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiError } from '../../../core/api/models';
import { throwIfServiceFailure } from '../../../core/api/utils/service-result.util';
import type {
  EstacionamentoConfiguracao,
  EstacionamentoConfiguracaoPadrao,
  EstacionamentoConfiguracaoPostInput,
  EstacionamentoConfiguracaoPutInput,
  TipoTarifaAvulsa
} from '../models/estacionamento-configuracao.models';

const API = `${environment.API_BASE_URL}/EstacionamentoConfiguracao`;
const TIME_ZONE_PADRAO = 'America/Sao_Paulo';

@Injectable({ providedIn: 'root' })
export class EstacionamentoConfiguracaoService {
  private readonly http = inject(HttpClient);

  /** GET `/api/EstacionamentoConfiguracao/padroes` — opções do dropdown. */
  listarPadroes(): Observable<EstacionamentoConfiguracaoPadrao[]> {
    return this.http.get<unknown>(`${API}/padroes`).pipe(
      map((body) => {
        const raw = this.unwrapPayload<unknown>(body);
        const list = Array.isArray(raw) ? raw : [];
        return list
          .map((item) => this.mapPadrao(item))
          .filter((p): p is EstacionamentoConfiguracaoPadrao => p != null);
      })
    );
  }

  /** GET `/api/EstacionamentoConfiguracao` — config atual (null se ainda não houver). */
  obterAtual(): Observable<EstacionamentoConfiguracao | null> {
    return this.http.get<unknown>(API).pipe(
      map((body) => {
        const raw = this.unwrapPayload<unknown>(body);
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        return this.mapConfig(raw as Record<string, unknown>);
      }),
      catchError((err: unknown) => {
        const status =
          err instanceof HttpErrorResponse
            ? err.status
            : err && typeof err === 'object' && 'status' in err
              ? Number((err as { status?: number }).status)
              : undefined;
        if (status === 404 || status === 204) {
          return of(null);
        }
        return throwError(() => this.toApiError(err, 'Falha ao carregar configuração de horário.'));
      })
    );
  }

  /** GET `/api/EstacionamentoConfiguracao/estacionamento/{id}` */
  obterPorEstacionamentoId(estacionamentoId: number): Observable<EstacionamentoConfiguracao | null> {
    if (!Number.isFinite(estacionamentoId) || estacionamentoId <= 0) {
      return of(null);
    }
    return this.http.get<unknown>(`${API}/estacionamento/${estacionamentoId}`).pipe(
      map((body) => {
        const raw = this.unwrapPayload<unknown>(body);
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        return this.mapConfig(raw as Record<string, unknown>);
      }),
      catchError((err: unknown) => {
        const status =
          err instanceof HttpErrorResponse
            ? err.status
            : err && typeof err === 'object' && 'status' in err
              ? Number((err as { status?: number }).status)
              : undefined;
        if (status === 404 || status === 204) {
          return of(null);
        }
        return throwError(() => this.toApiError(err, 'Falha ao carregar configuração do estacionamento.'));
      })
    );
  }

  /** POST `/api/EstacionamentoConfiguracao` */
  gravar(input: EstacionamentoConfiguracaoPostInput): Observable<EstacionamentoConfiguracao | null> {
    return this.http.post<unknown>(API, this.toRequestBody(input)).pipe(
      map((body) => this.mapMutation(body)),
      catchError((err: unknown) =>
        throwError(() => this.toApiError(err, 'Falha ao gravar configuração do estacionamento.'))
      )
    );
  }

  /** PUT `/api/EstacionamentoConfiguracao` */
  alterar(input: EstacionamentoConfiguracaoPutInput): Observable<EstacionamentoConfiguracao | null> {
    return this.http.put<unknown>(API, this.toRequestBody(input)).pipe(
      map((body) => this.mapMutation(body)),
      catchError((err: unknown) =>
        throwError(() => this.toApiError(err, 'Falha ao alterar configuração do estacionamento.'))
      )
    );
  }

  private toRequestBody(
    input: EstacionamentoConfiguracaoPostInput | EstacionamentoConfiguracaoPutInput
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      timeZoneId: String(input.timeZoneId ?? '').trim() || TIME_ZONE_PADRAO,
      tipoTarifaAvulsa: input.tipoTarifaAvulsa ?? null,
      valorAvulso: input.valorAvulso ?? null,
      minutosToleranciaPermanencia: input.minutosToleranciaPermanencia ?? null
    };
    if ('id' in input && input.id != null) {
      body['id'] = input.id;
    }
    if (input.estacionamentoId != null && input.estacionamentoId > 0) {
      body['estacionamentoId'] = input.estacionamentoId;
    }
    return body;
  }

  private mapMutation(body: unknown): EstacionamentoConfiguracao | null {
    if (body == null || body === '') return null;
    const raw = this.unwrapPayload<unknown>(body);
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return this.mapConfig(raw as Record<string, unknown>);
  }

  private unwrapPayload<T>(body: unknown): T {
    if (body != null && typeof body === 'object' && !Array.isArray(body)) {
      const b = body as Record<string, unknown>;
      const success = b['success'] ?? b['Success'] ?? b['sucess'] ?? b['Sucess'];
      if (success === false) {
        throwIfServiceFailure({ ...b, success: false });
      }
      const payload = b['data'] ?? b['Data'] ?? b['result'] ?? b['Result'];
      if (payload !== undefined) return payload as T;
    }
    throwIfServiceFailure(body);
    return body as T;
  }

  private mapPadrao(raw: unknown): EstacionamentoConfiguracaoPadrao | null {
    if (raw == null || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const timeZoneId = String(row['timeZoneId'] ?? row['TimeZoneId'] ?? '').trim();
    if (!timeZoneId) return null;
    return {
      timeZoneId,
      nome: String(row['nome'] ?? row['Nome'] ?? timeZoneId).trim() || timeZoneId,
      utcOffset: String(row['utcOffset'] ?? row['UtcOffset'] ?? '').trim()
    };
  }

  private mapConfig(row: Record<string, unknown>): EstacionamentoConfiguracao | null {
    const timeZoneId = String(row['timeZoneId'] ?? row['TimeZoneId'] ?? '').trim();
    if (!timeZoneId) return null;
    const id = Number(row['id'] ?? row['Id'] ?? 0);
    return {
      id: Number.isFinite(id) ? id : 0,
      estacionamentoId: Number(row['estacionamentoId'] ?? row['EstacionamentoId'] ?? 0) || 0,
      timeZoneId,
      nome: String(row['nome'] ?? row['Nome'] ?? timeZoneId).trim() || timeZoneId,
      utcOffset: String(row['utcOffset'] ?? row['UtcOffset'] ?? '').trim(),
      cultura: String(row['cultura'] ?? row['Cultura'] ?? 'pt-BR').trim() || 'pt-BR',
      ativo: row['ativo'] === true || row['Ativo'] === true,
      tipoTarifaAvulsa: this.mapTipoTarifa(row['tipoTarifaAvulsa'] ?? row['TipoTarifaAvulsa']),
      valorAvulso: this.mapDecimal(row['valorAvulso'] ?? row['ValorAvulso']),
      minutosToleranciaPermanencia: this.mapInt(
        row['minutosToleranciaPermanencia'] ?? row['MinutosToleranciaPermanencia']
      )
    };
  }

  private mapTipoTarifa(raw: unknown): TipoTarifaAvulsa | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    if (n === 1 || n === 2) return n;
    return null;
  }

  private mapDecimal(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  private mapInt(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }

  private toApiError(err: unknown, fallback: string): ApiError {
    if (err && typeof err === 'object' && 'message' in err) {
      const msg = (err as ApiError).message;
      if (typeof msg === 'string' && msg.trim()) {
        return { message: msg, status: (err as ApiError).status };
      }
    }
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object') {
        try {
          throwIfServiceFailure(body);
        } catch (e) {
          return e as ApiError;
        }
      }
      return { message: err.message || fallback, status: err.status };
    }
    return { message: fallback, status: undefined };
  }
}
