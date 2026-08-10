import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { mapBuscarPorPlacaParaRegistroRapido } from '../mappers/entrada-saida-buscar-por-placa.mapper';
import { ModoRecibo } from '../models/entrada-saida.models';
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

  it('getById deve resolver transportadoraId aninhado quando raiz vier zerada', () => {
    let transportadoraId = 0;
    service.getById(4038).subscribe((res) => {
      transportadoraId = res?.transportadoraId ?? 0;
    });

    const req = httpMock.expectOne(`${environment.API_BASE_URL}/EntradaSaida/4038`);
    req.flush({
      result: {
        transportadoraId: 0,
        transportadora: { id: 12, razaoSocial: 'Transp' },
        finalizado: false
      }
    });
    expect(transportadoraId).toBe(12);
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
          Status: 0,
          Avulso: true,
          Faturado: false,
          DataFaturado: null,
          TransportadoraId: 7
        }
      ],
      RowCount: 1,
      CurrentPage: 1,
      PageSize: 20
    });
    expect(mappedId).toBe(42);
  });

  it('deve mapear avulso/faturado na busca', () => {
    let item: import('../models/entrada-saida.models').EntradaSaidaSearchOutput | undefined;
    service
      .buscar({ somenteEmAberto: true, numeroPagina: 1, tamanhoPagina: 20 })
      .subscribe((paged) => {
        item = paged.items[0];
      });

    const req = httpMock.expectOne((r) => r.url === `${environment.API_BASE_URL}/EntradaSaida`);
    req.flush({
      results: [
        {
          id: 3,
          placaVeiculo: 'ABC1D23',
          transportadoraId: 9,
          avulso: true,
          faturado: false,
          dataFaturado: null
        }
      ]
    });
    expect(item?.avulso).toBe(true);
    expect(item?.faturado).toBe(false);
    expect(item?.transportadoraId).toBe(9);
  });

  it('deve obter valor-estacionamento por entradaSaidaId', () => {
    let valor: number | null = -1;
    service.obterValorEstacionamento(4038).subscribe((res) => {
      valor = res.valor;
      expect(res.entradaSaidaId).toBe(4038);
      expect(res.origem).toBe('EstacionamentoConfiguracao');
      expect(res.valorUnitario).toBe(11);
      expect(res.quantidadeUnidades).toBe(2);
      expect(res.tipoTarifa).toBe(2);
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.API_BASE_URL}/EntradaSaida/valor-estacionamento` &&
        r.params.get('entradaSaidaId') === '4038'
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      result: {
        EntradaSaidaId: 4038,
        EstacionamentoId: 2,
        TransportadoraId: 12,
        ConfiguracaoCobrancaId: null,
        Valor: 22,
        Origem: 'EstacionamentoConfiguracao',
        ValorUnitario: 11,
        QuantidadeUnidades: 2,
        TipoTarifa: 2,
        TipoCobranca: 'Avulso'
      }
    });
    expect(valor).toBe(22);
  });

  it('deve baixar recibo PDF com modo e valor na saída', () => {
    let size = 0;
    service.baixarRecibo(12, ModoRecibo.Saida, 25.5).subscribe((blob) => {
      size = blob.size;
    });
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.API_BASE_URL}/EntradaSaida/12/recibo` &&
        r.params.get('modo') === '1' &&
        r.params.get('valor') === '25.5'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect(size).toBeGreaterThan(0);
  });

  it('deve baixar recibo de entrada com modo e sem valor', () => {
    service.baixarRecibo(12, ModoRecibo.Entrada).subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.API_BASE_URL}/EntradaSaida/12/recibo` &&
        r.params.get('modo') === '2' &&
        r.params.get('valor') == null
    );
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
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

  it('obterPorPlaca deve preservar motorista/veiculo/transportadora do contrato Registro Rápido', () => {
    let mapped: import('../models/entrada-saida.models').EntradaSaidaOutput | null | undefined;

    service.obterPorPlaca('ABC1D23').subscribe((res) => {
      mapped = res;
    });

    const req = httpMock.expectOne(
      `${environment.API_BASE_URL}/EntradaSaida/buscar-por-placa/ABC1D23`
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      result: {
        motoristaId: 2,
        transportadoraId: 1,
        veiculoId: 1,
        existeEntradaEmAberto: false,
        motorista: { id: 2, nome: 'EA Eduardo', cpf: '59319251270' },
        veiculo: { id: 1, placa: 'ABC1D23', tipoCarga: 1 },
        transportadora: {
          id: 1,
          cnpj: '12345678000195',
          razaoSocial: 'Transportes Rápidos',
          responsavelLegal: 'Juninho',
          responsavelTelefone: '44999999999'
        }
      }
    });

    expect(mapped?.motoristaId).toBe(2);
    expect(mapped?.veiculoId).toBe(1);
    expect(mapped?.transportadoraId).toBe(1);
    expect(mapped?.existeEntradaEmAberto).toBe(false);
    expect(mapped?.motorista?.nome).toBe('EA Eduardo');
    expect(mapped?.veiculo?.placa).toBe('ABC1D23');
    expect(mapped?.transportadora?.razaoSocial).toBe('Transportes Rápidos');
  });

  it('obterPorPlaca deve sintetizar veiculo/transportadora a partir do contrato flat na raiz', () => {
    let mapped: import('../models/entrada-saida.models').EntradaSaidaOutput | null | undefined;

    service.obterPorPlaca('KAI6428').subscribe((res) => {
      mapped = res;
    });

    const req = httpMock.expectOne(
      `${environment.API_BASE_URL}/EntradaSaida/buscar-por-placa/KAI6428`
    );
    req.flush({
      success: true,
      message: 'Operação realizada com sucesso',
      result: {
        id: null,
        existeEntradaEmAberto: false,
        dataHoraEntrada: null,
        observacao: null,
        status: null,
        veiculoId: 1,
        placa: 'KAI-6428',
        tipoCarga: null,
        transportadoraId: 1,
        razaoSocial: 'Transportes Rápidos Paraná LTDA',
        cnpj: '12.345.678/0001-95',
        responsavelLegal: 'Juninho Pereba',
        responsavelCpf: '312.402.060-03',
        responsavelEmail: 'ugne5565@uorak.com',
        responsavelTelefone: '',
        motorista: {
          id: 1,
          nome: 'Valdimir Santicago',
          cpf: '65272970520'
        }
      }
    });

    expect(mapped?.veiculoId).toBe(1);
    expect(mapped?.transportadoraId).toBe(1);
    expect(mapped?.veiculo?.placa).toBe('KAI-6428');
    expect(mapped?.transportadora?.cnpj).toBe('12.345.678/0001-95');
    expect(mapped?.transportadora?.razaoSocial).toBe('Transportes Rápidos Paraná LTDA');
    expect(mapped?.transportadora?.responsavelLegal).toBe('Juninho Pereba');
    expect(mapped?.transportadora?.responsavelCpf).toBe('312.402.060-03');
    expect(mapped?.transportadora?.responsavelEmail).toBe('ugne5565@uorak.com');
    expect(mapped?.motorista?.nome).toBe('Valdimir Santicago');
    expect(mapped?.motorista?.cpf).toBe('65272970520');

    const campos = mapBuscarPorPlacaParaRegistroRapido(mapped!);
    expect(campos.placa).toBe('KAI-6428');
    expect(campos.motoristaNome).toBe('Valdimir Santicago');
    expect(campos.motoristaCpf).toBe('65272970520');
    expect(campos.transportadoraCnpj).toBe('12.345.678/0001-95');
    expect(campos.transportadoraRazaoSocial).toBe('Transportes Rápidos Paraná LTDA');
    expect(campos.transportadoraResponsavelNome).toBe('Juninho Pereba');
  });
});
