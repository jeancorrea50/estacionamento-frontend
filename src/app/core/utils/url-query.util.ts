/**
 * Lê um parâmetro da query string sem tratar `+` como espaço (comportamento legado de `application/x-www-form-urlencoded`).
 * Útil para tokens na URL: se o backend não codificar `+` como `%2B`, parsers comuns corrompem o valor.
 */
export function readRawQueryParam(search: string, paramName: string): string | null {
  const q = search.startsWith('?') ? search.slice(1) : search;
  if (!q) return null;
  for (const part of q.split('&')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const rawKey = part.slice(0, idx);
    const rawVal = part.slice(idx + 1);
    let key: string;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    } catch {
      key = rawKey;
    }
    if (key.toLowerCase() !== paramName.toLowerCase()) continue;
    try {
      return decodeURIComponent(rawVal.replace(/\+/g, '%2B'));
    } catch {
      return rawVal;
    }
  }
  return null;
}
