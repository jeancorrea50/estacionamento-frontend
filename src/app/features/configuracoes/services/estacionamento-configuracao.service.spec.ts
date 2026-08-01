import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { EstacionamentoConfiguracaoService } from './estacionamento-configuracao.service';

const API = `${environment.API_BASE_URL}/EstacionamentoConfiguracao`;

describe('EstacionamentoConfiguracaoService', () => {
  let service: EstacionamentoConfiguracaoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(EstacionamentoConfiguracaoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista padroes a partir de envelope data (contrato com sucess)', () => {
    let itens: { timeZoneId: string; nome: string }[] = [];
    service.listarPadroes().subscribe((r) => (itens = r));

    const req = http.expectOne(`${API}/padroes`);
    expect(req.request.method).toBe('GET');
    req.flush({
      sucess: true,
      data: [
        {
          timeZoneId: 'America/Cuiaba',
          nome: 'Mato Grosso / Cuiabá (UTC-04)',
          utcOffset: '-04:00'
        },
        {
          timeZoneId: 'America/Sao_Paulo',
          nome: 'Horário de Brasília (UTC-03)',
          utcOffset: '-03:00'
        }
      ]
    });

    expect(itens).toHaveLength(2);
    expect(itens[0].timeZoneId).toBe('America/Cuiaba');
    expect(itens[1].nome).toContain('Brasília');
  });

  it('obtem config atual e pré-seleciona timeZoneId', () => {
    let atual: { id: number; timeZoneId: string } | null = null;
    service.obterAtual().subscribe((r) => (atual = r));

    const req = http.expectOne(API);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        id: 1,
        estacionamentoId: 5,
        timeZoneId: 'America/Cuiaba',
        nome: 'Mato Grosso / Cuiabá (UTC-04)',
        utcOffset: '-04:00',
        cultura: 'pt-BR',
        ativo: true
      }
    });

    expect(atual).toEqual(
      expect.objectContaining({
        id: 1,
        timeZoneId: 'America/Cuiaba'
      })
    );
  });

  it('trata 404 da config atual como ausência (null)', () => {
    let atual: unknown = 'sentinel';
    service.obterAtual().subscribe((r) => (atual = r));

    const req = http.expectOne(API);
    req.flush('{}', { status: 404, statusText: 'Not Found' });

    expect(atual).toBeNull();
  });

  it('grava apenas timeZoneId no POST', () => {
    service.gravar({ timeZoneId: 'America/Cuiaba' }).subscribe();
    const req = http.expectOne(API);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ timeZoneId: 'America/Cuiaba' });
    req.flush({ success: true, data: { id: 1, timeZoneId: 'America/Cuiaba' } });
  });

  it('altera com id + timeZoneId no PUT', () => {
    service.alterar({ id: 1, timeZoneId: 'America/Sao_Paulo' }).subscribe();
    const req = http.expectOne(API);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ id: 1, timeZoneId: 'America/Sao_Paulo' });
    req.flush({ success: true, data: { id: 1, timeZoneId: 'America/Sao_Paulo' } });
  });
});
