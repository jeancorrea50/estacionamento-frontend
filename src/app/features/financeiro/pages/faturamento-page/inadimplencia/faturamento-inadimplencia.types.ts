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
  id: string;
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
}

export interface InadimplenciaAcordoDialogData {
  faturaId: string;
  transportadora: string;
  valorOriginal: number;
}
