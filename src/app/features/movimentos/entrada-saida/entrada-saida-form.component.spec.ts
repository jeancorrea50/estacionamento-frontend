import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { ToastService } from '../../../core/api/services/toast.service';
import { SessionAccessService } from '../../../core/services/session-access.service';
import { EntradaSaidaService } from './entrada-saida.service';
import { EntradaSaidaFormComponent } from './entrada-saida-form.component';
import { VeiculoService } from '../../cadastro/services/veiculo.service';
import { of } from 'rxjs';

describe('EntradaSaidaFormComponent', () => {
  const routerMock = { navigate: vi.fn().mockResolvedValue(true) };
  const routeCreateMock = {
    snapshot: { paramMap: { get: (_k: string) => null } },
    parent: {}
  };

  const entradaSaidaServiceMock = {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  };

  const veiculoServiceMock = {
    obterPorPlaca: vi.fn().mockReturnValue(of(null))
  };

  const toastMock = { success: vi.fn(), error: vi.fn() };
  const sessionAccessMock = {
    canAccessRoute: () => true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntradaSaidaFormComponent],
      providers: [
        { provide: EntradaSaidaService, useValue: entradaSaidaServiceMock },
        { provide: VeiculoService, useValue: veiculoServiceMock },
        { provide: ToastService, useValue: toastMock },
        { provide: SessionAccessService, useValue: sessionAccessMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: routeCreateMock }
      ]
    }).compileComponents();
  });

  it('deve atualizar texto ao digitar e limpar motoristaId até nova seleção no modal', () => {
    const fixture = TestBed.createComponent(EntradaSaidaFormComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    cmp.form.patchValue({ motoristaId: 99 });
    cmp.motoristaTexto = 'José';

    const input = document.createElement('input');
    input.value = 'Jo';
    cmp.onCampoMotoristaNome({ target: input } as unknown as Event);

    expect(cmp.motoristaTexto).toBe('Jo');
    expect(cmp.form.controls.motoristaId.value).toBeNull();
  });
});
