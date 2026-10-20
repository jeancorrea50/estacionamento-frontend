import {
  ENTRADA_SAIDA_STATUS_LABEL,
  parseEntradaSaidaStatus,
} from '../../../movimentos/models/entrada-saida.models';
import type { MovimentacaoRelatorioItem } from './movimentacao-relatorio.types';

/** Mesma forma de `formatarMinutos` da tela de movimentos. Não recalcula suspensão. */
export function formatarPermanenciaRelatorio(minutos: number | null): string {
  if (minutos == null) return '—';
  if (minutos <= 0) return '0 min';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
}

/**
 * Preferência: `tempoPermanenciaMinutos` da API.
 * Fallback (igual à lista de Movimentações): diferença entrada→saída, ou entrada→agora se em aberto.
 * Não desconta suspensão — mesmo critério da tela operacional.
 */
export function minutosPermanenciaRelatorio(
  item: MovimentacaoRelatorioItem,
  referenciaFim?: Date | null
): number | null {
  if (item.tempoPermanenciaMinutos != null && Number.isFinite(item.tempoPermanenciaMinutos)) {
    return item.tempoPermanenciaMinutos;
  }
  if (!item.dataHoraEntrada?.trim()) return null;
  const inicio = new Date(item.dataHoraEntrada).getTime();
  if (!Number.isFinite(inicio)) return null;
  const fim = item.dataHoraSaida?.trim()
    ? new Date(item.dataHoraSaida).getTime()
    : (referenciaFim ?? new Date()).getTime();
  if (!Number.isFinite(fim)) return null;
  return Math.max(0, Math.floor((fim - inicio) / 60_000));
}

export function rotuloPermanenciaRelatorio(
  item: MovimentacaoRelatorioItem,
  referenciaFim?: Date | null
): string {
  return formatarPermanenciaRelatorio(minutosPermanenciaRelatorio(item, referenciaFim));
}

export function formatarDataFiltro(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const [data] = iso.trim().split('T');
  const [ano, mes, dia] = data.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHoraRelatorio(iso: string | null, timeZoneId: string | null): string {
  if (!iso?.trim()) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  const opcoes: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  if (timeZoneId) opcoes.timeZone = timeZoneId;
  try {
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(data);
  } catch {
    const { timeZone: _ignorado, ...semFuso } = opcoes;
    return new Intl.DateTimeFormat('pt-BR', semFuso).format(data);
  }
}

export function rotuloSituacao(item: MovimentacaoRelatorioItem): string {
  if (item.statusDescricao?.trim()) {
    const desc = item.statusDescricao.trim();
    return desc === 'Saida' ? 'Saída' : desc;
  }
  const parsed = parseEntradaSaidaStatus(item.status);
  if (parsed == null) return '—';
  const label = ENTRADA_SAIDA_STATUS_LABEL[parsed];
  return label === 'Saida' ? 'Saída' : label;
}

/** Cobertura derivada apenas das flags do contrato (sem valores). */
export function rotuloCobertura(item: MovimentacaoRelatorioItem): string {
  if (item.ehExcedente) return 'Excedente';
  if (item.avulso) return 'Avulso';
  return 'Acordo';
}

export function rotuloExcedente(item: MovimentacaoRelatorioItem): string {
  return item.ehExcedente ? 'Sim' : 'Não';
}

/** Valor da linha: formata só quando a API envia número; senão "—". */
export function formatarValorRelatorio(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export function rotuloFaturamento(item: MovimentacaoRelatorioItem): string {
  return item.faturado ? 'Sim' : 'Não';
}

/**
 * Escopo de transportadora a partir dos nomes já presentes nos itens.
 * Não inventa CNPJ.
 */
export function resolverTransportadoraEscopo(itens: MovimentacaoRelatorioItem[]): string | null {
  const nomes = new Set(
    itens
      .map((i) => i.nomeTransportadora?.trim())
      .filter((n): n is string => !!n)
  );
  if (nomes.size === 0) return null;
  if (nomes.size === 1) return [...nomes][0];
  return 'Consolidado (múltiplas transportadoras)';
}

export interface LinhaDemonstrativoQuantitativo {
  descricao: string;
  quantidade: number;
}

/** Contagens por flags do contrato — sem coluna de valor monetário. */
export function montarDemonstrativoQuantitativo(
  itens: MovimentacaoRelatorioItem[]
): LinhaDemonstrativoQuantitativo[] {
  let acordo = 0;
  let excedente = 0;
  let avulso = 0;
  let faturadas = 0;
  let naoFaturadas = 0;

  for (const item of itens) {
    if (item.ehExcedente) excedente += 1;
    else if (item.avulso) avulso += 1;
    else acordo += 1;

    if (item.faturado) faturadas += 1;
    else naoFaturadas += 1;
  }

  return [
    { descricao: 'Movimentações cobertas por acordo (não avulso / não excedente)', quantidade: acordo },
    { descricao: 'Movimentações excedentes', quantidade: excedente },
    { descricao: 'Movimentações avulsas', quantidade: avulso },
    { descricao: 'Movimentações faturadas', quantidade: faturadas },
    { descricao: 'Movimentações pendentes de faturamento', quantidade: naoFaturadas },
  ].filter((l) => l.quantidade > 0);
}

/** Compatibilidade: detalhes textuais sem inventar campos. */
export function montarDetalhesRelatorio(item: MovimentacaoRelatorioItem): string {
  const linhas = [
    `Situação: ${rotuloSituacao(item)}`,
    `Cobertura: ${rotuloCobertura(item)}`,
    `Faturado: ${rotuloFaturamento(item)}`,
  ];
  if (item.observacao?.trim()) linhas.push(`Obs.: ${item.observacao.trim()}`);
  return linhas.join('\n');
}
