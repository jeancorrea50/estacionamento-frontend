import type { JanelaSlotDisponivel, ModalidadeJanela } from '../../models/janela-agendamento.models';
import type { VagaReservaTransportadoraItem } from '../../models/vaga-disponibilidade.models';

export type AgendamentoModalidadeUi = 'estacionamento' | 'limpeza';

/** Slot da linha do tempo do dia (a partir de `GET JanelaAgendamento/disponibilidade`). */
export interface AgendamentoTimelineSlot {
  key: string;
  label: string;
  horaInicio: string;
  horaFim: string;
  /** Capacidade cadastrada na janela/slot (CAP.). */
  cadastrado: number;
  /**
   * Vagas já tomadas no slot (contrato BE `ocupadas`).
   * Na UI = AGEND. — o BE ainda não separa “agendado” de “em pátio”.
   */
  agendado: number;
  /** Vagas livres (DISP.). */
  disponiveis: number;
  /**
   * Em pátio / fisicamente ocupado (OCUP.).
   * Reservado: hoje o contrato de disponibilidade não envia esse split → 0.
   */
  ocupado: number;
  /** % de capacidade tomada (agendado + ocupado) sobre CAP. */
  ocupacaoPct: number;
}

/** Segmentos da barra empilhada (proporção visual). */
export interface AgendamentoBarSegmentos {
  disponiveis: number;
  agendado: number;
  ocupado: number;
  total: number;
  pctDisponiveis: number;
  pctAgendado: number;
  pctOcupado: number;
}

/** Totais do dia para o donut “Visão geral de ocupação”. */
export interface AgendamentoOcupacaoDia {
  disponiveis: number;
  agendado: number;
  ocupado: number;
  capacidade: number;
}

export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatIsoDateBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function modalidadeApi(ui: AgendamentoModalidadeUi): ModalidadeJanela {
  return ui === 'limpeza' ? 2 : 1;
}

function slotKey(s: JanelaSlotDisponivel): string {
  return `${s.janelaAgendamentoId}|${s.horaInicio}|${s.horaFim}`;
}

function formatHoraLabel(inicio: string, fim: string, labelApi: string): string {
  const limpo = (labelApi || '').trim();
  if (limpo) {
    // Remove sufixo "(N vagas…)" — a disponibilidade já aparece nas métricas/subtítulo.
    const semVagas = limpo
      .replace(/\s*\([^)]*vagas[^)]*\)\s*$/i, '')
      .replace(/\s*-\s*/g, '–')
      .trim();
    if (semVagas) return semVagas;
  }
  const hi = (inicio || '').trim();
  const hf = (fim || '').trim();
  if (hi && hf) return `${hi} às ${hf}`;
  return hi || hf || '—';
}

/** Ordena e normaliza slots da disponibilidade do dia para a timeline. */
export function mapTimelineSlots(slots: JanelaSlotDisponivel[]): AgendamentoTimelineSlot[] {
  return [...slots]
    .sort((a, b) => {
      const byHora = a.horaInicio.localeCompare(b.horaInicio);
      if (byHora !== 0) return byHora;
      return a.horaFim.localeCompare(b.horaFim);
    })
    .map((s) => {
      const cadastrado = Math.max(0, Number(s.capacidade) || 0);
      const agendado = Math.max(0, Number(s.ocupadas) || 0);
      const disponiveis = Math.max(0, Number(s.disponiveis) || 0);
      const ocupado = 0;
      const tomadas = agendado + ocupado;
      const ocupacaoPct =
        cadastrado > 0 ? Math.min(100, Math.round((tomadas / cadastrado) * 100)) : 0;
      return {
        key: slotKey(s),
        label: formatHoraLabel(s.horaInicio, s.horaFim, s.label),
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        cadastrado,
        agendado,
        disponiveis,
        ocupado,
        ocupacaoPct,
      };
    });
}

/**
 * Soma vagas disponíveis das janelas do dia.
 * Sem slots → 0. N janelas no mesmo dia → soma (fonte de verdade da timeline).
 */
export function somarDisponiveisSlots(
  slots: ReadonlyArray<Pick<AgendamentoTimelineSlot, 'disponiveis'>>
): number {
  return slots.reduce((acc, s) => acc + Math.max(0, Number(s.disponiveis) || 0), 0);
}

/** Soma ocupação (agendado) das janelas do dia. Sem slots → 0. */
export function somarAgendadosSlots(
  slots: ReadonlyArray<Pick<AgendamentoTimelineSlot, 'agendado'>>
): number {
  return slots.reduce((acc, s) => acc + Math.max(0, Number(s.agendado) || 0), 0);
}

/**
 * Preferência: totais do BE (incluem slots esgotados omitidos da lista).
 * Fallback: soma dos slots já mapeados na timeline.
 */
export function resolverKpiJanelasDia(opts: {
  totalDisponiveis?: number | null;
  totalOcupadas?: number | null;
  slots: ReadonlyArray<Pick<AgendamentoTimelineSlot, 'disponiveis' | 'agendado'>>;
}): { disponiveis: number; ocupados: number } {
  const disponiveis =
    opts.totalDisponiveis != null && Number.isFinite(Number(opts.totalDisponiveis))
      ? Math.max(0, Number(opts.totalDisponiveis))
      : somarDisponiveisSlots(opts.slots);
  const ocupados =
    opts.totalOcupadas != null && Number.isFinite(Number(opts.totalOcupadas))
      ? Math.max(0, Number(opts.totalOcupadas))
      : somarAgendadosSlots(opts.slots);
  return { disponiveis, ocupados };
}

