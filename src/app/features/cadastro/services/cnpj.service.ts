import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, isDevMode } from '@angular/core';
import { Observable, TimeoutError, catchError, finalize, map, of, shareReplay, timeout } from 'rxjs';
import { CnpjFormValue } from '../models/brasilapi-cnpj.model';
import { cnpjTem14Digitos, unmaskCnpj, validarCnpj } from '../utils/cnpj.utils';
import { CnpjBrasilApiService } from './cnpj-brasilapi.service';

export type CnpjLookupStatus =
  | 'success'
  | 'incomplete'
  | 'invalid'
  | 'not_found'
  | 'rate_limited'
  | 'service_unavailable'
  | 'timeout'
  | 'network_error'
  | 'error';

export interface CnpjLookupResult {
  status: CnpjLookupStatus;
  source: 'brasilapi';
  normalizedCnpj: string;
  message: string;
  data: CnpjFormValue | null;
  httpStatus?: number;
}

@Injectable({ providedIn: 'root' })
export class CnpjService {
  private readonly cache = new Map<string, CnpjLookupResult>();
  private readonly pending = new Map<string, Observable<CnpjLookupResult>>();

  constructor(private brasilApiService: CnpjBrasilApiService) {}

  normalizeCnpj(cnpj: string | null | undefined): string {
    return unmaskCnpj(cnpj);
  }

  isValidCnpj(cnpj: string | null | undefined): boolean {
    return validarCnpj(cnpj);
  }

  consultarCnpj(cnpj: string | null | undefined): Observable<CnpjLookupResult> {
    const normalizedCnpj = this.normalizeCnpj(cnpj);
    if (!cnpjTem14Digitos(normalizedCnpj)) {
      return of(this.buildResult('incomplete', normalizedCnpj));
    }
    if (!this.isValidCnpj(normalizedCnpj)) {
      return of(this.buildResult('invalid', normalizedCnpj));
    }

    const cached = this.cache.get(normalizedCnpj);
    if (cached) return of(cached);

    const inflight = this.pending.get(normalizedCnpj);
    if (inflight) return inflight;

    const request$ = this.queryPrimarySource(normalizedCnpj).pipe(
      timeout(10000),
      map((data) => {
        if (!data) {
          const result = this.buildResult('not_found', normalizedCnpj, { httpStatus: 404 });
          this.cache.set(normalizedCnpj, result);
          return result;
        }
        const result = this.buildResult('success', normalizedCnpj, { data });
        this.cache.set(normalizedCnpj, result);
        return result;
      }),
      catchError((error: unknown) => {
        const result = this.mapErrorToResult(normalizedCnpj, error);
        if (result.status !== 'network_error' && result.status !== 'timeout') {
          this.cache.set(normalizedCnpj, result);
        }
        if (isDevMode()) {
          // Log técnico somente em desenvolvimento para diagnosticar instabilidade da API externa.
          console.error('[CNPJ] Falha na consulta', { normalizedCnpj, error });
        }
        return of(result);
      }),
      finalize(() => this.pending.delete(normalizedCnpj)),
      shareReplay(1)
    );

    this.pending.set(normalizedCnpj, request$);
    return request$;
  }

  /**
   * Primeira fonte de consulta (BrasilAPI).
   * Mantido isolado para facilitar fallback futuro com segunda fonte sem impactar o componente.
   */
  private queryPrimarySource(normalizedCnpj: string): Observable<CnpjFormValue | null> {
    return this.brasilApiService.buscar(normalizedCnpj);
  }

  private mapErrorToResult(normalizedCnpj: string, error: unknown): CnpjLookupResult {
    if (error instanceof TimeoutError) {
      return this.buildResult('timeout', normalizedCnpj);
    }

    const httpError = error instanceof HttpErrorResponse ? error : null;
    const status = httpError?.status;

    if (status === 0) return this.buildResult('network_error', normalizedCnpj, { httpStatus: status });
    if (status === 400) return this.buildResult('invalid', normalizedCnpj, { httpStatus: status });
    if (status === 404) return this.buildResult('not_found', normalizedCnpj, { httpStatus: status });
    if (status === 429) return this.buildResult('rate_limited', normalizedCnpj, { httpStatus: status });
    if (status != null && [500, 502, 503, 504].includes(status)) {
      return this.buildResult('service_unavailable', normalizedCnpj, { httpStatus: status });
    }

    return this.buildResult('error', normalizedCnpj, { httpStatus: status });
  }

  private buildResult(
    status: CnpjLookupStatus,
    normalizedCnpj: string,
    options?: { data?: CnpjFormValue | null; httpStatus?: number }
  ): CnpjLookupResult {
    const defaultMessages: Record<CnpjLookupStatus, string> = {
      success: 'Dados carregados com sucesso.',
      incomplete: 'Informe um CNPJ com 14 dígitos para consultar.',
      invalid: 'CNPJ inválido. Verifique o número informado.',
      not_found: 'CNPJ não localizado na base consultada. Verifique os dados ou preencha manualmente.',
      rate_limited: 'Muitas consultas em sequência. Aguarde alguns segundos e tente novamente.',
      service_unavailable: 'Serviço de consulta de CNPJ temporariamente indisponível. Tente novamente.',
      timeout: 'Consulta demorou mais que o esperado. Tente novamente.',
      network_error: 'Falha de conexão ao consultar CNPJ. Verifique sua rede e tente novamente.',
      error: 'Não foi possível consultar os dados do CNPJ no momento.'
    };

    return {
      status,
      source: 'brasilapi',
      normalizedCnpj,
      message: defaultMessages[status],
      data: options?.data ?? null,
      httpStatus: options?.httpStatus
    };
  }
}
