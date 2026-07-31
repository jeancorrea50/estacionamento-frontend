import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VeiculoDTO } from '../models/veiculo.dto';
import { VeiculoService } from './veiculo.service';
import { environment } from '../../../../environments/environment';

describe('VeiculoService — motoristas vinculados no GET', () => {
  let service: VeiculoService;
  let httpMock: HttpTestingController;
  const base = `${environment.API_BASE_URL}/Veiculo`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VeiculoService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(VeiculoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('deve mapear motoristas[] de objetos (descricao, cnh, validadeCNH)', () => {
    let mapped: VeiculoDTO | null | undefined;

    service.obterPorId(1).subscribe((res) => {
      mapped = res;
    });

    const req = httpMock.expectOne(`${base}/1`);
    expect(req.request.method).toBe('GET');
    req.flush({
      result: {
        id: 1,
        placa: 'ABC1D23',
        ativo: true,
        motoristas: [
          {
            id: 2,
            descricao: 'JOAO DA SILVA',
            cnh: '60724740120',
            validadeCNH: '2030-05-01T01:55:53.144',
            principal: true
          }
        ]
      }
    });

    expect(mapped).toBeTruthy();
    expect(mapped!.motoristaId).toBe(2);
    expect(mapped!.motoristasVinculos).toEqual([
      {
        id: 2,
        nome: 'JOAO DA SILVA',
        cnh: '60724740120',
        validadeCnh: '01/05/2030',
        principal: true
      }
    ]);
  });

  it('não deve exigir motoristaIds quando motoristas[] vem como objetos', () => {
    let mapped: VeiculoDTO | null | undefined;

    service.obterPorId(1).subscribe((res) => {
      mapped = res;
    });

    httpMock.expectOne(`${base}/1`).flush({
      id: 1,
      placa: 'XYZ9Z99',
      ativo: true,
      motoristas: [{ id: 9, Descricao: 'Maria', Cnh: '123', ValidadeCNH: '2028-12-31' }]
    });

    expect(mapped?.motoristasVinculos?.length).toBe(1);
    expect(mapped?.motoristasVinculos?.[0]).toMatchObject({
      id: 9,
      nome: 'Maria',
      cnh: '123',
      validadeCnh: '31/12/2028'
    });
  });
});

describe('VeiculoService — POST/PUT motoristas (MotoristaVinculoInput)', () => {
  let service: VeiculoService;
  let httpMock: HttpTestingController;
  const base = `${environment.API_BASE_URL}/Veiculo`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VeiculoService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(VeiculoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('gravar deve enviar motoristas[{ id, principal }] e não motoristaId/motoristaIds', () => {
    service
      .gravar({
        placa: 'KAI6428',
        ativo: true,
        transportadoraId: 1,
        motoristas: [
          { id: 10, principal: true },
          { id: 11, principal: false }
        ]
      })
      .subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.motoristas).toEqual([
      { id: 10, principal: true },
      { id: 11, principal: false }
    ]);
    expect(req.request.body.motoristaId).toBeUndefined();
    expect(req.request.body.motoristaIds).toBeUndefined();
    req.flush({ id: 99 });
  });

  it('gravar deve montar payload no contrato POST (marca/modelo/ano) sem campos flat legados', () => {
    service
      .gravar({
        placa: 'ABC1D23',
        ativo: true,
        transportadoraId: 3,
        cor: 'Branco',
        tipoCarga: 1,
        anoFabricacao: 2022,
        anoModelo: 2023,
        marcaDescricao: 'Volvo',
        modeloDescricao: 'FH 540',
        motoristas: [{ id: 10, principal: true }]
      })
      .subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      placa: 'ABC1D23',
      ativo: true,
      transportadoraId: 3,
      cor: 'Branco',
      tipoCarga: 1,
      ano: 2022,
      marca: { descricao: 'Volvo' },
      modelo: {
        descricao: 'FH 540',
        marca: { descricao: 'Volvo' }
      },
      motoristas: [{ id: 10, principal: true }]
    });
    expect(req.request.body.marcaModelo).toBeUndefined();
    expect(req.request.body.veiculoModeloId).toBeUndefined();
    expect(req.request.body.anoFabricacao).toBeUndefined();
    expect(req.request.body.anoModelo).toBeUndefined();
    expect(req.request.body.centroCusto).toBeUndefined();
    expect(req.request.body.dataCriacao).toBeUndefined();
    expect(req.request.body.veiculoDetalhe).toBeUndefined();
    req.flush({ id: 99 });
  });

  it('alterar deve enviar o mesmo contrato do POST + id (sem campos legados)', () => {
    service
      .alterar({
        id: 5,
        placa: 'ABC1D23',
        ativo: true,
        transportadoraId: 3,
        cor: 'Branco',
        tipoCarga: 1,
        anoFabricacao: 2022,
        anoModelo: 2023,
        marcaDescricao: 'Volvo',
        modeloDescricao: 'FH 540',
        motoristas: [{ id: 10, principal: true }]
      })
      .subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      id: 5,
      placa: 'ABC1D23',
      ativo: true,
      transportadoraId: 3,
      cor: 'Branco',
      tipoCarga: 1,
      ano: 2022,
      marca: { descricao: 'Volvo' },
      modelo: {
        descricao: 'FH 540',
        marca: { descricao: 'Volvo' }
      },
      motoristas: [{ id: 10, principal: true }]
    });
    expect(req.request.body.marcaModelo).toBeUndefined();
    expect(req.request.body.anoFabricacao).toBeUndefined();
    expect(req.request.body.veiculoDetalhe).toBeUndefined();
    req.flush({});
  });

  it('alterar deve montar motoristas a partir de motoristaIds + motoristaId (principal)', () => {
    service
      .alterar({
        id: 5,
        placa: 'ABC1D23',
        ativo: true,
        motoristaId: 2,
        motoristaIds: [2, 7]
      })
      .subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.motoristas).toEqual([
      { id: 2, principal: true },
      { id: 7, principal: false }
    ]);
    expect(req.request.body.id).toBe(5);
    expect(req.request.body.motoristaId).toBeUndefined();
    expect(req.request.body.motoristaIds).toBeUndefined();
    req.flush({});
  });

  it('alterar sem id deve falhar sem chamar a API', () => {
    let erro: Error | undefined;
    service
      .alterar({
        placa: 'ABC1D23',
        ativo: true
      })
      .subscribe({
        error: (e) => {
          erro = e;
        }
      });

    httpMock.expectNone(base);
    expect(erro?.message).toContain('Id obrigatório');
  });

  it('gravar não deve enviar id mesmo se dto.id vier preenchido', () => {
    service
      .gravar({
        id: 99,
        placa: 'XYZ9Z99',
        ativo: true,
        transportadoraId: 1
      })
      .subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.id).toBeUndefined();
    expect(req.request.body.placa).toBe('XYZ9Z99');
    req.flush({ id: 100 });
  });

  it('gravar sem vínculos deve enviar motoristas: []', () => {
    service
      .gravar({
        placa: 'DEF2A34',
        ativo: true,
        motoristas: []
      })
      .subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.body.motoristas).toEqual([]);
    req.flush({ id: 1 });
  });

  it('gravar deve enviar tipoCarga (enum byte) junto com motoristas', () => {
    service
      .gravar({
        placa: 'KAI6428',
        ativo: true,
        transportadoraId: 1,
        tipoCarga: 2,
        motoristas: [{ id: 10, principal: true }]
      })
      .subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.tipoCarga).toBe(2);
    expect(req.request.body.motoristas).toEqual([{ id: 10, principal: true }]);
    req.flush({ id: 99 });
  });
});

