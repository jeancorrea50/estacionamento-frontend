import { toIsoDate } from './movimentos-filtros.util';

export interface KpiTendencia {
  valor: number;
  /** Variação percentual do último dia contra o anterior. `null` quando não há base. */
  variacao: number | null;
  serie: number[];
}

export const KPI_TENDENCIA_VAZIA: KpiTendencia = { valor: 0, variacao: null, serie: [] };

export function diasRetroativos(hoje: Date, quantidade: number): string[] {
  const dias: string[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    dias.push(toIsoDate(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i)));
  }
  return dias;
}

export function chaveDiaLocal(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return toIsoDate(data);
}

export function contarPorDia(isos: Array<string | null | undefined>, dias: string[]): number[] {
  const totais = new Map(dias.map((dia) => [dia, 0]));
  for (const iso of isos) {
    const chave = chaveDiaLocal(iso);
    if (!chave || !totais.has(chave)) continue;
    totais.set(chave, (totais.get(chave) ?? 0) + 1);
  }
  return dias.map((dia) => totais.get(dia) ?? 0);
}

export function variacaoContraAnterior(serie: number[]): number | null {
  if (serie.length < 2) return null;
  const anterior = serie[serie.length - 2] ?? 0;
  const atual = serie[serie.length - 1] ?? 0;
  if (anterior <= 0) return atual === 0 ? 0 : null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export function tendenciaDoDia(serie: number[], valorAtual: number): KpiTendencia {
  const serieAjustada = serie.length ? [...serie] : [];
  if (serieAjustada.length) serieAjustada[serieAjustada.length - 1] = valorAtual;
  return {
    valor: valorAtual,
    variacao: variacaoContraAnterior(serieAjustada),
    serie: serieAjustada
  };
}

/** Pontos `x,y` no viewBox 0–100 × 0–32. */
export function sparklineLinha(serie: number[]): string {
  if (serie.length === 0) return '';
  const max = Math.max(...serie, 0);
  const min = Math.min(...serie, 0);
  const span = Math.max(max - min, 1);
  const altura = 32;
  return serie
    .map((valor, indice) => {
      const x = serie.length === 1 ? 100 : (indice / (serie.length - 1)) * 100;
      const y = altura - 2 - ((valor - min) / span) * (altura - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function sparklineArea(serie: number[]): string {
  const linha = sparklineLinha(serie);
  if (!linha) return '';
  return `0,32 ${linha} 100,32`;
}
