import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/**
 * Camada base de integração HTTP.
 * Todas as requisições usam API_BASE_URL e passam pelos interceptors (auth, error).
 *
 * Para tipar respostas/corpos com os tipos do backend, use os tipos gerados:
 * @example
 * import type { ApiSchemas } from '../generated';
   * this.api.get<ApiSchemas['AlgumDto']>('Estacionamento/1');
   * this.api.post<ApiSchemas['EstacionamentoPostInput']>('Estacionamento', body);
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.API_BASE_URL;

  constructor(private http: HttpClient) {}

  /**
   * GET request.
   * @param path Caminho relativo à base (ex.: 'Estacionamento' ou 'auth/Menu/Buscar').
   * @param params Query params opcionais.
   * @param T Use tipos de {@link ApiSchemas} ou {@link components} quando for resposta do backend.
   */
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Observable<T> {
    const httpParams = this.buildParams(params);
    const url = this.buildUrl(path);
    return this.http.get<T>(url, { params: httpParams });
  }

  /**
   * POST request.
   * @param T Use tipos de {@link ApiSchemas} para body/response do backend.
   */
  post<T>(path: string, body: unknown): Observable<T> {
    const url = this.buildUrl(path);
    return this.http.post<T>(url, body);
  }

  /**
   * PUT request.
   */
  put<T>(path: string, body: unknown): Observable<T> {
    const url = this.buildUrl(path);
    return this.http.put<T>(url, body);
  }

  /**
   * PATCH request.
   * @param T Use tipos de {@link ApiSchemas} para body/response do backend.
   */
  patch<T>(path: string, body: unknown): Observable<T> {
    const url = this.buildUrl(path);
    return this.http.patch<T>(url, body);
  }

  /**
   * DELETE request.
   * @param T Use tipos de {@link ApiSchemas} para response quando o backend retornar corpo.
   */
  delete<T>(path: string): Observable<T> {
    const url = this.buildUrl(path);
    return this.http.delete<T>(url);
  }

  private buildUrl(path: string): string {
    const trimmed = path.startsWith('/') ? path.slice(1) : path;
    const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    return `${base}/${trimmed}`;
  }

  private buildParams(params?: Record<string, string | number | boolean | undefined>): HttpParams | undefined {
    if (!params) return undefined;
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams.keys().length ? httpParams : undefined;
  }
}
