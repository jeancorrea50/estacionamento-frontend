import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  ModalidadeCobranca,
  RegraFechamento,
  StatusConfiguracaoCobranca
} from '../models/configuracao-cobranca.models';
import { ConfiguracaoCobrancaService } from './configuracao-cobranca.service';

describe('ConfiguracaoCobrancaService', () => {
  let service: ConfiguracaoCobrancaService;
  let httpMock: HttpTestingController;
  const base = `${environment.API_BASE_URL}/financeiro/ConfiguracaoCobranca`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(ConfiguracaoCobrancaService);
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
      expect(page.items[0].transportadora).toBe('Transp X');
      expect(page.items[0].modalidade).toBe('Mensal');
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
            TransportadoraId: 1,
            TransportadoraNome: 'Transp X',
            EstacionamentoId: 2,
            EstacionamentoNome: 'Estac Y',
            Status: StatusConfiguracaoCobranca.Ativa,
            ModalidadeCobranca: ModalidadeCobranca.Mensal,
            ValorEstadia: 10,
            EmailFinanceiro: 'a@b.com',
            DataCriacao: '2026-07-01T00:00:00'
          }
        ],
        RowCount: 1,
        CurrentPage: 1,
        PageSize: 20
      }
    });
    expect(total).toBe(1);
  });

  it('deve obter por id e mapear regra', () => {
    let modalidade = '';
    service.obterListaItemPorId(3).subscribe((item) => {
      modalidade = item?.modalidade ?? '';
      expect(item?.regra.cobrarMensal).toBe(true);      expect(item?.prazoVencimentoDias).toBe(10);
    });

    const req = httpMock.expectOne(`${base}/3`);
    req.flush({
      result: {
        id: 3,
        transportadoraId: 1,
        transportadoraNome: 'T',
        estacionamentoId: 2,
        estacionamentoNome: 'E',
        status: StatusConfiguracaoCobranca.Ativa,
        modalidadeCobranca: ModalidadeCobranca.Mensal,
        diaFechamento: null,
        regraFechamento: RegraFechamento.UltimoDiaDoMes,
        prazoVencimentoDias: 10,
        emailFinanceiro: 'fin@t.com',
        envioAutomaticoEmail: true,
        gerarFaturaAutomaticamente: false,
        permitirPagamentoParcial: false,
        aplicarMulta: false,
        multaPercentual: 0,
        aplicarJuros: false,
        jurosPercentual: 0,
        aplicarDescontoFixo: false,
        valorDescontoFixo: 0,
        aplicarAcrescimoFixo: false,
        valorAcrescimoFixo: 0,
        valorEstadia: null,
        agruparPorPlaca: false,
        agruparPorPeriodo: true,
        agruparPorTransportadora: true,
        regra: {
          id: 9,
          cobrarDiaria: false,
          cobrarSemanal: false,
          cobrarQuinzenal: false,
          cobrarMensal: true,
          cobrarDataPersonalizada: false,
          cobrarLavagem: false,
          cobrarPernoite: false,
          cobrarServicosExtras: false,
          considerarBeneficioAbastecimento: false
        }
      }
    });
    expect(modalidade).toBe('Mensal');
  });

  it('deve enviar POST no gravar', () => {
    service
      .gravar({
        transportadoraId: 1,
        estacionamentoId: 2,
        status: StatusConfiguracaoCobranca.Ativa,
        modalidadeCobranca: ModalidadeCobranca.Mensal,
        diaFechamento: null,
        regraFechamento: RegraFechamento.UltimoDiaDoMes,
        prazoVencimentoDias: 10,
        emailFinanceiro: 'a@b.com',
        envioAutomaticoEmail: true,
        gerarFaturaAutomaticamente: false,
        permitirPagamentoParcial: false,
        aplicarMulta: false,
        multaPercentual: 0,
        aplicarJuros: false,
        jurosPercentual: 0,
        aplicarDescontoFixo: false,
        valorDescontoFixo: 0,
        aplicarAcrescimoFixo: false,
        valorAcrescimoFixo: 0,
        valorEstadia: null,
        agruparPorPlaca: false,
        agruparPorPeriodo: true,
        agruparPorTransportadora: true,
        regra: {
          id: 0,
          cobrarDiaria: false,
          cobrarSemanal: false,
          cobrarQuinzenal: false,
          cobrarMensal: true,
          cobrarDataPersonalizada: false,
          cobrarLavagem: false,
          cobrarPernoite: false,
          cobrarServicosExtras: false,
          considerarBeneficioAbastecimento: false
        }
      })
      .subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.transportadoraId).toBe(1);
    req.flush({
      result: {
        id: 11,
        transportadoraId: 1,
        transportadoraNome: 'T',
        estacionamentoId: 2,
        estacionamentoNome: 'E',
        status: 1,
        modalidadeCobranca: 4,
        diaFechamento: null,
        regraFechamento: 1,
        prazoVencimentoDias: 10,
        emailFinanceiro: 'a@b.com',
        envioAutomaticoEmail: true,
        gerarFaturaAutomaticamente: false,
        permitirPagamentoParcial: false,
        aplicarMulta: false,
        multaPercentual: 0,
        aplicarJuros: false,
        jurosPercentual: 0,
        aplicarDescontoFixo: false,
        valorDescontoFixo: 0,
        aplicarAcrescimoFixo: false,
        valorAcrescimoFixo: 0,
        valorEstadia: null,
        agruparPorPlaca: false,
        agruparPorPeriodo: true,
        agruparPorTransportadora: true,
        regra: { id: 1, cobrarMensal: true }
      }
    });
  });

  it('deve enviar DELETE no excluir', () => {
    service.excluir(5).subscribe();
    const req = httpMock.expectOne(`${base}/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ result: true });
  });

  it('deve aceitar PUT com sucesso sem entidade no corpo', () => {
    let resolved: unknown = 'pending';
    service
      .alterar({
        id: 5,
        transportadoraId: 1,
        estacionamentoId: 2,
        status: StatusConfiguracaoCobranca.Ativa,
        modalidadeCobranca: ModalidadeCobranca.Mensal,
        diaFechamento: null,
        regraFechamento: RegraFechamento.UltimoDiaDoMes,
        prazoVencimentoDias: 10,
        emailFinanceiro: 'a@b.com',
        envioAutomaticoEmail: true,
        gerarFaturaAutomaticamente: false,
        permitirPagamentoParcial: false,
        aplicarMulta: false,
        multaPercentual: 0,
        aplicarJuros: false,
        jurosPercentual: 0,
        aplicarDescontoFixo: false,
        valorDescontoFixo: 0,
        aplicarAcrescimoFixo: false,
        valorAcrescimoFixo: 0,
        valorEstadia: null,
        agruparPorPlaca: false,
        agruparPorPeriodo: true,
        agruparPorTransportadora: true,
        regra: {
          id: 1,
          cobrarDiaria: false,
          cobrarSemanal: false,
          cobrarQuinzenal: false,
          cobrarMensal: true,
          cobrarDataPersonalizada: false,
          cobrarLavagem: false,
          cobrarPernoite: false,
          cobrarServicosExtras: false,
          considerarBeneficioAbastecimento: false
        }
      })
      .subscribe((res) => {
        resolved = res;
      });

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    req.flush({ result: true });
    expect(resolved).toBeNull();
  });
});
