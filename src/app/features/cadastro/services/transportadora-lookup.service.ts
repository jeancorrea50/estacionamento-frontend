import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, timeout, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionCacheService } from '../../../core/services/permission-cache.service';

const API_BASE = environment.API_BASE_URL;
const TRANSPORTADORA = `${API_BASE}/Transportadora`;

/** Opção para select/autocomplete (lookup). */
export interface LookupOption {
  id: number;
  label: string;
  cnpj: string;
}

/**
 * Lookup de Transportadoras (GET /api/Transportadora?...).
 * Sem claim `transportadora.visualizar` (e não Admin), não chama a API (evita 403 em Faturamento).
 */
@Injectable({ providedIn: 'root' })
export class TransportadoraLookupService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionCacheService);

  /** GET /api/Transportadora?NumeroPagina=1&TamanhoPagina=100 */
  list(): Observable<LookupOption[]> {
    if (!this.canList()) {
      return of([]);
    }
    const params = new URLSearchParams();
    params.set('NumeroPagina', '1');
    params.set('TamanhoPagina', '100');
    const url = `${TRANSPORTADORA}?${params.toString()}`;
    return this.http.get<unknown>(url).pipe(
      timeout(15000),
      map((body) => this.normalizeToOptions(body))
    );
  }

  /** Busca por termo (usa Descricao no query string do OpenAPI). */
  search(term: string): Observable<LookupOption[]> {
    const t = (term ?? '').trim();
    if (!t) {
      return of([]);
    }
    if (!this.canList()) {
      return of([]);
    }
    const params = new URLSearchParams();
    const digits = t.replace(/\D/g, '');
    if (digits.length >= 8) {
      params.set('Cnpj', digits);
    } else {
      params.set('Descricao', t);
    }
    params.set('NumeroPagina', '1');
    params.set('TamanhoPagina', '20');
    const url = `${TRANSPORTADORA}?${params.toString()}`;
    return this.http.get<unknown>(url).pipe(
      timeout(15000),
      map((body) => this.normalizeToOptions(body))
    );
  }

  private canList(): boolean {
    return this.auth.isAdmin() || this.permissions.has('transportadora.visualizar');
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
    const nome = String(
      row['razaoSocial'] ?? row['nomeRazaoSocial'] ?? row['descricao'] ?? ''
    );
    const cnpj = String(row['cnpj'] ?? row['documento'] ?? '');
    return {
      id,
      label: nome ? `${nome} — ${cnpj || '-'}` : String(id),
      cnpj,
    };
  }
}
