import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AUTH_TOKEN_STORAGE_KEY, normalizeBearerValue } from '../../auth/auth-token.storage';
import { SESSION_ESTACIONAMENTO_KEY, type SessionEstacionamento } from '../../auth/session-estacionamento';
import { decodeJwtPayload, getJwtStringClaim } from '../../auth/jwt.util';

/** Requisições para APIs externas (ex.: BrasilAPI) não devem receber o token do backend. */
function isExternalApi(req: HttpRequest<unknown>): boolean {
  return req.url.includes('brasilapi.com.br') || req.url.includes('viacep.com.br');
}

/**
 * Rotas públicas de auth/Usuario: não enviar Bearer.
 * Register/PUT exigem JWT (`usuario.gravar`) — não entram nesta lista.
 */
function isPublicAuthUsuarioRoute(req: HttpRequest<unknown>): boolean {
  const u = req.url.toLowerCase();
  return (
    u.includes('auth/usuario/confirmar-email') ||
    u.includes('auth/usuario/login') ||
    u.includes('auth/usuario/esqueci-senha') ||
    u.includes('auth/usuario/redefinir-senha')
  );
}

function readSessionEstacionamento(): SessionEstacionamento | null {
  try {
    const raw = sessionStorage.getItem(SESSION_ESTACIONAMENTO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionEstacionamento;
    const id = Number(parsed?.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    return {
      id: Math.trunc(id),
      nome: typeof parsed.nome === 'string' ? parsed.nome : null,
      codExportacao: typeof parsed.codExportacao === 'string' ? parsed.codExportacao : null,
    };
  } catch {
    return null;
  }
}

/**
 * Adiciona `Authorization: Bearer <token>` e headers multi-tenant.
 * Preferência: estacionamento de sessão (Admin) → claims do JWT.
 */
export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  if (isExternalApi(req) || isPublicAuthUsuarioRoute(req)) return next(req);

  const platformId = inject(PLATFORM_ID);
  let raw: string | null = null;
  if (isPlatformBrowser(platformId)) {
    try {
      raw = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      raw = null;
    }
  }

  const token = raw?.trim() ? normalizeBearerValue(raw) : null;

  if (token) {
    const payload = decodeJwtPayload(token);
    const session = isPlatformBrowser(platformId) ? readSessionEstacionamento() : null;
    const codExportacao =
      session?.codExportacao?.trim() ||
      (payload ? getJwtStringClaim(payload, 'CodExportacao', 'codExportacao') : null);
    const empresaId =
      (session?.id && session.id > 0 ? String(session.id) : null) ||
      (payload ? getJwtStringClaim(payload, 'EmpresaId', 'empresaId') : null);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (codExportacao) headers['X-Cod-Exportacao'] = codExportacao;
    if (empresaId && empresaId !== '0') headers['X-Empresa-Id'] = empresaId;
    req = req.clone({ setHeaders: headers });
  }

  return next(req);
}
