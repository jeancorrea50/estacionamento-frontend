import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  ConfiguracaoCobrancaPostInput,
  ModalidadeCobranca,
  RegraFechamento,
  StatusConfiguracaoCobranca
} from '../models/configuracao-cobranca.models';
import { ConfiguracaoCobrancaService } from './configuracao-cobranca.service';

function postInput(overrides: Partial<ConfiguracaoCobrancaPostInput> = {}): ConfiguracaoCobrancaPostInput {
  return {
    transportadoraId: 1,
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
    valorEstacionamento: null,
    dataCobranca: null,
    cobrarLavagem: false,
    valorLavagem: null,
    cobrarPernoite: false,
    valorPernoite: null,
    cobrarServicosExtras: false,
    valorServicosExtras: null,
    considerarBeneficioAbastecimento: false,
    valorBeneficioAbastecimento: null,
    vagasJaneiro: null,
    vagasFevereiro: null,
    vagasMarco: null,
    vagasAbril: null,
    vagasMaio: null,
    vagasJunho: null,
    vagasJulho: null,
    vagasAgosto: null,
    vagasSetembro: null,
    vagasOutubro: null,
    vagasNovembro: null,
    vagasDezembro: null,
    custoExcedente: null,
    tipoCobrancaExcedente: null,
    dataInicioAcordo: null,
    dataFimAcordo: null,
    agruparPorPlaca: false,
    agruparPorPeriodo: false,
    agruparPorTransportadora: false,
    ...overrides
  };
}

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
            ValorEstacionamento: 10,
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

  it('deve obter por id e mapear serviços adicionais e data personalizada', () => {
    service.obterListaItemPorId(3).subscribe((item) => {
      expect(item?.modalidade).toBe('Personalizada');
      expect(item?.dataCobranca).toBe('2026-09-10');
      expect(item?.servicos.lavagem).toEqual({ habilitado: true, valor: 25 });
      expect(item?.prazoVencimentoDias).toBe(10);
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
        modalidadeCobranca: ModalidadeCobranca.Personalizado,
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
        valorEstacionamento: null,
        dataCobranca: '2026-09-10T00:00:00',
        cobrarLavagem: true,
        valorLavagem: 25,
        cobrarPernoite: false,
        valorPernoite: null,
        cobrarServicosExtras: false,
        valorServicosExtras: null,
        considerarBeneficioAbastecimento: false,
        valorBeneficioAbastecimento: null,
        agruparPorPlaca: false,
        agruparPorPeriodo: false,
        agruparPorTransportadora: false
      }
    });
  });

  it('deve enviar POST no gravar', () => {
    service.gravar(postInput()).subscribe();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.transportadoraId).toBe(1);
    expect(req.request.body.regra).toBeUndefined();
    req.flush({ result: true });
  });

  it('deve enviar DELETE no excluir', () => {
    service.excluir(5).subscribe();
    const req = httpMock.expectOne(`${base}/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ result: true });
  });

  it('deve aceitar PUT com sucesso sem entidade no corpo', () => {
    let resolved: unknown = 'pending';
    service.alterar({ ...postInput(), id: 5 }).subscribe((res) => {
      resolved = res;
    });

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    req.flush({ result: true });
    expect(resolved).toBeNull();
  });
});
