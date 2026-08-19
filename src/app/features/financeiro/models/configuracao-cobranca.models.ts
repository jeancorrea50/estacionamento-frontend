/** Contratos alinhados a `/api/financeiro/ConfiguracaoCobranca`. */

export enum StatusConfiguracaoCobranca {
  Ativa = 1,
  Inativa = 2
}

export enum ModalidadeCobranca {
  Diaria = 1,
  Semanal = 2,
  Quinzenal = 3,
  Mensal = 4,
  Personalizado = 5,
  Acordo = 6
}

export enum TipoCobrancaExcedente {
  PorVaga = 1
}

export enum RegraFechamento {
  UltimoDiaDoMes = 1,
  DiaFixo = 2
}

/** Vagas contratadas por mês e regra de excedente quando a modalidade é Acordo. */
export interface ConfiguracaoCobrancaAcordo {
  vagasJaneiro: number | null;
  vagasFevereiro: number | null;
  vagasMarco: number | null;
  vagasAbril: number | null;
  vagasMaio: number | null;
  vagasJunho: number | null;
  vagasJulho: number | null;
  vagasAgosto: number | null;
  vagasSetembro: number | null;
  vagasOutubro: number | null;
  vagasNovembro: number | null;
  vagasDezembro: number | null;
  custoExcedente: number | null;
  tipoCobrancaExcedente: TipoCobrancaExcedente | null;
}

/** Serviços adicionais: cada flag habilita o respectivo valor, obrigatório quando ativa. */
export interface ConfiguracaoCobrancaServicosAdicionais {
  cobrarLavagem: boolean;
  valorLavagem: number | null;
  cobrarPernoite: boolean;
  valorPernoite: number | null;
  cobrarServicosExtras: boolean;
  valorServicosExtras: number | null;
  considerarBeneficioAbastecimento: boolean;
  valorBeneficioAbastecimento: number | null;
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
  diaFechamento: number | null;
  regraFechamento: RegraFechamento;
  prazoVencimentoDias: number;
  valorEstacionamento: number | null;
  emailFinanceiro: string | null;
  envioAutomaticoEmail: boolean;
  gerarFaturaAutomaticamente: boolean;
  dataCriacao: string;
}

export interface ConfiguracaoCobrancaOutput extends ConfiguracaoCobrancaServicosAdicionais, ConfiguracaoCobrancaAcordo {
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
  valorEstacionamento: number | null;
  /** Preenchida somente quando `modalidadeCobranca` é `Personalizado`. */
  dataCobranca: string | null;
  agruparPorPlaca: boolean;
  agruparPorPeriodo: boolean;
  agruparPorTransportadora: boolean;
}

export interface ConfiguracaoCobrancaPostInput extends ConfiguracaoCobrancaServicosAdicionais, ConfiguracaoCobrancaAcordo {
  id?: number;
  transportadoraId: number;
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
  valorEstacionamento: number | null;
  /** Enviada somente quando `modalidadeCobranca` é `Personalizado`. */
  dataCobranca: string | null;
  agruparPorPlaca: boolean;
  agruparPorPeriodo: boolean;
  agruparPorTransportadora: boolean;
}

export type ConfiguracaoCobrancaPutInput = ConfiguracaoCobrancaPostInput & { id: number };

export interface ConfiguracaoCobrancaPagedResult {
  items: ConfiguracaoCobrancaSearchOutput[];
  totalCount: number;
  numeroPagina: number;
  tamanhoPagina: number;
}
