/**
 * Serializa data/hora com componentes do fuso local do browser
 * (ex.: Cuiabá 18:57 → `2026-07-31T18:57:00.000`), sem converter para UTC.
 *
 * Evita o deslocamento de `Date#toISOString()` (18:57 BRT-4 → 22:57Z).
 */
export function toLocalIsoDateTime(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  );
}

/** Valor para `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`) no fuso local. */
export function toDateTimeLocalInputValue(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Componentes de calendário/relógio de um instante no fuso informado (ex.: America/Cuiaba). */
export function getZonedParts(date: Date, timeZoneId: string): ZonedDateTimeParts | null {
  if (Number.isNaN(date.getTime()) || !timeZoneId.trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneId.trim(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const num = (type: Intl.DateTimeFormatPartTypes): number => {
      const raw = parts.find((p) => p.type === type)?.value;
      const n = Number(raw);
      return Number.isFinite(n) ? n : NaN;
    };
    let hour = num('hour');
    if (hour === 24) hour = 0;
    const year = num('year');
    const month = num('month');
    const day = num('day');
    const minute = num('minute');
    const second = num('second');
    if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) return null;
    return { year, month, day, hour, minute, second };
  } catch {
    return null;
  }
}

/**
 * `datetime-local` com o relógio do pátio (`timeZoneId` de Gerenciamento → Horário).
 * Sem fuso válido, cai no fuso do browser.
 */
export function toDateTimeLocalInputValueInTimeZone(
  date: Date = new Date(),
  timeZoneId?: string | null
): string {
  const tz = timeZoneId?.trim();
  if (!tz) return toDateTimeLocalInputValue(date);
  const p = getZonedParts(date, tz);
  if (!p) return toDateTimeLocalInputValue(date);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Formata data/hora de movimento no relógio do pátio.
 * Entrada/Saída gravadas como wall-clock (mesmo com `Z` indevido) — usa os dígitos.
 * Só aplica `timeZoneId` quando não há padrão ISO reconhecível.
 */
export function formatDateTimeInTimeZone(
  raw: string | null | undefined,
  timeZoneId?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  const texto = String(raw ?? '').trim();
  if (!texto) return '—';

  const m = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?/i
  );
  if (m) {
    const yearStyle = options?.year === '2-digit' ? m[1].slice(-2) : m[1];
    return `${m[3]}/${m[2]}/${yearStyle}, ${m[4]}:${m[5]}`;
  }

  const d = new Date(texto);
  if (Number.isNaN(d.getTime())) return texto;
  const opcoes: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };
  const tz = timeZoneId?.trim();
  if (tz) opcoes.timeZone = tz;
  try {
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(d);
  } catch {
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

/**
 * Converte string de entrada/saída em Date comparável pelo relógio do pátio.
 * Sempre usa ano-mês-dia-hora-minuto dos dígitos e ignora Z/offset
 * (contrato: API grava wall-clock; `Z` indevido não pode virar −4h).
 */
export function parsePatioWallClock(
  raw: string | null | undefined,
  _timeZoneId?: string | null
): Date | null {
  const texto = String(raw ?? '').trim();
  if (!texto) return null;

  const m = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?/i
  );
  if (m) {
    const d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] ?? 0)
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Converte valor de `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm` ou com segundos)
 * para ISO local sem UTC — preserva o relógio escolhido na tela.
 */
export function datetimeLocalInputToApiIso(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return `${raw}:00.000`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return `${raw}.000`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,3}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  return toLocalIsoDateTime(parsed);
}
