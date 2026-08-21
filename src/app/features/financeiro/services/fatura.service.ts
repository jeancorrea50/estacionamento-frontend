import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import {
  mapFechamentoItemToLista,
  mapInadimplenteItemToLista,
  mapOutputToListaItem,
  mapRawFechamentosOutput,
  mapRawInadimplentesOutput,
  mapRawOutput,
  mapRawRecebimentosOutput,
  mapRawSearchItem,
  mapRawVisaoGeral,
  mapRecebimentoItemToLista,
  mapSearchToListaItem,
  pickNumber,
  unwrapResult
} from '../mappers/fatura.mapper';
import type {
  FaturaFechamentosFilter,
  FaturaFechamentosOutput,
  FaturaFilter,
  FaturaInadimplentesFilter,
  FaturaInadimplentesOutput,
  FaturaOutput,
  FaturaPagedResult,
  FaturaPostInput,
  FaturaPutInput,
  FaturaRecebimentosFilter,
  FaturaRecebimentosOutput,
  FaturaSearchOutput,
  FaturaVisaoGeralOutput
} from '../models/fatura.models';
import type { FaturaListaItem } from '../pages/faturamento-page/faturas/faturamento-faturas.types';
import type {
  FechamentoListaItem,
  FechamentoResumo
} from '../pages/faturamento-page/fechamentos/faturamento-fechamentos.types';
import type {
  InadimplenciaListaItem,
  InadimplenciaResumo
} from '../pages/faturamento-page/inadimplencia/faturamento-inadimplencia.types';
import type {
  RecebimentoListaItem,
  RecebimentoResumo
} from '../pages/faturamento-page/recebimentos/faturamento-recebimentos.types';

const API = `${environment.API_BASE_URL}/financeiro/Fatura`;

