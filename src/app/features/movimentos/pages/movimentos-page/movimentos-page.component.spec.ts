import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
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

  it('deve permitir finalizar apenas quando registro não finalizado', () => {
    const fixture = TestBed.createComponent(MovimentosPageComponent);
    const component = fixture.componentInstance;
    component.registroSelecionado.set({ finalizado: false } as never);
    expect(component.podeFinalizar()).toBeTruthy();
    component.registroSelecionado.set({ finalizado: true } as never);
    expect(component.podeFinalizar()).toBeFalsy();
  });
});