export function flexBar(value: number): number {
  return Math.max(0, Number(value) || 0);
}

function pctPart(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((parte / total) * 100)));
}

/** Proporções da barra (DISP + AGEND + OCUP). Normaliza para 100% quando há valores. */
export function segmentosBarraSlot(
  slot: Pick<AgendamentoTimelineSlot, 'disponiveis' | 'agendado' | 'ocupado' | 'cadastrado'>
): AgendamentoBarSegmentos {
  const disponiveis = Math.max(0, Number(slot.disponiveis) || 0);
  const agendado = Math.max(0, Number(slot.agendado) || 0);
  const ocupado = Math.max(0, Number(slot.ocupado) || 0);
  let total = disponiveis + agendado + ocupado;
  if (total <= 0) {
    const cap = Math.max(0, Number(slot.cadastrado) || 0);
    return {
      disponiveis: cap > 0 ? cap : 1,
      agendado: 0,
      ocupado: 0,
      total: cap > 0 ? cap : 1,
      pctDisponiveis: 100,
      pctAgendado: 0,
      pctOcupado: 0,
    };
  }
  let pctDisponiveis = pctPart(disponiveis, total);
  let pctAgendado = pctPart(agendado, total);
  let pctOcupado = pctPart(ocupado, total);
  const soma = pctDisponiveis + pctAgendado + pctOcupado;
  if (soma !== 100 && soma > 0) {
    // Ajuste residual no maior segmento para fechar 100%.
    const diff = 100 - soma;
    if (pctDisponiveis >= pctAgendado && pctDisponiveis >= pctOcupado) {
      pctDisponiveis += diff;
    } else if (pctAgendado >= pctOcupado) {
      pctAgendado += diff;
    } else {
      pctOcupado += diff;
    }
  }
  return {
    disponiveis,
    agendado,
    ocupado,
    total,
    pctDisponiveis,
    pctAgendado,
    pctOcupado,
  };
}

/** Totais do dia para o donut (soma dos slots visíveis). */
export function somarOcupacaoDia(
  slots: ReadonlyArray<Pick<AgendamentoTimelineSlot, 'disponiveis' | 'agendado' | 'ocupado' | 'cadastrado'>>
): AgendamentoOcupacaoDia {
  return slots.reduce(
    (acc, s) => ({
      disponiveis: acc.disponiveis + Math.max(0, Number(s.disponiveis) || 0),
      agendado: acc.agendado + Math.max(0, Number(s.agendado) || 0),
      ocupado: acc.ocupado + Math.max(0, Number(s.ocupado) || 0),
      capacidade: acc.capacidade + Math.max(0, Number(s.cadastrado) || 0),
    }),
    { disponiveis: 0, agendado: 0, ocupado: 0, capacidade: 0 }
  );
}

/** Conic-gradient CSS do donut (DISP → AGEND → OCUP). */
export function donutConicGradient(dia: AgendamentoOcupacaoDia): string {
  const segs = segmentosBarraSlot({
    disponiveis: dia.disponiveis,
    agendado: dia.agendado,
    ocupado: dia.ocupado,
    cadastrado: dia.capacidade,
  });
  const gDisp = 'var(--ag-occ-disp, var(--success, #10b981))';
  const gAgd = 'var(--ag-occ-agd, var(--warning, #f59e0b))';
  const gOcup = 'var(--ag-occ-ocup, var(--danger, #ef4444))';
  const a = segs.pctDisponiveis;
  const b = a + segs.pctAgendado;
  return `conic-gradient(${gDisp} 0% ${a}%, ${gAgd} ${a}% ${b}%, ${gOcup} ${b}% 100%)`;
}

function isoDateOnly(value: string | null | undefined): string {
  return (value || '').trim().slice(0, 10);
}

/** Reserva ativa cobrindo o dia (vigência início/fim; fim nulo = aberto a partir do início). */
export function reservaCobreDia(
  reserva: Pick<VagaReservaTransportadoraItem, 'ativo' | 'dataInicio' | 'dataFim'>,
  dataIso: string
): boolean {
  if (!reserva?.ativo) return false;
  const dia = isoDateOnly(dataIso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const inicio = isoDateOnly(reserva.dataInicio);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || inicio > dia) return false;
  const fim = isoDateOnly(reserva.dataFim);
  if (!fim) return true;
  return fim >= dia;
}

/**
 * Soma vagas destinadas CIF/FOB (Geral = todas modalidades) para o dia.
 * CIF = sem responsável de faturamento; FOB = com terceiro.
 * Filtro opcional de transportadora.
 */
export function somarDestinacaoCifFob(
  reservas: ReadonlyArray<VagaReservaTransportadoraItem>,
  opts: { dataIso: string; transportadoraId?: number | null }
): { cif: number; fob: number } {
  const tid =
    opts.transportadoraId != null && opts.transportadoraId > 0 ? opts.transportadoraId : null;
  let cif = 0;
  let fob = 0;
  for (const r of reservas ?? []) {
    if (!reservaCobreDia(r, opts.dataIso)) continue;
    if (tid != null && Number(r.transportadoraId) !== tid) continue;
    const qtd = Math.max(0, Math.trunc(Number(r.quantidade) || 0));
    const pagadorId = Number(r.responsavelFaturamentoId ?? 0);
    if (Number.isFinite(pagadorId) && pagadorId > 0) fob += qtd;
    else cif += qtd;
  }
  return { cif, fob };
}
