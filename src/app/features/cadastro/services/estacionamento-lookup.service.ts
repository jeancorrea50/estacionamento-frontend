import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, timeout, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EstacionamentoPaths } from '../constants/estacionamento-api.paths';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionCacheService } from '../../../core/services/permission-cache.service';

const API_BASE = environment.API_BASE_URL;
const Estacionamento = `${API_BASE}/Estacionamento`;

/** Opção para select/autocomplete (lookup). */
export interface LookupOption {
  id: number;
  label: string;
  cnpj: string;
  /** Nome / razão social sem CNPJ concatenado (compatível com selects legados). */
  nome?: string | null;
  /** Nome fantasia (endpoint: nomeFantasia / descricaoPessoa). */
  fantasia?: string | null;
  /** Razão social (endpoint: nomeRazaoSocial). */
  razaoSocial?: string | null;
  codExportacao?: string | null;
}

export interface EstacionamentoListOptions {
  /** Força GET na API (ex.: modal Admin), mesmo sem claim na sessão. */
  forceApi?: boolean;
}

/**
 * Lookup de Estacionamentos para formulários/filtros.
 * - Com claim `estacionamentos.visualizar` (ou Admin / forceApi): GET /api/Estacionamento
 * - Sem essa claim, mas com EmpresaId na sessão: devolve só o estacionamento do login/sessão
 */
@Injectable({ providedIn: 'root' })
export class EstacionamentoLookupService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly permissions = inject(PermissionCacheService);

  list(options?: EstacionamentoListOptions): Observable<LookupOption[]> {
    if (!options?.forceApi) {
      const fromSession = this.trySessionOnlyOption();
      if (fromSession) {
        return of([fromSession]);
      }
    }

    const params = new URLSearchParams();
    params.set('NumeroPagina', '1');
    params.set('TamanhoPagina', '200');
    const listUrl = EstacionamentoPaths.buscar
      ? `${Estacionamento}/${EstacionamentoPaths.buscar}`
      : Estacionamento;
    const url = `${listUrl}?${params.toString()}`;
    return this.http.get<unknown>(url).pipe(
      timeout(15000),
      map((body) => this.normalizeToOptions(body))
    );
  }

  search(term: string): Observable<LookupOption[]> {
    const t = (term ?? '').trim();
    if (!t) {
      return of([]);
    }

    const fromSession = this.trySessionOnlyOption();
    if (fromSession) {
      const hay = `${fromSession.label} ${fromSession.fantasia ?? ''} ${fromSession.razaoSocial ?? ''} ${fromSession.nome ?? ''} ${fromSession.id} ${fromSession.cnpj} ${fromSession.codExportacao ?? ''}`.toLowerCase();
      return of(hay.includes(t.toLowerCase()) ? [fromSession] : []);
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

  private trySessionOnlyOption(): LookupOption | null {
    if (this.auth.isAdmin() || this.permissions.has('estacionamentos.visualizar')) {
      return null;
    }

    const id = this.auth.resolveEstacionamentoId();
    if (id == null || id <= 0) {
      return null;
    }

    const session = this.auth.getSessionEstacionamento();
    const label =
      session?.nome?.trim() ||
      (this.auth.isEstacionamentoRole() ? 'Meu estacionamento' : `Estacionamento #${id}`);

    return {
      id,
      nome: label,
      fantasia: label,
      razaoSocial: null,
      label,
      cnpj: '',
      codExportacao: session?.codExportacao ?? this.auth.resolveCodExportacao(),
    };
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
    const id = Number(row['id'] ?? row['Id']) || 0;
    const fantasia = String(
      row['nomeFantasia'] ??
        row['NomeFantasia'] ??
        row['descricaoPessoa'] ??
        row['DescricaoPessoa'] ??
        row['fantasia'] ??
        row['Fantasia'] ??
        row['descricao'] ??
        row['Descricao'] ??
        ''
    ).trim();
    const razaoSocial = String(
      row['nomeRazaoSocial'] ?? row['NomeRazaoSocial'] ?? row['razaoSocial'] ?? row['RazaoSocial'] ?? ''
    ).trim();
    const nomePrincipal = fantasia || razaoSocial;
    const cnpj = String(row['cnpj'] ?? row['Cnpj'] ?? row['documento'] ?? '').trim();
    const codExportacao = String(row['codExportacao'] ?? row['CodExportacao'] ?? '').trim() || null;
    return {
      id,
      nome: nomePrincipal || null,
      fantasia: fantasia || null,
      razaoSocial: razaoSocial || null,
      label: nomePrincipal ? `${nomePrincipal} — ${cnpj || '-'}` : String(id),
      cnpj,
      codExportacao,
    };
  }
}
