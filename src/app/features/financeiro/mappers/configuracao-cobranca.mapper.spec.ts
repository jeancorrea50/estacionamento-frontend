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
  prazoVencimentoLabel
} from './configuracao-cobranca.mapper';

describe('configuracao-cobranca.mapper', () => {
  it('deve mapear modalidade e prazo para labels', () => {
    expect(modalidadeLabel(ModalidadeCobranca.Quinzenal)).toBe('Quinzenal');
    expect(prazoVencimentoLabel(10)).toBe('10 dias após fechamento');
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
  });

  it('deve montar post input a partir do item', () => {
    const lista = mapOutputToListaItem(
      mapRawOutput({
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
        agruparPorPlaca: false,
        agruparPorPeriodo: true,
        agruparPorTransportadora: true,
        regra: { id: 4, cobrarMensal: true }
      })
    );
    const payload = mapListaItemToPostInput(lista);
    expect(payload.transportadoraId).toBe(1);
    expect(payload.prazoVencimentoDias).toBe(10);
    expect(payload.regra.cobrarMensal).toBe(true);
    expect(payload.aplicarMulta).toBe(true);  });
});
