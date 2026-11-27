import { toIsoDateLocal } from '../../pages/agendamentos-page/agendamento-dashboard.util';
import {
  ExcecaoTipo,
  GranularidadeUnidade,
  JanelaAgendamentoDetalhe,
  JanelaAgendamentoPayload,
  ModalidadeJanela,
  PeriodicidadeTipo,
} from '../../models/janela-agendamento.models';

/** Dados de abertura do modal de criar/editar janela. */
export interface JanelaFormDialogData {
  mode: 'create' | 'edit';
  /** Modalidade pré-selecionada na criação. */
  modalidade: ModalidadeJanela;
  /** Detalhe completo (GET {id}) — obrigatório em `edit`. */
  janela?: JanelaAgendamentoDetalhe;
}

export interface JanelaFormDialogResult {
  saved: true;
  janela: JanelaAgendamentoDetalhe;
}

/** Seções do formulário (validação / erros). */
export type JanelaFormAba = 'horarios' | 'capacidade' | 'excecoes' | 'periodicidade';

let uidSeq = 0;
/** Identidade estável das linhas (track do `@for`), independente do `id` do backend. */
export function novoUid(): number {
  uidSeq += 1;
  return uidSeq;
}

export interface FaixaForm {
  uid: number;
  id?: number;
  horaInicio: string;
  horaFim: string;
}

export interface PeriodicidadeForm {
  uid: number;
  id?: number;
  tipo: PeriodicidadeTipo;
  /** 0 = Dom … 6 = Sáb */
  dias: number[];
  diaMes: number | null;
  mes: number | null;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  descricao: string;
}

export interface ExcecaoForm {
  uid: number;
  id?: number;
  data: string;
  tipo: ExcecaoTipo;
  horaInicio: string;
  horaFim: string;
  vagasAjuste: number | null;
  motivo: string;
}

export interface JanelaFormState {
  nome: string;
  descricao: string;
  modalidade: ModalidadeJanela;
  dataVigenciaInicio: string;
  dataVigenciaFim: string;
  ativo: boolean;
  granularidadeUnidade: GranularidadeUnidade;
  granularidadeValor: number | null;
  vagasPorSlot: number | null;
  faixas: FaixaForm[];
  periodicidades: PeriodicidadeForm[];
  excecoes: ExcecaoForm[];
}

export function periodicidadeVazia(dataInicio: string): PeriodicidadeForm {
  return {
    uid: novoUid(),
    tipo: 1,
    dias: [],
    diaMes: null,
    mes: null,
    dataInicio,
    dataFim: '',
    ativo: true,
    descricao: '',
  };
}

/** Nova janela: vigência a partir de hoje, 1 hora, uma periodicidade diária. */
export function formVazio(modalidade: ModalidadeJanela): JanelaFormState {
  const hoje = toIsoDateLocal(new Date());
  return {
    nome: '',
    descricao: '',
    modalidade,
    dataVigenciaInicio: hoje,
    dataVigenciaFim: '',
    ativo: true,
    granularidadeUnidade: 1,
    granularidadeValor: 1,
    vagasPorSlot: null,
    faixas: [],
    periodicidades: [periodicidadeVazia(hoje)],
    excecoes: [],
  };
}

function csvParaDias(csv: string): number[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[0-6]$/.test(s))
    .map(Number);
}

export function formDeDetalhe(d: JanelaAgendamentoDetalhe): JanelaFormState {
  return {
    nome: d.nome,
    descricao: d.descricao,
    modalidade: d.modalidade,
    dataVigenciaInicio: d.dataVigenciaInicio,
    dataVigenciaFim: d.dataVigenciaFim ?? '',
    ativo: d.ativo,
    granularidadeUnidade: d.granularidadeUnidade,
    granularidadeValor: d.granularidadeValor,
    vagasPorSlot: d.vagasPorSlot,
    faixas: d.faixas.map((f) => ({
      uid: novoUid(),
      id: f.id,
      horaInicio: f.horaInicio,
      horaFim: f.horaFim,
    })),
    periodicidades: d.periodicidades.map((p) => ({
      uid: novoUid(),
      id: p.id,
      tipo: p.tipo,
      dias: csvParaDias(p.diasSemana),
      diaMes: p.diaMes,
      mes: p.mes,
      dataInicio: p.dataInicio,
      dataFim: p.dataFim ?? '',
      ativo: p.ativo,
      descricao: p.descricao,
    })),
    excecoes: d.excecoes.map((e) => ({
      uid: novoUid(),
      id: e.id,
      data: e.data,
      tipo: e.tipo,
      horaInicio: e.horaInicio ?? '',
      horaFim: e.horaFim ?? '',
      vagasAjuste: e.vagasAjuste,
      motivo: e.motivo,
    })),
  };
}

/** Pré-condição: `validarJanelaForm` sem erros (números já não-nulos). */
export function formParaPayload(s: JanelaFormState): JanelaAgendamentoPayload {
  return {
    modalidade: s.modalidade,
    nome: s.nome,
    descricao: s.descricao,
    dataVigenciaInicio: s.dataVigenciaInicio,
    dataVigenciaFim: s.dataVigenciaFim || null,
    ativo: s.ativo,
    granularidadeUnidade: s.granularidadeUnidade,
    granularidadeValor: s.granularidadeValor ?? 0,
    vagasPorSlot: s.vagasPorSlot ?? 0,
    faixas: s.faixas.map((f, i) => ({ id: f.id, horaInicio: f.horaInicio, horaFim: f.horaFim, ordem: i + 1 })),
    periodicidades: s.periodicidades.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      diasSemana: [...p.dias].sort((a, b) => a - b).join(','),
      diaMes: p.diaMes,
      mes: p.mes,
      dataInicio: p.dataInicio,
      dataFim: p.dataFim || null,
      ativo: p.ativo,
      descricao: p.descricao,
    })),
    excecoes: s.excecoes.map((e) => ({
      id: e.id,
      data: e.data,
      tipo: e.tipo,
      horaInicio: e.horaInicio || null,
      horaFim: e.horaFim || null,
      vagasAjuste: e.vagasAjuste,
      motivo: e.motivo,
    })),
  };
}
