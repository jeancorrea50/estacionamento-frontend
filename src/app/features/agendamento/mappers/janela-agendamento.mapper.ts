import {
  ExcecaoTipo,
  GranularidadeUnidade,
  JanelaAgendamentoDetalhe,
  JanelaAgendamentoListItem,
  JanelaAgendamentoPayload,
  JanelaDisponibilidade,
  JanelaDisponibilidadeDia,
  JanelaExcecao,
  JanelaFaixa,
  JanelaPagedResult,
  JanelaPeriodicidade,
  JanelaSlotDisponivel,
  ModalidadeJanela,
  parseModalidadeAgendamento,
  PeriodicidadeTipo,
} from '../models/janela-agendamento.models';

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Lê camelCase ou PascalCase. */
function pick(row: Row, key: string): unknown {
  return row[key] ?? row[key.charAt(0).toUpperCase() + key.slice(1)];
}

function str(row: Row, key: string): string {
  const v = pick(row, key);
  return v == null ? '' : String(v);
}

function num(row: Row, key: string, fallback = 0): number {
  const n = Number(pick(row, key));
  return Number.isFinite(n) ? n : fallback;
}

function numOrNull(row: Row, key: string): number | null {
  const v = pick(row, key);
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(row: Row, key: string, fallback = true): boolean {
  const v = pick(row, key);
  if (v == null) return fallback;
  return v === true || v === 1 || String(v).toLowerCase() === 'true';
}

function list(row: Row, key: string): Row[] {
  const v = pick(row, key);
  return Array.isArray(v) ? v.filter(isRow) : [];
}

/** `2026-11-18T00:00:00` → `2026-11-18`. */
export function toIsoDate(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 10) : '';
}

function toIsoDateOrNull(value: unknown): string | null {
  const iso = toIsoDate(value);
  return iso || null;
}

/** `08:00:00` → `08:00`. */
export function toHoraHHmm(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 5) : '';
}

function toHoraOrNull(value: unknown): string | null {
  const h = toHoraHHmm(value);
  return h || null;
}

function modalidade(row: Row): ModalidadeJanela {
  return parseModalidadeAgendamento(pick(row, 'modalidade'));
}

function mapFaixa(row: Row): JanelaFaixa {
  return {
    id: num(row, 'id') || undefined,
    horaInicio: toHoraHHmm(pick(row, 'horaInicio')),
    horaFim: toHoraHHmm(pick(row, 'horaFim')),
    ordem: num(row, 'ordem'),
  };
}

function mapPeriodicidade(row: Row): JanelaPeriodicidade {
  return {
    id: num(row, 'id') || undefined,
    tipo: (num(row, 'tipo', 1) || 1) as PeriodicidadeTipo,
    diasSemana: str(row, 'diasSemana'),
    diaMes: numOrNull(row, 'diaMes'),
    mes: numOrNull(row, 'mes'),
    dataInicio: toIsoDate(pick(row, 'dataInicio')),
    dataFim: toIsoDateOrNull(pick(row, 'dataFim')),
    ativo: bool(row, 'ativo'),
    descricao: str(row, 'descricao'),
  };
}

function mapExcecao(row: Row): JanelaExcecao {
  return {
    id: num(row, 'id') || undefined,
    data: toIsoDate(pick(row, 'data')),
    tipo: (num(row, 'tipo', 1) || 1) as ExcecaoTipo,
    horaInicio: toHoraOrNull(pick(row, 'horaInicio')),
    horaFim: toHoraOrNull(pick(row, 'horaFim')),
    vagasAjuste: numOrNull(row, 'vagasAjuste'),
    motivo: str(row, 'motivo'),
  };
}

