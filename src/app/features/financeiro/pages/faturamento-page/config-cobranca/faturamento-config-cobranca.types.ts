export type ConfigCobrancaModalidade =
  | 'Diária'
  | 'Semanal'
  | 'Quinzenal'
  | 'Mensal'
  | 'Por data personalizada';

export type ConfigCobrancaStatus = 'Ativa' | 'Inativa' | 'Pendente de dados' | 'Sem e-mail financeiro';

export type ConfigCobrancaEnvioFiltroId = 'all' | 'ativo' | 'inativo';

export type ConfigCobrancaFiltroRapidoId =
  | 'todas'
  | 'ativas'
  | 'inativas'
  | 'pendentes'
  | 'semEmail'
  | 'envioAuto'
  | 'mensal'
  | 'quinzenal';

export interface ConfigCobrancaListaItem {
  id: string;
  transportadora: string;
  estacionamento: string;
  modalidade: ConfigCobrancaModalidade;
  fechamento: string;
  prazoVencimento: string;
  envioAutomatico: boolean;
  emailFinanceiro: string | null;
  status: ConfigCobrancaStatus;
  multaAplicar: boolean;
  multaPercentual: number;
  jurosAplicar: boolean;
  jurosPercentual: number;
  pagamentoParcial: boolean;
  servicosCobrados: string;
  agrupamentoFatura: string;
}
