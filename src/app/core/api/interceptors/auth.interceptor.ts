import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AUTH_TOKEN_STORAGE_KEY, normalizeBearerValue } from '../../auth/auth-token.storage';

/** Requisições para APIs externas (ex.: BrasilAPI) não devem receber o token do backend. */
function isExternalApi(req: HttpRequest<unknown>): boolean {
  return req.url.includes('brasilapi.com.br') || req.url.includes('viacep.com.br');
}

/** Rotas públicas de auth/Usuario: não enviar Bearer mesmo se houver token antigo no storage. */
function isPublicAuthUsuarioRoute(req: HttpRequest<unknown>): boolean {
  const u = req.url.toLowerCase();
  return (
    u.includes('auth/usuario/confirmar-email') ||
    u.includes('auth/usuario/login') ||
    u.includes('auth/usuario/register') ||
    u.includes('auth/usuario/registrar') ||
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
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req);
}
