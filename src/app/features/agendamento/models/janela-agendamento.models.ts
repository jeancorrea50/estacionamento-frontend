/**
 * Contrato `JanelaAgendamento` (API `/api/JanelaAgendamento`).
 * Enums espelham o backend: ModalidadeAgendamento, JanelaGranularidadeUnidade,
 * JanelaPeriodicidadeTipo e JanelaExcecaoTipo.
 */

/**
 * Modalidade da janela / destinação / agendamento.
 * 1 = Estacionamento, 2 = Limpeza, 3 = Ambos (ocupa as duas capacidades).
 */
export type ModalidadeJanela = 1 | 2 | 3;
export const MODALIDADE_ESTACIONAMENTO: ModalidadeJanela = 1;
export const MODALIDADE_LIMPEZA: ModalidadeJanela = 2;
export const MODALIDADE_AMBOS: ModalidadeJanela = 3;

/** Alias: mesma enum no agendamento/slots. */
export type ModalidadeAgendamento = ModalidadeJanela;
export const MODALIDADE_AGENDAMENTO_AMBOS: ModalidadeAgendamento = 3;

/** 1 = Hora, 2 = Minuto. */
export type GranularidadeUnidade = 1 | 2;
export const GRANULARIDADE_HORA: GranularidadeUnidade = 1;
export const GRANULARIDADE_MINUTO: GranularidadeUnidade = 2;
export const GRANULARIDADE_MAX: Record<GranularidadeUnidade, number> = { 1: 24, 2: 1440 };

/** 1 = Diário, 2 = Dias da semana, 3 = Semanal, 4 = Mensal, 5 = Anual. */
export type PeriodicidadeTipo = 1 | 2 | 3 | 4 | 5;
/** 1 = Bloqueio, 2 = Ajuste de capacidade. */
export type ExcecaoTipo = 1 | 2;

export const MODALIDADE_JANELA_OPCOES: ReadonlyArray<{ value: ModalidadeJanela; label: string }> = [
  { value: 1, label: 'Estacionamento' },
  { value: 2, label: 'Limpeza' },
  { value: 3, label: 'Ambos' },
];

/** Opções de CRUD/lista de janelas — sem Ambos (só Estacionamento e Limpeza). */
export const MODALIDADE_JANELA_CRUD_OPCOES: ReadonlyArray<{
  value: ModalidadeJanela;
  label: string;
}> = MODALIDADE_JANELA_OPCOES.filter((o) => o.value === 1 || o.value === 2);

/** Opções do modal Novo agendamento / seletor de slot (inclui Ambos). */
export const MODALIDADE_AGENDAMENTO_OPCOES: ReadonlyArray<{
  value: ModalidadeAgendamento;
  label: string;
}> = MODALIDADE_JANELA_OPCOES;

export function parseModalidadeAgendamento(raw: unknown): ModalidadeAgendamento {
  const n = Number(raw);
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

export function parseModalidadeJanela(raw: unknown): ModalidadeJanela {
  return parseModalidadeAgendamento(raw);
}

export const GRANULARIDADE_OPCOES: ReadonlyArray<{ value: GranularidadeUnidade; label: string }> = [
  { value: 1, label: 'Hora(s)' },
  { value: 2, label: 'Minuto(s)' },
];

export const PERIODICIDADE_OPCOES: ReadonlyArray<{ value: PeriodicidadeTipo; label: string }> = [
  { value: 1, label: 'Diário' },
  { value: 2, label: 'Dias da semana' },
  { value: 3, label: 'Semanal' },
  { value: 4, label: 'Mensal' },
  { value: 5, label: 'Anual' },
];

export const EXCECAO_OPCOES: ReadonlyArray<{ value: ExcecaoTipo; label: string }> = [
  { value: 1, label: 'Bloqueio' },
  { value: 2, label: 'Ajuste de capacidade' },
];

/** CSV da API: 0 = Domingo … 6 = Sábado. */
export const DIAS_SEMANA_OPCOES: ReadonlyArray<{ value: number; label: string; abrev: string }> = [
  { value: 1, label: 'Segunda', abrev: 'Seg' },
  { value: 2, label: 'Terça', abrev: 'Ter' },
  { value: 3, label: 'Quarta', abrev: 'Qua' },
  { value: 4, label: 'Quinta', abrev: 'Qui' },
  { value: 5, label: 'Sexta', abrev: 'Sex' },
  { value: 6, label: 'Sábado', abrev: 'Sáb' },
  { value: 0, label: 'Domingo', abrev: 'Dom' },
];

export const MESES_OPCOES: ReadonlyArray<{ value: number; label: string }> = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
].map((label, i) => ({ value: i + 1, label }));

export function modalidadeJanelaLabel(m: number | null | undefined): string {
  return MODALIDADE_JANELA_OPCOES.find((o) => o.value === m)?.label ?? '—';
}

// ── Entidades (leitura) ──────────────────────────────────────────────

export interface JanelaFaixa {
  id?: number;
  /** `HH:mm` */
  horaInicio: string;
  /** `HH:mm` */
  horaFim: string;
  ordem: number;
}

