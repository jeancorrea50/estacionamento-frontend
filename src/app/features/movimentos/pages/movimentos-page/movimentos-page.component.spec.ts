import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  DashboardAtualizadoPayload,
  MovimentacaoAtualizadaPayload
} from '../../../../core/models/dashboard.models';
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
    excluir: vi.fn().mockReturnValue(of(void 0))
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

  let dashboardSignal: WritableSignal<DashboardAtualizadoPayload | null>;
  let movimentacoesSignal: WritableSignal<MovimentacaoAtualizadaPayload>;
  let signalrDashboardServiceMock: {
    dashboardAtualizado: WritableSignal<DashboardAtualizadoPayload | null>;
    movimentacoes: WritableSignal<MovimentacaoAtualizadaPayload>;
    alertaOperacional: ReturnType<typeof signal<string>>;
    connect: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    dashboardSignal = signal<DashboardAtualizadoPayload | null>(null);
    movimentacoesSignal = signal<MovimentacaoAtualizadaPayload>([]);
    signalrDashboardServiceMock = {
      dashboardAtualizado: dashboardSignal,
      movimentacoes: movimentacoesSignal,
      alertaOperacional: signal(''),
      connect: vi.fn().mockResolvedValue(undefined)
    };

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

  it('deve permitir finalizar apenas quando registro não finalizado', () => {
    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;
    component.registroSelecionado.set({ finalizado: false } as never);
    expect(component.podeFinalizar()).toBeTruthy();
    component.registroSelecionado.set({ finalizado: true } as never);
    expect(component.podeFinalizar()).toBeFalsy();
  });

  it('deve refletir resultado do Buscar (HTTP) e encerrar loading', () => {
    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;

    entradaSaidaServiceMock.buscar.mockReturnValueOnce(
      of({
        items: [
          {
            id: 10,
            placaVeiculo: 'RAL1C89',
            nomeMotorista: 'ALEXSANDER',
            nomeTransportadora: 'GT',
            dataHoraEntrada: '2026-07-21T17:25:00',
            dataHoraSaida: null,
            status: 'Entrada'
          }
        ],
        totalCount: 1,
        numeroPagina: 1,
        tamanhoPagina: 20
      })
    );

    component.buscar();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.registros()).toHaveLength(1);
    expect(component.registros()[0].placaVeiculo).toBe('RAL1C89');
  });

  it('deve refletir movimentacaoAtualizada com Guid no monitoramento sem converter id para NaN', () => {
    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;
    const guid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    movimentacoesSignal.set([
      {
        id: guid,
        status: 'Entrada',
        horario: '2026-07-21T17:25:00',
        veiculo: 'RAL1C89',
        motorista: 'ALEXSANDER DE OLIVEIRA PENHA',
        transportadora: ''
      }
    ]);
    fixture.detectChanges();

    const itens = component.monitoramentoItens();
    expect(itens).toHaveLength(1);
    expect(itens[0].id).toBe(guid);
    expect(itens[0].placa).toBe('RAL1C89');
    expect(itens[0].motorista).toBe('ALEXSANDER DE OLIVEIRA PENHA');
  });
});
