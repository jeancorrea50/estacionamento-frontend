/** Separador usado na listagem de veículos (`mapItem`). */
export const MARCA_MODELO_SEP = ' / ';

/**
 * Separa texto combinado de marca/modelo.
 * Aceita `Marca / Modelo` (listagem) ou `Marca Modelo` (espaço).
 */
export function splitMarcaModelo(value: string | null | undefined): {
  marca: string;
  modelo: string;
} {
  const t = String(value ?? '').trim();
  if (!t) return { marca: '', modelo: '' };

  if (t.includes(MARCA_MODELO_SEP)) {
    const [marcaPart, ...rest] = t.split(MARCA_MODELO_SEP);
    return {
      marca: String(marcaPart ?? '').trim(),
      modelo: rest.join(MARCA_MODELO_SEP).trim()
    };
  }

  const idx = t.indexOf(' ');
  if (idx < 0) return { marca: t, modelo: '' };
  return {
    marca: t.slice(0, idx).trim(),
    modelo: t.slice(idx + 1).trim()
  };
}

/** Monta texto combinado para grade/GET (marca + modelo). */
export function joinMarcaModelo(
  marca: string | null | undefined,
  modelo: string | null | undefined
): string {
  return [String(marca ?? '').trim(), String(modelo ?? '').trim()]
    .filter(Boolean)
    .join(MARCA_MODELO_SEP);
}

/** Extrai `descricao` de string ou objeto `{ descricao }` (API aninhada). */
export function descricaoFromApiField(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    return String(o['descricao'] ?? o['Descricao'] ?? '').trim();
  }
  return '';
}
