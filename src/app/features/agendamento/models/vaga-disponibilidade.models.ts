export type ModalidadeVagaAgendamento = 1 | 2 | 3;
/** 1=Estacionamento, 2=Limpeza, 3=Ambos */

export type PeriodicidadeVagaReserva = 1 | 2 | 3 | 4;
/** 1=Diario, 2=Semanal, 3=Mensal, 4=Periodo */

/** @deprecated Preferir horaInicio/horaFim do slot da janela. */
export type PeriodoDiaVaga = 1 | 2 | 3 | null;
/** 1=Matutino, 2=Vespertino, 3=Noturno */

export interface VagaDisponibilidadeResumo {
  capacidadeEstacionamento: number | null;
  capacidadeLimpeza: number | null;
  vagasReservadasEstacionamento: number;
  vagasReservadasLimpeza: number;
  vagasDisponiveisEstacionamento: number | null;
  vagasDisponiveisLimpeza: number | null;
  controleAtivo: boolean;
  reservas: VagaReservaTransportadoraItem[];
}

export interface VagaReservaTransportadoraItem {
  id: number;
  transportadoraId: number;
  transportadoraNome: string;
  modalidade: ModalidadeVagaAgendamento;
  modalidadeLabel: string;
  quantidade: number;
  dataInicio: string;
  dataFim: string | null;
  periodicidade: PeriodicidadeVagaReserva;
  periodicidadeLabel: string;
  periodoDia: PeriodoDiaVaga;
  periodoDiaLabel: string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  /**
   * CSV `0..6` (Dom..Sáb), alinhado às Janelas — usado quando `periodicidade = 2` (Semanal).
   */
  diasSemana?: string | null;
  responsavelFaturamentoId?: number | null;
  responsavelFaturamentoNome?: string | null;
  avulso: boolean;
  /** Quando true, job pode transferir saldo não usado para a próxima janela do dia. */
  transferenciaAutomaticaSaldo: boolean;
  ativo: boolean;
}

export interface VagaReservaTransportadoraInput {
  transportadoraId: number;
  modalidade: ModalidadeVagaAgendamento;
  quantidade: number;
  dataInicio: string;
  dataFim?: string | null;
  periodicidade: PeriodicidadeVagaReserva;
  /** Mantido por compatibilidade; preferir horaInicio/horaFim. */
  periodoDia?: PeriodoDiaVaga;
  horaInicio: string;
  horaFim: string;
  /** CSV `0..6` (Dom..Sáb); enviar quando `periodicidade = 2`. */
  diasSemana?: string | null;
  responsavelFaturamentoId?: number | null;
  avulso?: boolean;
  /** Default false; ativa monitoramento/transferência automática de saldo. */
  transferenciaAutomaticaSaldo?: boolean;
}
