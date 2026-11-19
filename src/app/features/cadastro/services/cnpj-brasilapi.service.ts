import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { CnpjFormValue, mapCnpjResponseToFormValue } from '../models/brasilapi-cnpj.model';

/**
 * Consulta de CNPJ no cadastro de transportadora.
 * OBRIGATÓRIO: a consulta vai DIRETAMENTE para a BrasilAPI.
 * NUNCA usar: /api/Cnpj/Consultar, /api/..., localhost, environment.apiUrl, baseUrl ou proxy.
 */
@Injectable({
  providedIn: 'root'
})
export class CnpjBrasilApiService {
  constructor(private http: HttpClient) {}

  /**
   * Consulta dados do CNPJ diretamente na BrasilAPI.
   * URL usada: https://brasilapi.com.br/api/cnpj/v1/{cnpjLimpo}
   * Não usa backend, proxy nem rotas locais.
   */
  buscar(cnpj: string): Observable<CnpjFormValue | null> {
    const cnpjLimpo = (cnpj ?? '').replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      return of(null);
    }
    // URL absoluta fixa — não concatenar com environment, baseUrl nem api.
    const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`;
    return this.http.get<unknown>(url).pipe(
      map((body) => {
        if (body == null || typeof body !== 'object') return null;
        const r = body as Record<string, unknown>;
        const razao = r['razao_social'];
        const fantasia = r['nome_fantasia'];
        const situacao = r['descricao_situacao_cadastral'];
        if (razao == null && fantasia == null && situacao == null) return null;
        return mapCnpjResponseToFormValue(body);
      })
    );
  }
}
