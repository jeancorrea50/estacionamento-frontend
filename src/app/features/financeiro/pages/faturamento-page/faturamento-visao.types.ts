/** Tipos compartilhados entre a página de Faturamento e a Visão Geral (evita import circular). */
export type FaturamentoTabId =
  | 'visao-geral'
  | 'fechamentos'
  | 'recebimentos'
  | 'inadimplencia'
  | 'config-cobranca';

export type PeriodoFiltroId = 'hoje' | 'semana' | 'mes' | 'personalizado';

export type FaturaStatusVisao =
  | 'Pago'
  | 'Em aberto'
  | 'Vencido'
  | 'Parcial'
  | 'Aguardando envio'
  | 'Cancelada';
