import { describe, expect, it } from 'vitest';
import type { VagaReservaTransportadoraItem } from '../../models/vaga-disponibilidade.models';
import { agruparDestinacoesLista, labelPeriodoDestinacao } from './vaga-reserva-lista.util';

function reserva(
  partial: Partial<VagaReservaTransportadoraItem> & Pick<VagaReservaTransportadoraItem, 'id'>
): VagaReservaTransportadoraItem {
  return {
    id: partial.id,
    transportadoraId: partial.transportadoraId ?? 10,
    transportadoraNome: partial.transportadoraNome ?? 'Bom Futuro',
    modalidade: partial.modalidade ?? 1,
    modalidadeLabel: partial.modalidadeLabel ?? 'Estacionamento',
    quantidade: partial.quantidade ?? 2,
    dataInicio: partial.dataInicio ?? '2026-12-01',
    dataFim: partial.dataFim ?? '2026-12-31',
    periodicidade: partial.periodicidade ?? 1,
    periodicidadeLabel: partial.periodicidadeLabel ?? 'Diário',
    periodoDia: partial.periodoDia ?? null,
    periodoDiaLabel: partial.periodoDiaLabel ?? null,
    horaInicio: partial.horaInicio ?? '08:00',
    horaFim: partial.horaFim ?? '09:00',
    diasSemana: partial.diasSemana ?? null,
    responsavelFaturamentoId: partial.responsavelFaturamentoId ?? null,
    responsavelFaturamentoNome: partial.responsavelFaturamentoNome ?? null,
    avulso: partial.avulso ?? false,
    transferenciaAutomaticaSaldo: partial.transferenciaAutomaticaSaldo ?? false,
    ativo: partial.ativo ?? true,
  };
}

describe('vaga-reserva-lista.util', () => {
  it('formata período com início e fim', () => {
    expect(labelPeriodoDestinacao('2026-12-01', '2026-12-31')).toBe('01/12/2026 a 31/12/2026');
    expect(labelPeriodoDestinacao('2026-12-01', '2026-12-01')).toBe('01/12/2026');
  });

  it('agrupa por transportadora, período e ordena horários', () => {
    const grupos = agruparDestinacoesLista(
      [
        reserva({ id: 1, horaInicio: '08:00', horaFim: '09:00', quantidade: 2 }),
        reserva({ id: 2, horaInicio: '06:00', horaFim: '07:00', quantidade: 2 }),
        reserva({ id: 3, horaInicio: '07:00', horaFim: '08:00', quantidade: 2 }),
        reserva({
          id: 4,
          transportadoraId: 20,
          transportadoraNome: 'Outra',
          horaInicio: '10:00',
          horaFim: '11:00',
        }),
      ],
      { busca: '', modalidade: 'todas', situacao: 'todas' }
    );

    expect(grupos).toHaveLength(2);
    expect(grupos[0]!.nome).toBe('Bom Futuro');
    expect(grupos[0]!.periodosAtivos).toHaveLength(1);
    expect(grupos[0]!.periodosAtivos[0]!.horarios.map((h) => h.horaInicio)).toEqual([
      '06:00',
      '07:00',
      '08:00',
    ]);
    expect(grupos[0]!.vagasDiaAtivas).toBe(6);
  });

  it('separa inativos no histórico', () => {
    const grupos = agruparDestinacoesLista(
      [
        reserva({ id: 1, ativo: true }),
        reserva({ id: 2, ativo: false, horaInicio: '10:00', horaFim: '11:00' }),
      ],
      { busca: '', modalidade: 'todas', situacao: 'todas' }
    );
    expect(grupos[0]!.ativosCount).toBe(1);
    expect(grupos[0]!.inativosCount).toBe(1);
    expect(grupos[0]!.periodosInativos[0]!.horarios[0]!.id).toBe(2);
  });

  it('não mistura periodicidades diferentes no mesmo período', () => {
    const grupos = agruparDestinacoesLista(
      [
        reserva({ id: 1, periodicidade: 1, horaInicio: '06:00', horaFim: '07:00' }),
        reserva({
          id: 2,
          periodicidade: 2,
          diasSemana: '1,2,3,4,5',
          horaInicio: '07:00',
          horaFim: '08:00',
        }),
      ],
      { busca: '', modalidade: 'todas', situacao: 'todas' }
    );
    expect(grupos[0]!.periodosAtivos).toHaveLength(2);
  });
});
