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

  it('não libera Veículo/Motorista quando o login só tem Cadastro/Transportadora', () => {
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
      {
        id: 12,
        descricao: 'Cadastro',
        ativo: true,
        ordem: 2,
        rota: '/app/cadastro',
        subMenus: [
          {
            id: 11,
            descricao: 'Transportadora',
            rota: '/app/cadastro/transportadora',
            ativo: true,
            ordem: 0,
          },
        ],
      },
      {
        id: 2033,
        descricao: 'Agendamento',
        ativo: true,
        ordem: 3,
        rota: '/app/agendamento',
        subMenus: [
          {
            id: 3060,
            descricao: 'agendamentos',
            rota: '/app/agendamento',
            ativo: true,
            ordem: 0,
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
      {
        label: 'Agendamento',
        route: '/app/agendamento',
      },
      {
        label: 'Cadastro',
        route: '/app/cadastro',
        children: [
          { label: 'Veículo', route: '/app/cadastro/veiculos' },
          { label: 'Motorista', route: '/app/cadastro/motoristas' },
          { label: 'Transportadora', route: '/app/cadastro/transportadoras' },
        ],
      },
    ]);

    expect(filtered.map((i) => i.label)).toEqual(['Pátio', 'Agendamento', 'Cadastro']);
    expect(filtered.find((i) => i.label === 'Pátio')?.children?.map((c) => c.route)).toEqual([
      '/app/patio/movimentacoes',
    ]);
    expect(filtered.find((i) => i.label === 'Agendamento')?.route).toBe('/app/agendamento');
    expect(filtered.find((i) => i.label === 'Agendamento')?.children).toBeUndefined();
    expect(filtered.find((i) => i.label === 'Cadastro')?.children?.map((c) => c.route)).toEqual([
      '/app/cadastro/transportadoras',
    ]);
    expect(service.canAccessRoute('/app/cadastro/transportadoras')).toBe(true);
    expect(service.canAccessRoute('/app/agendamento')).toBe(true);
    expect(service.canAccessRoute('/app/cadastro/veiculos')).toBe(false);
    expect(service.canAccessRoute('/app/cadastro/motoristas')).toBe(false);
    expect(service.canAccessRoute('/app/patio/entrada-saida')).toBe(false);
  });
});
