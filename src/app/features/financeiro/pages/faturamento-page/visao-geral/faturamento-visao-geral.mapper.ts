import {
  StatusFatura,
  type FaturaProximoVencimentoOutput,
  type FaturaVisaoGeralOutput
} from '../../../models/fatura.models';
import { statusFaturaLabel } from '../../../mappers/fatura.mapper';
import { ModalidadeCobranca, modalidadeLabel } from '../../../mappers/configuracao-cobranca.mapper';
import type { FaturaStatusVisao } from '../faturamento-visao.types';
import type { AlertaResumoBase, ProximoVencimentoBase } from './faturamento-visao-alertas';

export interface VisaoResumoFinanceiroVm {
  totalReceber: number;
  recebido: number;
  emAberto: number;
  vencido: number;
  /** Percentual 0–100 da barra verde (recebido / total). */
  pctRecebido: number;
  /** Percentual 0–100 da barra vermelha (restante / total). */
  pctRestante: number;
  /** Taxa de recebimento 0–100 (mesma base do pctRecebido). */
  taxaRecebimento: number;
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

/** Ordem das regras de cobrança (igual ao cadastro) + Avulso no início. */
const MODALIDADE_COBRANCA_ORDEM: ModalidadeCobranca[] = [
  ModalidadeCobranca.Diaria,
  ModalidadeCobranca.Semanal,
  ModalidadeCobranca.Quinzenal,
  ModalidadeCobranca.Mensal,
  ModalidadeCobranca.Personalizado,
  ModalidadeCobranca.Acordo
];

/** Código reservado no agregado FE para faturas sem configuração de cobrança. */
const MODALIDADE_AVULSO = 0;

const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

function labelModalidadeCobrancaChart(codigo: number): string {
  if (codigo === MODALIDADE_AVULSO) return 'Avulso';
  if (Number(codigo) === ModalidadeCobranca.Personalizado) return 'Data personalizada';
  return String(modalidadeLabel(codigo));
}

function normalizarCodigoModalidadeCobranca(raw: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return MODALIDADE_AVULSO;
  if (
    n === ModalidadeCobranca.Diaria ||
    n === ModalidadeCobranca.Semanal ||
    n === ModalidadeCobranca.Quinzenal ||
    n === ModalidadeCobranca.Mensal ||
    n === ModalidadeCobranca.Personalizado ||
    n === ModalidadeCobranca.Acordo
  ) {
    return n;
  }
  // Código fora do enum de cobrança → trata como Avulso (sem config válida).
  return MODALIDADE_AVULSO;
}

export function mapVisaoResumoFinanceiro(dto: FaturaVisaoGeralOutput): VisaoResumoFinanceiroVm {
  const totalReceber = Number(dto.totalAReceber) || 0;
  const recebido = Number(dto.recebido) || 0;
  const emAberto = Number(dto.emAberto) || 0;
  const vencido = Number(dto.vencido) || 0;
  const base = totalReceber > 0 ? totalReceber : 0;
  const pctRecebido = base > 0 ? Math.min(100, Math.max(0, (recebido / base) * 100)) : 0;
  const pctRestante = base > 0 ? Math.min(100, Math.max(0, 100 - pctRecebido)) : 0;

  return {
    totalReceber,
    recebido,
    emAberto,
    vencido,
    pctRecebido,
    pctRestante,
    taxaRecebimento: pctRecebido
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

/**
 * Valor gerado por modalidade de **cobrança** (cadastro Config. cobrança).
 * Sem configuração → **Avulso** (`modalidade` 0/ausente/inválida).
 * Só retorna linhas com valor > 0 vindas do backend (não inventa modalidades zeradas).
 */
export function mapVisaoPorModalidade(dto: FaturaVisaoGeralOutput): ModalidadeValor[] {
  const byMod = new Map<number, number>();
  for (const row of dto.recebimentosPorModalidade) {
    const key = normalizarCodigoModalidadeCobranca(Number(row.modalidade));
    const valor = Number(row.valor) || 0;
    if (valor <= 0) continue;
    byMod.set(key, (byMod.get(key) ?? 0) + valor);
  }

  const ordem = [MODALIDADE_AVULSO, ...MODALIDADE_COBRANCA_ORDEM];
  return ordem
    .filter((codigo) => (byMod.get(codigo) ?? 0) > 0)
    .map((codigo) => ({
      modalidade: labelModalidadeCobrancaChart(codigo),
      valor: byMod.get(codigo) ?? 0
    }));
}

/** Contagens extras que não vêm no snapshot “total” de `/visao-geral`. */
export interface VisaoAlertasExtras {
  /** Total de fechamentos em andamento (`SituacaoFechamento.EmAndamento`), sem filtro de mês. */
  fechamentosPendentes?: number;
  /** Snapshot do mês civil atual — usado em faturas emitidas. */
  mesAtual?: FaturaVisaoGeralOutput | null;
  /** Snapshot do mês civil anterior — comparativo só de faturas emitidas. */
  mesAnterior?: FaturaVisaoGeralOutput | null;
}

export interface AlertaKpiVm extends AlertaResumoBase {
  /** Ex.: "Mês passado: 12" — só quando houver dado de mês anterior. */
  detalheSecundario?: string | null;
}

/** Formata ISO date → dd/MM/yyyy (pt-BR). */
export function formatVisaoVencimentoLabel(iso: string): string {
  const raw = String(iso || '').trim();
  if (!raw) return '';
  const dayPart = raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayPart);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('pt-BR');
}

/**
 * Linhas de próximos vencimentos vindas do contrato `/visao-geral`.
 * Sem array / vazio → `[]` (empty state); não inventa transportadoras.
 */
export function mapVisaoProximosVencimentos(
  rows: readonly FaturaProximoVencimentoOutput[] | null | undefined
): ProximoVencimentoBase[] {
  if (!rows?.length) return [];
  return rows
    .map((row) => {
      const transportadora = String(row.transportadoraNome || '').trim();
      const vencimento = formatVisaoVencimentoLabel(row.dataVencimento);
      if (!transportadora || !vencimento) return null;
      return {
        transportadora,
        valor: Number(row.valor) || 0,
        vencimento,
        status: statusFaturaLabel(row.status) as FaturaStatusVisao
      };
    })
    .filter((row): row is ProximoVencimentoBase => row != null);
}

/**
 * KPIs de alertas (contrato real):
 * - fat → `faturasVencidas` (total, sem recorte mensal)
 * - cob → `cobrancasPendentes` (total)
 * - fech → `fechamentosPendentes` (totalCount EmAndamento)
 * - emi → `faturasEmitidas` do mês atual + detalhe do mês passado
 * - transp → `transportadorasFaturadas` (total, sem comparativo)
 */
export function mapVisaoAlertas(
  dto: FaturaVisaoGeralOutput,
  base: readonly AlertaResumoBase[],
  extras: VisaoAlertasExtras = {}
): AlertaKpiVm[] {
  const fechamentosPendentes = Math.max(0, Number(extras.fechamentosPendentes) || 0);
  const mesAtual = extras.mesAtual ?? null;
  const mesAnterior = extras.mesAnterior ?? null;

  return base.map((a) => {
    if (a.id === 'fat') {
      return { ...a, quantidade: dto.faturasVencidas, detalheSecundario: null };
    }
    if (a.id === 'cob') {
      return { ...a, quantidade: dto.cobrancasPendentes, detalheSecundario: null };
    }
    if (a.id === 'fech') {
      return { ...a, quantidade: fechamentosPendentes, detalheSecundario: null };
    }
    if (a.id === 'emi') {
      const qtdMes = mesAtual?.faturasEmitidas ?? 0;
      const qtdAnt = mesAnterior?.faturasEmitidas ?? 0;
      return {
        ...a,
        quantidade: qtdMes,
        detalhe: 'No mês atual',
        detalheSecundario: mesAnterior ? `Mês passado: ${qtdAnt}` : null
      };
    }
    if (a.id === 'transp') {
      return {
        ...a,
        quantidade: dto.transportadorasFaturadas,
        detalheSecundario: null
      };
    }
    return { ...a, quantidade: 0, detalheSecundario: null };
  });
}
