/** Tipos do Relatório de Pagamentos. */

export interface PagamentoRelatorioFiltro {
  dataInicial?: string | null;
  dataFinal?: string | null;
  transportadoraId?: number | null;
  status?: number | null;
  formaPagamento?: number | null;
  numero?: string | null;
  descricao?: string | null;
  limite?: number | null;
}

export interface PagamentoRelatorioResumo {
  quantidade: number;
  valorTotal: number;
  valorRecebido: number;
  saldoRestante: number;
  qtdPago: number;
  qtdParcial: number;
  qtdEmAberto: number;
  qtdVencido: number;
}

export interface PagamentoRelatorioItem {
  id: number;
  numero: string;
  transportadoraId: number | null;
  transportadoraNome: string;
  valorTotal: number;
  valorRecebido: number;
  saldoRestante: number;
  dataPagamento: string | null;
  formaPagamento: number | null;
  formaPagamentoDescricao: string;
  tipoFatura: number;
  tipoFaturaDescricao: string;
  status: number;
  statusDescricao: string;
}

export interface PagamentoRelatorioOutput {
  resumo: PagamentoRelatorioResumo;
  itens: PagamentoRelatorioItem[];
  truncado: boolean;
  limiteAplicado: number;
}

export const PAGAMENTO_RELATORIO_STATUS_OPCOES: { value: number; label: string }[] = [
  { value: 1, label: 'Aguardando envio' },
  { value: 2, label: 'Em aberto' },
  { value: 3, label: 'Parcial' },
  { value: 4, label: 'Pago' },
  { value: 5, label: 'Vencido' },
  { value: 6, label: 'Cancelada' },
];

export const PAGAMENTO_RELATORIO_FORMA_OPCOES: { value: number; label: string }[] = [
  { value: 1, label: 'PIX' },
  { value: 2, label: 'Boleto' },
  { value: 3, label: 'Transferência' },
  { value: 4, label: 'Cartão' },
];
