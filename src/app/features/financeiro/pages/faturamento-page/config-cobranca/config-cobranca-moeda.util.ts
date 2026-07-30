/** Formata para o padrão brasileiro sem símbolo, exibido ao lado de um prefixo "R$". */
export function formatarBrl(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Aceita "1.234,56", "1234,56", "1234.56" e "R$ 1.234,56". */
export function parseBrl(raw: string | null | undefined): number | null {
  const texto = String(raw ?? '').trim();
  if (!texto) return null;

  let limpo = texto.replace(/[^\d.,-]/g, '');
  if (!limpo || limpo === '-' || limpo === ',' || limpo === '.') return null;

  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');

  if (temVirgula && temPonto) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (temVirgula) {
    limpo = limpo.replace(',', '.');
  } else if (temPonto) {
    // Um único ponto com até duas casas é decimal (12.5); os demais casos são separador de milhar.
    const parts = limpo.split('.');
    if (parts.length !== 2 || parts[1].length > 2) {
      limpo = limpo.replace(/\./g, '');
    }
  }

  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}
