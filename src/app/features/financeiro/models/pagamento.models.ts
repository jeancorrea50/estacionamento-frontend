import { ModalidadeRecebimento, StatusFatura, TipoFatura } from './fatura.models';

/** GET `/api/financeiro/pagamento` — query. */
export interface PagamentoFilter {
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

export interface ResumoPagamentosOutput {
  totalRecebidoPeriodo: number;
  pagamentosParciais: number;
  quantidadePagamentosParciais: number;
  valorPendente: number;
  quantidadePendentes: number;
  pagamentosDoDia: number;
}

export interface PagamentoItemOutput {
  id: number;
  numero: string;
  transportadoraId: number;
  transportadoraNome: string;
  valorTotal: number;
  valorRecebido: number;
  saldoRestante: number;
  dataPagamento: string | null;
  formaPagamento: ModalidadeRecebimento | null;
  tipoFatura: TipoFatura;
  status: StatusFatura;
  comprovante: string | null;
}

export interface PagamentoBuscarOutput {
  resumo: ResumoPagamentosOutput;
  itens: {
    items: PagamentoItemOutput[];
    totalCount: number;
    numeroPagina: number;
    tamanhoPagina: number;
  };
}

/** POST `/api/financeiro/pagamento` */
export interface PagamentoPostInput {
  faturaId: number;
  valorRecebido: number;
  dataPagamento: string;
  modalidadeRecebimento: ModalidadeRecebimento;
  observacao?: string | null;
}

/** PUT `/api/financeiro/pagamento` */
export interface PagamentoPutInput {
  id: number;
  valorRecebido: number;
  dataPagamento: string;
  modalidadeRecebimento: ModalidadeRecebimento;
  observacao?: string | null;
}
