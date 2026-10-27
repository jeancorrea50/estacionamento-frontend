import { contarPorDia, tendenciaDoDia, variacaoContraAnterior } from './kpi-tendencia.util';

describe('kpi-tendencia.util', () => {
  it('calcula a variação do último dia contra o anterior', () => {
    expect(variacaoContraAnterior([10, 12])).toBe(20);
    expect(variacaoContraAnterior([10, 8])).toBe(-20);
    expect(variacaoContraAnterior([0, 4])).toBeNull();
    expect(variacaoContraAnterior([0, 0])).toBe(0);
  });

  it('agrupa os eventos no dia local e usa o total de hoje no card', () => {
    const serie = contarPorDia(
      ['2026-10-14T10:00:00', '2026-10-15T08:00:00', '2026-10-15T18:00:00'],
      ['2026-10-14', '2026-10-15']
    );
    expect(serie).toEqual([1, 2]);
    expect(tendenciaDoDia(serie, 2)).toEqual({
      valor: 2,
      variacao: 100,
      serie: [1, 2]
    });
  });
});
