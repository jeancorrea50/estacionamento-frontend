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
