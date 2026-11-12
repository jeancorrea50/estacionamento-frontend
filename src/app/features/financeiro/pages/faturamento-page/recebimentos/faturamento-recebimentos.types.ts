import type { ModalidadeRecebimento, TipoFatura } from '../../../models/fatura.models';
import type { TipoFaturaLabel } from '../faturas/faturamento-faturas.types';

export type RecebimentoPagamentoStatus =
  | 'Pago'
  | 'Parcial'
  | 'Em aberto'
  | 'Vencido'
  | 'Cancelada';

export type RecebimentoComprovanteEstado =
  | 'Anexado'
  | 'Sem comprovante'
  | 'Aguardando conferência'
  | '—';

export type RecebimentoFormaPagamento =
  | 'PIX'
  | 'Boleto'
  | 'Transferência'
  | 'Cartão'
  | 'Dinheiro'
  | 'Outros';

export type RecebimentoPeriodoGranularidade = 'dia' | 'mes' | 'ano';

export type RecebimentoFiltroRapidoId =
  | 'todos'
  | 'pagos'
  | 'parciais'
  | 'pendentes'
  | 'vencidos'
  | 'comComprovante'
  | 'semComprovante';

export interface RecebimentoHistoricoItem {
  data: string;
  forma: string;
  valor: number;
  situacao: string;
}

export interface RecebimentoListaItem {
  faturaId: number;
  id: string;
  transportadoraId: number;
  transportadora: string;
  estacionamento: string;
  tipoFatura: TipoFaturaLabel;
  tipoFaturaCodigo: TipoFatura;
  valorFatura: number;
  valorRecebido: number;
  saldoRestante: number;
  dataPagamento: string | null;
  formaPagamento: RecebimentoFormaPagamento | string | null;
  comprovante: RecebimentoComprovanteEstado;
  status: RecebimentoPagamentoStatus;
  historico: RecebimentoHistoricoItem[];
}

export interface RecebimentoResumo {
  totalRecebidoPeriodo: number;
  pagamentosParciais: number;
  quantidadePagamentosParciais: number;
  valorPendente: number;
  quantidadePendentes: number;
  pagamentosDoDia: number;
}

/** @deprecated Use RecebimentoPagamentoDialogData. */
export interface RecebimentoPartialDialogData {
  faturaId: string;
  valorTotal: number;
  valorJaRecebido: number;
  saldoRestante: number;
}

export interface RecebimentoPagamentoDialogData {
  mode: 'create' | 'edit';
  faturaId: number;
  faturaNumero: string;
  valorTotal: number;
  valorJaRecebido: number;
  saldoRestante: number;
  valorRecebidoInicial?: number;
  dataPagamentoInicial?: string | null;
  formaInicial?: ModalidadeRecebimento | null;
  observacaoInicial?: string | null;
  /** Id do pagamento para PUT/DELETE; fallback = faturaId quando a API unifica. */
  pagamentoId?: number | null;
}

export interface RecebimentoPagamentoDialogResult {
  mode: 'create' | 'edit';
  faturaId: number;
  pagamentoId: number;
  valorRecebido: number;
  /** yyyy-MM-dd */
  dataPagamento: string;
  modalidadeRecebimento: ModalidadeRecebimento;
  observacao: string | null;
}
