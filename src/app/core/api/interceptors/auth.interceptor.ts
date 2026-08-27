import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AUTH_TOKEN_STORAGE_KEY, normalizeBearerValue } from '../../auth/auth-token.storage';
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

/**
 * Adiciona `Authorization: Bearer <token>` em toda requisição HTTP (exceto APIs externas),
 * usando o valor gravado no login em {@link AUTH_TOKEN_STORAGE_KEY}.
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
    const codExportacao = payload
      ? getJwtStringClaim(payload, 'CodExportacao', 'codExportacao')
      : null;
    const empresaId = payload
      ? getJwtStringClaim(payload, 'EmpresaId', 'empresaId')
      : null;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (codExportacao) headers['X-Cod-Exportacao'] = codExportacao;
    if (empresaId) headers['X-Empresa-Id'] = empresaId;
    req = req.clone({ setHeaders: headers });
  }

  return next(req);
}