export function mapJanelaDetalhe(row: Row): JanelaAgendamentoDetalhe {
  return {
    id: num(row, 'id'),
    estacionamentoId: num(row, 'estacionamentoId'),
    modalidade: modalidade(row),
    nome: str(row, 'nome'),
    descricao: str(row, 'descricao'),
    dataVigenciaInicio: toIsoDate(pick(row, 'dataVigenciaInicio')),
    dataVigenciaFim: toIsoDateOrNull(pick(row, 'dataVigenciaFim')),
    ativo: bool(row, 'ativo'),
    granularidadeUnidade: (num(row, 'granularidadeUnidade', 1) === 2
      ? 2
      : 1) as GranularidadeUnidade,
    granularidadeValor: num(row, 'granularidadeValor', 1),
    vagasPorSlot: num(row, 'vagasPorSlot'),
    faixas: list(row, 'faixas').map(mapFaixa),
    periodicidades: list(row, 'periodicidades').map(mapPeriodicidade),
    excecoes: list(row, 'excecoes').map(mapExcecao),
  };
}

function mapListItem(row: Row): JanelaAgendamentoListItem {
  const vagasPorSlot = num(row, 'vagasPorSlot');
  const faixasEmb = list(row, 'faixas');
  const qtdFaixas = num(row, 'qtdFaixas') || faixasEmb.length;
  return {
    id: num(row, 'id'),
    estacionamentoId: num(row, 'estacionamentoId'),
    modalidade: modalidade(row),
    nome: str(row, 'nome'),
    descricao: str(row, 'descricao'),
    dataVigenciaInicio: toIsoDate(pick(row, 'dataVigenciaInicio')),
    dataVigenciaFim: toIsoDateOrNull(pick(row, 'dataVigenciaFim')),
    ativo: bool(row, 'ativo'),
    vagasPorSlot,
    qtdFaixas,
    qtdPeriodicidades: num(row, 'qtdPeriodicidades') || list(row, 'periodicidades').length,
    totalDisponibilizacoes: Math.max(0, vagasPorSlot) * Math.max(0, qtdFaixas),
  };
}

/** Página `{ results|Results, rowCount, currentPage, pageSize }` (já sem envelope). */
export function mapJanelaPaged(
  source: unknown,
  numeroPagina: number,
  tamanhoPagina: number,
): JanelaPagedResult {
  const root: Row = isRow(source) ? source : {};
  const rows = Array.isArray(source)
    ? source
    : ((pick(root, 'results') as unknown[] | undefined) ?? []);
  const items = (Array.isArray(rows) ? rows : []).filter(isRow).map(mapListItem);
  return {
    items,
    totalCount: num(root, 'rowCount', items.length) || items.length,
    numeroPagina: num(root, 'currentPage', numeroPagina) || numeroPagina,
    tamanhoPagina: num(root, 'pageSize', tamanhoPagina) || tamanhoPagina,
  };
}

function mapSlot(row: Row): JanelaSlotDisponivel {
  const horaInicio = toHoraHHmm(pick(row, 'horaInicio'));
  const horaFim = toHoraHHmm(pick(row, 'horaFim'));
  return {
    janelaAgendamentoId: num(row, 'janelaAgendamentoId'),
    horaInicio,
    horaFim,
    capacidade: num(row, 'capacidade'),
    ocupadas: num(row, 'ocupadas'),
    disponiveis: num(row, 'disponiveis'),
    viaDestinacao: bool(row, 'viaDestinacao', false),
    label: str(row, 'label').trim() || `${horaInicio} - ${horaFim}`,
    tipoPagador: tipoPagadorDe(pick(row, 'tipoPagador')),
    pagadorNome: str(row, 'pagadorNome').trim() || null,
    pagadores: list(row, 'pagadores').map((p) => ({
      tipoPagador: tipoPagadorDe(pick(p, 'tipoPagador')) ?? 'transportadora',
      responsavelFaturamentoId: numOrNull(p, 'responsavelFaturamentoId'),
      nome: str(p, 'nome').trim() || null,
      destinadas: num(p, 'destinadas'),
      disponiveis: num(p, 'disponiveis'),
    })),
  };
}

