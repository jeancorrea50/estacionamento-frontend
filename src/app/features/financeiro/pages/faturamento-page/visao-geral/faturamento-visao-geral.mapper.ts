import { ModalidadeRecebimento, StatusFatura, type FaturaVisaoGeralOutput } from '../../../models/fatura.models';
import { modalidadeRecebimentoLabel, statusFaturaLabel } from '../../../mappers/fatura.mapper';
import type { FaturaStatusVisao } from '../faturamento-visao.types';
import type { AlertaResumoBase } from './faturamento-visao-alertas';

export interface VisaoCardsVm {
  totalReceber: number;
  recebido: number;
  emAberto: number;
  vencido: number;
  aVencer: number;
}

export interface VisaoIndicadoresVm {
  faturasEmitidas: number;
  faturasVencidas: number;
  transportadorasFaturadas: number;
  cobrancasPendentes: number;
}

export interface BarraMes {
  mes: string;
  valor: number;
}

export interface StatusContagem {
  status: FaturaStatusVisao;
  quantidade: number;
}

export interface ModalidadeValor {
  modalidade: string;
  valor: number;
}

const STATUS_ORDEM: StatusFatura[] = [
  StatusFatura.Pago,
  StatusFatura.EmAberto,
  StatusFatura.Vencido,
  StatusFatura.Parcial,
  StatusFatura.AguardandoEnvio,
  StatusFatura.Cancelada
];

const MODALIDADE_ORDEM: ModalidadeRecebimento[] = [
  ModalidadeRecebimento.Pix,
  ModalidadeRecebimento.Boleto,
  ModalidadeRecebimento.Transferencia,
  ModalidadeRecebimento.Cartao
];

const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

export function mapVisaoCards(dto: FaturaVisaoGeralOutput): VisaoCardsVm {
  return {
    totalReceber: dto.totalAReceber,
    recebido: dto.recebido,
    emAberto: dto.emAberto,
    vencido: dto.vencido,
    aVencer: dto.aVencer
  };
}

export function mapVisaoIndicadores(dto: FaturaVisaoGeralOutput): VisaoIndicadoresVm {
  return {
    faturasEmitidas: dto.faturasEmitidas,
    faturasVencidas: dto.faturasVencidas,
    transportadorasFaturadas: dto.transportadorasFaturadas,
    cobrancasPendentes: dto.cobrancasPendentes
  };
}

export function mapVisaoEvolucao(dto: FaturaVisaoGeralOutput): BarraMes[] {
  return dto.evolucaoFaturamento.map((row) => {
    const mes = MES_ABREV[Math.max(0, Math.min(11, (row.mes || 1) - 1))] ?? String(row.mes);
    const label = dto.evolucaoFaturamento.some((x) => x.ano !== row.ano) ? `${mes}/${row.ano}` : mes;
    return { mes: label, valor: row.valor };
  });
}

export function mapVisaoPorStatus(dto: FaturaVisaoGeralOutput): StatusContagem[] {
  const byStatus = new Map(dto.faturasPorStatus.map((s) => [Number(s.status), s.quantidade]));
  return STATUS_ORDEM.map((status) => ({
    status: statusFaturaLabel(status) as FaturaStatusVisao,
    quantidade: byStatus.get(status) ?? 0
  })).filter((s) => s.quantidade > 0);
}

export function mapVisaoPorModalidade(dto: FaturaVisaoGeralOutput): ModalidadeValor[] {
  const byMod = new Map(dto.recebimentosPorModalidade.map((m) => [Number(m.modalidade), m.valor]));
  return MODALIDADE_ORDEM.map((mod) => ({
    modalidade: modalidadeRecebimentoLabel(mod) === 'Pix' ? 'PIX' : String(modalidadeRecebimentoLabel(mod)),
    valor: byMod.get(mod) ?? 0
  })).filter((m) => m.valor > 0);
}

export function mapVisaoAlertas(dto: FaturaVisaoGeralOutput, base: readonly AlertaResumoBase[]): AlertaResumoBase[] {
  const qtdAguardando = dto.faturasPorStatus
    .filter((s) => Number(s.status) === StatusFatura.AguardandoEnvio)
    .reduce((a, s) => a + s.quantidade, 0);

  return base.map((a) => {
    if (a.id === 'fat') return { ...a, quantidade: dto.faturasVencidas };
    if (a.id === 'cob') return { ...a, quantidade: dto.cobrancasPendentes };
    if (a.id === 'env') return { ...a, quantidade: qtdAguardando };
    return { ...a, quantidade: 0 };
  });
}
