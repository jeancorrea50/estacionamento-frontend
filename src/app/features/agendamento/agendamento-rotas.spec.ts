import { describe, expect, it } from 'vitest';
import {
  AGENDAMENTO_PAINEL_ROUTE,
  AGENDAMENTO_ROUTE,
  JANELAS_ROUTE,
  normalizeAgendamentoAppRoute,
} from './agendamento-rotas';

describe('normalizeAgendamentoAppRoute', () => {
  it('mantém o agrupador /app/patio/agendamentos (não reescreve para painel)', () => {
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamentos')).toBe(AGENDAMENTO_ROUTE);
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamentos/')).toBe(AGENDAMENTO_ROUTE);
  });

  it('mapeia painel e janelas canônicos', () => {
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamentos/painel')).toBe(
      AGENDAMENTO_PAINEL_ROUTE
    );
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamentos/janelas')).toBe(JANELAS_ROUTE);
  });

  it('preserva filhos dinâmicos desconhecidos sob o agrupador', () => {
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamentos/foo')).toBe(
      '/app/patio/agendamentos/foo'
    );
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamentos/painel-extra')).toBe(
      '/app/patio/agendamentos/painel-extra'
    );
  });

  it('preserva nesting sob painel e janelas (3º nível+)', () => {
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamentos/painel/foo')).toBe(
      '/app/patio/agendamentos/painel/foo'
    );
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamentos/janelas/bar')).toBe(
      '/app/patio/agendamentos/janelas/bar'
    );
  });

  it('mapeia singular legado /app/patio/agendamento para painel (sem casar plural)', () => {
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamento')).toBe(AGENDAMENTO_PAINEL_ROUTE);
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamento/lista')).toBe(
      AGENDAMENTO_PAINEL_ROUTE
    );
  });

  it('não colapsa filhos do plural por causa do prefixo singular', () => {
    expect(normalizeAgendamentoAppRoute('/app/patio/agendamentos/filho')).toBe(
      '/app/patio/agendamentos/filho'
    );
  });
});
