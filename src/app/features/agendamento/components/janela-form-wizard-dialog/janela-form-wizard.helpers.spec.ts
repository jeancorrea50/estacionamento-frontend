import {
  formatDuracaoFaixa,
  formatDuracaoSlot,
  formatPeriodicidadeResumo,
  formatVigenciaResumo,
  mapFaixasResumo,
} from './janela-form-wizard.helpers';

describe('janela-form-wizard.helpers', () => {
  it('formata vigência sem data final', () => {
    expect(formatVigenciaResumo('2026-11-22', '')).toContain('Sem data final');
  });

  it('formata duração de slot e faixa', () => {
    expect(formatDuracaoSlot(1, 1)).toBe('1 hora');
    expect(formatDuracaoSlot(1, 2)).toBe('2 horas');
    expect(formatDuracaoFaixa('06:00', '08:00')).toBe('2 horas');
  });

  it('mapeia faixas para tabela de resumo', () => {
    const rows = mapFaixasResumo([
      { uid: 1, horaInicio: '06:00', horaFim: '08:00' },
      { uid: 2, horaInicio: '08:00', horaFim: '10:00' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].horarioLabel).toBe('06:00–08:00');
    expect(rows[0].duracao).toBe('2 horas');
  });

  it('resume periodicidade diária', () => {
    expect(
      formatPeriodicidadeResumo([
        {
          uid: 1,
          tipo: 1,
          dias: [],
          diaMes: null,
          mes: null,
          dataInicio: '2026-11-22',
          dataFim: '',
          ativo: true,
          descricao: '',
        },
      ])
    ).toBe('Diário');
  });
});
