import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { AUTH_TOKEN_STORAGE_KEY, normalizeBearerValue } from '../auth/auth-token.storage';
import {
  decodeJwtPayload,
  extractJwtPermissionKeys,
  getJwtStringClaim,
  validateJwtPayload,
} from '../auth/jwt.util';
import { LoggedUser } from './user.service';
import { PermissionCacheService } from './permission-cache.service';
import { SessionAccessService, SessionMenuAccess } from './session-access.service';
import { resolveExibirNoSidebar } from '../../features/gerenciamento/services/menu-sidebar-visibility';
import { environment } from '../../../environments/environment';
import { ApiError } from '../api/models';
import { mergeServiceResultToRoot, readLoginServiceFailure } from '../api/utils/service-result.util';
import { getLoginMenusAppRouteValidationMessage } from '../utils/login-menus-app-route.validator';

export interface LoginRequest {
  userName: string;
  password: string;
}

/** Resposta esperada do backend (ajustar conforme contrato real da API). */
export interface LoginResponse {
  /** Envelope comum na API GTS: `{ jwt: { token: "eyJ..." } }`. */
  jwt?: { token?: string; Token?: string; refreshToken?: unknown };
  Jwt?: { token?: string; Token?: string };
  /** JWT / apiKey na raiz — veja {@link extractTokenFromLoginBody}. */
  token?: string;
  usuario?: {
    userName?: string;
    nome?: string;
    perfil?: string;
    permissoes?: { acessoConfiguracoes?: boolean; verHome?: boolean };
  };
  [key: string]: unknown;
}

