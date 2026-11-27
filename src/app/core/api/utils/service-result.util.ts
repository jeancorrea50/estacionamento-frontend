import { ApiError } from '../models';

/**
 * Envelope padrão da API (.NET ServiceResult) — camelCase e PascalCase.
 * Sucesso: { success, message, result } ou { Success, Message, Result }
 * Falha de regra (400): { success: false, notifications: string[] | string, ... }
 */
function readNotifications(
  b: Record<string, unknown>
): { text: string; fromArray: boolean } {
  const notes = b['notifications'] ?? b['Notifications'];
  if (Array.isArray(notes) && notes.length > 0) {
    const text = notes
      .filter((n): n is string => typeof n === 'string')
      .map((n) => n.trim())
      .filter(Boolean)
      .join(' ');
    if (text) return { text, fromArray: true };
  }
  if (typeof notes === 'string' && notes.trim()) {
    return { text: notes.trim(), fromArray: false };
  }
  const m = b['message'] ?? b['Message'] ?? b['title'] ?? b['Title'];
  if (typeof m === 'string' && m.trim()) {
    return { text: m.trim(), fromArray: false };
  }
  return { text: 'Operação rejeitada.', fromArray: false };
}

/**
 * Lança {@link ApiError} quando o envelope indica falha lógica (success: false)
 * em resposta 200, ou em qualquer corpo com essa forma.
 */
export function throwIfServiceFailure(body: unknown): void {
  if (body == null || typeof body !== 'object') return;
  const b = body as Record<string, unknown>;
  const success = b['success'] ?? b['Success'];
  if (success === false) {
    const { text } = readNotifications(b);
    const err: ApiError = { message: text, status: 400 };
    throw err;
  }
}

/**
 * Desembrulha `result` / `Result` após checar `success: false` (garanta que não siga o fluxo).
 * Se o corpo for um array (sem envelope), devolve o próprio array.
 * Se tiver `result` sem `success`, devolve `result` (útil com APIs mistas).
 */
export function unwrapServiceResult<T>(body: unknown): T {
  throwIfServiceFailure(body);
  if (body == null) {
    const err: ApiError = { message: 'Resposta vazia do servidor.', status: undefined };
    throw err;
  }
  if (Array.isArray(body)) {
    return body as T;
  }
  if (typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const hasSuccess = 'success' in b || 'Success' in b;
    if (hasSuccess) {
      const r = b['result'] ?? b['Result'];
      if (r === undefined && b['success'] === true) {
        const err: ApiError = { message: 'Resposta sem result.', status: 400 };
        throw err;
      }
      return r as T;
    }
    if ('result' in b) return b['result'] as T;
    if ('Result' in b) return b['Result'] as T;
  }
  return body as T;
}

/**
 * Faz merge de `result` na raiz para consumidores que esperam `jwt` e `menus` no primeiro nível (ex.: login).
 */
export function mergeServiceResultToRoot<T extends Record<string, unknown>>(res: T): T {
  const result = (res as { result?: unknown; Result?: unknown }).result ?? (res as { Result?: unknown }).Result;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return { ...res, ...(result as object) } as T;
  }
  return res;
}

/**
 * Lê sucesso falso lógico no login (ex.: 200 com success: false).
 */
export function readLoginServiceFailure(
  res: unknown
): { success: false; message: string } | null {
  if (res == null || typeof res !== 'object') return null;
  const b = res as Record<string, unknown>;
  const success = b['success'] ?? b['Success'];
  if (success === false) {
    return { success: false, message: readNotifications(b).text };
  }
  return null;
}
