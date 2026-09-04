import {
  mapPagamentoItemToLista,
  mapRawPagamentosOutput
} from './pagamento.mapper';
import { ModalidadeRecebimento, StatusFatura, TipoFatura } from '../models/fatura.models';

describe('pagamento.mapper', () => {
  it('mapeia pagamentos com resumo e item da lista', () => {
    const page = mapRawPagamentosOutput(
      {
        Result: {
          Resumo: {
            TotalRecebidoPeriodo: 500,
            PagamentosParciais: 50,
            QuantidadePagamentosParciais: 1,
            ValorPendente: 100,
            QuantidadePendentes: 1,
            PagamentosDoDia: 20
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
    expect(page.resumo.pagamentosDoDia).toBe(20);
    const item = mapPagamentoItemToLista(page.itens.items[0]);
    expect(item.faturaId).toBe(8);
    expect(item.id).toBe('FAT-8');
    expect(item.tipoFatura).toBe('Cobrança');
    expect(item.status).toBe('Parcial');
    expect(item.formaPagamento).toBe('Boleto');
    expect(item.saldoRestante).toBe(50);
    expect(item.comprovante).toBe('Sem comprovante');
  });
});
