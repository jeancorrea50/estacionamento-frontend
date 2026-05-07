import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';

const API_BASE = environment.API_BASE_URL;
const AUTH_PERFIL = `${API_BASE}/auth/Perfil`;

/** Perfil (Role) conforme Swagger ApplicationRole */
export interface ApplicationRole {
  id?: number | string;
  perfilId?: number | string;
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

export interface PerfilPermissaoInput {
  permissaoId?: number;
  selecionado?: boolean;
}

export interface PerfilSubModuloInput {
  subMenuId?: number;
  selecionado?: boolean;
  permissoes?: PerfilPermissaoInput[] | null;
}

export interface PerfilModuloInput {
  menuId?: number;
  selecionado?: boolean;
  subMenus?: PerfilSubModuloInput[] | null;
}

export interface PerfilUpsertInput {
  id?: number;
  perfilId?: number;
  name?: string | null;
  nome?: string | null;
  menus?: PerfilModuloInput[] | null;
}

/** Parâmetros opcionais para Buscar (Swagger não detalha; seguindo padrão da API). */
export interface PerfilBuscarParams {
  NumeroPagina?: number;
  TamanhoPagina?: number;
  Propriedade?: string;
  Sort?: string;
}

/**
 * Service para CRUD de Perfis (Roles).
 * Endpoints reais:
 * GET /api/auth/Perfil
 * POST /api/auth/Perfil
 * PUT /api/auth/Perfil
 * GET /api/auth/Perfil/{id}
 * DELETE /api/auth/Perfil/{id}
 * GET /api/auth/Perfil/usuario/{usuarioId}

 * GET /api/auth/Perfil/usuario/buscarSimplicado

 * @see http://108.174.145.123:5000/swagger/v1/swagger.json (tag Perfil)
 */
@Injectable({
  providedIn: 'root'
})
export class AcessosPerfisService {
  constructor(private http: HttpClient) {}

  /** GET /api/auth/Perfil */
  buscar(params?: PerfilBuscarParams): Observable<unknown> {
    const query = new URLSearchParams();
    if (params?.NumeroPagina != null) query.set('NumeroPagina', String(params.NumeroPagina));
    if (params?.TamanhoPagina != null) query.set('TamanhoPagina', String(params.TamanhoPagina));
    if (params?.Propriedade != null) query.set('Propriedade', params.Propriedade);
    if (params?.Sort != null) query.set('Sort', params.Sort);
    const qs = query.toString();
    const url = qs ? `${AUTH_PERFIL}?${qs}` : `${AUTH_PERFIL}`;
    return this.http.get<unknown>(url).pipe(timeout(15000));
  }

  /** GET /api/auth/Perfil/{id} */
  obterPorId(id: string | number): Observable<ApplicationRole> {
    return this.http.get<ApplicationRole>(`${AUTH_PERFIL}/${id}`).pipe(timeout(15000));
  }

  /** POST /api/auth/Perfil */
  gravar(dto: PerfilUpsertInput): Observable<unknown> {
    return this.http.post<unknown>(`${AUTH_PERFIL}`, dto).pipe(timeout(15000));
  }

  /** PUT /api/auth/Perfil */
  alterar(dto: PerfilUpsertInput): Observable<unknown> {
    return this.http.put<unknown>(`${AUTH_PERFIL}`, dto).pipe(timeout(15000));
  }

  /** DELETE /api/auth/Perfil/{id} */
  delete(id: string | number): Observable<void> {
    return this.http.delete<void>(`${AUTH_PERFIL}/${id}`).pipe(timeout(15000));
  }

  /** GET /api/auth/Perfil/usuario/{usuarioId} */
  buscarPorUsuario(usuarioId: string | number): Observable<unknown> {
    return this.http.get<unknown>(`${AUTH_PERFIL}/usuario/${usuarioId}`).pipe(timeout(15000));
  }

  /** GET /api/auth/Perfil/usuario/buscarSimplicado */
  buscarSimplicadoUsuario(): Observable<unknown> {
    return this.http.get<unknown>(`${AUTH_PERFIL}/usuario/buscarSimplicado`).pipe(timeout(15000));
  }
}
