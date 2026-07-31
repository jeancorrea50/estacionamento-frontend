/**
 * Utilitários de placa BR (padrão antigo AAA9999 e Mercosul AAA9A99).
 * Exibição profissional com hífen: ABC-1234 / ABC-1D23.
 *
 * Importante: exibição/normalização para API usa strip alfanumérico (não descarta
 * caracteres já persistidos). A sanitização por posição só guia a digitação.
 */

const PLACA_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

/** Uppercase + só A-Z0-9, máx. 7 — preserva valor vindo da API (ex.: KG65881). */
export function stripPlacaAlnum(raw: string | null | undefined): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);
}

/**
 * Sanitiza digitação posição a posição (Mercosul + legado):
 * 1–3 letras | 4 dígito | 5 letra ou dígito | 6–7 dígitos.
 */
export function sanitizePlacaInput(raw: string | null | undefined): string {
  const chars = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  let out = '';
  for (let i = 0; i < chars.length && out.length < 7; i++) {
    const c = chars[i];
    const pos = out.length;
    if (pos < 3) {
      if (/[A-Z]/.test(c)) out += c;
    } else if (pos === 3) {
      if (/[0-9]/.test(c)) out += c;
    } else if (pos === 4) {
      if (/[A-Z0-9]/.test(c)) out += c;
    } else if (/[0-9]/.test(c)) {
      out += c;
    }
  }
  return out;
}

/**
 * Normaliza para envio/comparação com a API.
 * Preserva 7 alfanuméricos já gravados (não aplica máscara por posição).
 */
export function normalizePlaca(raw: string | null | undefined): string {
  return stripPlacaAlnum(raw);
}

/** Exibe placa com hífen após o 3º caractere (ex.: ABC-1234, KG6-5881). */
export function formatPlacaDisplay(raw: string | null | undefined): string {
  const n = stripPlacaAlnum(raw);
  if (!n) return '';
  if (n.length <= 3) return n;
  return `${n.slice(0, 3)}-${n.slice(3)}`;
}

/**
 * Máscara progressiva na digitação.
 * Se já houver 7 alfanuméricos (cola / valor da API), preserva e só formata.
 */
export function formatPlacaInput(raw: string | null | undefined): string {
  const stripped = stripPlacaAlnum(raw);
  if (stripped.length === 7) {
    return formatPlacaDisplay(stripped);
  }
  const n = sanitizePlacaInput(raw);
  if (n.length <= 3) return n;
  return `${n.slice(0, 3)}-${n.slice(3)}`;
}

/** true se há 7 caracteres alfanuméricos (padrão BR completo ou legado da API). */
export function placaCompleta(raw: string | null | undefined): boolean {
  return stripPlacaAlnum(raw).length === 7;
}

/** true se a placa completa for especificamente Mercosul. */
export function placaMercosul(raw: string | null | undefined): boolean {
  return PLACA_MERCOSUL.test(stripPlacaAlnum(raw));
}