export interface JanelaPeriodicidade {
  id?: number;
  tipo: PeriodicidadeTipo;
  /** CSV `0..6` (Dom..Sáb) para tipo 2 e 3. */
  diasSemana: string;
  diaMes: number | null;
  mes: number | null;
  /** `yyyy-MM-dd` */
  dataInicio: string;
  /** `yyyy-MM-dd` */
  dataFim: string | null;
  ativo: boolean;
  descricao: string;
}

export interface JanelaExcecao {
  id?: number;
  /** `yyyy-MM-dd` */
  data: string;
  tipo: ExcecaoTipo;
  horaInicio: string | null;
  horaFim: string | null;
  vagasAjuste: number | null;
  motivo: string;
}

export interface JanelaAgendamentoDetalhe {
  id: number;
  estacionamentoId: number;
  modalidade: ModalidadeJanela;
  nome: string;
  descricao: string;
  dataVigenciaInicio: string;
  dataVigenciaFim: string | null;
  ativo: boolean;
  granularidadeUnidade: GranularidadeUnidade;
  granularidadeValor: number;
  vagasPorSlot: number;
  faixas: JanelaFaixa[];
  periodicidades: JanelaPeriodicidade[];
  excecoes: JanelaExcecao[];
}

export interface JanelaAgendamentoListItem {
  id: number;
  estacionamentoId: number;
  modalidade: ModalidadeJanela;
  nome: string;
  descricao: string;
  dataVigenciaInicio: string;
  dataVigenciaFim: string | null;
  ativo: boolean;
  vagasPorSlot: number;
  qtdFaixas: number;
  qtdPeriodicidades: number;
  /** Derivado: `qtdFaixas × vagasPorSlot` (capacidade do dia na janela). */
  totalDisponibilizacoes: number;
  /** Preenchido via detalhe (ou se a lista já trouxer faixas/periodicidades). */
  recorrenciaLabel?: string;
  /** Ex.: `06h às 18h` (extremos das faixas). */
  horarioResumo?: string;
}

export interface JanelaPagedResult {
  items: JanelaAgendamentoListItem[];
  totalCount: number;
  numeroPagina: number;
  tamanhoPagina: number;
}

// ── Entrada (POST/PUT/duplicar/filtro) ───────────────────────────────

export interface JanelaAgendamentoPayload {
  /** Obrigatório apenas no PUT. */
  id?: number;
  /** Omitido: o backend resolve o pátio da sessão. */
  estacionamentoId?: number;
  modalidade: ModalidadeJanela;
  nome: string;
  descricao?: string | null;
  dataVigenciaInicio: string;
  dataVigenciaFim?: string | null;
  ativo: boolean;
  granularidadeUnidade: GranularidadeUnidade;
  granularidadeValor: number;
  vagasPorSlot: number;
  faixas: Array<{ id?: number; horaInicio: string; horaFim: string; ordem: number }>;
  periodicidades: Array<{
    id?: number;
    tipo: PeriodicidadeTipo;
    diasSemana?: string | null;
    diaMes?: number | null;
    mes?: number | null;
    dataInicio: string;
    dataFim?: string | null;
    ativo: boolean;
    descricao?: string | null;
  }>;
  excecoes: Array<{
    id?: number;
    data: string;
    tipo: ExcecaoTipo;
    horaInicio?: string | null;
    horaFim?: string | null;
    vagasAjuste?: number | null;
    motivo?: string | null;
  }>;
}

export interface JanelaAgendamentoFiltro {
  modalidade?: ModalidadeJanela | null;
  ativo?: boolean | null;
  numeroPagina?: number;
  tamanhoPagina?: number;
}

export interface JanelaDuplicarInput {
  janelaOrigemId: number;
  modalidadeDestino: ModalidadeJanela;
  nome: string;
}

// ── Disponibilidade (tela Agendar) ───────────────────────────────────

export interface JanelaSlotDisponivel {
  janelaAgendamentoId: number;
  horaInicio: string;
  horaFim: string;
  capacidade: number;
  ocupadas: number;
  disponiveis: number;
  viaDestinacao: boolean;
  label: string;
  /** Quem paga as vagas destinadas do horário (só com destinação). null = segue a regra de cobrança ou misto. */
  tipoPagador?: 'transportadora' | 'terceiro' | null;
  /** Nome do terceiro pagador, quando houver. */
  pagadorNome?: string | null;
}

export interface JanelaDisponibilidade {
  /** `yyyy-MM-dd` */
  data: string;
  modalidade: ModalidadeAgendamento;
  usouDestinacao: boolean;
  /**
   * Totais do dia (BE): incluem slots esgotados omitidos de `slots`.
   * Ausentes em clientes antigos → FE soma a partir de `slots`.
   */
  totalCapacidade?: number;
  totalOcupadas?: number;
  totalDisponiveis?: number;
  slots: JanelaSlotDisponivel[];
}

/** Resumo de um dia para o calendário do agendamento (`/disponibilidade/periodo`). */
export interface JanelaDisponibilidadeDia {
  /** `yyyy-MM-dd` */
  data: string;
  possuiJanelas: boolean;
  /** A transportadora tem destinação cobrindo o dia (vagas limitadas a ela). */
  usouDestinacao: boolean;
  totalDisponiveis: number;
  horariosDisponiveis: number;
}
