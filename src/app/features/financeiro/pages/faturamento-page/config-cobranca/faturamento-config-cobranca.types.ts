/**
 * Modalidades do contrato de configuração de cobrança.
 * Semanal e Mensal exigem `diaFechamento` (1–7 = dia da semana; 1–31 = dia do mês).
 */
export type ConfigCobrancaModalidade =
  | 'Diária'
  | 'Semanal'
  | 'Quinzenal'
  | 'Mensal'
  | 'Personalizada'
  | 'Acordo';

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

export type ConfigCobrancaMesAcordo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type ConfigCobrancaVagasAcordo = Record<ConfigCobrancaMesAcordo, number | null>;

/** Grupo de meses com a mesma quantidade de vagas dentro do acordo. */
export interface ConfigCobrancaAcordoListagem {
  id: string;
  meses: ConfigCobrancaMesAcordo[];
  quantidade: number | null;
}

export interface ConfigCobrancaAcordo {
  /** ISO `yyyy-MM-dd`. */
  dataInicio: string | null;
  /** ISO `yyyy-MM-dd`. */
  dataFim: string | null;
  listagens: ConfigCobrancaAcordoListagem[];
  vagas: ConfigCobrancaVagasAcordo;
  custoExcedente: number | null;
  tipoCobrancaExcedente: number;
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
  acordo: ConfigCobrancaAcordo;
}

export interface ConfigCobrancaLookupOption {
  id: number;
  label: string;
  cnpj?: string;
}
