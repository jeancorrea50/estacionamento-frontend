import { calcularQuantidadeDiarias, calcularTotalDiarias } from './calcular-diarias';

describe('calcular-diarias', () => {
  it('mesmo dia calendário conta 1 diária', () => {
    expect(calcularQuantidadeDiarias('2026-08-01T10:00:00', '2026-08-01T23:00')).toBe(1);
  });

  it('conta dias inclusivos entre entrada e saída', () => {
    expect(calcularQuantidadeDiarias('2026-08-01T10:00:00', '2026-08-03T08:00')).toBe(3);
  });

  it('sem datas válidas retorna 1', () => {
    expect(calcularQuantidadeDiarias(null, null)).toBe(1);
    expect(calcularQuantidadeDiarias('', '2026-08-01T10:00')).toBe(1);
  });

  it('calcula total com 2 casas', () => {
    expect(calcularTotalDiarias(25, 3)).toBe(75);
    expect(calcularTotalDiarias(10.555, 2)).toBe(21.11);
    expect(calcularTotalDiarias(null, 2)).toBeNull();
  });
});
