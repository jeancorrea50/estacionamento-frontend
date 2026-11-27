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
  PorVaga = 1,
  PorHora = 2,
  PorPernoite = 3,
  PorDiaria = 4
}

export enum RegraFechamento {
  UltimoDiaDoMes = 1,
  DiaFixo = 2
}

/** Quem paga a fatura no contrato. */
export enum TipoPagadorCobranca {
  Transportadora = 1,
  Terceiro = 2
}

/** Derivado do pagador: Transportadora = CIF, Terceiro = FOB. */
export enum TipoOperacaoFaturamento {
  Cif = 1,
  Fob = 2
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
  /** Split CIF (fonte de verdade). FOB = max(0, total − CIF); CIF nulo ⇒ CIF = total. */
  vagasCifJaneiro: number | null;
  vagasCifFevereiro: number | null;
  vagasCifMarco: number | null;
  vagasCifAbril: number | null;
  vagasCifMaio: number | null;
  vagasCifJunho: number | null;
  vagasCifJulho: number | null;
  vagasCifAgosto: number | null;
  vagasCifSetembro: number | null;
  vagasCifOutubro: number | null;
  vagasCifNovembro: number | null;
  vagasCifDezembro: number | null;
  custoExcedente: number | null;
  tipoCobrancaExcedente: TipoCobrancaExcedente | null;
  /** Vigência do acordo; enviada somente na modalidade Acordo. */
  dataInicioAcordo: string | null;
  dataFimAcordo: string | null;
}

/** Serviços adicionais: cada flag habilita o respectivo valor, obrigatório quando ativa. */
export interface ConfiguracaoCobrancaServicosAdicionais {
  cobrarLavagem: boolean;
  valorLavagem: number | null;
  cobrarLimpeza: boolean;
  valorLimpeza: number | null;
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
  tipoPagadorCobranca?: TipoPagadorCobranca;
  responsavelFaturamentoId?: number | null;
  responsavelFaturamentoNome?: string | null;
  tipoOperacaoFaturamento?: TipoOperacaoFaturamento;
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
  tipoPagadorCobranca?: TipoPagadorCobranca;
  responsavelFaturamentoId?: number | null;
  responsavelFaturamentoNome?: string | null;
  tipoOperacaoFaturamento?: TipoOperacaoFaturamento;
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
  tipoPagadorCobranca: TipoPagadorCobranca;
  responsavelFaturamentoId: number | null;
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
