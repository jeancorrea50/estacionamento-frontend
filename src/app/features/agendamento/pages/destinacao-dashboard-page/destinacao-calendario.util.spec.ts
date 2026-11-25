import { describe, expect, it } from 'vitest';
import {
  buildMonthGrid,
  livreTom,
  reservaCobreDiaCalendario,
} from './destinacao-calendario.util';

describe('destinacao-calendario.util', () => {
  it('monta grade de 42 células para o mês', () => {
    const grid = buildMonthGrid(2026, 11); // dezembro
    expect(grid).toHaveLength(42);
    expect(grid.some((d) => d.iso === '2026-12-15' && !d.foraDoMes)).toBe(true);
  });

  it('classifica tom de livres', () => {
    expect(livreTom(40)).toBe('ok');
    expect(livreTom(15)).toBe('warn');
    expect(livreTom(3)).toBe('crit');
  });

  it('respeita diasSemana na periodicidade semanal', () => {
    const base = {
      ativo: true,
      dataInicio: '2026-12-01',
      dataFim: '2026-12-31',
      periodicidade: 2 as const,
      diasSemana: '1,2,3,4,5',
    };
    // 2026-12-15 é terça (2)
    expect(reservaCobreDiaCalendario(base, '2026-12-15')).toBe(true);
    // 2026-12-13 é domingo (0)
    expect(reservaCobreDiaCalendario(base, '2026-12-13')).toBe(false);
  });

  it('periodicidade mensal usa o dia do mês de dataInicio', () => {
    const base = {
      ativo: true,
      dataInicio: '2026-11-15',
      dataFim: '2027-01-31',
      periodicidade: 3 as const,
      diasSemana: null,
    };
    expect(reservaCobreDiaCalendario(base, '2026-12-15')).toBe(true);
    expect(reservaCobreDiaCalendario(base, '2026-12-14')).toBe(false);
  });
});
