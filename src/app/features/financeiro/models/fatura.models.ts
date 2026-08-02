/** Contratos alinhados a `/api/financeiro/Fatura`. */

export enum StatusFatura {
  AguardandoEnvio = 1,
  EmAberto = 2,
  Parcial = 3,
  Pago = 4,
  Vencido = 5,
  Cancelada = 6
}

export enum ModalidadeRecebimento {
  Pix = 1,
  Boleto = 2,
  Transferencia = 3,
  Cartao = 4
}

export interface FaturaFilter {
  transportadoraId?: number;
  estacionamentoId?: number;
  status?: StatusFatura;
  modalidadeRecebimento?: ModalidadeRecebimento;
  numero?: string;
  descricao?: string;
  dataInicial?: string;
  dataFinal?: string;
  numeroPagina: number;
  tamanhoPagina: number;
  propriedade?: string;
  sort?: string;
}

export interface FaturaSearchOutput {
  id: number;
  numero: string;
  transportadoraId: number;
  transportadoraNome: string;
  estacionamentoId: number;
  estacionamentoNome: string;
  status: StatusFatura;
  modalidadeRecebimento: ModalidadeRecebimento | null;
  valorTotal: number;
  valorRecebido: number;
  valorEmAberto: number;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento: string | null;
}

export interface FaturaOutput {
  id: number;
  dataCriacao?: string;
  dataAtualizacao?: string | null;
  transportadoraId: number;
  transportadoraNome: string;
  estacionamentoId: number;
  estacionamentoNome: string;
  configuracaoCobrancaId: number | null;
  numero: string;
  status: StatusFatura;
  modalidadeRecebimento: ModalidadeRecebimento | null;
  valorTotal: number;
  valorRecebido: number;
  valorEmAberto: number;
  valorDesconto: number;
  valorAcrescimo: number;
  valorJuros: number;
  valorMulta: number;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento: string | null;
  periodoInicio: string;
  periodoFim: string;
  emailEnvio: string | null;
  observacao: string | null;
}

/** POST `/api/financeiro/Fatura` — estacionamentoId nulo usa EmpresaId do token. */
export interface FaturaPostInput {
  transportadoraId: number;
  estacionamentoId?: number | null;
}

export interface FaturaPutInput {
  id: number;
  dataCriacao?: string;
  dataAtualizacao?: string | null;
  transportadoraId: number;
  estacionamentoId: number;
  configuracaoCobrancaId?: number | null;
  numero?: string | null;
  status: StatusFatura;
  modalidadeRecebimento?: ModalidadeRecebimento | null;
  valorTotal: number;
  valorRecebido: number;
  valorDesconto: number;
  valorAcrescimo: number;
  valorJuros: number;
  valorMulta: number;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento?: string | null;
  periodoInicio: string;
  periodoFim: string;
  emailEnvio?: string | null;
  observacao?: string | null;
}

export interface FaturaPagedResult {
  items: FaturaSearchOutput[];
  totalCount: number;
  numeroPagina: number;
  tamanhoPagina: number;
}

/** GET `/api/financeiro/Fatura/inadimplentes` — query. */
export interface FaturaInadimplentesFilter {
  transportadoraId?: number;
  numero?: string;
  descricao?: string;
  dataInicial?: string;
  dataFinal?: string;
  numeroPagina: number;
  tamanhoPagina: number;
  propriedade?: string;
  sort?: string;
}

export interface ResumoInadimplentesOutput {
  totalVencido: number;
  faturasVencidas: number;
  transportadorasInadimplentes: number;
  acordosRealizados: number;
}

export interface FaturaInadimplenteItemOutput {
  id: number;
  numero: string;
  transportadoraId: number;
  transportadoraNome: string;
  status: StatusFatura;
  valorTotal: number;
  valorRecebido: number;
  valorEmAberto: number;
  dataVencimento: string;
  diasEmAtraso: number;
  quantidadeMovimentos: number;
  ultimaCobranca: string | null;
  statusCobranca: string | null;
}

export interface FaturaInadimplentesOutput {
  resumo: ResumoInadimplentesOutput;
  itens: {
    items: FaturaInadimplenteItemOutput[];
    totalCount: number;
    numeroPagina: number;
    tamanhoPagina: number;
  };
}

/** GET `/api/financeiro/Fatura/recebimentos` — query. */
export interface FaturaRecebimentosFilter {
  transportadoraId?: number;
  status?: StatusFatura;
  formaPagamento?: ModalidadeRecebimento;
  numero?: string;
  descricao?: string;
  dataInicial?: string;
  dataFinal?: string;
  numeroPagina: number;
  tamanhoPagina: number;
  propriedade?: string;
  sort?: string;
}

export interface ResumoRecebimentosOutput {
  totalRecebidoPeriodo: number;
  pagamentosParciais: number;
  quantidadePagamentosParciais: number;
  valorPendente: number;
  quantidadePendentes: number;
  recebimentosDoDia: number;
}

export interface FaturaRecebimentoItemOutput {
  id: number;
  numero: string;
  transportadoraId: number;
  transportadoraNome: string;
  valorTotal: number;
  valorRecebido: number;
  saldoRestante: number;
  dataPagamento: string | null;
  formaPagamento: ModalidadeRecebimento | null;
  status: StatusFatura;
  comprovante: string | null;
}

export interface FaturaRecebimentosOutput {
  resumo: ResumoRecebimentosOutput;
  itens: {
    items: FaturaRecebimentoItemOutput[];
    totalCount: number;
    numeroPagina: number;
    tamanhoPagina: number;
  };
}

/** GET `/api/financeiro/Fatura/fechamentos` — query. */
export enum SituacaoFechamento {
  ProntoParaFaturar = 1,
  EmAndamento = 2,
  ComDivergencia = 3,
  Faturado = 4,
  Cancelado = 5
}

export interface FaturaFechamentosFilter {
  transportadoraId?: number;
  situacao?: SituacaoFechamento;
  modalidade?: number;
  descricao?: string;
  dataInicial?: string;
  dataFinal?: string;
  numeroPagina: number;
  tamanhoPagina: number;
  propriedade?: string;
  sort?: string;
}

export interface ResumoFechamentosOutput {
  fechamentosDisponiveis: number;
  prontosParaFaturar: number;
  valorEstimadoTotal: number;
  comDivergencia: number;
}

export interface FaturaFechamentoItemOutput {
  transportadoraId: number;
  transportadoraNome: string;
  configuracaoCobrancaId: number | null;
  modalidade: number | null;
  periodoInicio: string | null;
  periodoFim: string | null;
  quantidadeMovimentos: number;
  valorEstimado: number;
  quantidadeDivergencias: number;
  situacao: SituacaoFechamento;
}

export interface FaturaFechamentosOutput {
  resumo: ResumoFechamentosOutput;
  itens: {
    items: FaturaFechamentoItemOutput[];
    totalCount: number;
    numeroPagina: number;
    tamanhoPagina: number;
  };
}
