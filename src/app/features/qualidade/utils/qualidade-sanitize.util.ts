/** Remove padrões sensíveis de evidências/observações locais. */
const SENSITIVE =
  /(password|senha|token|bearer|authorization|api[_-]?key|secret|cpf|cnpj|cartao|card\s*number)\s*[:=]\s*\S+/gi;

const JWT_LIKE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

export function sanitizarTextoQualidade(raw: string | null | undefined, maxLen = 4000): string {
  let text = String(raw ?? '').trim();
  if (!text) return '';
  text = text.replace(SENSITIVE, '$1=[REDACTED]');
  text = text.replace(JWT_LIKE, '[JWT_REDACTED]');
  if (text.length > maxLen) {
    text = `${text.slice(0, maxLen)}…`;
  }
  return text;
}
