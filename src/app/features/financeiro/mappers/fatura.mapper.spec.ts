import {
  mapFechamentoItemToLista,
  mapInadimplenteItemToLista,
  mapRawFechamentosOutput,
  mapRawInadimplentesOutput,
  mapRawRecebimentosOutput,
  mapRawSearchItem,
  mapRawVisaoGeral,
  mapRecebimentoItemToLista,
  mapSearchToListaItem,
  statusFaturaFromLabel,
  statusFaturaLabel,
  modalidadeRecebimentoLabel,
  tipoFaturaLabel
} from './fatura.mapper';
import { ModalidadeCobranca } from '../models/configuracao-cobranca.models';
import {
  ModalidadeRecebimento,
  SituacaoFechamento,
  StatusFatura,
  TipoFatura
} from '../models/fatura.models';

describe('fatura.mapper', () => {
  it('mapeia status e modalidade para labels', () => {
    expect(statusFaturaLabel(StatusFatura.Pago)).toBe('Pago');
    expect(statusFaturaFromLabel('Vencido')).toBe(StatusFatura.Vencido);
    expect(modalidadeRecebimentoLabel(ModalidadeRecebimento.Boleto)).toBe('Boleto');
    expect(modalidadeRecebimentoLabel(null)).toBe('—');
    expect(tipoFaturaLabel(TipoFatura.Avulso)).toBe('Avulso');
    expect(tipoFaturaLabel(TipoFatura.Cobranca)).toBe('Cobrança');
  });

  it('mapeia search PascalCase para item da lista', () => {
    const dto = mapRawSearchItem({
      Id: 1,
      Numero: 'FT-1',
      TransportadoraId: 10,
      TransportadoraNome: 'ABC',
      EstacionamentoId: 20,
      EstacionamentoNome: 'Pátio',
      TipoFatura: TipoFatura.Avulso,
      Status: StatusFatura.AguardandoEnvio,
      ModalidadeRecebimento: ModalidadeRecebimento.Pix,
      ValorTotal: 50.5,
      ValorRecebido: 0,
      ValorEmAberto: 50.5,
      DataEmissao: '2026-08-01T12:00:00',
      DataVencimento: '2026-08-15T00:00:00',
      DataPagamento: null
    });
    const item = mapSearchToListaItem(dto);
    expect(item.id).toBe(1);
    expect(item.numero).toBe('FT-1');
    expect(item.tipoFatura).toBe('Avulso');
    expect(item.tipoFaturaCodigo).toBe(TipoFatura.Avulso);
    expect(item.status).toBe('Aguardando envio');
    expect(item.vencimento).toBe('2026-08-15');
    expect(item.parcial).toBe(true);
  });

  it('mapeia inadimplentes com resumo e stub de status cobrança', () => {
    const page = mapRawInadimplentesOutput(
      {
        Result: {
          Resumo: {
            TotalVencido: 100,
            FaturasVencidas: 1,
            TransportadorasInadimplentes: 1,
            AcordosRealizados: 0
          },
          Itens: {
            Results: [
              {
                Id: 9,
                Numero: 'FAT-9',
                TransportadoraId: 1,
                TransportadoraNome: 'X',
                Status: StatusFatura.Vencido,
                ValorTotal: 100,
                ValorRecebido: 0,
                ValorEmAberto: 100,
                DataVencimento: '2026-07-01T00:00:00',
                DiasEmAtraso: 30,
                QuantidadeMovimentos: 2,
                UltimaCobranca: null,
                StatusCobranca: null
              }
            ],
            RowCount: 1,
            CurrentPage: 1,
            PageSize: 20
          }
        }
      },
      1,
      20
    );
    expect(page.resumo.totalVencido).toBe(100);
    const item = mapInadimplenteItemToLista(page.itens.items[0]);
    expect(item.faturaId).toBe(9);
    expect(item.id).toBe('FAT-9');
    expect(item.tipoFatura).toBe('Cobrança');
    expect(item.diasAtraso).toBe(30);
    expect(item.statusCobranca).toBe('Não enviada');
  });

  it('mapeia recebimentos com resumo e item da lista', () => {
    const page = mapRawRecebimentosOutput(
      {
        Result: {
          Resumo: {
            TotalRecebidoPeriodo: 500,
            PagamentosParciais: 50,
            QuantidadePagamentosParciais: 1,
            ValorPendente: 100,
            QuantidadePendentes: 1,
            RecebimentosDoDia: 20
          },
          Itens: {
            Results: [
              {
                Id: 8,
                Numero: 'FAT-8',
                TransportadoraId: 2,
                TransportadoraNome: 'Y',
                ValorTotal: 500,
                ValorRecebido: 450,
                SaldoRestante: 50,
                DataPagamento: '2026-08-01T00:00:00',
                FormaPagamento: ModalidadeRecebimento.Boleto,
                TipoFatura: TipoFatura.Cobranca,
                Status: StatusFatura.Parcial,
                Comprovante: null
              }
            ],
            RowCount: 1,
            CurrentPage: 1,
            PageSize: 20
          }
        }
      },
      1,
      20
    );
    expect(page.resumo.totalRecebidoPeriodo).toBe(500);
    expect(page.resumo.pagamentosParciais).toBe(50);
    const item = mapRecebimentoItemToLista(page.itens.items[0]);
    expect(item.faturaId).toBe(8);
    expect(item.id).toBe('FAT-8');
    expect(item.tipoFatura).toBe('Cobrança');
    expect(item.status).toBe('Parcial');
    expect(item.formaPagamento).toBe('Boleto');
    expect(item.saldoRestante).toBe(50);
    expect(item.comprovante).toBe('Sem comprovante');
  });

  it('mapeia fechamentos com resumo e item da lista', () => {
    const page = mapRawFechamentosOutput(
      {
        Result: {
          Resumo: {
            FechamentosDisponiveis: 2,
            ProntosParaFaturar: 1,
            ValorEstimadoTotal: 1280,
            ComDivergencia: 0
          },
          Itens: {
            Results: [
              {
                TransportadoraId: 7,
                TransportadoraNome: 'Transp Z',
                ConfiguracaoCobrancaId: 3,
                Modalidade: ModalidadeCobranca.Mensal,
                PeriodoInicio: '2026-08-01T00:00:00',
                PeriodoFim: '2026-08-31T00:00:00',
                QuantidadeMovimentos: 12,
                ValorEstimado: 1280,
                QuantidadeDivergencias: 0,
                Situacao: SituacaoFechamento.ProntoParaFaturar
              }
            ],
            RowCount: 2,
            CurrentPage: 1,
            PageSize: 20
          }
        }
      },
      1,
      20
    );
    expect(page.resumo.fechamentosDisponiveis).toBe(2);
    expect(page.resumo.prontosParaFaturar).toBe(1);
    expect(page.resumo.valorEstimadoTotal).toBe(1280);
    const item = mapFechamentoItemToLista(page.itens.items[0]);
    expect(item.transportadoraId).toBe(7);
    expect(item.id).toBe('7');
    expect(item.modalidade).toBe('Mensal');
    expect(item.situacao).toBe('Pronto para faturar');
    expect(item.periodoApurado).toBe('01/08/2026 - 31/08/2026');
    expect(item.movimentacoes).toBe(12);
  });

  it('mapeia visão geral PascalCase do dashboard', () => {
    const dto = mapRawVisaoGeral({
      Result: {
        TotalAReceber: 186420.5,
        Recebido: 124800,
        EmAberto: 48320.75,
        Vencido: 9450,
        AVencer: 13849.75,
        FaturasEmitidas: 56,
        FaturasVencidas: 7,
        TransportadorasFaturadas: 14,
        CobrancasPendentes: 11,
        FaturasPorStatus: [{ Status: StatusFatura.Pago, Quantidade: 28, Valor: 100 }],
        RecebimentosPorModalidade: [{ Modalidade: ModalidadeRecebimento.Pix, Quantidade: 10, Valor: 52100 }],
        EvolucaoFaturamento: [{ Ano: 2026, Mes: 5, Valor: 88000 }]
      }
    });
    expect(dto.totalAReceber).toBe(186420.5);
    expect(dto.faturasEmitidas).toBe(56);
    expect(dto.transportadorasFaturadas).toBe(14);
    expect(dto.faturasPorStatus[0].quantidade).toBe(28);
    expect(dto.recebimentosPorModalidade[0].valor).toBe(52100);
    expect(dto.evolucaoFaturamento[0].mes).toBe(5);
  });
});
