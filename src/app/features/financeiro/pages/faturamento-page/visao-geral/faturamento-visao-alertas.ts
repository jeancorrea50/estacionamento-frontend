/**
 * Dados dos cartões "Alertas" e "Próximos vencimentos" da Visão Geral.
 * A rota final é resolvida em runtime pelo menu cadastrado (Gerenciamento > Menu),
 * por isso aqui só fica a aba de destino (`tab`) e o filtro aplicado no destino.
 */
import type { FaturamentoTabId, FaturaStatusVisao } from '../faturamento-visao.types';

export interface AlertaResumoBase {
  id: string;
  titulo: string;
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

export const VISAO_ALERTAS: readonly AlertaResumoBase[] = [
  {
    id: 'fat',
    titulo: 'Faturas vencidas',
    quantidade: 7,
    detalhe: 'Requer atenção imediata',
    icon: 'gpp_bad',
    tab: 'faturas',
    queryParams: { filtro: 'vencidas' }
  },
  {
    id: 'cob',
    titulo: 'Cobranças pendentes',
    quantidade: 11,
    detalhe: 'Envio ou confirmação pendente',
    icon: 'mark_email_unread',
    tab: 'inadimplencia',
    queryParams: { filtro: 'semCobranca' }
  },
  {
    id: 'fech',
    titulo: 'Fechamentos pendentes',
    quantidade: 2,
    detalhe: 'Períodos aguardando conferência',
    icon: 'fact_check',
    tab: 'fechamentos',
    queryParams: { filtro: 'andamento' }
  },
  {
    id: 'env',
    titulo: 'Faturas aguardando envio',
    quantidade: 3,
    detalhe: 'Ainda não disparadas ao cliente',
    icon: 'schedule_send',
    tab: 'faturas',
    queryParams: { filtro: 'aguardando-envio' }
  }
];

export const PROXIMOS_VENCIMENTOS: readonly ProximoVencimentoBase[] = [
  { transportadora: 'Transp. Horizonte Ltda', valor: 4_200, vencimento: '14/05/2026', status: 'Em aberto' },
  { transportadora: 'Logística Sul ME', valor: 2_890.5, vencimento: '15/05/2026', status: 'Aguardando envio' },
  { transportadora: 'Cargo Prime Transportes', valor: 6_150, vencimento: '16/05/2026', status: 'Parcial' },
  { transportadora: 'Rota Azul Logística', valor: 1_980, vencimento: '18/05/2026', status: 'Em aberto' },
  { transportadora: 'Expresso Centro Oeste', valor: 3_310, vencimento: '08/05/2026', status: 'Vencido' }
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
