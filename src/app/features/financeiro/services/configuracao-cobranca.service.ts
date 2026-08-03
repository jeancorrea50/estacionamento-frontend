import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  ConfiguracaoCobrancaFilter,
  ConfiguracaoCobrancaOutput,
  ConfiguracaoCobrancaPagedResult,
  ConfiguracaoCobrancaPostInput,
  ConfiguracaoCobrancaPutInput,
  ConfiguracaoCobrancaSearchOutput,
  ValorEstacionamentoResponse
} from '../models/configuracao-cobranca.models';
import type { ConfigCobrancaListaItem } from '../pages/faturamento-page/config-cobranca/faturamento-config-cobranca.types';
import {
  mapOutputToListaItem,
  mapRawOutput,
  mapRawSearchItem,
  mapSearchToListaItem,
  pickNumber,
  pickNumberOrNull,
  unwrapResult
} from '../mappers/configuracao-cobranca.mapper';

const API = `${environment.API_BASE_URL}/financeiro/ConfiguracaoCobranca`;

@Injectable({ providedIn: 'root' })
export class ConfiguracaoCobrancaService {
  private readonly http = inject(HttpClient);

  /**
   * GET /api/financeiro/ConfiguracaoCobranca
   */
  buscar(filtro: ConfiguracaoCobrancaFilter): Observable<ConfiguracaoCobrancaPagedResult> {
    return this.http
      .get<unknown>(API, { params: this.buildBuscarParams(filtro) })
      .pipe(map((body) => this.normalizePagedResult(body, filtro.numeroPagina, filtro.tamanhoPagina)));
  }

  /**
   * Lista mapeada para a grid da tela.
   */
  listar(filtro: ConfiguracaoCobrancaFilter): Observable<{
    items: ConfigCobrancaListaItem[];
    totalCount: number;
    numeroPagina: number;
    tamanhoPagina: number;
  }> {
    return this.buscar(filtro).pipe(
      map((page) => ({
        ...page,
        items: page.items.map((dto) => mapSearchToListaItem(dto))
      }))
    );
  }

  /**
   * GET /api/financeiro/ConfiguracaoCobranca/{id}
   */
  obterPorId(id: number): Observable<ConfiguracaoCobrancaOutput | null> {
    return this.http.get<unknown>(`${API}/${id}`).pipe(
      map((body) => {
        const raw = this.extractRecord(body);
        if (!raw) return null;
        return mapRawOutput(raw, id);
      })
    );
  }

  obterListaItemPorId(id: number): Observable<ConfigCobrancaListaItem | null> {
    return this.obterPorId(id).pipe(map((dto) => (dto ? mapOutputToListaItem(dto) : null)));
  }

  /**
   * POST /api/financeiro/ConfiguracaoCobranca
   * Aceita envelope com entidade ou sucesso sem corpo (retorna null).
   */
  gravar(input: ConfiguracaoCobrancaPostInput): Observable<ConfigCobrancaListaItem | null> {
    const payload = { ...input, id: 0 };
    return this.http.post<unknown>(API, payload).pipe(map((body) => this.mapMutationBody(body)));
  }

  /**
   * PUT /api/financeiro/ConfiguracaoCobranca
   * Aceita envelope com entidade ou sucesso sem corpo (retorna null).
   */
  alterar(input: ConfiguracaoCobrancaPutInput): Observable<ConfigCobrancaListaItem | null> {
    return this.http.put<unknown>(API, input).pipe(map((body) => this.mapMutationBody(body, input.id)));
  }

  /**
   * DELETE /api/financeiro/ConfiguracaoCobranca/{id}
   */
  excluir(id: number): Observable<void> {
    return this.http.delete<unknown>(`${API}/${id}`).pipe(map(() => undefined));
  }

