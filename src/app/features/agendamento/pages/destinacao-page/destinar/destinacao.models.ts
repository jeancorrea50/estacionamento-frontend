// Tipos da tela Destinação (visão "Destinar").
// Uma "destinação" agrupa N reservas da API (`VagaReservaTransportadora`, uma por horário)
// que compartilham transportadora, quem destina, período, modalidade e recorrência.
import type { VagaReservaTransportadoraItem } from '../../../models/vaga-disponibilidade.models';

export type Modalidade = 'estacionamento' | 'limpeza' | 'ambos';
/** `personalizado` = Semanal com dias fora dos atalhos (só leitura / edição preserva). */
export type Recorrencia = 'todos' | 'uteis' | 'fds' | 'personalizado';
export type StatusRegra = 'ativa' | 'pausada' | 'encerrada';
export type TipoFaturamento = 'transportadora' | 'terceiro';

/** `id = 0` representa o próprio pátio (sem responsável de faturamento). */
export interface Empresa {
  id: number;
  nome: string;
  cnpj?: string;
}

export interface Transportadora extends Empresa {
  /** Saldo do acordo ainda não destinado (vagas/dia). `undefined` = sem acordo com teto. */
  saldoAcordo?: number;
  carregandoSaldo?: boolean;
}

/** Quem paga as vagas destinadas. */
export interface Faturamento {
  tipo: TipoFaturamento;
  /** Obrigatório quando tipo = 'terceiro' (`responsavelFaturamentoId`). */
  pagador: Empresa | null;
}

export interface TransportadoraSelecionada {
  transportadora: Transportadora;
  faturamento: Faturamento;
}

/** Slot de janela no dia de início da vigência (`GET /JanelaAgendamento/disponibilidade`). */
export interface Janela {
  /** `HH:mm|HH:mm` */
  id: string;
  inicio: string;
  fim: string;
  capacidade: number;
  /** Capacidade menos o que já está destinado (exceto a própria destinação em edição). */
  livres: number;
}

/** Um horário da destinação = uma reserva da API. */
export interface ItemDestinacao {
  /** Id da reserva (`VagaReservaTransportadora.id`). */
  id: number;
  horaInicio: string;
  horaFim: string;
  /** `06:00–07:00` */
  janela: string;
  vagas: number;
  usadasHoje: number;
  faturamento: Faturamento;
  status: Exclude<StatusRegra, 'encerrada'>;
}

export interface Destinacao {
  /** Chave do agrupamento (não é id de API). */
  id: string;
  transportadoraId: number | null; // null = avulso
  transportadoraNome: string;
  destinador: Empresa;
  inicio: string; // yyyy-MM-dd
  fim: string | null;
  modalidade: Modalidade;
  recorrencia: Recorrencia;
  /** CSV 0..6 quando Semanal (preservado na edição de `personalizado`). */
  diasSemana: string | null;
  transferenciaSaldo: boolean;
  status: StatusRegra;
  registradoPor: string;
  registradoEm: string | null;
  itens: ItemDestinacao[];
}

export interface GrupoDestinacao {
  /** `t{id}` ou `avulso`. */
  id: string;
  transportadoraId: number | null;
  nome: string;
  avulso: boolean;
  destinacoes: Destinacao[];
  horariosAtivos: number;
  vagasDia: number;
  temTerceiro: boolean;
}

export interface Disponibilidade {
  /** null = controle de capacidade desativado para a modalidade. */
  capacidade: number | null;
  reservadas: number;
}

export const MODALIDADES: ReadonlyArray<{ id: Modalidade; label: string; icon: string }> = [
  { id: 'estacionamento', label: 'Estacionamento', icon: 'local_parking' },
  { id: 'limpeza', label: 'Limpeza', icon: 'water_drop' },
  { id: 'ambos', label: 'Ambos', icon: 'select_all' },
];

export const RECORRENCIAS: ReadonlyArray<{ id: Recorrencia; label: string }> = [
  { id: 'todos', label: 'Todos os dias' },
  { id: 'uteis', label: 'Dias úteis (seg–sex)' },
  { id: 'fds', label: 'Fins de semana' },
];

export const RECORRENCIA_LABEL: Record<Recorrencia, string> = {
  todos: 'Todos os dias',
  uteis: 'Dias úteis',
  fds: 'Fins de semana',
  personalizado: 'Dias personalizados',
};

export const STATUS_LABEL: Record<StatusRegra, string> = {
  ativa: 'Ativa',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
};

// ─── Modal de criação/edição ─────────────────────────────────────────────
export type ModoFormulario = 'criar' | 'editar' | 'duplicar';

export interface DestinacaoFormData {
  modo: ModoFormulario;
  /** Obrigatório em 'editar' e 'duplicar'. */
  destinacao?: Destinacao;
  /** Pré-seleciona uma transportadora ao criar a partir do menu do grupo. */
  transportadora?: { id: number; nome: string };
  /** Reservas atuais (para calcular o saldo livre por janela). */
  reservas: ReadonlyArray<VagaReservaTransportadoraItem>;
}

/** Resultado do modal: quantas reservas a API gravou/alterou e quantas falharam. */
export interface DestinacaoFormResult {
  gravadas: number;
  falhas: number;
  /** Grupos afetados (para abrir na lista). */
  grupos: string[];
}