export type LoginResult = { success: true } | { success: false; message: string };

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly LOGGED_USER_KEY = 'loggedUser';
  private readonly TOKEN_KEY = AUTH_TOKEN_STORAGE_KEY;

  constructor(
    private http: HttpClient,
    private router: Router,
    private permissionCache: PermissionCacheService,
    private sessionAccess: SessionAccessService
  ) {}

  /**
   * Faz login via API (POST).
   * Retorna Observable com success e, em caso de erro, a mensagem da API.
   */
  login(username: string, password: string): Observable<LoginResult> {
    if (this.tryEmergencyAdminLogin(username, password)) {
      return of({ success: true });
    }

    const body: LoginRequest = {
      userName: username,
      password
    };

    const url = `${environment.API_BASE_URL}/auth/Usuario/Login`;
    return this.http.post<LoginResponse>(url, body).pipe(
      map((res): LoginResult => {
        if (res && typeof res === 'object') {
          const fail = readLoginServiceFailure(res);
          if (fail) {
            return fail;
          }
        }
        const merged =
          res && typeof res === 'object'
            ? (mergeServiceResultToRoot(res as Record<string, unknown>) as unknown as LoginResponse)
            : res;
        return this.buildSessionFromLoginResponse(username, merged);
      }),
      catchError((err: unknown) => {
        const message = this.getLoginErrorMessage(err);
        return of({ success: false, message });
      })
    );
  }

  private tryEmergencyAdminLogin(username: string, password: string): boolean {
    const emergency = environment.emergencyAdmin;
    if (environment.production || !emergency?.enabled) return false;
    if (username !== emergency.username || password !== emergency.password) return false;

    const permissionKeys = ['*'];
    const accessToken = this.buildEmergencyToken(username, permissionKeys);
    const loggedUser: LoggedUser = {
      username,
      perfil: 'Admin',
      permissionKeys,
      permissoes: {
        acessoConfiguracoes: true,
        verHome: true,
      },
    };

    localStorage.setItem(this.TOKEN_KEY, accessToken);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem(this.LOGGED_USER_KEY, JSON.stringify(loggedUser));
    sessionStorage.setItem('welcomeSeen', 'false');
    this.permissionCache.setKeys(permissionKeys);
    this.sessionAccess.clear();

    return true;
  }

  private buildEmergencyToken(username: string, permissionKeys: string[]): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = {
      unique_name: username,
      role: 'Admin',
      Permission: permissionKeys,
      exp: nowSec + 12 * 60 * 60,
      iat: nowSec,
      iss: 'gts-frontend-dev-local',
      aud: 'gts-frontend'
    };

    const header = this.toBase64Url({ alg: 'none', typ: 'JWT' });
    const body = this.toBase64Url(payload);
    return `${header}.${body}.`;
  }

  private toBase64Url(value: Record<string, unknown>): string {
    const json = JSON.stringify(value);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private getLoginErrorMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'message' in err && typeof (err as ApiError).message === 'string') {
      return (err as ApiError).message.trim();
    }
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object' && !(body instanceof ProgressEvent)) {
        const b = body as { notifications?: string[]; message?: string; title?: string };
        if (Array.isArray(b.notifications) && b.notifications.length > 0) {
          const text = b.notifications.filter((n): n is string => typeof n === 'string').join(' ').trim();
          if (text) return text;
        }
        const msg = b.message ?? b.title;
        if (typeof msg === 'string' && msg.trim()) return msg.trim();
      }
      if (typeof body === 'string' && body.trim()) return body.trim();
      const fallback: Record<number, string> = {
        401: 'Usuário ou senha inválidos.',
        400: 'Usuário ou senha inválido.',
        0: 'Sem conexão. Verifique sua rede.'
      };
      return fallback[err.status] ?? `Erro na requisição (${err.status ?? 0}).`;
    }
    return 'Usuário ou senha inválidos.';
  }

  /**
   * Token atual (Bearer) persistido após login — usado pelo interceptor em todas as chamadas HTTP ao backend.
   */
  getAccessToken(): string | null {
    try {
      const raw = localStorage.getItem(this.TOKEN_KEY);
      return raw?.trim() ? raw : null;
    } catch {
      return null;
    }
  }

  /**
   * Persiste token e perfil **somente** a partir do JWT (claims), com validação de exp/nbf.
   * Ignora `usuario` no corpo da API se o token estiver presente.
   */
  private buildSessionFromLoginResponse(username: string, res: LoginResponse): LoginResult {
    const token = extractTokenFromLoginBody(res);
    if (!token) {
      return { success: false, message: 'Login não retornou token. Não é possível continuar.' };
    }

    const normalized = normalizeBearerValue(token);
    const payload = decodeJwtPayload(normalized);
    if (!payload) {
      return { success: false, message: 'Token inválido ou ilegível.' };
    }

    const validation = validateJwtPayload(payload);
    if (!validation.valid) {
      return { success: false, message: validation.message ?? 'Token inválido.' };
    }

    const permissionKeys = extractJwtPermissionKeys(payload);
    this.permissionCache.setKeys(permissionKeys);
    const jwtRole = resolveJwtRole(payload);
    const menusFromLogin = extractMenusFromLoginBody(res, jwtRole);
    const rotaInvalidaMsg = getLoginMenusAppRouteValidationMessage(menusFromLogin);
    if (rotaInvalidaMsg) {
      this.permissionCache.clear();
      return { success: false, message: rotaInvalidaMsg };
    }
    this.sessionAccess.setMenus(menusFromLogin);
    if (this.sessionAccess.hasSessionMenus() && !this.sessionAccess.getDefaultRoute()) {
      this.permissionCache.clear();
      this.sessionAccess.clear();
      return {
        success: false,
        message: 'Usuário sem acesso às telas habilitadas para este sistema.'
      };
    }

    const loggedUser = buildLoggedUserFromJwtClaims(username, payload, permissionKeys);

    localStorage.setItem(this.TOKEN_KEY, normalized);
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem(this.LOGGED_USER_KEY, JSON.stringify(loggedUser));
    sessionStorage.setItem('welcomeSeen', 'false');

    return { success: true };
  }

  /**
   * Faz logout
   */
  logout(): void {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem(this.LOGGED_USER_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem('welcomeSeen');
    this.permissionCache.clear();
    this.sessionAccess.clear();
    this.router.navigate(['/']);
  }

  /**
   * Verifica se o usuário está logado
   */
  isLoggedIn(): boolean {
    return localStorage.getItem('isLoggedIn') === 'true';
  }

  /**
   * Obtém o usuário logado
   */
  getLoggedUser(): LoggedUser | null {
    const data = localStorage.getItem(this.LOGGED_USER_KEY);
    if (!data) return null;
    try {
      const u = JSON.parse(data) as LoggedUser;
      if (!Array.isArray(u.permissionKeys)) {
        u.permissionKeys = [];
      }
      return u;
    } catch {
      return null;
    }
  }

  /** True se o perfil da sessão é Admin (claim Role do JWT). */
  isAdmin(): boolean {
    const perfil = (this.getLoggedUser()?.perfil ?? '').trim().toLowerCase();
    return perfil === 'admin' || perfil === 'administrator' || perfil === 'adm';
  }

  /**
   * Verifica se a tela de boas-vindas já foi vista
   */
  hasSeenWelcome(): boolean {
    return sessionStorage.getItem('welcomeSeen') === 'true';
  }

  /**
   * Rota padrão da sessão logada com base no menu autorizado recebido no login.
   */
  getDefaultAuthorizedRoute(): string {
    const sessionRoute = this.sessionAccess.getDefaultRoute();
    if (sessionRoute) return sessionRoute;
    if (this.sessionAccess.hasSessionMenus()) return '/';
    return '/app/dashboard';
  }

  /**
   * Marcar tela de boas-vindas como vista
   */
  markWelcomeAsSeen(): void {
    sessionStorage.setItem('welcomeSeen', 'true');
  }
}

