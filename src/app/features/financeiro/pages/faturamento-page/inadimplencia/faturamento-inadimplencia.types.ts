export type InadimplenciaStatusCobranca =
  | 'Não enviada'
  | 'Enviada'
  | 'Reenviada'
  | 'Em negociação'
  | 'Acordo realizado'
  | 'Sem retorno';

/** Filtro do select "Dias em atraso" */
export type InadimplenciaDiasFiltroId = 'all' | '1-7' | '8-15' | 'mais15' | 'mais30';

export type InadimplenciaFiltroRapidoId =
  | 'todas'
  | 'd1_7'
  | 'd8_15'
  | 'mais15'
  | 'mais30'
  | 'semCobranca'
  | 'emNegociacao';

export interface InadimplenciaHistoricoCobrancaItem {
  data: string;
  canal: string;
  acao: string;
  resultado: string;
}

export interface InadimplenciaListaItem {
  /** Id numérico da fatura (API). */
  faturaId: number;
  /** Número da fatura (exibição na grid). */
  id: string;
  transportadoraId: number;
  transportadora: string;
  estacionamento: string;
  valor: number;
  vencimento: string;
  diasAtraso: number;
  ultimaCobranca: string | null;
  statusCobranca: InadimplenciaStatusCobranca;
  emailFinanceiro: string;
  contato: string;
  historicoCobranca: InadimplenciaHistoricoCobrancaItem[];
  quantidadeMovimentos: number;
}

export interface InadimplenciaResumo {
  totalVencido: number;
  faturasVencidas: number;
  transportadorasInadimplentes: number;
  acordosRealizados: number;
}

export interface InadimplenciaAcordoDialogData {
  faturaId: string;
  transportadora: string;
  valorOriginal: number;
}
