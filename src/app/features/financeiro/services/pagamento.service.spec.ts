import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ModalidadeRecebimento, StatusFatura } from '../models/fatura.models';
import { PagamentoService } from './pagamento.service';

describe('PagamentoService', () => {
  let service: PagamentoService;
  let httpMock: HttpTestingController;
  const base = `${environment.API_BASE_URL}/financeiro/pagamento`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(PagamentoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve listar pagamentos com resumo do dashboard', () => {
    let totalRecebido = 0;
    let itemsLen = 0;
    service
      .listar({
        numeroPagina: 1,
        tamanhoPagina: 20,
        dataInicial: '2026-08-01',
        dataFinal: '2026-08-31'
      })
      .subscribe((page) => {
        totalRecebido = page.resumo.totalRecebidoPeriodo;
        itemsLen = page.items.length;
        expect(page.resumo.quantidadePagamentosParciais).toBe(1);
        expect(page.resumo.quantidadePendentes).toBe(2);
        expect(page.resumo.pagamentosDoDia).toBe(100);
        expect(page.items[0].faturaId).toBe(21);
        expect(page.items[0].id).toBe('FAT-21');
        expect(page.items[0].status).toBe('Pago');
        expect(page.items[0].formaPagamento).toBe('PIX');
        expect(page.items[0].comprovante).toBe('Sem comprovante');
      });

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('NumeroPagina')).toBe('1');
    expect(req.request.params.get('TamanhoPagina')).toBe('20');
    expect(req.request.params.get('DataInicial')).toBe('2026-08-01');
    expect(req.request.params.get('DataFinal')).toBe('2026-08-31');
    req.flush({
      Result: {
        Resumo: {
          TotalRecebidoPeriodo: 1500,
          PagamentosParciais: 200,
          QuantidadePagamentosParciais: 1,
          ValorPendente: 400,
          QuantidadePendentes: 2,
          PagamentosDoDia: 100
        },
        Itens: {
          Results: [
            {
              Id: 21,
              Numero: 'FAT-21',
              TransportadoraId: 5,
              TransportadoraNome: 'Transp B',
              ValorTotal: 1500,
              ValorRecebido: 1500,
              SaldoRestante: 0,
              DataPagamento: '2026-08-02T00:00:00',
              FormaPagamento: ModalidadeRecebimento.Pix,
              Status: StatusFatura.Pago,
              Comprovante: 'Sem comprovante'
            }
          ],
          RowCount: 1,
          CurrentPage: 1,
          PageSize: 20
        }
      }
    });
    expect(totalRecebido).toBe(1500);
    expect(itemsLen).toBe(1);
  });
});
