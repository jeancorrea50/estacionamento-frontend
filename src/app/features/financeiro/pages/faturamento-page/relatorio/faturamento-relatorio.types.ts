/** Tipos da aba Relatório de Faturamento. */

export type RelatorioPeriodoCampo = 'emissao' | 'vencimento' | 'pagamento';

export interface FaturaRelatorioFiltro {
  dataInicial?: string | null;
  dataFinal?: string | null;
  periodoCampo?: RelatorioPeriodoCampo;
  transportadoraId?: number | null;
  status?: number | null;
  modalidadeRecebimento?: number | null;
  tipoFatura?: number | null;
  numero?: string | null;
  descricao?: string | null;
  dataVencimentoInicial?: string | null;
  dataVencimentoFinal?: string | null;
  dataPagamentoInicial?: string | null;
  dataPagamentoFinal?: string | null;
  valorMinimo?: number | null;
  valorMaximo?: number | null;
  limite?: number | null;
}

export interface FaturaRelatorioResumo {
  quantidade: number;
  valorTotal: number;
  valorRecebido: number;
  valorEmAberto: number;
  qtdPago: number;
  qtdEmAberto: number;
  qtdVencido: number;
  qtdCancelada: number;
}

export interface FaturaRelatorioItem {
  id: number;
  numero: string;
  transportadoraId: number | null;
  transportadoraNome: string;
  estacionamentoId: number;
  estacionamentoNome: string;
  tipoFatura: number;
  tipoFaturaDescricao: string;
  status: number;
  statusDescricao: string;
  modalidadeRecebimento: number | null;
  modalidadeDescricao: string;
  valorTotal: number;
  valorRecebido: number;
  valorEmAberto: number;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento: string | null;
  observacao: string | null;
}

export interface FaturaRelatorioOutput {
  resumo: FaturaRelatorioResumo;
  itens: FaturaRelatorioItem[];
  truncado: boolean;
  limiteAplicado: number;
}

export const RELATORIO_STATUS_OPCOES: { value: number; label: string }[] = [
  { value: 1, label: 'Aguardando envio' },
  { value: 2, label: 'Em aberto' },
  { value: 3, label: 'Parcial' },
  { value: 4, label: 'Pago' },
  { value: 5, label: 'Vencido' },
  { value: 6, label: 'Cancelada' },
];

export const RELATORIO_MODALIDADE_OPCOES: { value: number; label: string }[] = [
  { value: 1, label: 'PIX' },
  { value: 2, label: 'Boleto' },
  { value: 3, label: 'Transferência' },
  { value: 4, label: 'Cartão' },
];

export const RELATORIO_TIPO_OPCOES: { value: number; label: string }[] = [
  { value: 1, label: 'Avulso' },
  { value: 2, label: 'Faturado' },
];

export const RELATORIO_PERIODO_CAMPO_OPCOES: { value: RelatorioPeriodoCampo; label: string }[] = [
  { value: 'emissao', label: 'Emissão' },
  { value: 'vencimento', label: 'Vencimento' },
  { value: 'pagamento', label: 'Pagamento' },
];
