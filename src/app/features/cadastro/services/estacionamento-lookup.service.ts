import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, timeout, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EstacionamentoPaths } from '../constants/estacionamento-api.paths';

const API_BASE = environment.API_BASE_URL;
const Estacionamento = `${API_BASE}/Estacionamento`;

/** Opção para select/autocomplete (lookup). */
export interface LookupOption {
  id: number;
  label: string;
  cnpj: string;
}

/**
 * Lookup de Estacionamentos para formulários (ex.: usuário com perfil Estacionamento).
 * GET /api/Estacionamento?Descricao=...
 */
@Injectable({ providedIn: 'root' })
export class EstacionamentoLookupService {
  constructor(private http: HttpClient) {}

  /**
   * Lista Estacionamentos (primeira página) para combobox/listagem.
   * GET /api/Estacionamento?NumeroPagina=1&TamanhoPagina=100
   */
  list(): Observable<LookupOption[]> {
    const params = new URLSearchParams();
    params.set('NumeroPagina', '1');
    params.set('TamanhoPagina', '100');
    const listUrl = EstacionamentoPaths.buscar
      ? `${Estacionamento}/${EstacionamentoPaths.buscar}`
      : Estacionamento;
    const url = `${listUrl}?${params.toString()}`;
    return this.http.get<unknown>(url).pipe(
      timeout(15000),
      map((body) => this.normalizeToOptions(body))
    );
  }

  /**
   * Busca Estacionamentos por Descricao (Razão Social / texto).
   * GET /api/Estacionamento?Descricao=term&NumeroPagina=1&TamanhoPagina=20
   */
  search(term: string): Observable<LookupOption[]> {
    const t = (term ?? '').trim();
    if (!t) {
      return of([]);
    }
    const params = new URLSearchParams();
    params.set('Descricao', t);
    params.set('NumeroPagina', '1');
    params.set('TamanhoPagina', '20');
    const listUrl = EstacionamentoPaths.buscar
      ? `${Estacionamento}/${EstacionamentoPaths.buscar}`
      : Estacionamento;
    const url = `${listUrl}?${params.toString()}`;
    return this.http.get<unknown>(url).pipe(
      timeout(15000),
      map((body) => this.normalizeToOptions(body))
    );
  }

  private normalizeToOptions(body: unknown): LookupOption[] {
    const items = this.extractItems(body);
    return items.map((row) => this.itemToOption(row));
  }

  private extractItems(body: unknown): Record<string, unknown>[] {
    if (Array.isArray(body)) {
      return body as Record<string, unknown>[];
    }
    if (body && typeof body === 'object' && 'result' in body) {
      const r = (body as { result?: unknown }).result;
      if (r && typeof r === 'object' && 'results' in r) {
        const arr = (r as { results?: unknown[] }).results;
        return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
      }
      if (Array.isArray(r)) return r as Record<string, unknown>[];
    }
    if (body && typeof body === 'object' && 'items' in body) {
      const arr = (body as { items?: unknown[] }).items;
      return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
    }
    return [];
  }

  private itemToOption(row: Record<string, unknown>): LookupOption {
    const id = Number(row['id']) || 0;
    const nomeRazao = String(row['nomeRazaoSocial'] ?? row['descricao'] ?? '');
    const cnpj = String(row['cnpj'] ?? row['documento'] ?? '');
    return {
      id,
      label: nomeRazao ? `${nomeRazao} — ${cnpj || '-'}` : String(id),
      cnpj,
    };
  }
}
