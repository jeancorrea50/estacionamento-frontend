import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';

const API_BASE = environment.API_BASE_URL;
const AUTH_PERMISSAO = `${API_BASE}/auth/Permissao`;

/** Permissão (Role) conforme ApplicationRole / PermissaoDto */
export interface ApplicationRole {
  id?: number | string;
  permissaoId?: number | string;
  /** @deprecated use permissaoId */
  perfilId?: number | string;
  permissao?: string | null;
  /** @deprecated use permissao / nome */
  perfil?: string | null;
  name?: string | null;
  nome?: string | null;
  normalizedName?: string | null;
  concurrencyStamp?: string | null;
  rolePermissions?: unknown[] | null;
  menus?: unknown[] | null;
  permissionIds?: string[];
  /** Quando ausente na API, a UI assume ativo para filtros/badge. */
  ativo?: boolean;
  /** Quantidade de usuários vinculados (quando o backend enviar). */
  usuariosVinculados?: number | null;
  /** ISO ou string retornada pela API para última atualização. */
  ultimaAtualizacao?: string | null;
}

export interface PermissaoPermissaoInput {
  permissaoId?: number;
  selecionado?: boolean;
}

export interface PermissaoSubModuloInput {
  subMenuId?: number;
  selecionado?: boolean;
  permissoes?: PermissaoPermissaoInput[] | null;
}

export interface PermissaoModuloInput {
  menuId?: number;
  selecionado?: boolean;
  subMenus?: PermissaoSubModuloInput[] | null;
}

export interface PermissaoUpsertInput {
  id?: number;
  permissaoId?: number;
  name?: string | null;
  nome?: string | null;
  menus?: PermissaoModuloInput[] | null;
}

/** Aliases legados — preferir tipos Permissao* */
export type PerfilPermissaoInput = PermissaoPermissaoInput;
export type PerfilSubModuloInput = PermissaoSubModuloInput;
export type PerfilModuloInput = PermissaoModuloInput;
export type PerfilUpsertInput = PermissaoUpsertInput;

/** Parâmetros opcionais para Buscar. */
export interface PermissaoBuscarParams {
  NumeroPagina?: number;
  TamanhoPagina?: number;
  Propriedade?: string;
  Sort?: string;
}

export type PerfilBuscarParams = PermissaoBuscarParams;

/**
 * Service para CRUD de Permissões (Roles).
 * GET/POST/PUT/DELETE /api/auth/Permissao
 * GET /api/auth/Permissao/{id}
 * GET /api/auth/Permissao/usuario/{usuarioId}
 * GET /api/auth/Permissao/usuario/buscarSimplicado
 */
@Injectable({
  providedIn: 'root'
})
export class AcessosPerfisService {
  constructor(private http: HttpClient) {}

  /** GET /api/auth/Permissao */
  buscar(params?: PermissaoBuscarParams): Observable<unknown> {
    const query = new URLSearchParams();
    if (params?.NumeroPagina != null) query.set('NumeroPagina', String(params.NumeroPagina));
    if (params?.TamanhoPagina != null) query.set('TamanhoPagina', String(params.TamanhoPagina));
    if (params?.Propriedade != null) query.set('Propriedade', params.Propriedade);
    if (params?.Sort != null) query.set('Sort', params.Sort);
    const qs = query.toString();
    const url = qs ? `${AUTH_PERMISSAO}?${qs}` : `${AUTH_PERMISSAO}`;
    return this.http.get<unknown>(url).pipe(timeout(15000));
  }

  /** GET /api/auth/Permissao/{id} */
  obterPorId(id: string | number): Observable<ApplicationRole> {
    return this.http.get<ApplicationRole>(`${AUTH_PERMISSAO}/${id}`).pipe(timeout(15000));
  }

  /** POST /api/auth/Permissao */
  gravar(dto: PermissaoUpsertInput): Observable<unknown> {
    return this.http.post<unknown>(`${AUTH_PERMISSAO}`, dto).pipe(timeout(15000));
  }

  /** PUT /api/auth/Permissao */
  alterar(dto: PermissaoUpsertInput): Observable<unknown> {
    return this.http.put<unknown>(`${AUTH_PERMISSAO}`, dto).pipe(timeout(15000));
  }

  /** DELETE /api/auth/Permissao/{id} */
  delete(id: string | number): Observable<void> {
    return this.http.delete<void>(`${AUTH_PERMISSAO}/${id}`).pipe(timeout(15000));
  }

  /** GET /api/auth/Permissao/usuario/{usuarioId} */
  buscarPorUsuario(usuarioId: string | number): Observable<unknown> {
    return this.http.get<unknown>(`${AUTH_PERMISSAO}/usuario/${usuarioId}`).pipe(timeout(15000));
  }

  /** GET /api/auth/Permissao/usuario/buscarSimplicado */
  buscarSimplicadoUsuario(): Observable<unknown> {
    return this.http.get<unknown>(`${AUTH_PERMISSAO}/usuario/buscarSimplicado`).pipe(timeout(15000));
  }
}
