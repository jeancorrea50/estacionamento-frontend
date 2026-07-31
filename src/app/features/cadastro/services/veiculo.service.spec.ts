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
            validadeCNH: '2030-05-01T01:55:53.144'
          }
        ]
      }
    });

    expect(mapped).toBeTruthy();
    expect(mapped!.motoristasVinculos).toEqual([
      {
        id: 2,
        nome: 'JOAO DA SILVA',
        cnh: '60724740120',
        validadeCnh: '01/05/2030'
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
