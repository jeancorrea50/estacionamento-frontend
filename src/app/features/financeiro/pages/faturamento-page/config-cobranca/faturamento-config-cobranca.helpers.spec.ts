import {
  RegraFechamento,
  montarRegistroDoFormulario,
  servicosVazios,
  validarFormularioConfig
} from './faturamento-config-cobranca.helpers';
import type { ConfigCobrancaServicos } from './faturamento-config-cobranca.types';

type EntradaValidacao = Parameters<typeof validarFormularioConfig>[0];

function entradaValida(overrides: Partial<EntradaValidacao> = {}): EntradaValidacao {
  return {
    transportadoraId: 1,
    estacionamentoId: 2,
    modalidade: 'Mensal',
    dataCobranca: null,
    regraFechamento: RegraFechamento.UltimoDiaDoMes,
    diaFechamento: null,
    prazoVencimentoDias: 10,
    email: 'financeiro@empresa.com',
    multa: false,
    multaPct: 0,
    juros: false,
    jurosPct: 0,
    descFixo: false,
    descValor: 0,
    acresFixo: false,
    acresValor: 0,
    valorEstadia: 100,
    servicos: servicosVazios(),
    ...overrides
  };
}

function comServico(
  key: keyof ConfigCobrancaServicos,
  habilitado: boolean,
  valor: number | null
): ConfigCobrancaServicos {
  const servicos = servicosVazios();
  servicos[key] = { habilitado, valor };
  return servicos;
}

describe('validarFormularioConfig', () => {
  it('aceita configuração completa', () => {
    expect(validarFormularioConfig(entradaValida()).ok).toBe(true);
  });

  it('exige uma regra de cobrança selecionada', () => {
    const r = validarFormularioConfig(entradaValida({ modalidade: '' }));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.mensagens).toContain('Selecione a regra de cobrança.');
  });

  it('obriga reescolher a regra em registros legados com modalidade semanal', () => {
    const r = validarFormularioConfig(entradaValida({ modalidade: 'Semanal' }));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.mensagens).toContain('Selecione a regra de cobrança.');
  });

  it('exige data da cobrança apenas na modalidade personalizada', () => {
    const semData = validarFormularioConfig(
      entradaValida({ modalidade: 'Personalizada', dataCobranca: null })
    );
    expect(semData.ok).toBe(false);
    expect(semData.ok === false && semData.mensagens).toContain(
      'Informe a data da cobrança para a cobrança em data personalizada.'
    );

    const comData = validarFormularioConfig(
      entradaValida({ modalidade: 'Personalizada', dataCobranca: '2026-09-10' })
    );
    expect(comData.ok).toBe(true);

    // Nas demais modalidades a data é irrelevante e não bloqueia o salvamento.
    expect(validarFormularioConfig(entradaValida({ modalidade: 'Diária' })).ok).toBe(true);
  });

  it('exige percentual quando juros ou multa estão ativos', () => {
    expect(validarFormularioConfig(entradaValida({ juros: true, jurosPct: 0 })).ok).toBe(false);
    expect(validarFormularioConfig(entradaValida({ juros: true, jurosPct: 2 })).ok).toBe(true);
    expect(validarFormularioConfig(entradaValida({ multa: true, multaPct: 0 })).ok).toBe(false);
    expect(validarFormularioConfig(entradaValida({ multa: true, multaPct: 1.5 })).ok).toBe(true);
  });

  it('exige valor quando desconto ou acréscimo fixo estão ativos', () => {
    expect(validarFormularioConfig(entradaValida({ descFixo: true, descValor: 0 })).ok).toBe(false);
    expect(validarFormularioConfig(entradaValida({ acresFixo: true, acresValor: 0 })).ok).toBe(false);
    expect(
      validarFormularioConfig(entradaValida({ descFixo: true, descValor: 10, acresFixo: true, acresValor: 5 })).ok
    ).toBe(true);
  });

  it('exige valor de cada serviço adicional habilitado', () => {
    for (const key of ['lavagem', 'pernoite', 'extras', 'beneficio'] as const) {
      expect(validarFormularioConfig(entradaValida({ servicos: comServico(key, true, null) })).ok).toBe(false);
      expect(validarFormularioConfig(entradaValida({ servicos: comServico(key, true, 0) })).ok).toBe(false);
      expect(validarFormularioConfig(entradaValida({ servicos: comServico(key, true, 20) })).ok).toBe(true);
    }
  });

  it('ignora valor de serviço desabilitado', () => {
    expect(validarFormularioConfig(entradaValida({ servicos: comServico('lavagem', false, null) })).ok).toBe(true);
  });

  it('exige dia de fechamento quando a regra é dia fixo', () => {
    const semDia = entradaValida({ regraFechamento: RegraFechamento.DiaFixo, diaFechamento: null });
    expect(validarFormularioConfig(semDia).ok).toBe(false);
    expect(validarFormularioConfig({ ...semDia, diaFechamento: 40 }).ok).toBe(false);
    expect(validarFormularioConfig({ ...semDia, diaFechamento: 15 }).ok).toBe(true);
  });
});

describe('montarRegistroDoFormulario', () => {
  const campos = {
    id: 0,
    transportadoraId: 1,
    transportadoraNome: 'Transp',
    estacionamentoId: 2,
    estacionamentoNome: 'Estac',
    status: 'Ativa' as const,
    modalidade: 'Mensal' as const,
    dataCobranca: '2026-09-10',
    regraFechamento: RegraFechamento.UltimoDiaDoMes,
    diaFechamento: null,
    prazoVencimentoDias: 10,
    email: 'fin@empresa.com',
    envioAuto: true,
    gerarAuto: false,
    pagamentoParcial: false,
    multa: false,
    multaPct: 0,
    juros: false,
    jurosPct: 0,
    descFixo: false,
    descValor: 0,
    acresFixo: false,
    acresValor: 0,
    valorEstadia: 100,
    servicos: servicosVazios()
  };

  it('descarta a data da cobrança fora da modalidade personalizada', () => {
    expect(montarRegistroDoFormulario(campos).dataCobranca).toBeNull();
    expect(montarRegistroDoFormulario({ ...campos, modalidade: 'Personalizada' }).dataCobranca).toBe('2026-09-10');
  });

  it('descarta o valor de serviço desabilitado e resume os habilitados', () => {
    const registro = montarRegistroDoFormulario({
      ...campos,
      servicos: {
        ...servicosVazios(),
        lavagem: { habilitado: true, valor: 30 },
        pernoite: { habilitado: false, valor: 99 }
      }
    });

    expect(registro.servicos.lavagem).toEqual({ habilitado: true, valor: 30 });
    expect(registro.servicos.pernoite).toEqual({ habilitado: false, valor: null });
    expect(registro.servicosCobrados).toBe('Lavagem');
  });
});
