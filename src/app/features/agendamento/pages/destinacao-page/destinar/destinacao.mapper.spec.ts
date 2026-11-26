import { describe, expect, it } from 'vitest';
import type { VagaReservaTransportadoraItem } from '../../../models/vaga-disponibilidade.models';
import {
  agruparDestinacoes,
  agruparPorTransportadora,
  calcularJanelas,
  montarInput,
  recorrenciaDaApi,
  recorrenciaParaApi,
  reservaCobreDia,
  somarDias,
} from './destinacao.mapper';

const PATIO = { id: 0, nome: 'Pátio' };

function reserva(
  p: Partial<VagaReservaTransportadoraItem> & Pick<VagaReservaTransportadoraItem, 'id'>,
): VagaReservaTransportadoraItem {
  return {
    transportadoraId: 10,
    transportadoraNome: 'Bom Futuro',
    modalidade: 1,
    modalidadeLabel: 'Estacionamento',
    quantidade: 2,
    dataInicio: '2026-12-01T00:00:00',
    dataFim: '2026-12-31T00:00:00',
    periodicidade: 1,
    periodicidadeLabel: 'Diário',
    periodoDia: null,
    periodoDiaLabel: null,
    horaInicio: '08:00',
    horaFim: '09:00',
    diasSemana: null,
    responsavelFaturamentoId: null,
    responsavelFaturamentoNome: null,
    avulso: false,
    transferenciaAutomaticaSaldo: false,
    ativo: true,
    ...p,
  };
}

describe('recorrência', () => {
  it('converte dias da semana em atalhos e volta', () => {
    expect(recorrenciaDaApi(1, null)).toBe('todos');
    expect(recorrenciaDaApi(2, '5,4,3,2,1')).toBe('uteis');
    expect(recorrenciaDaApi(2, '6,0')).toBe('fds');
    expect(recorrenciaDaApi(2, '1,3')).toBe('personalizado');
    expect(recorrenciaParaApi('uteis')).toEqual({ periodicidade: 2, diasSemana: '1,2,3,4,5' });
    expect(recorrenciaParaApi('todos')).toEqual({ periodicidade: 1, diasSemana: null });
    expect(recorrenciaParaApi('personalizado', '3,1')).toEqual({
      periodicidade: 2,
      diasSemana: '1,3',
    });
  });

  it('respeita vigência e dias da semana', () => {
    const uteis = reserva({ id: 1, periodicidade: 2, diasSemana: '1,2,3,4,5' });
    expect(reservaCobreDia(uteis, '2026-12-07')).toBe(true); // segunda
    expect(reservaCobreDia(uteis, '2026-12-06')).toBe(false); // domingo
    expect(reservaCobreDia(uteis, '2027-01-04')).toBe(false); // fora da vigência
  });
});

describe('agruparDestinacoes', () => {
  it('junta horários do mesmo período e separa por destinador', () => {
    const lista = agruparDestinacoes(
      [
        reserva({
          id: 1,
          horaInicio: '07:00',
          horaFim: '08:00',
          usuarioCriacao: 'ana',
          dataCriacao: '2026-11-20T10:00:00',
        }),
        reserva({ id: 2, horaInicio: '06:00', horaFim: '07:00', ativo: false }),
        reserva({ id: 3, destinadorId: 5, destinadorNome: 'Yara' }),
      ],
      PATIO,
      '2026-12-10',
    );
    expect(lista).toHaveLength(2);
    const patio = lista.find((d) => d.destinador.id === 0)!;
    expect(patio.itens.map((i) => i.id)).toEqual([2, 1]);
    expect(patio.status).toBe('ativa');
    expect(patio.registradoPor).toBe('ana');
    expect(lista.find((d) => d.destinador.id === 5)!.destinador.nome).toBe('Yara');
  });

  it('marca encerrada quando o fim já passou e pausada quando nada está ativo', () => {
    const [enc] = agruparDestinacoes(
      [reserva({ id: 1, dataFim: '2026-11-01', dataInicio: '2026-10-01' })],
      PATIO,
      '2026-12-10',
    );
    expect(enc.status).toBe('encerrada');
    const [pau] = agruparDestinacoes([reserva({ id: 1, ativo: false })], PATIO, '2026-12-10');
    expect(pau.status).toBe('pausada');
  });

  it('agrupa por transportadora com filtros e avulso primeiro', () => {
    const ds = agruparDestinacoes(
      [
        reserva({ id: 1, transportadoraId: 20, transportadoraNome: 'Zeta' }),
        reserva({ id: 2, avulso: true, transportadoraId: 0 }),
        reserva({ id: 3, responsavelFaturamentoId: 9, responsavelFaturamentoNome: 'Amaggi' }),
      ],
      PATIO,
      '2026-12-10',
    );
    const grupos = agruparPorTransportadora(ds, {
      termo: '',
      modalidade: 'todas',
      status: 'ativa',
    });
    expect(grupos.map((g) => g.nome)).toEqual(['Avulso', 'Bom Futuro', 'Zeta']);
    expect(grupos[1].temTerceiro).toBe(true);
    expect(
      agruparPorTransportadora(ds, { termo: 'amaggi', modalidade: 'todas', status: 'todas' }),
    ).toHaveLength(1);
  });
});

describe('calcularJanelas', () => {
  it('desconta o destinado no dia, ignorando a própria destinação', () => {
    const reservas = [
      reserva({ id: 1, quantidade: 3, horaInicio: '08:00', horaFim: '09:00' }),
      reserva({ id: 2, quantidade: 2, horaInicio: '08:00', horaFim: '09:00', modalidade: 2 }),
      reserva({ id: 3, quantidade: 4, horaInicio: '08:00', horaFim: '09:00', ativo: false }),
    ];
    const slots = [{ horaInicio: '08:00:00', horaFim: '09:00:00', capacidade: 10 }];
    expect(calcularJanelas(slots, reservas, '2026-12-10', 'estacionamento')[0].livres).toBe(7);
    expect(
      calcularJanelas(slots, reservas, '2026-12-10', 'estacionamento', new Set([1]))[0].livres,
    ).toBe(10);
  });
});

describe('montarInput', () => {
  it('gera o payload da API', () => {
    const input = montarInput({
      transportadoraId: null,
      destinadorId: 0,
      modalidade: 'limpeza',
      inicio: '2026-12-01',
      fim: null,
      recorrencia: 'fds',
      diasOriginais: null,
      janela: { inicio: '06:00', fim: '07:00' },
      quantidade: 2,
      faturamento: { tipo: 'transportadora', pagador: null },
      transferencia: true,
    });
    expect(input).toMatchObject({
      avulso: true,
      modalidade: 2,
      periodicidade: 2,
      diasSemana: '0,6',
      destinadorId: null,
      responsavelFaturamentoId: null,
      transferenciaAutomaticaSaldo: true,
    });
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
  });
});
