export type ConfigCobrancaModalidade = 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal';

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

export interface ConfigCobrancaRegraFlags {
  id: number;
  cobrarDiaria: boolean;
  cobrarSemanal: boolean;
  cobrarQuinzenal: boolean;
  cobrarMensal: boolean;
  cobrarDataPersonalizada: boolean;
  cobrarLavagem: boolean;
  cobrarPernoite: boolean;
  cobrarServicosExtras: boolean;
  considerarBeneficioAbastecimento: boolean;
}

export interface ConfigCobrancaListaItem {
  id: number;
  transportadoraId: number;
  estacionamentoId: number;
  transportadora: string;
  estacionamento: string;
  modalidade: ConfigCobrancaModalidade;
  modalidadeCobranca: number;
  diaFechamento: number | null;
  regraFechamento: number;
  fechamento: string;
  prazoVencimentoDias: number;
  prazoVencimento: string;
  envioAutomatico: boolean;
  gerarFaturaAutomaticamente: boolean;
  emailFinanceiro: string | null;
  status: ConfigCobrancaStatus;
  multaAplicar: boolean;
  multaPercentual: number;
  jurosAplicar: boolean;
  jurosPercentual: number;
  aplicarDescontoFixo: boolean;
  valorDescontoFixo: number;
  aplicarAcrescimoFixo: boolean;
  valorAcrescimoFixo: number;
  valorEstadia: number | null;
  pagamentoParcial: boolean;
  servicosCobrados: string;
  agrupamentoFatura: string;
  agruparPorPlaca: boolean;
  agruparPorPeriodo: boolean;
  agruparPorTransportadora: boolean;
  regra: ConfigCobrancaRegraFlags;
  /** true quando veio só da listagem (sem detalhe completo). */
  parcial?: boolean;
}

export interface ConfigCobrancaLookupOption {
  id: number;
  label: string;
}
