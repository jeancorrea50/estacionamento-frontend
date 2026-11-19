import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ModalidadeRecebimento, SituacaoFechamento, StatusFatura } from '../models/fatura.models';
import { ModalidadeCobranca } from '../models/configuracao-cobranca.models';
import { FaturaService } from './fatura.service';

describe('FaturaService', () => {
  let service: FaturaService;
  let httpMock: HttpTestingController;
  const base = `${environment.API_BASE_URL}/financeiro/Fatura`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(FaturaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve listar com paginação e mapear Results PascalCase', () => {
    let total = 0;
    service.listar({ numeroPagina: 1, tamanhoPagina: 20 }).subscribe((page) => {
      total = page.totalCount;
      expect(page.items[0].id).toBe(7);
      expect(page.items[0].numero).toBe('FT-001');
      expect(page.items[0].transportadora).toBe('Transp X');
      expect(page.items[0].status).toBe('Em aberto');
      expect(page.items[0].modalidadeRecebimento).toBe('Pix');
    });

    const req = httpMock.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('NumeroPagina')).toBe('1');
    expect(req.request.params.get('TamanhoPagina')).toBe('20');
    req.flush({
      Result: {
        Results: [
          {
            Id: 7,
            Numero: 'FT-001',
            TransportadoraId: 1,
            TransportadoraNome: 'Transp X',
            EstacionamentoId: 2,
            EstacionamentoNome: 'Estac Y',
            Status: StatusFatura.EmAberto,
            ModalidadeRecebimento: ModalidadeRecebimento.Pix,
            ValorTotal: 100,
            ValorRecebido: 0,
            ValorEmAberto: 100,
            DataEmissao: '2026-07-01T00:00:00',
            DataVencimento: '2026-07-10T00:00:00',
            DataPagamento: null
          }
        ],
        RowCount: 1,
        CurrentPage: 1,
        PageSize: 20
      }
    });
    expect(total).toBe(1);
  });

  it('deve gravar apenas transportadoraId e estacionamentoId no POST', () => {
    service.gravar({ transportadoraId: 3, estacionamentoId: 5 }).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ transportadoraId: 3, estacionamentoId: 5 });
    req.flush({ Result: { Id: 9, Numero: 'FT-009', TransportadoraId: 3, Status: 1 } });
  });

  it('deve baixar PDF como blob', () => {
    let size = 0;
    service.baixarPdf(12).subscribe((blob) => {
      size = blob.size;
    });
    const req = httpMock.expectOne(`${base}/12/report`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(size).toBeGreaterThan(0);
  });

  it('deve baixar Excel como blob', () => {
    let size = 0;
    service.baixarExcel(12).subscribe((blob) => {
      size = blob.size;
    });
    const req = httpMock.expectOne(`${base}/12/excel`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(
      new Blob(['PK'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
    );
    expect(size).toBeGreaterThan(0);
  });

  it('deve listar inadimplentes com resumo do dashboard', () => {
    let totalVencido = 0;
    let itemsLen = 0;
    service.listarInadimplentes({ numeroPagina: 1, tamanhoPagina: 20 }).subscribe((page) => {
      totalVencido = page.resumo.totalVencido;
      itemsLen = page.items.length;
      expect(page.resumo.faturasVencidas).toBe(2);
      expect(page.resumo.transportadorasInadimplentes).toBe(1);
      expect(page.items[0].faturaId).toBe(11);
      expect(page.items[0].id).toBe('FAT-11');
      expect(page.items[0].diasAtraso).toBe(12);
      expect(page.items[0].statusCobranca).toBe('Não enviada');
    });

    const req = httpMock.expectOne((r) => r.url === `${base}/inadimplentes`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('NumeroPagina')).toBe('1');
    expect(req.request.params.get('TamanhoPagina')).toBe('20');
    req.flush({
      Result: {
        Resumo: {
          TotalVencido: 350.5,
          FaturasVencidas: 2,
          TransportadorasInadimplentes: 1,
          AcordosRealizados: 0
        },
        Itens: {
          Results: [
            {
              Id: 11,
              Numero: 'FAT-11',
              TransportadoraId: 3,
              TransportadoraNome: 'Transp A',
              Status: StatusFatura.Vencido,
              ValorTotal: 200,
              ValorRecebido: 0,
              ValorEmAberto: 200,
              DataVencimento: '2026-07-20T00:00:00',
              DiasEmAtraso: 12,
              QuantidadeMovimentos: 4,
              UltimaCobranca: null,
              StatusCobranca: null
            }
          ],
          RowCount: 2,
          CurrentPage: 1,
          PageSize: 20
        }
      }
    });
    expect(totalVencido).toBe(350.5);
    expect(itemsLen).toBe(1);
  });

  it('deve listar fechamentos com resumo do dashboard', () => {
    let disponiveis = 0;
    let itemsLen = 0;
    service
      .listarFechamentos({
        numeroPagina: 1,
        tamanhoPagina: 20,
        dataInicial: '2026-08-01',
        dataFinal: '2026-08-31'
      })
      .subscribe((page) => {
        disponiveis = page.resumo.fechamentosDisponiveis;
        itemsLen = page.items.length;
        expect(page.resumo.prontosParaFaturar).toBe(1);
        expect(page.resumo.valorEstimadoTotal).toBe(900);
        expect(page.items[0].transportadoraId).toBe(4);
        expect(page.items[0].id).toBe('4');
        expect(page.items[0].situacao).toBe('Em andamento');
        expect(page.items[0].modalidade).toBe('Quinzenal');
      });

    const req = httpMock.expectOne((r) => r.url === `${base}/fechamentos`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('NumeroPagina')).toBe('1');
    expect(req.request.params.get('TamanhoPagina')).toBe('20');
    expect(req.request.params.get('DataInicial')).toBe('2026-08-01');
    expect(req.request.params.get('DataFinal')).toBe('2026-08-31');
    req.flush({
      Result: {
        Resumo: {
          FechamentosDisponiveis: 3,
          ProntosParaFaturar: 1,
          ValorEstimadoTotal: 900,
          ComDivergencia: 0
        },
        Itens: {
          Results: [
            {
              TransportadoraId: 4,
              TransportadoraNome: 'Transp C',
              ConfiguracaoCobrancaId: null,
              Modalidade: ModalidadeCobranca.Quinzenal,
              PeriodoInicio: '2026-08-01T00:00:00',
              PeriodoFim: '2026-08-15T00:00:00',
              QuantidadeMovimentos: 5,
              ValorEstimado: 900,
              QuantidadeDivergencias: 0,
              Situacao: SituacaoFechamento.EmAndamento
            }
          ],
          RowCount: 3,
          CurrentPage: 1,
          PageSize: 20
        }
      }
    });
    expect(disponiveis).toBe(3);
    expect(itemsLen).toBe(1);
  });

  it('deve obter visão geral do dashboard', () => {
    let emitidas = 0;
    service.obterVisaoGeral({ dataInicial: '2026-05-01', dataFinal: '2026-05-31' }).subscribe((dto) => {
      emitidas = dto.faturasEmitidas;
      expect(dto.totalAReceber).toBe(186420.5);
      expect(dto.faturasVencidas).toBe(7);
      expect(dto.transportadorasFaturadas).toBe(14);
      expect(dto.faturasPorStatus[0].quantidade).toBe(28);
    });

    const req = httpMock.expectOne((r) => r.url === `${base}/visao-geral`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('DataInicial')).toBe('2026-05-01');
    expect(req.request.params.get('DataFinal')).toBe('2026-05-31');
    req.flush({
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
        RecebimentosPorModalidade: [],
        EvolucaoFaturamento: []
      }
    });
    expect(emitidas).toBe(56);
  });

  it('deve excluir por id', () => {
    service.excluir(4).subscribe();
    const req = httpMock.expectOne(`${base}/4`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