describe('VeiculoService — listagem com motoristas', () => {
  let service: VeiculoService;
  let httpMock: HttpTestingController;
  const base = `${environment.API_BASE_URL}/Veiculo`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VeiculoService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(VeiculoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('buscar deve mapear motoristas (objetos) com nome, cpf e principal', () => {
    let mapped: { items: { motoristas?: unknown }[] } | undefined;

    service.buscar({ NumeroPagina: 1, TamanhoPagina: 20, TransportadoraId: 1 }).subscribe((res) => {
      mapped = res;
    });

    const req = httpMock.expectOne((r) => r.url.startsWith(base) && r.method === 'GET');
    req.flush({
      success: true,
      result: {
        results: [
          {
            id: 3037,
            placa: 'KG65881',
            ativo: true,
            tipoCarga: 1,
            motoristas: [
              {
                id: 1020,
                descricao: 'ALEXSANDER DE OLIVEIRA PENNA',
                cpf: '12345678901',
                principal: true
              },
              {
                id: 3,
                nome: 'Camila Duarte Araújo',
                cpf: '98765432100',
                principal: false
              }
            ]
          }
        ],
        rowCount: 1,
        currentPage: 1,
        pageSize: 20
      }
    });

    expect(mapped?.items[0].motoristas).toEqual([
      {
        id: 1020,
        nome: 'ALEXSANDER DE OLIVEIRA PENNA',
        cpf: '12345678901',
        principal: true
      },
      {
        id: 3,
        nome: 'Camila Duarte Araújo',
        cpf: '98765432100',
        principal: false
      }
    ]);
  });

  it('buscar deve mapear motoristaIds + motoristas (nomes) legado', () => {
    let mapped: { items: { motoristas?: { id: number; nome: string }[] }[] } | undefined;

    service.buscar({ NumeroPagina: 1, TamanhoPagina: 20 }).subscribe((res) => {
      mapped = res;
    });

    httpMock.expectOne((r) => r.url.startsWith(base)).flush({
      result: {
        results: [
          {
            id: 1,
            placa: 'KLC8443',
            ativo: true,
            motoristaIds: [2040, 5],
            motoristas: ['Genivaldo Ferreira Mendes', 'Juliana Teixeira Ramos']
          }
        ],
        rowCount: 1
      }
    });

    expect(mapped?.items[0].motoristas).toEqual([
      { id: 2040, nome: 'Genivaldo Ferreira Mendes' },
      { id: 5, nome: 'Juliana Teixeira Ramos' }
    ]);
  });
});
