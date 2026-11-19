import { describe, expect, it } from 'vitest';
import {
  mapTimelineSlots,
  resolverKpiJanelasDia,
  somarAgendadosSlots,
  somarDisponiveisSlots,
  type AgendamentoTimelineSlot,
} from './agendamento-dashboard.util';
import type { JanelaSlotDisponivel } from '../../models/janela-agendamento.models';

function slot(
  partial: Partial<AgendamentoTimelineSlot> & Pick<AgendamentoTimelineSlot, 'disponiveis' | 'agendado'>
): AgendamentoTimelineSlot {
  return {
    key: partial.key ?? 'k',
    label: partial.label ?? '08:00 às 09:00',
    horaInicio: partial.horaInicio ?? '08:00',
    horaFim: partial.horaFim ?? '09:00',
    cadastrado: partial.cadastrado ?? 4,
    agendado: partial.agendado,
    disponiveis: partial.disponiveis,
    ocupacaoPct: partial.ocupacaoPct ?? 0,
  };
}

describe('agendamento-dashboard.util KPIs de janelas', () => {
  it('sem janelas → vagas disponíveis 0', () => {
    expect(somarDisponiveisSlots([])).toBe(0);
    expect(somarAgendadosSlots([])).toBe(0);
    expect(resolverKpiJanelasDia({ slots: [] })).toEqual({ disponiveis: 0, ocupados: 0 });
  });

  it('soma disponíveis de N janelas do mesmo dia (ex.: 4×4 = 16)', () => {
    const slots = [
      slot({ disponiveis: 4, agendado: 0 }),
      slot({ disponiveis: 4, agendado: 0 }),
      slot({ disponiveis: 4, agendado: 0 }),
      slot({ disponiveis: 4, agendado: 0 }),
    ];
    expect(somarDisponiveisSlots(slots)).toBe(16);
    expect(resolverKpiJanelasDia({ slots }).disponiveis).toBe(16);
  });

  it('preferência pelos totais do BE quando informados', () => {
    const slots = [slot({ disponiveis: 4, agendado: 1 })];
    expect(
      resolverKpiJanelasDia({
        totalDisponiveis: 12,
        totalOcupadas: 5,
        slots,
      })
    ).toEqual({ disponiveis: 12, ocupados: 5 });
  });

  it('mapTimelineSlots alimenta a mesma soma usada no card', () => {
    const api: JanelaSlotDisponivel[] = [
      {
        janelaAgendamentoId: 1,
        horaInicio: '08:00',
        horaFim: '09:00',
        capacidade: 4,
        ocupadas: 0,
        disponiveis: 4,
        viaDestinacao: false,
        label: '08:00 às 09:00',
      },
      {
        janelaAgendamentoId: 1,
        horaInicio: '09:00',
        horaFim: '10:00',
        capacidade: 4,
        ocupadas: 1,
        disponiveis: 3,
        viaDestinacao: false,
        label: '09:00 às 10:00',
      },
    ];
    const mapped = mapTimelineSlots(api);
    expect(somarDisponiveisSlots(mapped)).toBe(7);
    expect(somarAgendadosSlots(mapped)).toBe(1);
  });
});