@Injectable({ providedIn: 'root' })
export class FaturaService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** GET `/api/financeiro/Fatura` */
  buscar(filtro: FaturaFilter): Observable<FaturaPagedResult> {
    return this.http
      .get<unknown>(API, { params: this.buildBuscarParams(filtro) })
      .pipe(map((body) => this.normalizePagedResult(body, filtro.numeroPagina, filtro.tamanhoPagina)));
  }

  listar(filtro: FaturaFilter): Observable<{
    items: FaturaListaItem[];
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

  /** GET `/api/financeiro/Fatura/{id}` */
  obterPorId(id: number): Observable<FaturaOutput | null> {
    return this.http.get<unknown>(`${API}/${id}`).pipe(
      map((body) => {
        const raw = this.extractRecord(body);
        if (!raw) return null;
        return mapRawOutput(raw, id);
      })
    );
  }

  obterListaItemPorId(id: number): Observable<FaturaListaItem | null> {
    return this.obterPorId(id).pipe(map((dto) => (dto ? mapOutputToListaItem(dto) : null)));
  }

  /** POST `/api/financeiro/Fatura` */
  gravar(input: FaturaPostInput): Observable<FaturaListaItem | null> {
    return this.http.post<unknown>(API, input).pipe(map((body) => this.mapMutationBody(body)));
  }

  /** PUT `/api/financeiro/Fatura` */
  alterar(input: FaturaPutInput): Observable<FaturaListaItem | null> {
    return this.http.put<unknown>(API, input).pipe(map((body) => this.mapMutationBody(body, input.id)));
  }

  /** DELETE `/api/financeiro/Fatura/{id}` */
  excluir(id: number): Observable<void> {
    return this.http.delete<unknown>(`${API}/${id}`).pipe(map(() => undefined));
  }

  /** GET `/api/financeiro/Fatura/{id}/report` — PDF blob. */
  baixarPdf(id: number): Observable<Blob> {
    return this.http.get(`${API}/${id}/report`, { responseType: 'blob' });
  }

  /** GET `/api/financeiro/Fatura/{id}/excel` — planilha Excel blob. */
  baixarExcel(id: number): Observable<Blob> {
    return this.http.get(`${API}/${id}/excel`, { responseType: 'blob' });
  }

  /** GET `/api/financeiro/Fatura/visao-geral` — cards e gráficos da Visão Geral. */
  obterVisaoGeral(filtro: Omit<FaturaFilter, 'numeroPagina' | 'tamanhoPagina'> = {}): Observable<FaturaVisaoGeralOutput> {
    return this.http
      .get<unknown>(`${API}/visao-geral`, {
        params: this.buildBuscarParams({ ...filtro, numeroPagina: 1, tamanhoPagina: 1 })
      })
      .pipe(map((body) => mapRawVisaoGeral(body)));
  }

  /** GET `/api/financeiro/Fatura/inadimplentes` — lista + resumo do dashboard. */
  buscarInadimplentes(filtro: FaturaInadimplentesFilter): Observable<FaturaInadimplentesOutput> {
    return this.http
      .get<unknown>(`${API}/inadimplentes`, { params: this.buildInadimplentesParams(filtro) })
      .pipe(map((body) => mapRawInadimplentesOutput(body, filtro.numeroPagina, filtro.tamanhoPagina)));
  }

  listarInadimplentes(filtro: FaturaInadimplentesFilter): Observable<{
    resumo: InadimplenciaResumo;
    items: InadimplenciaListaItem[];
    totalCount: number;
    numeroPagina: number;
    tamanhoPagina: number;
  }> {
    return this.buscarInadimplentes(filtro).pipe(
      map((page) => ({
        resumo: page.resumo,
        items: page.itens.items.map((dto) => mapInadimplenteItemToLista(dto)),
        totalCount: page.itens.totalCount,
        numeroPagina: page.itens.numeroPagina,
        tamanhoPagina: page.itens.tamanhoPagina
      }))
    );
  }

  /** GET `/api/financeiro/Fatura/recebimentos` — lista + resumo do dashboard. */
  buscarRecebimentos(filtro: FaturaRecebimentosFilter): Observable<FaturaRecebimentosOutput> {
    return this.http
      .get<unknown>(`${API}/recebimentos`, { params: this.buildRecebimentosParams(filtro) })
      .pipe(map((body) => mapRawRecebimentosOutput(body, filtro.numeroPagina, filtro.tamanhoPagina)));
  }

  listarRecebimentos(filtro: FaturaRecebimentosFilter): Observable<{
    resumo: RecebimentoResumo;
    items: RecebimentoListaItem[];
    totalCount: number;
    numeroPagina: number;
    tamanhoPagina: number;
  }> {
    return this.buscarRecebimentos(filtro).pipe(
      map((page) => ({
        resumo: page.resumo,
        items: page.itens.items.map((dto) => mapRecebimentoItemToLista(dto)),
        totalCount: page.itens.totalCount,
        numeroPagina: page.itens.numeroPagina,
        tamanhoPagina: page.itens.tamanhoPagina
      }))
    );
  }

  /** GET `/api/financeiro/Fatura/fechamentos` — lista + resumo do dashboard. */
  buscarFechamentos(filtro: FaturaFechamentosFilter): Observable<FaturaFechamentosOutput> {
    return this.http
      .get<unknown>(`${API}/fechamentos`, { params: this.buildFechamentosParams(filtro) })
      .pipe(map((body) => mapRawFechamentosOutput(body, filtro.numeroPagina, filtro.tamanhoPagina)));
  }

  listarFechamentos(filtro: FaturaFechamentosFilter): Observable<{
    resumo: FechamentoResumo;
    items: FechamentoListaItem[];
    totalCount: number;
    numeroPagina: number;
    tamanhoPagina: number;
  }> {
    return this.buscarFechamentos(filtro).pipe(
      map((page) => {
        const estacionamentoId = this.auth.resolveEstacionamentoId();
        return {
          resumo: page.resumo,
          items: page.itens.items.map((dto) => mapFechamentoItemToLista(dto, estacionamentoId)),
          totalCount: page.itens.totalCount,
          numeroPagina: page.itens.numeroPagina,
          tamanhoPagina: page.itens.tamanhoPagina
        };
      })
    );
  }

  private buildBuscarParams(filtro: FaturaFilter): HttpParams {
    let params = new HttpParams()
      .set('NumeroPagina', String(filtro.numeroPagina))
      .set('TamanhoPagina', String(filtro.tamanhoPagina));

    if (filtro.descricao?.trim()) params = params.set('Descricao', filtro.descricao.trim());
    if (filtro.numero?.trim()) params = params.set('Numero', filtro.numero.trim());
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
    if (typeof filtro.modalidadeRecebimento === 'number') {
      params = params.set('ModalidadeRecebimento', String(filtro.modalidadeRecebimento));
    }
    if (filtro.propriedade?.trim()) params = params.set('Propriedade', filtro.propriedade.trim());
    if (filtro.sort?.trim()) params = params.set('Sort', filtro.sort.trim());
    return params;
  }

  private buildInadimplentesParams(filtro: FaturaInadimplentesFilter): HttpParams {
    let params = new HttpParams()
      .set('NumeroPagina', String(filtro.numeroPagina))
      .set('TamanhoPagina', String(filtro.tamanhoPagina));

    if (typeof filtro.transportadoraId === 'number' && filtro.transportadoraId > 0) {
      params = params.set('TransportadoraId', String(filtro.transportadoraId));
    }
    if (filtro.numero?.trim()) params = params.set('Numero', filtro.numero.trim());
    if (filtro.descricao?.trim()) params = params.set('Descricao', filtro.descricao.trim());
    if (filtro.dataInicial) params = params.set('DataInicial', filtro.dataInicial);
    if (filtro.dataFinal) params = params.set('DataFinal', filtro.dataFinal);
    if (filtro.propriedade?.trim()) params = params.set('Propriedade', filtro.propriedade.trim());
    if (filtro.sort?.trim()) params = params.set('Sort', filtro.sort.trim());
    return params;
  }

  private buildRecebimentosParams(filtro: FaturaRecebimentosFilter): HttpParams {
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

  private buildFechamentosParams(filtro: FaturaFechamentosFilter): HttpParams {
    let params = new HttpParams()
      .set('NumeroPagina', String(filtro.numeroPagina))
      .set('TamanhoPagina', String(filtro.tamanhoPagina));

    if (typeof filtro.transportadoraId === 'number' && filtro.transportadoraId > 0) {
      params = params.set('TransportadoraId', String(filtro.transportadoraId));
    }
    if (typeof filtro.situacao === 'number') {
      params = params.set('Situacao', String(filtro.situacao));
    }
    if (typeof filtro.modalidade === 'number') {
      params = params.set('Modalidade', String(filtro.modalidade));
    }
    if (filtro.descricao?.trim()) params = params.set('Descricao', filtro.descricao.trim());
    if (filtro.dataInicial) params = params.set('DataInicial', filtro.dataInicial);
    if (filtro.dataFinal) params = params.set('DataFinal', filtro.dataFinal);
    if (filtro.propriedade?.trim()) params = params.set('Propriedade', filtro.propriedade.trim());
    if (filtro.sort?.trim()) params = params.set('Sort', filtro.sort.trim());
    return params;
  }

  private normalizePagedResult(
    body: unknown,
    numeroPagina: number,
    tamanhoPagina: number
  ): FaturaPagedResult {
    const source = unwrapResult(body);
    const root = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
    const rows =
      (Array.isArray(root['results']) && root['results']) ||
      (Array.isArray(root['Results']) && root['Results']) ||
      (Array.isArray(root['items']) && root['items']) ||
      (Array.isArray(source) && source) ||
      [];

    const items: FaturaSearchOutput[] = (rows as unknown[])
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

  private mapMutationBody(body: unknown, fallbackId = 0): FaturaListaItem | null {
    const raw = unwrapResult(body);
    if (raw == null || raw === true || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const record = raw as Record<string, unknown>;
    const hasIdentity =
      pickNumber(record, 'id', 'Id') > 0 ||
      pickNumber(record, 'transportadoraId', 'TransportadoraId') > 0 ||
      fallbackId > 0;
    if (!hasIdentity && !('numero' in record || 'Numero' in record)) {
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
