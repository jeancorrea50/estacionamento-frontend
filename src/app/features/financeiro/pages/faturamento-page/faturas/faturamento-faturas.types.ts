import type { ModalidadeRecebimento, StatusFatura, TipoFatura } from '../../../models/fatura.models';

export type FaturaStatusLabel =
  | 'Pago'
  | 'Em aberto'
  | 'Vencido'
  | 'Parcial'
  | 'Aguardando envio'
  | 'Cancelada';

export type ModalidadeRecebimentoLabel = 'Pix' | 'Boleto' | 'Transferência' | 'Cartão';

export type TipoFaturaLabel = 'Avulso' | 'Cobrança';

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
  tipoFatura: TipoFaturaLabel;
  tipoFaturaCodigo: TipoFatura;
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
  itens?: FaturaItemLista[];
  valorTotalExcedente?: number;
}

export interface FaturaItemLista {
  id: number;
  entradaSaidaId: number;
  placa: string;
  dataHoraEntrada: string;
  dataHoraSaida: string;
  tempoPermanenciaMinutos: number;
  valorEstacionamento: number;
  valorLavagem: number;
  valorPernoite: number;
  valorServicosExtras: number;
  valorExcedente: number;
  valorBeneficioAbastecimento: number;
  valorTotal: number;
  descricao: string;
  ehExcedente: boolean;
}
