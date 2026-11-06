import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  CategoriaCusto,
  DashboardCusto,
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

  buscarLancamentos(params: {
    termo?: string;
    tipo?: TipoLancamentoCusto | null;
    categoriaId?: number | null;
    periodoInicio?: string | null;
    periodoFim?: string | null;
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
    if (params.periodoInicio) httpParams = httpParams.set('periodoInicio', params.periodoInicio);
    if (params.periodoFim) httpParams = httpParams.set('periodoFim', params.periodoFim);

    return this.http
      .get<ApiEnvelope<PagedLancamentos>>(`${this.base}/lancamentos`, { params: httpParams })
      .pipe(
        map(
          (r) =>
            r.result ?? {
              results: [],
              currentPage: 1,
              pageCount: 1,
              pageSize: 25,
              rowCount: 0,
            }
        )
      );
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

  dashboard(ano: number, tipo?: TipoLancamentoCusto | null): Observable<DashboardCusto> {
    let params = new HttpParams().set('ano', String(ano));
    if (tipo != null) params = params.set('tipo', String(tipo));
    return this.http
      .get<ApiEnvelope<DashboardCusto>>(`${this.base}/dashboard`, { params })
      .pipe(map((r) => r.result as DashboardCusto));
  }
}
