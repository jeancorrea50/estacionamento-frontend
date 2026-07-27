import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { EntradaSaidaService } from './entrada-saida.service';

describe('EntradaSaidaService', () => {
  let service: EntradaSaidaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(EntradaSaidaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve enviar filtros e paginação na busca', () => {
    service.buscar({
      placa: 'ABC1D23',
      motoristaId: 1,
      transportadoraId: 2,
      somenteEmAberto: true,
      numeroPagina: 2,
      tamanhoPagina: 20
    }).subscribe();

    const req = httpMock.expectOne((r) => r.url === `${environment.API_BASE_URL}/EntradaSaida`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('placa')).toBe('ABC1D23');
    expect(req.request.params.get('motoristaId')).toBe('1');
    expect(req.request.params.get('transportadoraId')).toBe('2');
    expect(req.request.params.get('somenteEmAberto')).toBe('true');
    expect(req.request.params.get('NumeroPagina')).toBe('2');
    expect(req.request.params.get('TamanhoPagina')).toBe('20');
    req.flush({ results: [] });
  });

  it('deve mapear envelope em getById', () => {
    let resultId = 0;
    service.getById(99).subscribe((res) => {
      resultId = res?.id ?? 0;
    });

    const req = httpMock.expectOne(`${environment.API_BASE_URL}/EntradaSaida/99`);
    // Backend EntradaSaidaOutput não serializa Id — service deve preservar o id da rota.
    req.flush({ result: { descricao: 'teste', permanenciaSuspensa: false, finalizado: false } });
    expect(resultId).toBe(99);
  });

  it('deve mapear Id PascalCase da busca para suspender-permanencia', () => {
    let mappedId = 0;
    service
      .buscar({
        somenteEmAberto: true,
        numeroPagina: 1,
        tamanhoPagina: 20
      })
      .subscribe((paged) => {
        mappedId = paged.items[0]?.id ?? 0;
      });

    const req = httpMock.expectOne((r) => r.url === `${environment.API_BASE_URL}/EntradaSaida`);
    req.flush({
      Results: [
        {
          Id: 42,
          PlacaVeiculo: 'RAL1C89',
          NomeMotorista: 'ALEXSANDER',
          NomeTransportadora: 'GT',
          DataHoraEntrada: '2026-07-21T17:25:00',
          DataHoraSaida: null,
          Status: 0
        }
      ],
      RowCount: 1,
      CurrentPage: 1,
      PageSize: 20
    });
    expect(mappedId).toBe(42);
  });

  it('deve enviar query dataHoraSaida em finalizarPermanencia', () => {
    service.finalizarPermanencia(10, '2026-01-01T10:00:00.000Z').subscribe();
    const req = httpMock.expectOne((r) =>
      r.url === `${environment.API_BASE_URL}/EntradaSaida/10/finalizar-permanencia`
      && r.params.get('dataHoraSaida') === '2026-01-01T10:00:00.000Z'
    );
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });
});