/** Chaves cujo valor é a string JWT (não confundir com o objeto `jwt: { token }`). */
const TOKEN_STRING_KEYS = [
  'token',
  'Token',
  'accessToken',
  'AccessToken',
  'access_token',
  'apiKey',
  'ApiKey',
  'bearerToken',
  'BearerToken',
];

/**
 * Extrai o token da resposta do POST Login.
 * Suporta formato `{ jwt: { token: "eyJ..." } }` (API GTS) e token na raiz.
 */
function extractTokenFromLoginBody(res: LoginResponse): string | null {
  const r = res as Record<string, unknown>;

  /** Envelope `jwt` / `Jwt` com `token` dentro. */
  for (const wrapperKey of ['jwt', 'Jwt']) {
    const wrapper = r[wrapperKey];
    if (wrapper && typeof wrapper === 'object' && !Array.isArray(wrapper)) {
      const w = wrapper as Record<string, unknown>;
      for (const tk of TOKEN_STRING_KEYS) {
        const tv = w[tk];
        if (typeof tv === 'string' && tv.trim()) return tv;
      }
    }
  }

  for (const key of TOKEN_STRING_KEYS) {
    const v = r[key];
    if (typeof v === 'string' && v.trim()) return v;
  }

  const nestedKeys = ['data', 'Data', 'result', 'Result', 'usuario', 'Usuario'];
  for (const nk of nestedKeys) {
    const inner = r[nk];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const nested = inner as Record<string, unknown>;
      for (const wk of ['jwt', 'Jwt']) {
        const wrapper = nested[wk];
        if (wrapper && typeof wrapper === 'object' && !Array.isArray(wrapper)) {
          const w = wrapper as Record<string, unknown>;
          for (const tk of TOKEN_STRING_KEYS) {
            const tv = w[tk];
            if (typeof tv === 'string' && tv.trim()) return tv;
          }
        }
      }
      for (const key of TOKEN_STRING_KEYS) {
        const v = nested[key];
        if (typeof v === 'string' && v.trim()) return v;
      }
    }
  }

  return null;
}

function buildLoggedUserFromJwtClaims(
  fallbackUsername: string,
  payload: Record<string, unknown>,
  permissionKeys: string[]
): LoggedUser {
  const uniqueName = getJwtStringClaim(payload, 'unique_name', 'uniqueName', 'preferred_username');
  const email = getJwtStringClaim(payload, 'email', 'Email');
  const nameId = getJwtStringClaim(payload, 'nameid', 'nameId', 'sub');
  const role = resolveJwtRole(payload);

  const displayName = uniqueName ?? fallbackUsername;
  const perfil = role ?? 'Operador';

  const roleLower = perfil.toLowerCase();
  const isAdmin = roleLower === 'admin' || roleLower === 'administrator';
  const hasConfigInPermissions = permissionKeys.some((k) => /config/i.test(k));

  return {
    username: displayName,
    perfil,
    permissionKeys,
    email: email ?? undefined,
    nameId: nameId ?? undefined,
    permissoes: {
      acessoConfiguracoes: isAdmin || hasConfigInPermissions,
      verHome: true,
    },
  };
}

function resolveJwtRole(payload: Record<string, unknown>): string | null {
  const claimRole =
    payload['role'] ??
    payload['Role'] ??
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
  if (typeof claimRole === 'string' && claimRole.trim()) {
    return claimRole.trim();
  }
  if (Array.isArray(claimRole) && claimRole.length > 0) {
    const first = claimRole[0];
    if (typeof first === 'string' && first.trim()) {
      return first.trim();
    }
  }
  return null;
}

