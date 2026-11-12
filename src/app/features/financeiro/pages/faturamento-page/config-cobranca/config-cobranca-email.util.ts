/** Contrato API: `emailFinanceiro` é string; múltiplos destinatários vão separados por vírgula. */
export const EMAIL_FINANCEIRO_MAX = 10;
const EMAIL_FINANCEIRO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isEmailFinanceiroValido(email: string): boolean {
  return EMAIL_FINANCEIRO_RE.test(email.trim());
}

/** Aceita vírgula, ponto-e-vírgula ou quebra de linha como separador. */
export function parseEmailsFinanceiros(raw: string | null | undefined): string[] {
  const texto = String(raw ?? '').trim();
  if (!texto) return [];
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const parte of texto.split(/[,;\n]+/)) {
    const email = parte.trim().toLowerCase();
    if (!email || vistos.has(email)) continue;
    vistos.add(email);
    out.push(email);
  }
  return out;
}

export function serializeEmailsFinanceiros(emails: readonly string[]): string {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of emails) {
    const email = String(item ?? '').trim().toLowerCase();
    if (!email || vistos.has(email)) continue;
    vistos.add(email);
    out.push(email);
  }
  return out.join(', ');
}

export function normalizarEmailFinanceiro(raw: string | null | undefined): string {
  return serializeEmailsFinanceiros(parseEmailsFinanceiros(raw));
}

export function mensagemEmailsFinanceirosInvalidos(
  raw: string | null | undefined,
  opts?: { obrigatorio?: boolean; max?: number }
): string | null {
  const emails = parseEmailsFinanceiros(raw);
  const obrigatorio = opts?.obrigatorio === true;
  const max = opts?.max ?? EMAIL_FINANCEIRO_MAX;

  if (!emails.length) {
    return obrigatorio ? 'Informe o e-mail financeiro.' : null;
  }
  if (emails.length > max) {
    return `Informe no máximo ${max} e-mails financeiros.`;
  }
  const invalidos = emails.filter((e) => !isEmailFinanceiroValido(e));
  if (invalidos.length) {
    return invalidos.length === 1
      ? `E-mail financeiro inválido: ${invalidos[0]}.`
      : 'Há e-mails financeiros inválidos.';
  }
  return null;
}
