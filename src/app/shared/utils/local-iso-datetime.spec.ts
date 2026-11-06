import { describe, expect, it } from 'vitest';
import {
  datetimeLocalInputToApiIso,
  toDateTimeLocalInputValue,
  toLocalIsoDateTime
} from './local-iso-datetime';

describe('local-iso-datetime', () => {
  it('toLocalIsoDateTime usa componentes locais (não UTC)', () => {
    const d = new Date(2026, 6, 31, 18, 57, 30, 123);
    expect(toLocalIsoDateTime(d)).toBe('2026-07-31T18:57:30.123');
  });

  it('toDateTimeLocalInputValue formata para datetime-local', () => {
    const d = new Date(2026, 6, 31, 18, 57, 30, 123);
    expect(toDateTimeLocalInputValue(d)).toBe('2026-07-31T18:57');
  });

  it('datetimeLocalInputToApiIso preserva horário do input', () => {
    expect(datetimeLocalInputToApiIso('2026-07-31T18:57')).toBe('2026-07-31T18:57:00.000');
    expect(datetimeLocalInputToApiIso('2026-07-31T18:57:05')).toBe('2026-07-31T18:57:05.000');
    expect(datetimeLocalInputToApiIso('')).toBe('');
  });
});
