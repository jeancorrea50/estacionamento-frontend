/**
 * Decodifica o payload do JWT (somente leitura no cliente; a assinatura é validada no backend).
 */

export interface JwtValidationResult {
  valid: boolean;
  message?: string;
}

/** Decodifica a 2ª parte do JWT (payload) em objeto. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const segment = parts[1];
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    if (typeof atob !== 'function') {
      return null;
    }
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Valida `exp` no cliente. **`nbf` não é validado aqui** — diferença de relógio entre PC e servidor
 * costuma disparar "Token ainda não é válido."; o backend continua responsável por `nbf`/assinatura.
 */
export function validateJwtPayload(payload: Record<string, unknown>): JwtValidationResult {
  const nowSec = Math.floor(Date.now() / 1000);

  const expRaw = payload['exp'];
  const exp = typeof expRaw === 'number' ? expRaw : Number(expRaw);
  if (Number.isFinite(exp) && nowSec > exp) {
    return { valid: false, message: 'Token expirado. Faça login novamente.' };
  }

  return { valid: true };
}

/** Lista de permissões a partir do claim `Permission` / `permission` (array ou string). */
export function extractJwtPermissionKeys(payload: Record<string, unknown>): string[] {
  const raw =
    payload['Permission'] ??
    payload['permission'] ??
    payload['Permissions'] ??
    payload['Permissao'];
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x) => x.trim().toLowerCase())
      )
    );
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [raw.trim().toLowerCase()];
  }
  return [];
}

export function getJwtStringClaim(
  payload: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const v = payload[key];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
    if (Array.isArray(v)) {
      const first = v.find((x): x is string => typeof x === 'string' && x.trim().length > 0);
      if (first) return first.trim();
    }
  }
  return null;
}
