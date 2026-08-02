import type { ModalidadeRecebimento, StatusFatura } from '../../../models/fatura.models';

export type FaturaStatusLabel =
  | 'Pago'
  | 'Em aberto'
  | 'Vencido'
  | 'Parcial'
  | 'Aguardando envio'
  | 'Cancelada';

export type ModalidadeRecebimentoLabel = 'Pix' | 'Boleto' | 'Transferência' | 'Cartão';

export type FiltroRapidoFaturas =
  | 'vencidas'
  | 'a-vencer'
  | 'dentro-prazo'
  | 'pagas'
  | 'aguardando-envio';

export interface FaturaLookupOption {
  id: number;
  label: string;
}

/** Item da grid / formulário — alinhado a FaturaSearchOutput + campos extras do Output. */
export interface FaturaListaItem {
  id: number;
  numero: string;
  transportadoraId: number;
  transportadora: string;
  estacionamentoId: number;
  estacionamento: string;
  status: FaturaStatusLabel;
  statusCodigo: StatusFatura;
  modalidadeRecebimento: ModalidadeRecebimentoLabel | '—';
  modalidadeRecebimentoCodigo: ModalidadeRecebimento | null;
  valorTotal: number;
  valorRecebido: number;
  valorEmAberto: number;
  /** yyyy-MM-dd */
  dataEmissao: string;
  /** yyyy-MM-dd */
  vencimento: string;
  dataPagamento: string | null;
  periodoInicio: string;
  periodoFim: string;
  emailEnvio: string | null;
  observacao: string | null;
  configuracaoCobrancaId: number | null;
  valorDesconto: number;
  valorAcrescimo: number;
  valorJuros: number;
  valorMulta: number;
  /** true = veio só da listagem (sem detalhes completos). */
  parcial: boolean;
}
