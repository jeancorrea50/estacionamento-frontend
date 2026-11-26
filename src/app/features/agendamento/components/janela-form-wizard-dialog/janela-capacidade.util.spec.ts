import { describe, expect, it } from 'vitest';
import {
  gerarFaixasHorario,
  somarUsoVagasJanelas,
  tetoDisponivel,
  validarVagasContraCapacidadePatio,
} from './janela-capacidade.util';

describe('janela-capacidade.util', () => {
  const janelas = [
    { id: 1, modalidade: 1 as const, vagasPorSlot: 40 },
    { id: 2, modalidade: 2 as const, vagasPorSlot: 20 },
    { id: 3, modalidade: 3 as const, vagasPorSlot: 10 },
  ];

  it('soma buckets e exclui janela em edição', () => {
    expect(somarUsoVagasJanelas(janelas)).toEqual({ estacionamento: 50, limpeza: 30 });
    expect(somarUsoVagasJanelas(janelas, 3)).toEqual({ estacionamento: 40, limpeza: 20 });
  });

  it('calcula teto disponível', () => {
    expect(tetoDisponivel(100, 40)).toBe(60);
    expect(tetoDisponivel(50, 60)).toBe(0);
    expect(tetoDisponivel(null, 10)).toBeNull();
  });

  it('bloqueia quando ultrapassa capacidade de estacionamento', () => {
    const erros = validarVagasContraCapacidadePatio({
      vagasPorSlot: 70,
      modalidade: 1,
      capacidade: { estacionamento: 100, limpeza: 50 },
      usoOutras: { estacionamento: 40, limpeza: 0 },
    });
    expect(erros.length).toBe(1);
    expect(erros[0]).toContain('estacionamento');
  });

  it('Ambos valida os dois buckets', () => {
    const erros = validarVagasContraCapacidadePatio({
      vagasPorSlot: 35,
      modalidade: 3,
      capacidade: { estacionamento: 100, limpeza: 50 },
      usoOutras: { estacionamento: 40, limpeza: 20 },
    });
    expect(erros.some((e) => e.includes('limpeza'))).toBe(true);
  });

  it('permite quando cabe no restante', () => {
    expect(
      validarVagasContraCapacidadePatio({
        vagasPorSlot: 30,
        modalidade: 1,
        capacidade: { estacionamento: 100, limpeza: 50 },
        usoOutras: { estacionamento: 40, limpeza: 0 },
      })
    ).toEqual([]);
  });

  it('gera 12 faixas de 1h entre 06:00 e 18:00', () => {
    const { faixas, erro } = gerarFaixasHorario({
      horaInicio: '06:00',
      horaFim: '18:00',
      duracaoMinutos: 60,
    });
    expect(erro).toBeUndefined();
    expect(faixas).toHaveLength(12);
    expect(faixas[0]).toEqual({ horaInicio: '06:00', horaFim: '07:00' });
    expect(faixas[11]).toEqual({ horaInicio: '17:00', horaFim: '18:00' });
  });
});
