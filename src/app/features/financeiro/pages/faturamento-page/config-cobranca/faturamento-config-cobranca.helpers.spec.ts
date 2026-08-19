import {
  RegraFechamento,
  montarRegistroDoFormulario,
  servicosVazios,
  validarFormularioConfig
} from './faturamento-config-cobranca.helpers';
import { acordoVazio, MESES_ACORDO, novaListagemAcordo, sincronizarVagasDoAcordo } from './config-cobranca-acordo.util';
import type { ConfigCobrancaServicos } from './faturamento-config-cobranca.types';

type EntradaValidacao = Parameters<typeof validarFormularioConfig>[0];

function entradaValida(overrides: Partial<EntradaValidacao> = {}): EntradaValidacao {
  return {
    transportadoraId: 1,
    modalidade: 'Mensal',
    dataCobranca: null,
    regraFechamento: RegraFechamento.DiaFixo,
    diaFechamento: 10,
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
    valorEstacionamento: 100,
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

  it('exige valor de cobrança maior que zero com mensagem correspondente à modalidade', () => {
    const casos = [
      ['Diária', 'Informe o valor da diária maior que zero.'],
      ['Semanal', 'Informe o valor da semana maior que zero.'],
      ['Mensal', 'Informe o valor estadia maior que zero.'],
      ['Quinzenal', 'Informe o valor da quinzena maior que zero.'],
      ['Personalizada', 'Informe o valor da cobrança maior que zero.']
    ] as const;

    for (const [modalidade, mensagem] of casos) {
      const r = validarFormularioConfig(
        entradaValida({
          modalidade,
          dataCobranca: modalidade === 'Personalizada' ? '2026-09-10' : null,
          diaFechamento:
            modalidade === 'Semanal' ? 2 : modalidade === 'Mensal' ? 10 : null,
          regraFechamento:
            modalidade === 'Semanal' || modalidade === 'Mensal'
              ? RegraFechamento.DiaFixo
              : RegraFechamento.UltimoDiaDoMes,
          valorEstacionamento: 0
        })
      );
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.mensagens).toContain(mensagem);
    }

    expect(validarFormularioConfig(entradaValida({ valorEstacionamento: null })).ok).toBe(false);
    expect(validarFormularioConfig(entradaValida({ valorEstacionamento: -1 })).ok).toBe(false);
  });

  it('exige dia da semana na cobrança semanal', () => {
    const semDia = validarFormularioConfig(
      entradaValida({ modalidade: 'Semanal', diaFechamento: null, regraFechamento: RegraFechamento.DiaFixo })
    );
    expect(semDia.ok).toBe(false);
    expect(semDia.ok === false && semDia.mensagens).toContain('Selecione o dia da semana da cobrança.');

    expect(
      validarFormularioConfig(
        entradaValida({ modalidade: 'Semanal', diaFechamento: 2, regraFechamento: RegraFechamento.DiaFixo })
      ).ok
    ).toBe(true);
  });

  it('exige dia da cobrança na modalidade mensal', () => {
    const semDia = validarFormularioConfig(entradaValida({ modalidade: 'Mensal', diaFechamento: null }));
    expect(semDia.ok).toBe(false);
    expect(semDia.ok === false && semDia.mensagens).toContain(
      'Informe o dia da cobrança mensal (1 a 31).'
    );

    expect(validarFormularioConfig(entradaValida({ modalidade: 'Mensal', diaFechamento: 15 })).ok).toBe(true);
  });

  it('não exige dia/fechamento quando gerar fatura automaticamente está desligado', () => {
    const r = validarFormularioConfig(
      entradaValida({
        modalidade: 'Mensal',
        diaFechamento: null,
        gerarFaturaAutomaticamente: false
      })
    );
    expect(r.ok).toBe(true);
  });

  it('exige data da cobrança apenas na modalidade personalizada', () => {
    const semData = validarFormularioConfig(
      entradaValida({ modalidade: 'Personalizada', dataCobranca: null, diaFechamento: null })
    );
    expect(semData.ok).toBe(false);
    expect(semData.ok === false && semData.mensagens).toContain(
      'Informe a data da cobrança para a cobrança em data personalizada.'
    );

    const comData = validarFormularioConfig(
      entradaValida({
        modalidade: 'Personalizada',
        dataCobranca: '2026-09-10',
        diaFechamento: null,
        regraFechamento: RegraFechamento.UltimoDiaDoMes
      })
    );
    expect(comData.ok).toBe(true);

    // Nas demais modalidades a data é irrelevante e não bloqueia o salvamento.
    expect(
      validarFormularioConfig(
        entradaValida({
          modalidade: 'Diária',
          diaFechamento: null,
          regraFechamento: RegraFechamento.UltimoDiaDoMes
        })
      ).ok
    ).toBe(true);
  });

  it('não exige e-mail quando o envio automático está desligado', () => {
    expect(
      validarFormularioConfig(entradaValida({ email: '', envioAutomaticoEmail: false })).ok
    ).toBe(true);
  });

  it('exige e-mail quando o envio automático está ligado', () => {
    const r = validarFormularioConfig(entradaValida({ email: '', envioAutomaticoEmail: true }));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.mensagens).toContain('Informe o e-mail financeiro.');
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

  it('não exige vencimento da fatura na cobrança diária', () => {
    expect(
      validarFormularioConfig(
        entradaValida({
          modalidade: 'Diária',
          regraFechamento: 0,
          diaFechamento: null,
          prazoVencimentoDias: 0
        })
      ).ok
    ).toBe(true);
  });

  it('exige dia de fechamento quando a regra é dia fixo', () => {
    const semDia = entradaValida({
      modalidade: 'Quinzenal',
      regraFechamento: RegraFechamento.DiaFixo,
      diaFechamento: null
    });
    expect(validarFormularioConfig(semDia).ok).toBe(false);
    expect(validarFormularioConfig({ ...semDia, diaFechamento: 40 }).ok).toBe(false);
    expect(validarFormularioConfig({ ...semDia, diaFechamento: 15 }).ok).toBe(true);
  });

  it('exige período, listagem de vagas e custo do excedente na modalidade acordo', () => {
    const acordo = acordoVazio();
    acordo.dataInicio = '2026-01-01';
    acordo.dataFim = '2026-12-31';
    acordo.listagens = [novaListagemAcordo(MESES_ACORDO.map((mes) => mes.mes), 15)];
    sincronizarVagasDoAcordo(acordo);
    acordo.custoExcedente = 100;
    acordo.tipoCobrancaExcedente = 1;

    const semVagas = validarFormularioConfig(entradaValida({ modalidade: 'Acordo', acordo: acordoVazio() }));
    expect(semVagas.ok).toBe(false);
    expect(semVagas.ok === false && semVagas.mensagens).toContain(
      'Informe a data de início e a data de fim do acordo.'
    );

    const semCusto = validarFormularioConfig(
      entradaValida({ modalidade: 'Acordo', acordo: { ...acordo, custoExcedente: null } })
    );
    expect(semCusto.ok).toBe(false);

    expect(validarFormularioConfig(entradaValida({ modalidade: 'Acordo', acordo })).ok).toBe(true);
  });
});

