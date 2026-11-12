import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  mapPagamentoItemToLista,
  mapRawPagamentoItem,
  mapRawPagamentosOutput
} from '../mappers/pagamento.mapper';
import type {
  PagamentoBuscarOutput,
  PagamentoFilter,
  PagamentoPostInput,
  PagamentoPutInput
} from '../models/pagamento.models';
import type {
  RecebimentoListaItem,
  RecebimentoResumo
} from '../pages/faturamento-page/recebimentos/faturamento-recebimentos.types';
import { unwrapResult } from '../mappers/configuracao-cobranca.mapper';

const API = `${environment.API_BASE_URL}/financeiro/pagamento`;

@Injectable({ providedIn: 'root' })
export class PagamentoService {
  private readonly http = inject(HttpClient);

  /** GET `/api/financeiro/pagamento` — lista + resumo do dashboard. */
  buscar(filtro: PagamentoFilter): Observable<PagamentoBuscarOutput> {
    return this.http
      .get<unknown>(API, { params: this.buildBuscarParams(filtro) })
      .pipe(map((body) => mapRawPagamentosOutput(body, filtro.numeroPagina, filtro.tamanhoPagina)));
  }

  listar(filtro: PagamentoFilter): Observable<{
    resumo: RecebimentoResumo;
    items: RecebimentoListaItem[];
    totalCount: number;
    numeroPagina: number;
    tamanhoPagina: number;
  }> {
    return this.buscar(filtro).pipe(
      map((page) => ({
        resumo: page.resumo,
        items: page.itens.items.map((dto) => mapPagamentoItemToLista(dto)),
        totalCount: page.itens.totalCount,
        numeroPagina: page.itens.numeroPagina,
        tamanhoPagina: page.itens.tamanhoPagina
      }))
    );
  }

  /** GET `/api/financeiro/pagamento/{id}` */
  obterPorId(id: number): Observable<RecebimentoListaItem | null> {
    return this.http.get<unknown>(`${API}/${id}`).pipe(
      map((body) => {
        const raw = unwrapResult(body);
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        return mapPagamentoItemToLista(mapRawPagamentoItem(raw as Record<string, unknown>));
      })
    );
  }

  /** POST `/api/financeiro/pagamento` */
  gravar(input: PagamentoPostInput): Observable<RecebimentoListaItem | null> {
    return this.http.post<unknown>(API, input).pipe(
      map((body) => {
        const raw = unwrapResult(body);
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        return mapPagamentoItemToLista(mapRawPagamentoItem(raw as Record<string, unknown>));
      })
    );
  }

  /** PUT `/api/financeiro/pagamento` */
  alterar(input: PagamentoPutInput): Observable<RecebimentoListaItem | null> {
    return this.http.put<unknown>(API, input).pipe(
      map((body) => {
        const raw = unwrapResult(body);
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        return mapPagamentoItemToLista(mapRawPagamentoItem(raw as Record<string, unknown>));
      })
    );
  }

  /** DELETE `/api/financeiro/pagamento/{id}` */
  excluir(id: number): Observable<void> {
    return this.http.delete<unknown>(`${API}/${id}`).pipe(map(() => undefined));
  }

  private buildBuscarParams(filtro: PagamentoFilter): HttpParams {
    let params = new HttpParams()
      .set('NumeroPagina', String(filtro.numeroPagina))
      .set('TamanhoPagina', String(filtro.tamanhoPagina));

    if (typeof filtro.transportadoraId === 'number' && filtro.transportadoraId > 0) {
      params = params.set('TransportadoraId', String(filtro.transportadoraId));
    }
    if (typeof filtro.status === 'number') {
      params = params.set('Status', String(filtro.status));
    }
    if (typeof filtro.formaPagamento === 'number') {
      params = params.set('FormaPagamento', String(filtro.formaPagamento));
    }
    if (filtro.numero?.trim()) params = params.set('Numero', filtro.numero.trim());
    if (filtro.descricao?.trim()) params = params.set('Descricao', filtro.descricao.trim());
    if (filtro.dataInicial) params = params.set('DataInicial', filtro.dataInicial);
    if (filtro.dataFinal) params = params.set('DataFinal', filtro.dataFinal);
    if (filtro.propriedade?.trim()) params = params.set('Propriedade', filtro.propriedade.trim());
    if (filtro.sort?.trim()) params = params.set('Sort', filtro.sort.trim());
    return params;
  }
}