export function mapJanelaDisponibilidade(source: unknown): JanelaDisponibilidade {
  const root: Row = isRow(source) ? source : {};
  const slots = list(root, 'slots').map(mapSlot);
  const totalCapacidade = numOrNull(root, 'totalCapacidade');
  const totalOcupadas = numOrNull(root, 'totalOcupadas');
  const totalDisponiveis = numOrNull(root, 'totalDisponiveis');
  return {
    data: toIsoDate(pick(root, 'data')),
    modalidade: parseModalidadeAgendamento(pick(root, 'modalidade')),
    usouDestinacao: bool(root, 'usouDestinacao', false),
    ...(totalCapacidade != null ? { totalCapacidade } : {}),
    ...(totalOcupadas != null ? { totalOcupadas } : {}),
    ...(totalDisponiveis != null ? { totalDisponiveis } : {}),
    slots,
  };
}

function textoOuNull(value: string | null | undefined): string | null {
  const t = (value ?? '').trim();
  return t || null;
}

/** Normaliza o payload do formulário para o contrato exato do backend. */
export function montarPayloadJanela(form: JanelaAgendamentoPayload): JanelaAgendamentoPayload {
  const faixas = [...form.faixas]
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    .map((f, i) => ({ id: f.id, horaInicio: f.horaInicio, horaFim: f.horaFim, ordem: i + 1 }));

  return {
    ...(form.id ? { id: form.id } : {}),
    modalidade: form.modalidade,
    nome: form.nome.trim(),
    descricao: textoOuNull(form.descricao),
    dataVigenciaInicio: form.dataVigenciaInicio,
    dataVigenciaFim: form.dataVigenciaFim || null,
    ativo: form.ativo,
    granularidadeUnidade: form.granularidadeUnidade,
    granularidadeValor: form.granularidadeValor,
    vagasPorSlot: form.vagasPorSlot,
    faixas,
    periodicidades: form.periodicidades.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      diasSemana: p.tipo === 2 || p.tipo === 3 ? textoOuNull(p.diasSemana) : null,
      diaMes: p.tipo === 4 || p.tipo === 5 ? p.diaMes : null,
      mes: p.tipo === 5 ? p.mes : null,
      dataInicio: p.dataInicio,
      dataFim: p.dataFim || null,
      ativo: p.ativo,
      descricao: textoOuNull(p.descricao),
    })),
    excecoes: form.excecoes.map((e) => ({
      id: e.id,
      data: e.data,
      tipo: e.tipo,
      horaInicio: textoOuNull(e.horaInicio),
      horaFim: textoOuNull(e.horaFim),
      vagasAjuste: e.tipo === 2 ? e.vagasAjuste : null,
      motivo: textoOuNull(e.motivo),
    })),
  };
}

/** `GET /JanelaAgendamento/disponibilidade/periodo` → um item por dia. */
export function mapJanelaDisponibilidadePeriodo(source: unknown): JanelaDisponibilidadeDia[] {
  const rows = Array.isArray(source) ? source.filter(isRow) : [];
  return rows
    .map((r) => ({
      data: toIsoDate(pick(r, 'data')),
      possuiJanelas: bool(r, 'possuiJanelas', false),
      usouDestinacao: bool(r, 'usouDestinacao', false),
      totalDisponiveis: Math.max(0, num(r, 'totalDisponiveis')),
      horariosDisponiveis: Math.max(0, num(r, 'horariosDisponiveis')),
    }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.data));
}

/** `TipoPagadorCobranca` do backend (1 = Transportadora, 2 = Terceiro; ou o nome do enum). */
function tipoPagadorDe(raw: unknown): 'transportadora' | 'terceiro' | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === '2' || s === 'terceiro') return 'terceiro';
  if (s === '1' || s === 'transportadora') return 'transportadora';
  return null;
}
