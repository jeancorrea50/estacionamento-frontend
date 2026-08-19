import {
  ModalidadeCobranca,
  RegraFechamento,
  StatusConfiguracaoCobranca
} from '../models/configuracao-cobranca.models';
import {
  mapListaItemToPostInput,
  mapOutputToListaItem,
  mapRawOutput,
  mapSearchToListaItem,
  modalidadeBadgeLabel,
  modalidadeLabel,
  prazoVencimentoLabel,
  regraFechamentoLabel,
  toIsoDate
} from './configuracao-cobranca.mapper';

function rawOutputBase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 8,
    transportadoraId: 1,
    transportadoraNome: 'T',
    estacionamentoId: 2,
    estacionamentoNome: 'E',
    status: StatusConfiguracaoCobranca.Ativa,
    modalidadeCobranca: ModalidadeCobranca.Mensal,
    diaFechamento: null,
    regraFechamento: RegraFechamento.UltimoDiaDoMes,
    prazoVencimentoDias: 10,
    emailFinanceiro: 'a@b.com',
    envioAutomaticoEmail: true,
    gerarFaturaAutomaticamente: true,
    permitirPagamentoParcial: false,
    aplicarMulta: true,
    multaPercentual: 2,
    aplicarJuros: false,
    jurosPercentual: 0,
    aplicarDescontoFixo: false,
    valorDescontoFixo: 0,
    aplicarAcrescimoFixo: false,
    valorAcrescimoFixo: 0,
    valorEstacionamento: null,
    dataCobranca: null,
    cobrarLavagem: false,
    valorLavagem: null,
    cobrarPernoite: false,
    valorPernoite: null,
    cobrarServicosExtras: false,
    valorServicosExtras: null,
    considerarBeneficioAbastecimento: false,
    valorBeneficioAbastecimento: null,
    agruparPorPlaca: false,
    agruparPorPeriodo: true,
    agruparPorTransportadora: true,
    ...overrides
  };
}

