/**
 * `Semanal` não é oferecida no cadastro, mas continua no contrato do backend
 * e precisa ser exibida em registros antigos.
 */
export type ConfigCobrancaModalidade = 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'Personalizada';

export type ConfigCobrancaStatus = 'Ativa' | 'Inativa' | 'Pendente de dados' | 'Sem e-mail financeiro';

export type ConfigCobrancaEnvioFiltroId = 'all' | 'ativo' | 'inativo';

/** Chaves dos serviços adicionais, usadas para montar a seção de forma declarativa. */
export type ConfigCobrancaServicoKey = 'lavagem' | 'pernoite' | 'extras' | 'beneficio';

/** Estado de um serviço adicional: habilitado e, quando habilitado, valor obrigatório. */
export interface ConfigCobrancaServicoEstado {
  habilitado: boolean;
  valor: number | null;
}

export type ConfigCobrancaServicos = Record<ConfigCobrancaServicoKey, ConfigCobrancaServicoEstado>;

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
  /** ISO `yyyy-MM-dd`; preenchida apenas na modalidade personalizada. */
  dataCobranca: string | null;
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
  valorEstacionamento: number | null;
  pagamentoParcial: boolean;
  servicos: ConfigCobrancaServicos;
  /** Resumo textual dos serviços adicionais habilitados. */
  servicosCobrados: string;
  /** true quando veio só da listagem (sem detalhe completo). */
  parcial?: boolean;
}

export interface ConfigCobrancaLookupOption {
  id: number;
  label: string;
}
