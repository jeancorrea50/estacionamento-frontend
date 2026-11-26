import { describe, expect, it } from 'vitest';
import {
  calcularCotaDia,
  coletarFaixasUnicas,
  cotaAcordoDoMes,
  destinadasNoDia,
  faixaKey,
  maxQuantidadePermitida,
  mesDeIso,
  normHoraLab,
} from './cota-acordo.util';
import type { VagaReservaTransportadoraItem } from '../../../models/vaga-disponibilidade.models';

function reserva(partial: Partial<VagaReservaTransportadoraItem>): VagaReservaTransportadoraItem {
  return {
    id: 1,
    transportadoraId: 10,
    transportadoraNome: 'ACME',
    modalidade: 1,
    modalidadeLabel: 'Estacionamento',
    quantidade: 3,
    dataInicio: '2026-11-01',
    dataFim: '2026-11-30',
    periodicidade: 1,
    periodicidadeLabel: 'Diário',
    periodoDia: null,
    periodoDiaLabel: null,
    avulso: false,
    transferenciaAutomaticaSaldo: false,
    ativo: true,
    ...partial,
  };
}

describe('vaga-reserva-lab.util', () => {
  it('normaliza hora e chave de faixa', () => {
    expect(normHoraLab('6:00')).toBe('06:00');
    expect(faixaKey('6:00', '8:00')).toBe('06:00|08:00');
  });

  it('coleta faixas únicas ordenadas', () => {
    const faixas = coletarFaixasUnicas([
      { horaInicio: '08:00', horaFim: '10:00' },
      { horaInicio: '6:00', horaFim: '08:00' },
      { horaInicio: '08:00', horaFim: '10:00' },
    ]);
    expect(faixas.map((f) => f.key)).toEqual(['06:00|08:00', '08:00|10:00']);
  });

  it('lê cota do mês do acordo (capacidade diária contratada)', () => {
    expect(mesDeIso('2026-11-24')).toBe(11);
    expect(
      cotaAcordoDoMes(
        {
          1: null,
          2: null,
          3: null,
          4: null,
          5: null,
          6: null,
          7: null,
          8: null,
          9: null,
          10: null,
          11: 10,
          12: null,
        },
        11,
      ),
    ).toBe(10);
  });

  it('calcula livres com hard stop (sem excedente)', () => {
    const reservas = [reserva({ quantidade: 7 }), reserva({ id: 2, quantidade: 2, ativo: false })];
    expect(destinadasNoDia(reservas, '2026-11-24', 10)).toBe(7);
    const cota = calcularCotaDia({
      vagasAcordo: {
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
        8: null,
        9: null,
        10: null,
        11: 10,
        12: null,
      },
      temAcordo: true,
      dataIso: '2026-11-24',
      transportadoraId: 10,
      reservas,
    });
    expect(cota).toEqual({ cotaMes: 10, destinadas: 7, livres: 3, temAcordo: true });
    expect(maxQuantidadePermitida(cota)).toBe(3);

    const cheia = calcularCotaDia({
      vagasAcordo: cota && {
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
        8: null,
        9: null,
        10: null,
        11: 7,
        12: null,
      },
      temAcordo: true,
      dataIso: '2026-11-24',
      transportadoraId: 10,
      reservas,
    });
    expect(cheia.livres).toBe(0);
    expect(maxQuantidadePermitida(cheia)).toBe(0);
  });
});
