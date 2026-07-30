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
  modalidadeLabel,
  prazoVencimentoLabel,
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
    valorEstadia: null,
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
    expect(prazoVencimentoLabel(10)).toBe('10 dias após fechamento');
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
      valorEstadia: null,
      emailFinanceiro: 'a@b.com',
      dataCriacao: '2026-01-01'
    });
    expect(item.transportadora).toBe('Transp');
    expect(item.modalidade).toBe('Mensal');
    expect(item.status).toBe('Ativa');
    expect(item.parcial).toBe(true);
  });

  it('deve montar post input a partir do item', () => {
    const lista = mapOutputToListaItem(mapRawOutput(rawOutputBase()));
    const payload = mapListaItemToPostInput(lista);
    expect(payload.transportadoraId).toBe(1);
    expect(payload.prazoVencimentoDias).toBe(10);
    expect(payload.aplicarMulta).toBe(true);
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

  it('deve sempre zerar o agrupamento removido do cadastro', () => {
    const lista = mapOutputToListaItem(mapRawOutput(rawOutputBase()));
    const payload = mapListaItemToPostInput(lista);
    expect(payload.agruparPorPlaca).toBe(false);
    expect(payload.agruparPorPeriodo).toBe(false);
    expect(payload.agruparPorTransportadora).toBe(false);
  });
});
