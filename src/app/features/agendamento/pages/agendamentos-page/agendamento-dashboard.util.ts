import type { JanelaSlotDisponivel, ModalidadeJanela } from '../../models/janela-agendamento.models';
import type { VagaReservaTransportadoraItem } from '../../models/vaga-disponibilidade.models';

export type AgendamentoModalidadeUi = 'estacionamento' | 'limpeza';

/** Slot da linha do tempo do dia (a partir de `GET JanelaAgendamento/disponibilidade`). */
export interface AgendamentoTimelineSlot {
  key: string;
  label: string;
  horaInicio: string;
  horaFim: string;
  /** Capacidade cadastrada na janela/slot. */
  cadastrado: number;
  /** Já agendado / ocupado neste slot (contrato `ocupadas`). */
  agendado: number;
  disponiveis: number;
  ocupacaoPct: number;
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
      const ocupacaoPct =
        cadastrado > 0 ? Math.min(100, Math.round((agendado / cadastrado) * 100)) : 0;
      return {
        key: slotKey(s),
        label: formatHoraLabel(s.horaInicio, s.horaFim, s.label),
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        cadastrado,
        agendado,
        disponiveis,
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
