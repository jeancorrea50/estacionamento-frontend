import {
  calcularQuantidadeDiarias,
  calcularQuantidadeUnidades,
  calcularTotalDiarias
} from './calcular-diarias';

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

  it('quantidade por hora usa teto de horas', () => {
    expect(calcularQuantidadeUnidades('2026-08-09T15:25:00', '2026-08-09T17:00', 1)).toBe(2);
    expect(calcularQuantidadeUnidades('2026-08-09T15:25:00', '2026-08-09T15:40', 1)).toBe(1);
  });

  it('quantidade por diária usa teto de dias corridos', () => {
    expect(calcularQuantidadeUnidades('2026-08-01T10:00:00', '2026-08-01T23:00', 2)).toBe(1);
    expect(calcularQuantidadeUnidades('2026-08-01T10:00:00', '2026-08-03T12:00', 2)).toBe(3);
  });
});
