/**
 * Metadados dos cartões "Alertas" e tipagem de "Próximos vencimentos" da Visão Geral.
 * Quantidades e linhas de vencimento vêm exclusivamente da API — nunca de seeds fictícios.
 * A rota final é resolvida em runtime pelo menu cadastrado (Gerenciamento > Menu).
 */
import type { FaturamentoTabId, FaturaStatusVisao } from '../faturamento-visao.types';

export interface AlertaResumoBase {
  id: string;
  titulo: string;
  /** Sempre preenchido pelo mapper a partir do backend. */
  quantidade: number;
  detalhe: string;
  icon: string;
  /** Aba de destino do alerta. */
  tab: FaturamentoTabId;
  queryParams?: Record<string, string>;
}

export interface AlertaResumo extends AlertaResumoBase {
  /** Rota absoluta resolvida (menu cadastrado ou rota canônica). */
  route: string;
  /** Linha extra (ex.: mês passado) — só quando o contrato tiver o dado. */
  detalheSecundario?: string | null;
}

export interface ProximoVencimentoBase {
  transportadora: string;
  valor: number;
  vencimento: string;
  status: FaturaStatusVisao;
}

export interface ProximoVencimento extends ProximoVencimentoBase {
  route: string;
  queryParams: Record<string, string>;
}

/** Estrutura dos alertas (labels/ícones/rotas). Quantidade inicia em 0 e é sobrescrita pelo contrato. */
export const VISAO_ALERTAS: readonly AlertaResumoBase[] = [
  {
    id: 'fat',
    titulo: 'Faturas vencidas',
    quantidade: 0,
    detalhe: 'Requer atenção imediata',
    icon: 'gpp_bad',
    tab: 'faturas',
    queryParams: { filtro: 'vencidas' }
  },
  {
    id: 'cob',
    titulo: 'Cobranças pendentes',
    quantidade: 0,
    detalhe: 'Envio ou confirmação pendente',
    icon: 'mark_email_unread',
    tab: 'inadimplencia',
    queryParams: { filtro: 'semCobranca' }
  },
  {
    id: 'fech',
    titulo: 'Fechamentos pendentes',
    quantidade: 0,
    detalhe: 'Períodos aguardando conferência',
    icon: 'fact_check',
    tab: 'fechamentos',
    queryParams: { filtro: 'andamento' }
  },
  {
    id: 'emi',
    titulo: 'Faturas emitidas',
    quantidade: 0,
    detalhe: 'No mês atual',
    icon: 'receipt_long',
    tab: 'faturas'
  },
  {
    id: 'transp',
    titulo: 'Transportadoras faturadas',
    quantidade: 0,
    detalhe: 'Com fatura no sistema',
    icon: 'local_shipping',
    tab: 'faturas'
  }
];

/** Filtros da aba Faturas equivalentes ao status do vencimento. */
export function filtrosPorStatusFatura(row: ProximoVencimentoBase): Record<string, string> {
  const queryParams: Record<string, string> = { transportadora: row.transportadora };
  if (row.status === 'Vencido') {
    queryParams['filtro'] = 'vencidas';
  } else if (row.status === 'Aguardando envio') {
    queryParams['filtro'] = 'aguardando-envio';
  } else if (row.status === 'Pago') {
    queryParams['filtro'] = 'pagas';
  } else {
    queryParams['status'] = row.status;
  }
  return queryParams;
}