  /**
   * GET `/api/financeiro/ConfiguracaoCobranca/valor-estacionamento?transportadoraId=`
   * Pré-preenche valor do recibo na saída do veículo.
   */
  obterValorEstacionamento(transportadoraId: number): Observable<ValorEstacionamentoResponse> {
    const params = new HttpParams().set('transportadoraId', String(transportadoraId));
    return this.http.get<unknown>(`${API}/valor-estacionamento`, { params }).pipe(
      map((body) => {
        const raw = this.extractRecord(body) ?? {};
        return {
          transportadoraId: pickNumber(raw, 'transportadoraId', 'TransportadoraId') || transportadoraId,
          estacionamentoId: pickNumber(raw, 'estacionamentoId', 'EstacionamentoId'),
          configuracaoCobrancaId: pickNumberOrNull(raw, 'configuracaoCobrancaId', 'ConfiguracaoCobrancaId'),
          valorEstacionamento: pickNumberOrNull(raw, 'valorEstacionamento', 'ValorEstacionamento')
        };
      })
    );
  }

  private buildBuscarParams(filtro: ConfiguracaoCobrancaFilter): HttpParams {
    let params = new HttpParams()
      .set('NumeroPagina', String(filtro.numeroPagina))
      .set('TamanhoPagina', String(filtro.tamanhoPagina));

    if (filtro.descricao?.trim()) params = params.set('Descricao', filtro.descricao.trim());
    if (filtro.dataInicial) params = params.set('DataInicial', filtro.dataInicial);
    if (filtro.dataFinal) params = params.set('DataFinal', filtro.dataFinal);
    if (typeof filtro.transportadoraId === 'number' && filtro.transportadoraId > 0) {
      params = params.set('TransportadoraId', String(filtro.transportadoraId));
    }
    if (typeof filtro.estacionamentoId === 'number' && filtro.estacionamentoId > 0) {
      params = params.set('EstacionamentoId', String(filtro.estacionamentoId));
    }
    if (typeof filtro.status === 'number') {
      params = params.set('Status', String(filtro.status));
    }
    return params;
  }

  private normalizePagedResult(
    body: unknown,
    numeroPagina: number,
    tamanhoPagina: number
  ): ConfiguracaoCobrancaPagedResult {
    const source = unwrapResult(body);
    const root = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
    const rows =
      (Array.isArray(root['results']) && root['results']) ||
      (Array.isArray(root['Results']) && root['Results']) ||
      (Array.isArray(root['items']) && root['items']) ||
      (Array.isArray(source) && source) ||
      [];

    const items: ConfiguracaoCobrancaSearchOutput[] = (rows as unknown[])
      .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
      .map((row) => mapRawSearchItem(row));

    return {
      items,
      totalCount:
        Number(root['rowCount'] ?? root['RowCount'] ?? root['totalCount'] ?? items.length) ||
        items.length,
      numeroPagina:
        Number(root['currentPage'] ?? root['CurrentPage'] ?? root['numeroPagina'] ?? numeroPagina) ||
        numeroPagina,
      tamanhoPagina:
        Number(root['pageSize'] ?? root['PageSize'] ?? root['tamanhoPagina'] ?? tamanhoPagina) ||
        tamanhoPagina
    };
  }

  private mapMutationBody(body: unknown, fallbackId = 0): ConfigCobrancaListaItem | null {
    const raw = unwrapResult(body);
    if (raw == null || raw === true || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const record = raw as Record<string, unknown>;
    const hasIdentity =
      pickNumber(record, 'id', 'Id') > 0 ||
      pickNumber(record, 'transportadoraId', 'TransportadoraId') > 0 ||
      fallbackId > 0;
    if (!hasIdentity && !('emailFinanceiro' in record || 'EmailFinanceiro' in record)) {
      return null;
    }
    return mapOutputToListaItem(mapRawOutput(record, fallbackId));
  }

  private extractRecord(body: unknown): Record<string, unknown> | null {
    const raw = unwrapResult(body);
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw as Record<string, unknown>;
  }
}
