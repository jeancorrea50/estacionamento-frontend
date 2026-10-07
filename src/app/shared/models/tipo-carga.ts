/**
 * Espelha `TipoCarga` (byte) do backend:
 * Seca=1, Refrigerada=2, Perigosa=3, Granel=4, Liquida=5.
 */
export enum TipoCarga {
  Seca = 1,
  Refrigerada = 2,
  Perigosa = 3,
  Granel = 4,
  Liquida = 5
}

/** Labels alinhados aos `[Description]` do enum no backend. */
export const TIPO_CARGA_LABEL: Record<TipoCarga, string> = {
  [TipoCarga.Seca]: 'Seca',
  [TipoCarga.Refrigerada]: 'Refrigerada',
  [TipoCarga.Perigosa]: 'Perigosa',
  [TipoCarga.Granel]: 'Granel',
  [TipoCarga.Liquida]: 'Líquida'
};

export const TIPO_CARGA_VALUES = new Set<number>([
  TipoCarga.Seca,
  TipoCarga.Refrigerada,
  TipoCarga.Perigosa,
  TipoCarga.Granel,
  TipoCarga.Liquida
]);

/** Opções para selects (value = enum byte). */
export const TIPO_CARGA_OPCOES: ReadonlyArray<{ value: TipoCarga; label: string }> = [
  { value: TipoCarga.Seca, label: TIPO_CARGA_LABEL[TipoCarga.Seca] },
  { value: TipoCarga.Refrigerada, label: TIPO_CARGA_LABEL[TipoCarga.Refrigerada] },
  { value: TipoCarga.Perigosa, label: TIPO_CARGA_LABEL[TipoCarga.Perigosa] },
  { value: TipoCarga.Granel, label: TIPO_CARGA_LABEL[TipoCarga.Granel] },
  { value: TipoCarga.Liquida, label: TIPO_CARGA_LABEL[TipoCarga.Liquida] }
];

/** Labels do Registro Rápido / selects baseados em texto. */
export const TIPO_CARGA_LABELS: readonly string[] = TIPO_CARGA_OPCOES.map((o) => o.label);

/** Converte valor numérico/string da API para o enum tipado. */
export function parseTipoCarga(
  value: number | string | null | undefined
): TipoCarga | undefined {
  if (value == null || value === '') return undefined;

  if (typeof value === 'number') {
    return TIPO_CARGA_VALUES.has(value) ? (value as TipoCarga) : undefined;
  }

  const trimmed = String(value).trim();
  const asNum = Number(trimmed);
  if (trimmed !== '' && Number.isInteger(asNum) && TIPO_CARGA_VALUES.has(asNum)) {
    return asNum as TipoCarga;
  }

  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const byName: Record<string, TipoCarga> = {
    seca: TipoCarga.Seca,
    refrigerada: TipoCarga.Refrigerada,
    perigosa: TipoCarga.Perigosa,
    granel: TipoCarga.Granel,
    liquida: TipoCarga.Liquida
  };

  return byName[normalized];
}

/** Label de exibição a partir do enum/API. */
export function tipoCargaLabel(value: number | string | null | undefined): string {
  const parsed = parseTipoCarga(value);
  return parsed == null ? '' : TIPO_CARGA_LABEL[parsed];
}

/**
 * Converte label do select (ou texto livre) para o byte do backend.
 * Aceita também o próprio número/enum.
 */
export function mapearTipoCargaParaEnum(
  valor: string | number | null | undefined
): TipoCarga | undefined {
  return parseTipoCarga(valor);
}
