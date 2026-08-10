import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ToastService } from '../../../../core/api/services/toast.service';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { SignalrDashboardService } from '../../../../core/services/signalr-dashboard.service';
import { VeiculoService } from '../../../cadastro/services/veiculo.service';
import { EntradaSaidaService } from '../../entrada-saida/entrada-saida.service';
import { MovimentosPageComponent } from './movimentos-page.component';

describe('MovimentosPageComponent', () => {
  const entradaSaidaServiceMock = {
    buscar: vi.fn().mockReturnValue(
      of({
        items: [],
        totalCount: 0,
        numeroPagina: 1,
        tamanhoPagina: 20
      })
    ),
    getById: vi.fn().mockReturnValue(of(null)),
    create: vi.fn().mockReturnValue(of({})),
    update: vi.fn().mockReturnValue(of({})),
    suspenderPermanencia: vi.fn().mockReturnValue(of(void 0)),
    finalizarPermanencia: vi.fn().mockReturnValue(of(void 0)),
    saida: vi.fn().mockReturnValue(of(void 0)),
    baixarRecibo: vi.fn().mockReturnValue(of(new Blob(['%PDF']))),
    excluir: vi.fn().mockReturnValue(of(void 0)),
    obterPorPlaca: vi.fn().mockReturnValue(of(null)),
    obterValorEstacionamento: vi.fn().mockReturnValue(
      of({
        entradaSaidaId: 1,
        estacionamentoId: 1,
        transportadoraId: null,
        configuracaoCobrancaId: null,
        valor: null,
        origem: 'Indisponivel',
        valorUnitario: null,
        quantidadeUnidades: null,
        tipoTarifa: null,
        tipoCobranca: 'Avulso'
      })
    )
  };
  const toastServiceMock = {
    success: vi.fn(),
    error: vi.fn()
  };
  const permissionCacheMock = {
    has: (key: string) =>
      key === 'entradasaida.visualizar' ||
      key === 'entradasaida.gravar' ||
      key === 'entradasaida.alterar' ||
      key === 'entradasaida.excluir',
    hasAny: () => false
  };

  const routerMock = { navigate: vi.fn().mockResolvedValue(true) };
  const veiculoServiceMock = {
    obterPorPlaca: vi.fn().mockReturnValue(of(null))
  };
  const signalrDashboardServiceMock = {
    dashboardAtualizado: signal(null).asReadonly(),
    movimentacoes: signal([]).asReadonly(),
    alertaOperacional: signal('').asReadonly(),
    connect: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimentosPageComponent],
      providers: [
        { provide: EntradaSaidaService, useValue: entradaSaidaServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
        { provide: PermissionCacheService, useValue: permissionCacheMock },
        { provide: Router, useValue: routerMock },
        { provide: VeiculoService, useValue: veiculoServiceMock },
        { provide: SignalrDashboardService, useValue: signalrDashboardServiceMock },
        { provide: ActivatedRoute, useValue: { parent: {} } }
      ]
    }).compileComponents();
  });

  it('deve orientar uso do registro rápido ao abrirNovo', () => {
    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;
    component.abrirNovo();
    expect(toastServiceMock.success).toHaveBeenCalledWith(
      'Use o bloco "Registro Rápido de Movimentação" nesta tela para novos registros.'
    );
  });

  it('deve permitir finalizar apenas quando registro não finalizado e valor informado', () => {
    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;
    component.registroSelecionado.set({ finalizado: false } as never);
    component.saidaValor.set(25);
    expect(component.podeFinalizar()).toBeTruthy();
    component.saidaValor.set(null);
    expect(component.podeFinalizar()).toBeFalsy();
    component.saidaValor.set(10);
    component.registroSelecionado.set({ finalizado: true } as never);
    expect(component.podeFinalizar()).toBeFalsy();
  });

  it('ao abrir Registrar saída deve consultar valor-estacionamento por entradaSaidaId e calcular total por diárias', () => {
    entradaSaidaServiceMock.getById.mockReturnValue(
      of({
        id: 4038,
        finalizado: false,
        transportadoraId: 0,
        transportadora: { id: 12 },
        dataHoraEntrada: '2026-08-01T10:00:00'
      })
    );
    entradaSaidaServiceMock.obterValorEstacionamento.mockReturnValue(
      of({
        entradaSaidaId: 4038,
        estacionamentoId: 1,
        transportadoraId: 12,
        configuracaoCobrancaId: 5,
        valor: 75,
        origem: 'ConfiguracaoCobranca',
        valorUnitario: 25,
        quantidadeUnidades: 3,
        tipoTarifa: 2,
        tipoCobranca: 'Faturado'
      })
    );

    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;
    component.abrirPermanencia(
      {
        id: 4038,
        descricao: '',
        motoristaId: 0,
        nomeMotorista: '',
        transportadoraId: 12,
        nomeTransportadora: '',
        veiculoId: 0,
        placaVeiculo: 'LWN9515',
        dataHoraEntrada: '2026-08-01T10:00:00',
        dataHoraSaida: null,
        avulso: true
      },
      'finalizar'
    );

    expect(entradaSaidaServiceMock.obterValorEstacionamento).toHaveBeenCalledWith(4038);
    expect(component.saidaValorDiaria()).toBe(25);
    expect(component.saidaValorDiariaTexto()).toBe('25,00');
    expect(component.saidaValorBloqueado()).toBe(true);
    expect(component.saidaTipoTarifa()).toBe(2);
    expect(component.saidaLabelValorUnitario()).toBe('Valor da diária');
    expect(component.saidaLabelQuantidade()).toBe('Quantidade de diárias');
    expect(component.permanenciaOpen()).toBe(true);

    component.onPermanenciaDataHoraChange('2026-08-03T12:00');
    expect(component.saidaQuantidadeDiarias()).toBe(3);
    expect(component.saidaValor()).toBe(75);
  });

  it('ao abrir Registrar saída com tarifa por hora deve rotular campos em horas', () => {
    entradaSaidaServiceMock.getById.mockReturnValue(
      of({
        id: 5038,
        finalizado: false,
        transportadoraId: 0,
        dataHoraEntrada: '2026-08-09T15:25:00'
      })
    );
    entradaSaidaServiceMock.obterValorEstacionamento.mockReturnValue(
      of({
        entradaSaidaId: 5038,
        estacionamentoId: 1,
        transportadoraId: null,
        configuracaoCobrancaId: null,
        valor: 22,
        origem: 'EstacionamentoConfiguracao',
        valorUnitario: 11,
        quantidadeUnidades: 2,
        tipoTarifa: 1,
        tipoCobranca: 'Avulso'
      })
    );

    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;
    component.abrirPermanencia(
      {
        id: 5038,
        descricao: '',
        motoristaId: 0,
        nomeMotorista: '',
        transportadoraId: 0,
        nomeTransportadora: '',
        veiculoId: 0,
        placaVeiculo: 'IAA7771',
        dataHoraEntrada: '2026-08-09T15:25:00',
        dataHoraSaida: null,
        avulso: true
      },
      'finalizar'
    );

    expect(component.saidaTipoTarifa()).toBe(1);
    expect(component.saidaValorDiaria()).toBe(11);
    expect(component.saidaQuantidadeDiarias()).toBe(2);
    expect(component.saidaValor()).toBe(22);
    expect(component.saidaLabelValorUnitario()).toBe('Valor da hora');
    expect(component.saidaLabelQuantidade()).toBe('Quantidade de horas');
  });

  it('quando valor-estacionamento retorna 404 deve deixar a diária editável', () => {
    entradaSaidaServiceMock.getById.mockReturnValue(
      of({
        id: 10,
        finalizado: false,
        transportadoraId: 3,
        dataHoraEntrada: '2026-08-03T08:00:00'
      })
    );
    entradaSaidaServiceMock.obterValorEstacionamento.mockReturnValue(
      throwError(() => ({ message: 'Não encontrado', status: 404 }))
    );

    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;
    component.abrirPermanencia(
      {
        id: 10,
        descricao: '',
        motoristaId: 0,
        nomeMotorista: '',
        transportadoraId: 3,
        nomeTransportadora: '',
        veiculoId: 0,
        placaVeiculo: 'ABC1D23',
        dataHoraEntrada: '2026-08-03T08:00:00',
        dataHoraSaida: null,
        avulso: true
      },
      'finalizar'
    );

    expect(component.saidaValorDiaria()).toBeNull();
    expect(component.saidaValor()).toBeNull();
    expect(component.saidaValorBloqueado()).toBe(false);
    component.onPermanenciaDataHoraChange('2026-08-03T18:00');
    component.onSaidaValorDiariaChange('15');
    expect(component.saidaQuantidadeDiarias()).toBe(1);
    expect(component.saidaValor()).toBe(15);
    expect(component.podeFinalizar()).toBe(true);
  });

  it('deve abrir pré-visualização do recibo sem download automático', () => {
    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });

    (component as unknown as { abrirPreviewRecibo: (b: Blob, n: string) => void }).abrirPreviewRecibo(
      blob,
      'recibo-ABC1D23.pdf'
    );

    expect(component.reciboPreviewOpen()).toBe(true);
    expect(component.reciboPreviewUrl()).toBeTruthy();
    expect(component.reciboPreviewFileName()).toBe('recibo-ABC1D23.pdf');

    component.fecharPreviewRecibo();
    expect(component.reciboPreviewOpen()).toBe(false);
    expect(component.reciboPreviewUrl()).toBeNull();
  });

  it('imprimir deve abrir aba com URL própria (independente do modal)', () => {
    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    (component as unknown as { abrirPreviewRecibo: (b: Blob, n: string) => void }).abrirPreviewRecibo(
      blob,
      'recibo-X.pdf'
    );

    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      focus: vi.fn(),
      print: vi.fn(),
      addEventListener: vi.fn()
    } as unknown as Window);

    component.imprimirReciboDaPreview();

    expect(openSpy).toHaveBeenCalled();
    const openedUrl = openSpy.mock.calls[0]?.[0];
    expect(typeof openedUrl).toBe('string');
    expect(String(openedUrl).startsWith('blob:')).toBe(true);

    component.fecharPreviewRecibo();
    openSpy.mockRestore();
  });
});
