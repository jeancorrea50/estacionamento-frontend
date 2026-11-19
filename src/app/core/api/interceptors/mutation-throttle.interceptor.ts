import { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ApiError } from '../models';
import { ToastService } from '../services/toast.service';
import { AUTH_TOKEN_STORAGE_KEY, normalizeBearerValue } from '../../auth/auth-token.storage';
import { decodeJwtPayload, getJwtStringClaim } from '../../auth/jwt.util';

/** Métodos HTTP que alteram estado e não devem ser disparados em rajada. */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Janela mínima (ms) entre requisições idênticas do mesmo usuário. */
const COOLDOWN_MS = 2000;

/** Header opcional para liberar duplicata consciente (ex.: retries manuais). */
export const SKIP_MUTATION_THROTTLE_HEADER = 'X-Skip-Mutation-Throttle';

const inflightKeys = new Set<string>();
const lastAcceptedAt = new Map<string, number>();

function isExternalApi(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('brasilapi.com.br') ||
    u.includes('viacep.com.br') ||
    u.includes('nominatim.openstreetmap.org') ||
    u.includes('router.project-osrm.org')
  );
}

function currentUserKey(): string {
  try {
    if (typeof localStorage === 'undefined') return 'anon';
    const raw = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const token = normalizeBearerValue(raw ?? '');
    if (!token) return 'anon';
    const payload = decodeJwtPayload(token);
    if (!payload) return 'auth';
    const sub = getJwtStringClaim(
      payload,
      'sub',
      'nameid',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
      'unique_name',
      'email'
    );
    return sub || 'auth';
  } catch {
    return 'anon';
  }
}

function serializeBody(body: unknown): string {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (body instanceof FormData) {
    const parts: string[] = [];
    body.forEach((value, key) => {
      parts.push(
        `${key}=${value instanceof File ? `file:${value.name}:${value.size}` : String(value)}`
      );
    });
    return parts.sort().join('&');
  }
  if (body instanceof Blob) return `blob:${body.size}:${body.type}`;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

function buildKey(req: HttpRequest<unknown>): string {
  const user = currentUserKey();
  const method = req.method.toUpperCase();
  const url = req.urlWithParams;
  const body = serializeBody(req.body);
  return `${user}|${method}|${url}|${body}`;
}

function pruneOldEntries(now: number): void {
  for (const [key, at] of lastAcceptedAt) {
    if (now - at > COOLDOWN_MS * 4) lastAcceptedAt.delete(key);
  }
}

/**
 * Bloqueia POST/PUT/PATCH/DELETE duplicados (mesmo usuário + método + URL + corpo)
 * enquanto a anterior ainda está em voo ou dentro da janela de cooldown (~2s).
 */
export function mutationThrottleInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  if (!MUTATION_METHODS.has(req.method.toUpperCase()) || isExternalApi(req.url)) {
    return next(req);
  }

  if (req.headers.has(SKIP_MUTATION_THROTTLE_HEADER)) {
    return next(req.clone({ headers: req.headers.delete(SKIP_MUTATION_THROTTLE_HEADER) }));
  }

  const key = buildKey(req);
  const now = Date.now();
  pruneOldEntries(now);

  const last = lastAcceptedAt.get(key) ?? 0;
  const inFlight = inflightKeys.has(key);
  const tooSoon = now - last < COOLDOWN_MS;

  if (inFlight || tooSoon) {
    const toast = inject(ToastService);
    const message = inFlight
      ? 'Aguarde: esta operação já está em andamento.'
      : 'Aguarde um momento antes de repetir a mesma operação.';
    toast.warning(message);
    const err: ApiError = { message, status: 429, toastShown: true };
    return throwError(() => err);
  }

  inflightKeys.add(key);
  lastAcceptedAt.set(key, now);

  return next(req).pipe(
    finalize(() => {
      inflightKeys.delete(key);
    })
  );
}