describe('configuracao-cobranca.mapper', () => {
  it('deve mapear modalidade e prazo para labels', () => {
    expect(modalidadeLabel(ModalidadeCobranca.Quinzenal)).toBe('Quinzenal');
    expect(modalidadeLabel(ModalidadeCobranca.Personalizado)).toBe('Personalizada');
    expect(modalidadeBadgeLabel('Personalizada')).toBe('Data personalizada');
    expect(modalidadeBadgeLabel('Mensal')).toBe('Mensal');
    expect(prazoVencimentoLabel(10)).toBe('10 dias após fechamento');
    expect(regraFechamentoLabel(RegraFechamento.DiaFixo, 5)).toBe('Todo dia 05');
    expect(regraFechamentoLabel(RegraFechamento.UltimoDiaDoMes, null)).toBe('Último dia do mês');
  });

  it('deve normalizar DateTime do backend para yyyy-MM-dd', () => {
    expect(toIsoDate('2026-08-15T00:00:00')).toBe('2026-08-15');
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate('')).toBeNull();
  });

  it('deve mapear search para item de lista', () => {
    const item = mapSearchToListaItem({
      id: 1,
      transportadoraId: 2,
      transportadoraNome: 'Transp',
      estacionamentoId: 3,
      estacionamentoNome: 'Estac',
      status: StatusConfiguracaoCobranca.Ativa,
      modalidadeCobranca: ModalidadeCobranca.Mensal,
      diaFechamento: 5,
      regraFechamento: RegraFechamento.DiaFixo,
      prazoVencimentoDias: 10,
      valorEstacionamento: null,
      emailFinanceiro: 'a@b.com',
      envioAutomaticoEmail: false,
      gerarFaturaAutomaticamente: true,
      dataCriacao: '2026-01-01'
    });
    expect(item.transportadora).toBe('Transp');
    expect(item.modalidade).toBe('Mensal');
    expect(item.status).toBe('Ativa');
    // São propriedades independentes: a grade usa geração automática,
    // enquanto o formulário mantém o envio automático por e-mail.
    expect(item.envioAutomatico).toBe(false);
    expect(item.gerarFaturaAutomaticamente).toBe(true);
    // A grade precisa exibir fechamento e prazo já na busca, sem depender do detalhe.
    expect(item.fechamento).toBe('Todo dia 05');
    expect(item.prazoVencimento).toBe('10 dias após fechamento');
    expect(item.parcial).toBe(true);
  });

  it('deve montar post input a partir do item', () => {
    const lista = mapOutputToListaItem(mapRawOutput(rawOutputBase()));
    const payload = mapListaItemToPostInput(lista);
    expect(payload.transportadoraId).toBe(1);
    expect(payload.prazoVencimentoDias).toBe(10);
    expect(payload.aplicarMulta).toBe(true);
  });

  it('não exibe vencimento da fatura na cobrança diária', () => {
    const item = mapSearchToListaItem({
      id: 1,
      transportadoraId: 2,
      transportadoraNome: 'Transp',
      estacionamentoId: 3,
      estacionamentoNome: 'Patio',
      status: StatusConfiguracaoCobranca.Ativa,
      modalidadeCobranca: ModalidadeCobranca.Diaria,
      diaFechamento: 5,
      regraFechamento: RegraFechamento.DiaFixo,
      prazoVencimentoDias: 10,
      valorEstacionamento: 20,
      emailFinanceiro: 'a@b.com',
      envioAutomaticoEmail: false,
      gerarFaturaAutomaticamente: true,
      dataCriacao: '2026-01-01'
    });
    expect(item.fechamento).toBe('—');
    expect(item.prazoVencimento).toBe('—');

    const payload = mapListaItemToPostInput(item);
    expect(payload.diaFechamento).toBeNull();
    expect(payload.regraFechamento).toBe(RegraFechamento.UltimoDiaDoMes);
  });

  it('deve trazer serviços adicionais habilitados com seus valores', () => {
    const lista = mapOutputToListaItem(
      mapRawOutput(
        rawOutputBase({
          cobrarLavagem: true,
          valorLavagem: 35.5,
          considerarBeneficioAbastecimento: true,
          valorBeneficioAbastecimento: 12
        })
      )
    );

    expect(lista.servicos.lavagem).toEqual({ habilitado: true, valor: 35.5 });
    expect(lista.servicos.beneficio).toEqual({ habilitado: true, valor: 12 });
    expect(lista.servicos.pernoite).toEqual({ habilitado: false, valor: null });
    expect(lista.servicosCobrados).toBe('Lavagem, Benefício por abastecimento');

    const payload = mapListaItemToPostInput(lista);
    expect(payload.cobrarLavagem).toBe(true);
    expect(payload.valorLavagem).toBe(35.5);
  });

  it('não deve enviar valor de serviço desabilitado', () => {
    const lista = mapOutputToListaItem(mapRawOutput(rawOutputBase()));
    lista.servicos.pernoite = { habilitado: false, valor: 99 };

    const payload = mapListaItemToPostInput(lista);
    expect(payload.cobrarPernoite).toBe(false);
    expect(payload.valorPernoite).toBeNull();
  });

  it('deve enviar dataCobranca apenas na modalidade personalizada', () => {
    const personalizada = mapOutputToListaItem(
      mapRawOutput(
        rawOutputBase({
          modalidadeCobranca: ModalidadeCobranca.Personalizado,
          dataCobranca: '2026-09-10T00:00:00'
        })
      )
    );
    expect(personalizada.dataCobranca).toBe('2026-09-10');
    expect(mapListaItemToPostInput(personalizada).dataCobranca).toBe('2026-09-10');

    const mensal = { ...personalizada, modalidade: 'Mensal' as const, modalidadeCobranca: ModalidadeCobranca.Mensal };
    expect(mapListaItemToPostInput(mensal).dataCobranca).toBeNull();
  });

  it('deve mapear acordo e enviar vagas/excedente só nessa modalidade', () => {
    expect(modalidadeLabel(ModalidadeCobranca.Acordo)).toBe('Acordo');
    const acordo = mapOutputToListaItem(
      mapRawOutput(
        rawOutputBase({
          modalidadeCobranca: ModalidadeCobranca.Acordo,
          vagasJaneiro: 5,
          vagasFevereiro: 10,
          custoExcedente: 100,
          tipoCobrancaExcedente: 1
        })
      )
    );
    expect(acordo.modalidade).toBe('Acordo');
    expect(acordo.acordo.vagas[1]).toBe(5);
    expect(acordo.acordo.vagas[2]).toBe(10);
    expect(acordo.acordo.custoExcedente).toBe(100);

    const payload = mapListaItemToPostInput(acordo);
    expect(payload.modalidadeCobranca).toBe(ModalidadeCobranca.Acordo);
    expect(payload.vagasJaneiro).toBe(5);
    expect(payload.custoExcedente).toBe(100);
    expect(payload.tipoCobrancaExcedente).toBe(1);

    const mensal = mapListaItemToPostInput(mapOutputToListaItem(mapRawOutput(rawOutputBase())));
    expect(mensal.vagasJaneiro).toBeNull();
    expect(mensal.custoExcedente).toBeNull();
  });

  it('não deve enviar estacionamentoId no POST/PUT', () => {
    const lista = mapOutputToListaItem(mapRawOutput(rawOutputBase()));
    const payload = mapListaItemToPostInput(lista);
    expect(payload).not.toHaveProperty('estacionamentoId');
  });

  it('deve sempre zerar o agrupamento removido do cadastro', () => {
    const lista = mapOutputToListaItem(mapRawOutput(rawOutputBase()));
    const payload = mapListaItemToPostInput(lista);
    expect(payload.agruparPorPlaca).toBe(false);
    expect(payload.agruparPorPeriodo).toBe(false);
    expect(payload.agruparPorTransportadora).toBe(false);
  });
});
