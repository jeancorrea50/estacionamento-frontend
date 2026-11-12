export type ModalidadeVagaAgendamento = 1 | 2 | 3;
/** 1=Estacionamento, 2=Limpeza, 3=Ambos */

export type PeriodicidadeVagaReserva = 1 | 2 | 3 | 4;
/** 1=Diario, 2=Semanal, 3=Mensal, 4=Periodo */

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
  avulso: boolean;
  ativo: boolean;
}

export interface VagaReservaTransportadoraInput {
  transportadoraId: number;
  modalidade: ModalidadeVagaAgendamento;
  quantidade: number;
  dataInicio: string;
  dataFim?: string | null;
  periodicidade: PeriodicidadeVagaReserva;
  periodoDia?: PeriodoDiaVaga;
  avulso?: boolean;
}