function extractMenusFromLoginBody(res: LoginResponse, jwtRole?: string | null): SessionMenuAccess[] {
  const root = res as Record<string, unknown>;

  const candidates: unknown[] = [root['menus'], root['Menus']];
  const nestedKeys = ['result', 'Result', 'data', 'Data', 'usuario', 'Usuario'];
  for (const key of nestedKeys) {
    const value = root[key];
    const profileMenus = tryExtractProfileMenus(value, jwtRole);
    if (profileMenus) {
      candidates.unshift(profileMenus);
    }
    if (Array.isArray(value)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      candidates.push((value as Record<string, unknown>)['menus']);
      candidates.push((value as Record<string, unknown>)['Menus']);
    }
  }

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    return candidate
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((menu) => {
        const id = toNumber(menu['id'] ?? menu['menuId'] ?? menu['moduleId']) ?? 0;
        const rota = toStringValue(menu['rota']) ?? toStringValue(menu['route']);
        const fromApi = toBoolean(
          menu['exibirNoSidebar'] ?? menu['mostrarSidebar'] ?? menu['exibeSidebar'] ?? menu['sidebar']
        );
        return {
          id,
          descricao:
            toStringValue(menu['descricao']) ??
            toStringValue(menu['nome']) ??
            toStringValue(menu['menuDescricao']),
          icone: toStringValue(menu['icone']),
          rota,
          ativo: toBoolean(menu['ativo'] ?? menu['isActive']),
          exibirNoSidebar: resolveExibirNoSidebar({
            id,
            kind: 'menu',
            rota,
            fromApi: fromApi === null ? undefined : fromApi,
          }),
          selecionado: toBoolean(menu['selecionado'] ?? menu['selected']),
          ordem: toNumber(menu['ordem'] ?? menu['menuOrdem']),
          subMenus: mapSubMenus(
            menu['subMenus'] ??
              menu['submenus'] ??
              menu['submodules'] ??
              menu['subModules'] ??
              menu['subMenusDto']
          ),
        };
      });
  }

  return [];
}

function mapSubMenus(value: unknown): SessionMenuAccess['subMenus'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((sub) => {
      const id = toNumber(sub['id'] ?? sub['subMenuId'] ?? sub['menuId']) ?? 0;
      const rota = toStringValue(sub['rota']) ?? toStringValue(sub['subRota']);
      const fromApi = toBoolean(
        sub['exibirNoSidebar'] ?? sub['mostrarSidebar'] ?? sub['exibeSidebar'] ?? sub['sidebar']
      );
      return {
        id,
        descricao:
          toStringValue(sub['descricao']) ??
          toStringValue(sub['nome']) ??
          toStringValue(sub['subDescricao']) ??
          toStringValue(sub['subNome']),
        rota,
        ativo: toBoolean(sub['ativo'] ?? sub['subAtivo']),
        exibirNoSidebar: resolveExibirNoSidebar({
          id,
          kind: 'sub',
          rota,
          fromApi: fromApi === null ? undefined : fromApi,
        }),
        selecionado: toBoolean(sub['selecionado'] ?? sub['subSelecionado']),
        ordem: toNumber(sub['ordem'] ?? sub['subOrdem']),
      };
    });
}

function tryExtractProfileMenus(value: unknown, jwtRole?: string | null): unknown[] | null {
  if (!Array.isArray(value)) return null;
  const profiles = value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  if (profiles.length === 0) return null;

  const normalizedRole = normalizeLooseText(jwtRole);
  if (normalizedRole) {
    for (const profile of profiles) {
      const perfil = normalizeLooseText(toStringValue(profile['perfil']) ?? toStringValue(profile['role']));
      const menus = profile['menus'] ?? profile['Menus'];
      if (perfil && perfil === normalizedRole && Array.isArray(menus)) {
        return menus;
      }
    }
  }

  for (const profile of profiles) {
    const menus = profile['menus'] ?? profile['Menus'];
    if (Array.isArray(menus)) {
      return menus;
    }
  }
  return null;
}

function toStringValue(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function toBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  return null;
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeLooseText(v: string | null | undefined): string {
  if (!v) return '';
  return v
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
