import { describe, expect, it } from 'vitest';
import {
  mapTimelineSlots,
  reservaCobreDia,
  resolverKpiJanelasDia,
  somarAgendadosSlots,
  somarDestinacaoCifFob,
  somarDisponiveisSlots,
  type AgendamentoTimelineSlot,
} from './agendamento-dashboard.util';
import type { JanelaSlotDisponivel } from '../../models/janela-agendamento.models';
import type { VagaReservaTransportadoraItem } from '../../models/vaga-disponibilidade.models';

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

function reserva(
  partial: Partial<VagaReservaTransportadoraItem> &
    Pick<VagaReservaTransportadoraItem, 'quantidade' | 'dataInicio'>
): VagaReservaTransportadoraItem {
  return {
    id: partial.id ?? 1,
    transportadoraId: partial.transportadoraId ?? 10,
    transportadoraNome: partial.transportadoraNome ?? 'T',
    modalidade: partial.modalidade ?? 1,
    modalidadeLabel: partial.modalidadeLabel ?? 'Estacionamento',
    quantidade: partial.quantidade,
    dataInicio: partial.dataInicio,
    dataFim: partial.dataFim ?? null,
    periodicidade: partial.periodicidade ?? 1,
    periodicidadeLabel: partial.periodicidadeLabel ?? 'Diário',
    periodoDia: partial.periodoDia ?? null,
    periodoDiaLabel: partial.periodoDiaLabel ?? null,
    horaInicio: partial.horaInicio ?? '08:00',
    horaFim: partial.horaFim ?? '10:00',
    responsavelFaturamentoId: partial.responsavelFaturamentoId ?? null,
    responsavelFaturamentoNome: partial.responsavelFaturamentoNome ?? null,
    avulso: partial.avulso ?? false,
    transferenciaAutomaticaSaldo: partial.transferenciaAutomaticaSaldo ?? false,
    ativo: partial.ativo ?? true,
  };
}

describe('agendamento-dashboard.util CIF/FOB destinacao', () => {
  it('reservaCobreDia usa vigência aberta quando dataFim é nula', () => {
    expect(
      reservaCobreDia({ ativo: true, dataInicio: '2026-11-01', dataFim: null }, '2026-11-19')
    ).toBe(true);
    expect(
      reservaCobreDia({ ativo: true, dataInicio: '2026-11-20', dataFim: null }, '2026-11-19')
    ).toBe(false);
  });

  it('soma CIF e FOB gerais no dia (3 + 2)', () => {
    const reservas = [
      reserva({
        id: 1,
        quantidade: 3,
        dataInicio: '2026-11-19',
        dataFim: '2026-11-19',
        responsavelFaturamentoId: null,
      }),
      reserva({
        id: 2,
        quantidade: 2,
        dataInicio: '2026-11-19',
        dataFim: '2026-11-19',
        responsavelFaturamentoId: 99,
        responsavelFaturamentoNome: 'Terceiro X',
      }),
      reserva({
        id: 3,
        quantidade: 5,
        dataInicio: '2026-11-01',
        dataFim: '2026-11-18',
        ativo: true,
      }),
    ];
    expect(somarDestinacaoCifFob(reservas, { dataIso: '2026-11-19' })).toEqual({ cif: 3, fob: 2 });
  });

  it('filtra por transportadora quando informado', () => {
    const reservas = [
      reserva({
        transportadoraId: 10,
        quantidade: 3,
        dataInicio: '2026-11-19',
        dataFim: '2026-11-19',
      }),
      reserva({
        transportadoraId: 20,
        quantidade: 4,
        dataInicio: '2026-11-19',
        dataFim: '2026-11-19',
        responsavelFaturamentoId: 1,
      }),
    ];
    expect(
      somarDestinacaoCifFob(reservas, { dataIso: '2026-11-19', transportadoraId: 10 })
    ).toEqual({ cif: 3, fob: 0 });
  });
});
