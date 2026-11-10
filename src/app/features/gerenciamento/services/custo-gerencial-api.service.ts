import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  CategoriaCusto,
  CentroCusto,
  CentroCustoInput,
  DashboardCusto,
  HistoricoLancamentoCusto,
  LancamentoCusto,
  LancamentoCustoInput,
  PagedLancamentos,
  TipoLancamentoCusto,
} from '../models/custo-gerencial.models';

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  result?: T;
}

@Injectable({ providedIn: 'root' })
export class CustoGerencialApiService {
  private readonly http = inject(HttpClient);
  /** BFF no estacionamento-api (consome gerenciamento internamente). */
  private readonly base = `${environment.API_BASE_URL}/gerenciamento/Custo`;

  listarCategorias(): Observable<CategoriaCusto[]> {
    return this.http
      .get<ApiEnvelope<CategoriaCusto[]>>(`${this.base}/categorias`)
      .pipe(map((r) => r.result ?? []));
  }

  listarCentros(incluirInativos = false): Observable<CentroCusto[]> {
    let params = new HttpParams();
    if (incluirInativos) params = params.set('incluirInativos', 'true');
    return this.http
      .get<ApiEnvelope<CentroCusto[]>>(`${this.base}/centros`, { params })
      .pipe(map((r) => r.result ?? []));
  }

  criarCentro(input: CentroCustoInput): Observable<CentroCusto> {
    return this.http
      .post<ApiEnvelope<CentroCusto>>(`${this.base}/centros`, input)
      .pipe(map((r) => r.result as CentroCusto));
  }

  alterarCentro(id: number, input: CentroCustoInput): Observable<CentroCusto> {
    return this.http
      .put<ApiEnvelope<CentroCusto>>(`${this.base}/centros/${id}`, input)
      .pipe(map((r) => r.result as CentroCusto));
  }

  excluirCentro(id: number): Observable<void> {
    return this.http.delete<ApiEnvelope<object>>(`${this.base}/centros/${id}`).pipe(map(() => undefined));
  }

  buscarLancamentos(params: {
    termo?: string;
    tipo?: TipoLancamentoCusto | null;
    categoriaId?: number | null;
    centroCustoId?: number | null;
    periodoInicio?: string | null;
    periodoFim?: string | null;
    incluirInativos?: boolean;
    somenteInativos?: boolean;
    numeroPagina?: number;
    tamanhoPagina?: number;
  }): Observable<PagedLancamentos> {
    let httpParams = new HttpParams()
      .set('numeroPagina', String(params.numeroPagina ?? 1))
      .set('tamanhoPagina', String(params.tamanhoPagina ?? 25));
    if (params.termo?.trim()) httpParams = httpParams.set('termo', params.termo.trim());
    if (params.tipo != null) httpParams = httpParams.set('tipo', String(params.tipo));
    if (params.categoriaId != null && params.categoriaId > 0) {
      httpParams = httpParams.set('categoriaId', String(params.categoriaId));
    }
    if (params.centroCustoId != null && params.centroCustoId > 0) {
      httpParams = httpParams.set('centroCustoId', String(params.centroCustoId));
    }
    if (params.periodoInicio) httpParams = httpParams.set('periodoInicio', params.periodoInicio);
    if (params.periodoFim) httpParams = httpParams.set('periodoFim', params.periodoFim);
    if (params.somenteInativos) {
      httpParams = httpParams.set('somenteInativos', 'true');
    } else if (params.incluirInativos === false) {
      httpParams = httpParams.set('incluirInativos', 'false');
    }

    return this.http
      .get<ApiEnvelope<PagedLancamentos>>(`${this.base}/lancamentos`, { params: httpParams })
      .pipe(
        map((r) => {
          const page =
            r.result ?? {
              results: [],
              currentPage: 1,
              pageCount: 1,
              pageSize: 25,
              rowCount: 0,
            };
          return {
            ...page,
            results: (page.results ?? []).map((item) => ({
              ...item,
              recorrencia: (item.recorrencia || 1) as LancamentoCusto['recorrencia'],
              recorrenciaLabel: item.recorrenciaLabel || 'Única (dia)',
              financiadorNome: item.financiadorNome || 'Gt Sistema',
              formaPagamento: (item.formaPagamento || 1) as LancamentoCusto['formaPagamento'],
              formaPagamentoLabel: item.formaPagamentoLabel || 'Pix',
              parcelas: item.parcelas ?? null,
            })),
          };
        })
      );
  }

  historico(id: number): Observable<HistoricoLancamentoCusto[]> {
    return this.http
      .get<ApiEnvelope<HistoricoLancamentoCusto[]>>(`${this.base}/lancamentos/${id}/historico`)
      .pipe(map((r) => r.result ?? []));
  }

  criar(input: LancamentoCustoInput): Observable<LancamentoCusto> {
    return this.http
      .post<ApiEnvelope<LancamentoCusto>>(`${this.base}/lancamentos`, input)
      .pipe(map((r) => r.result as LancamentoCusto));
  }

  alterar(id: number, input: LancamentoCustoInput): Observable<LancamentoCusto> {
    return this.http
      .put<ApiEnvelope<LancamentoCusto>>(`${this.base}/lancamentos/${id}`, input)
      .pipe(map((r) => r.result as LancamentoCusto));
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<ApiEnvelope<object>>(`${this.base}/lancamentos/${id}`).pipe(map(() => undefined));
  }

  dashboard(
    ano: number,
    tipo?: TipoLancamentoCusto | null,
    centroCustoId?: number | null
  ): Observable<DashboardCusto> {
    let params = new HttpParams().set('ano', String(ano));
    if (tipo != null) params = params.set('tipo', String(tipo));
    if (centroCustoId != null && centroCustoId > 0) {
      params = params.set('centroCustoId', String(centroCustoId));
    }
    return this.http
      .get<ApiEnvelope<DashboardCusto>>(`${this.base}/dashboard`, { params })
      .pipe(map((r) => r.result as DashboardCusto));
  }
}
