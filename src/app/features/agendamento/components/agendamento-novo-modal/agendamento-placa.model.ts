import type { DestinoFreteAgendamento } from '../../models/agendamento.models';

/** Placa selecionada no fluxo de novo agendamento (com motorista opcional). */
export interface AgendamentoPlacaSelecionada {
  id: number;
  placa: string;
  marcaModelo?: string;
  motoristaId?: number | null;
  motoristaNome?: string | null;
  motoristaCpf?: string | null;
  /** Motorista veio do vínculo do veículo — campo bloqueado até limpar com X. */
  motoristaBloqueado?: boolean;
  /** Destino do frete por vaga (CIF/FOB). */
  destinoFrete?: DestinoFreteAgendamento;
}
