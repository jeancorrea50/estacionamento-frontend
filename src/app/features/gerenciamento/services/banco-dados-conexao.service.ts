import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { mergeServiceResultToRoot } from '../../../core/api/utils/service-result.util';
import type {
  BancoDadosConexao,
  BancoDadosConexaoFormPayload,
  BancoDadosConexaoOpcoes,
  BancoDadosConexaoTestarResult,
  BancoDadosNomeSelect,
  EstacionamentoSelect,
  SelectItem,
} from '../models/banco-dados-conexao.models';

const API = `${environment.API_BASE_URL}/BancoDadosConexao`;

function peel<T>(body: unknown): T {
  if (body && typeof body === 'object') {
    const merged = mergeServiceResultToRoot(body as Record<string, unknown>);
    const r = merged['result'] ?? merged['Result'] ?? merged['data'] ?? merged['Data'] ?? merged;
    return r as T;
  }
  return body as T;
}

@Injectable({ providedIn: 'root' })
export class BancoDadosConexaoService {
  private readonly http = inject(HttpClient);

  listar(): Observable<BancoDadosConexao[]> {
    return this.http.get<unknown>(API).pipe(
      map((body) => {
        const raw = peel<unknown>(body);
        return Array.isArray(raw) ? (raw as BancoDadosConexao[]) : [];
      })
    );
  }

  obterPorId(id: number): Observable<BancoDadosConexao> {
    return this.http.get<unknown>(`${API}/${id}`).pipe(map((body) => peel<BancoDadosConexao>(body)));
  }

  listarOpcoes(): Observable<BancoDadosConexaoOpcoes> {
    return this.http.get<unknown>(`${API}/opcoes`).pipe(map((body) => peel<BancoDadosConexaoOpcoes>(body)));
  }

  listarHosts(): Observable<SelectItem[]> {
    return this.http.get<unknown>(`${API}/opcoes/hosts`).pipe(
      map((body) => {
        const raw = peel<unknown>(body);
        return Array.isArray(raw) ? (raw as SelectItem[]) : [];
      })
    );
  }

  listarBancos(host?: string | null): Observable<BancoDadosNomeSelect[]> {
    let params = new HttpParams();
    if (host?.trim()) params = params.set('host', host.trim());
    return this.http.get<unknown>(`${API}/opcoes/bancos`, { params }).pipe(
      map((body) => {
        const raw = peel<unknown>(body);
        return Array.isArray(raw) ? (raw as BancoDadosNomeSelect[]) : [];
      })
    );
  }

  listarEstacionamentos(): Observable<EstacionamentoSelect[]> {
    return this.http.get<unknown>(`${API}/opcoes/estacionamentos`).pipe(
      map((body) => {
        const raw = peel<unknown>(body);
        return Array.isArray(raw) ? (raw as EstacionamentoSelect[]) : [];
      })
    );
  }

  testar(payload: BancoDadosConexaoFormPayload & { id?: number }): Observable<BancoDadosConexaoTestarResult> {
    return this.http
      .post<unknown>(`${API}/testar`, payload)
      .pipe(map((body) => peel<BancoDadosConexaoTestarResult>(body)));
  }

  gravar(payload: BancoDadosConexaoFormPayload): Observable<BancoDadosConexao> {
    return this.http.post<unknown>(API, payload).pipe(map((body) => peel<BancoDadosConexao>(body)));
  }

  alterar(payload: BancoDadosConexaoFormPayload & { id: number }): Observable<BancoDadosConexao> {
    return this.http.put<unknown>(API, payload).pipe(map((body) => peel<BancoDadosConexao>(body)));
  }
}
