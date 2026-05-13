import type { FaturaStatusVisao } from '../faturamento-visao.types';

export type ModalidadeCobrancaFatura =
  | 'Diária'
  | 'Semanal'
  | 'Quinzenal'
  | 'Mensal'
  | 'Por data personalizada';

export type FiltroRapidoFaturas =
  | 'vencidas'
  | 'a-vencer'
  | 'dentro-prazo'
  | 'pagas'
  | 'aguardando-envio';

export interface FaturaListaEnvio {
  situacao: 'Enviado' | 'Não enviado' | 'Agendado';
  canal?: 'E-mail' | 'WhatsApp' | 'E-mail e WhatsApp';
  /** Texto curto para exibição (mock). */
  detalhe?: string;
}

export interface FaturaListaItem {
  id: string;
  transportadora: string;
  estacionamento: string;
  modalidade: ModalidadeCobrancaFatura;
  /** Início do período faturado (YYYY-MM-DD). */
  periodoInicio: string;
  /** Fim do período faturado (YYYY-MM-DD). */
  periodoFim: string;
  valor: number;
  /** Vencimento da fatura (YYYY-MM-DD). */
  vencimento: string;
  status: FaturaStatusVisao;
  envio: FaturaListaEnvio;
}
