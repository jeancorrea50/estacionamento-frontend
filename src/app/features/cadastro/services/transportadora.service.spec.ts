import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransportadoraService } from './transportadora.service';
import { environment } from '../../../../environments/environment';

describe('TransportadoraService — listagem grid', () => {
  let service: TransportadoraService;
  let httpMock: HttpTestingController;
  const base = `${environment.API_BASE_URL}/Transportadora`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TransportadoraService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TransportadoraService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('deve mapear responsavelEmail, responsavelTelefone, quantidadeVeiculo e dataAtualizacao', () => {
    let mapped: {
      items: Array<{
        email: string;
        telefone?: string;
        quantidadeVeiculos?: number | null;
        dataAtualizacao?: string | null;
      }>;
    } | undefined;

    service.buscar({ NumeroPagina: 1, TamanhoPagina: 10 }).subscribe((res) => {
      mapped = res;
    });

    const req = httpMock.expectOne((r) => r.url.startsWith(base) && r.method === 'GET');
    req.flush({
      success: true,
      message: 'Operação realizada com sucesso',
      result: {
        results: [
          {
            id: 1,
            razaoSocial: 'Transportes Rápidos Paraná LTDA',
            fantasia: 'Transportes Rápidos Paraná LTDA',
            cnpj: '12.345.678/0001-95',
            email: null,
            ativo: true,
            responsavelEmail: 'ugne5565@uorak.com',
            responsavelTelefone: '44991321311',
            quantidadeVeiculo: 5,
            dataAtualizacao: '2026-07-31T15:26:51.9323072'
          },
          {
            id: 8,
            razaoSocial: 'Shell Mineiro Distribuidora Ltda.',
            fantasia: 'Alex Santana Oliveira',
            cnpj: '13.799.101/0017-83',
            email: null,
            ativo: true,
            contato: '65996389780',
            responsavelEmail: null,
            responsavelTelefone: null,
            quantidadeVeiculo: 0,
            dataAtualizacao: null
          }
        ],
        rowCount: 2,
        currentPage: 1,
        pageSize: 10
      }
    });

    expect(mapped?.items[0]).toMatchObject({
      email: 'ugne5565@uorak.com',
      telefone: '44991321311',
      quantidadeVeiculos: 5,
      dataAtualizacao: '2026-07-31T15:26:51.9323072'
    });
    expect(mapped?.items[1]).toMatchObject({
      email: '',
      telefone: '65996389780',
      quantidadeVeiculos: 0,
      dataAtualizacao: null
    });
  });
});
