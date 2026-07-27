/** Contratos alinhados a `/api/financeiro/ConfiguracaoCobranca`. */

export enum StatusConfiguracaoCobranca {
  Ativa = 1,
  Inativa = 2
}

export enum ModalidadeCobranca {
  Diaria = 1,
  Semanal = 2,
  Quinzenal = 3,
  Mensal = 4
}

export enum RegraFechamento {
  UltimoDiaDoMes = 1,
  DiaFixo = 2
}

export interface ConfiguracaoCobrancaRegraDto {
  id: number;
  configuracaoCobrancaId?: number;
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

export interface ConfiguracaoCobrancaFilter {
  descricao?: string;
  dataInicial?: string;
  dataFinal?: string;
  numeroPagina: number;
  tamanhoPagina: number;
  transportadoraId?: number;
  estacionamentoId?: number;
  status?: StatusConfiguracaoCobranca;
}

export interface ConfiguracaoCobrancaSearchOutput {
  id: number;
  transportadoraId: number;
  transportadoraNome: string;
  estacionamentoId: number;
  estacionamentoNome: string;
  status: StatusConfiguracaoCobranca;
  modalidadeCobranca: ModalidadeCobranca;
  valorEstadia: number | null;
  emailFinanceiro: string | null;
  dataCriacao: string;
}

export interface ConfiguracaoCobrancaOutput {
  id: number;
  dataCriacao?: string;
  dataAtualizacao?: string | null;
  transportadoraId: number;
  transportadoraNome: string;
  estacionamentoId: number;
  estacionamentoNome: string;
  status: StatusConfiguracaoCobranca;
  modalidadeCobranca: ModalidadeCobranca;
  diaFechamento: number | null;
  regraFechamento: RegraFechamento;
  prazoVencimentoDias: number;
  emailFinanceiro: string | null;
  envioAutomaticoEmail: boolean;
  gerarFaturaAutomaticamente: boolean;
  permitirPagamentoParcial: boolean;
  aplicarMulta: boolean;
  multaPercentual: number;
  aplicarJuros: boolean;
  jurosPercentual: number;
  aplicarDescontoFixo: boolean;
  valorDescontoFixo: number;
  aplicarAcrescimoFixo: boolean;
  valorAcrescimoFixo: number;
  valorEstadia: number | null;
  agruparPorPlaca: boolean;
  agruparPorPeriodo: boolean;
  agruparPorTransportadora: boolean;
  regra: ConfiguracaoCobrancaRegraDto | null;
}

export interface ConfiguracaoCobrancaPostInput {
  id?: number;
  transportadoraId: number;
  estacionamentoId: number;
  status: StatusConfiguracaoCobranca;
  modalidadeCobranca: ModalidadeCobranca;
  diaFechamento: number | null;
  regraFechamento: RegraFechamento;
  prazoVencimentoDias: number;
  emailFinanceiro: string;
  envioAutomaticoEmail: boolean;
  gerarFaturaAutomaticamente: boolean;
  permitirPagamentoParcial: boolean;
  aplicarMulta: boolean;
  multaPercentual: number;
  aplicarJuros: boolean;
  jurosPercentual: number;
  aplicarDescontoFixo: boolean;
  valorDescontoFixo: number;
  aplicarAcrescimoFixo: boolean;
  valorAcrescimoFixo: number;
  valorEstadia: number | null;
  agruparPorPlaca: boolean;
  agruparPorPeriodo: boolean;
  agruparPorTransportadora: boolean;
  regra: ConfiguracaoCobrancaRegraDto;
}

export type ConfiguracaoCobrancaPutInput = ConfiguracaoCobrancaPostInput & { id: number };

export interface ConfiguracaoCobrancaPagedResult {
  items: ConfiguracaoCobrancaSearchOutput[];
  totalCount: number;
  numeroPagina: number;
  tamanhoPagina: number;
}
