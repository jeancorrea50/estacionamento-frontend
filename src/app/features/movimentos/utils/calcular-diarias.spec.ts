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

  it('ignora sufixo Z/offset e compara relógio do pátio (1h ≠ 5h por UTC-4)', () => {
    expect(
      calcularQuantidadeUnidades('2026-11-22T15:19:00Z', '2026-11-22T16:19', 1)
    ).toBe(1);
    expect(
      calcularQuantidadeUnidades('2026-11-22T15:19:00.000Z', '2026-11-22T16:19:00', 1)
    ).toBe(1);
    expect(
      calcularQuantidadeUnidades('2026-11-22T15:19:00+00:00', '2026-11-22T16:19', 1)
    ).toBe(1);
  });

  it('mesmo com timeZoneId, dígitos da API são wall-clock (15:28Z → 16:28 = 1h)', () => {
    expect(
      calcularQuantidadeUnidades(
        '2026-11-22T15:28:00Z',
        '2026-11-22T16:28',
        1,
        'America/Cuiaba'
      )
    ).toBe(1);
  });

  it('quantidade por diária usa teto de dias corridos', () => {
    expect(calcularQuantidadeUnidades('2026-08-01T10:00:00', '2026-08-01T23:00', 2)).toBe(1);
    expect(calcularQuantidadeUnidades('2026-08-01T10:00:00', '2026-08-03T12:00', 2)).toBe(3);
  });

  it('dentro da tolerância (min) não cobra unidades', () => {
    expect(
      calcularQuantidadeUnidades(
        '2026-11-22T15:56:00',
        '2026-11-22T15:57',
        1,
        'America/Cuiaba',
        15
      )
    ).toBe(0);
    expect(
      calcularQuantidadeUnidades(
        '2026-11-22T15:56:00',
        '2026-11-22T16:11',
        1,
        null,
        15
      )
    ).toBe(0);
  });

  it('acima da tolerância cobra com teto normal', () => {
    expect(
      calcularQuantidadeUnidades(
        '2026-11-22T15:56:00',
        '2026-11-22T16:12',
        1,
        null,
        15
      )
    ).toBe(1);
    expect(
      calcularQuantidadeUnidades(
        '2026-11-22T15:00:00',
        '2026-11-22T16:01',
        1,
        null,
        15
      )
    ).toBe(2);
  });
});
