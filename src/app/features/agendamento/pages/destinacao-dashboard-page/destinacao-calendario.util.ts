import type { VagaReservaTransportadoraItem } from '../../models/vaga-disponibilidade.models';

const MESES = [
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
] as const;

export type CalendarioVisao = 'mes' | 'semana' | 'dia';
export type LivreTom = 'ok' | 'warn' | 'crit';

export interface DiaCalendarioVm {
  iso: string;
  dia: number;
  foraDoMes: boolean;
  /** vagasReservadas* do resumo do dia. */
  reservadas: number | null;
  /** vagasDisponiveis* — livres no dia. */
  disponiveis: number | null;
  /**
   * Vagas disponibilizadas pelas janelas no dia
   * (`totalCapacidade` / soma de `capacidade` dos slots — alinhado a faixas × vagas/horário).
   */
  janelas: number | null;
  loading: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDateLocal(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

export function formatDiaBr(iso: string): string {
  const d = parseIsoDateLocal(iso);
  if (!d) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function labelMesAno(ano: number, mes0: number): string {
  return `${MESES[mes0] ?? ''} ${ano}`.trim();
}

export function addMonths(ano: number, mes0: number, delta: number): { ano: number; mes0: number } {
  const d = new Date(ano, mes0 + delta, 1);
  return { ano: d.getFullYear(), mes0: d.getMonth() };
}

export function startOfWeekSunday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function addDaysIso(iso: string, delta: number): string {
  const d = parseIsoDateLocal(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + delta);
  return toIsoDateLocal(d);
}

/** Grade Dom–Sáb cobrindo o mês (células fora do mês preenchidas). */
export function buildMonthGrid(ano: number, mes0: number): DiaCalendarioVm[] {
  const first = new Date(ano, mes0, 1);
  const start = startOfWeekSunday(first);
  const cells: DiaCalendarioVm[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const foraDoMes = d.getMonth() !== mes0;
    cells.push({
      iso: toIsoDateLocal(d),
      dia: d.getDate(),
      foraDoMes,
      reservadas: null,
      disponiveis: null,
      janelas: null,
      loading: !foraDoMes,
    });
  }
  return cells;
}

export function daysInMonthIso(ano: number, mes0: number): string[] {
  const last = new Date(ano, mes0 + 1, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(`${ano}-${pad(mes0 + 1)}-${pad(d)}`);
  }
  return out;
}

export function weekDaysIso(centroIso: string): string[] {
  const d = parseIsoDateLocal(centroIso);
  if (!d) return [];
  const start = startOfWeekSunday(d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return toIsoDateLocal(x);
  });
}

export function livreTom(disponiveis: number | null | undefined): LivreTom {
  const n = Number(disponiveis);
  if (!Number.isFinite(n)) return 'warn';
  if (n >= 30) return 'ok';
  if (n >= 10) return 'warn';
  return 'crit';
}

function isoDateOnly(value: string | null | undefined): string {
  return (value || '').trim().slice(0, 10);
}

function parseDiasSemanaCsv(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((p) => Number(String(p).trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
}

/**
 * Reserva ativa cobrindo o dia, respeitando vigência + periodicidade + diasSemana.
 * 1=Diário, 2=Semanal (CSV dias), 3=Mensal (mesmo dia do mês de dataInicio), 4=Período contínuo.
 */
export function reservaCobreDiaCalendario(
  reserva: Pick<
    VagaReservaTransportadoraItem,
    'ativo' | 'dataInicio' | 'dataFim' | 'periodicidade' | 'diasSemana'
  >,
  dataIso: string
): boolean {
  if (!reserva?.ativo) return false;
  const dia = isoDateOnly(dataIso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const inicio = isoDateOnly(reserva.dataInicio);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || inicio > dia) return false;
  const fim = isoDateOnly(reserva.dataFim);
  if (fim && fim < dia) return false;

  const d = parseIsoDateLocal(dia);
  if (!d) return false;
  const p = Number(reserva.periodicidade) || 1;

  if (p === 4 || p === 1) return true;

  if (p === 2) {
    const dias = parseDiasSemanaCsv(reserva.diasSemana);
    if (!dias.length) return true; // sem CSV: backend pode tratar como todos
    return dias.includes(d.getDay());
  }

  if (p === 3) {
    const inicioDate = parseIsoDateLocal(inicio);
    if (!inicioDate) return false;
    return d.getDate() === inicioDate.getDate();
  }

  return true;
}

export function modalidadeBate(
  reservaModalidade: number,
  filtro: 1 | 2
): boolean {
  return reservaModalidade === filtro || reservaModalidade === 3;
}

export function normHora(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
}

export function horaNoIntervalo(hora: string, inicio: string, fim: string): boolean {
  const h = normHora(hora);
  const a = normHora(inicio);
  const b = normHora(fim);
  if (!h || !a || !b) return false;
  return h >= a && h < b;
}

export function extrairHoraDeDataHora(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  const m = s.match(/T(\d{2}):(\d{2})/) || s.match(/\s(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  return normHora(s);
}