describe('montarRegistroDoFormulario', () => {
  const campos = {
    id: 0,
    transportadoraId: 1,
    transportadoraNome: 'Transp',
    status: 'Ativa' as const,
    modalidade: 'Mensal' as const,
    dataCobranca: '2026-09-10',
    regraFechamento: RegraFechamento.DiaFixo,
    diaFechamento: 10,
    prazoVencimentoDias: 10,
    email: 'fin@empresa.com',
    envioAuto: true,
    gerarAuto: false,
    multa: false,
    multaPct: 0,
    juros: false,
    jurosPct: 0,
    descFixo: false,
    descValor: 0,
    acresFixo: false,
    acresValor: 0,
    valorEstacionamento: 100,
    servicos: servicosVazios()
  };

  it('descarta a data da cobrança fora da modalidade personalizada', () => {
    expect(montarRegistroDoFormulario(campos).dataCobranca).toBeNull();
    expect(montarRegistroDoFormulario({ ...campos, modalidade: 'Personalizada' }).dataCobranca).toBe('2026-09-10');
  });

  it('monta fechamento semanal a partir do dia da semana', () => {
    const registro = montarRegistroDoFormulario({
      ...campos,
      modalidade: 'Semanal',
      diaFechamento: 2
    });
    expect(registro.diaFechamento).toBe(2);
    expect(registro.regraFechamento).toBe(RegraFechamento.DiaFixo);
    expect(registro.fechamento).toBe('Toda segunda-feira');
  });

  it('força dia fixo na cobrança mensal', () => {
    const registro = montarRegistroDoFormulario({
      ...campos,
      modalidade: 'Mensal',
      regraFechamento: RegraFechamento.UltimoDiaDoMes,
      diaFechamento: 15
    });
    expect(registro.regraFechamento).toBe(RegraFechamento.DiaFixo);
    expect(registro.diaFechamento).toBe(15);
    expect(registro.fechamento).toBe('Todo dia 15');
  });

  it('neutraliza fechamento e prazo na cobrança diária', () => {
    const registro = montarRegistroDoFormulario({
      ...campos,
      modalidade: 'Diária',
      regraFechamento: RegraFechamento.DiaFixo,
      diaFechamento: 15,
      prazoVencimentoDias: 10
    });
    expect(registro.regraFechamento).toBe(RegraFechamento.UltimoDiaDoMes);
    expect(registro.diaFechamento).toBeNull();
    expect(registro.fechamento).toBe('—');
    expect(registro.prazoVencimento).toBe('—');
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
