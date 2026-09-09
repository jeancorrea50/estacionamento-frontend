import { TestBed } from '@angular/core/testing';
import { SessionAccessService } from './session-access.service';

describe('SessionAccessService sidebar filter', () => {
  let service: SessionAccessService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionAccessService);
    service.clear();
  });

  it('não libera Entrada e Saída quando o login só tem Movimentações', () => {
    service.setMenus([
      {
        id: 8,
        descricao: 'Pátio',
        ativo: true,
        ordem: 0,
        rota: '/app/patio',
        subMenus: [
          {
            id: 3055,
            descricao: 'Movimentações',
            rota: '/app/patio/movimentacoes',
            ativo: true,
            ordem: 1,
          },
        ],
      },
    ]);

    const filtered = service.filterSidebarItems([
      {
        label: 'Pátio',
        route: '/app/patio',
        children: [
          { label: 'Movimentações', route: '/app/patio/movimentacoes' },
          { label: 'Entrada e Saída', route: '/app/patio/entrada-saida' },
        ],
      },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].children?.map((c) => c.route)).toEqual(['/app/patio/movimentacoes']);
    expect(service.canAccessRoute('/app/patio/movimentacoes')).toBe(true);
    expect(service.canAccessRoute('/app/patio/entrada-saida')).toBe(false);
  });
});
