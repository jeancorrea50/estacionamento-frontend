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

  it('não libera Convites/Relatório quando o login só tem Transportadora', () => {
    service.setMenus([
      {
        id: 10,
        descricao: 'Cadastro',
        ativo: true,
        ordem: 0,
        rota: '/app/cadastro',
        selecionado: true,
        subMenus: [
          {
            id: 11,
            descricao: 'Transportadora',
            rota: '/app/cadastro/transportadoras',
            ativo: true,
            selecionado: true,
            ordem: 0,
          },
        ],
      },
    ]);

    const filtered = service.filterSidebarItems([
      {
        label: 'Cadastro',
        route: '/app/cadastro',
        children: [
          {
            label: 'Transportadora',
            route: '/app/cadastro/transportadoras',
            children: [
              { label: 'Convites', route: '/app/cadastro/transportadoras/convites' },
              { label: 'Relatório', route: '/app/cadastro/transportadoras/relatorio' },
            ],
          },
          { label: 'Veículo', route: '/app/cadastro/veiculos' },
        ],
      },
      { label: 'Pátio', route: '/app/patio' },
      { label: 'Agendamento', route: '/app/agendamento' },
      { label: 'Rede credenciada', route: '/app/rede-credenciada' },
    ]);

    expect(filtered.map((i) => i.label)).toEqual(['Cadastro']);
    expect(filtered[0].children?.map((c) => c.route)).toEqual(['/app/cadastro/transportadoras']);
    expect(
      (filtered[0].children?.[0] as { children?: unknown[] } | undefined)?.children
    ).toBeUndefined();
    expect(service.canAccessRoute('/app/cadastro/transportadoras')).toBe(true);
    expect(service.canAccessRoute('/app/cadastro/transportadoras/convites')).toBe(false);
    expect(service.canAccessRoute('/app/cadastro/transportadoras/relatorio')).toBe(false);
    expect(service.canAccessRoute('/app/patio')).toBe(false);
    expect(service.canAccessRoute('/app/agendamento')).toBe(false);
    expect(service.canAccessRoute('/app/rede-credenciada')).toBe(false);
  });

  it('respeita Relatório pela rota completa do login (pai no path)', () => {
    service.setMenus([
      {
        id: 1,
        descricao: 'Pátio',
        ativo: true,
        selecionado: true,
        rota: '/app/patio',
        subMenus: [
          {
            id: 10,
            descricao: 'Relatório',
            // formato comum da API: sem barra inicial
            rota: 'app/patio/movimentacoes/relatorio',
            ativo: true,
            selecionado: true,
            ordem: 0,
          },
        ],
      },
      {
        id: 2,
        descricao: 'Cadastro',
        ativo: true,
        selecionado: true,
        rota: '/app/cadastro',
        subMenus: [
          {
            id: 20,
            descricao: 'Relatório',
            rota: 'app/cadastro/transportadoras/relatorio',
            ativo: true,
            selecionado: true,
            ordem: 0,
          },
        ],
      },
      {
        id: 3,
        descricao: 'Financeiro',
        ativo: true,
        selecionado: true,
        rota: '/app/financeiro',
        subMenus: [
          {
            id: 30,
            descricao: 'Relatório',
            rota: 'app/financeiro/faturamento/relatorio',
            ativo: true,
            selecionado: true,
            ordem: 0,
          },
          {
            id: 31,
            descricao: 'Relatório',
            rota: 'app/financeiro/pagamento/relatorio',
            ativo: true,
            selecionado: true,
            ordem: 1,
          },
        ],
      },
    ]);

    expect(service.canAccessRoute('/app/patio/movimentacoes/relatorio')).toBe(true);
    expect(service.canAccessRoute('/app/cadastro/transportadoras/relatorio')).toBe(true);
    expect(service.canAccessRoute('/app/financeiro/faturamento/relatorio')).toBe(true);
    expect(service.canAccessRoute('/app/financeiro/pagamento/relatorio')).toBe(true);
    expect(service.canAccessRoute('/app/relatorios')).toBe(false);
  });

  it('lista plana Financeiro: Relatório de faturamento ≠ Relatório de pagamento', () => {
    service.setMenus([
      {
        id: 1,
        descricao: 'Financeiro',
        ativo: true,
        selecionado: true,
        rota: '/app/financeiro',
        subMenus: [
          {
            id: 10,
            descricao: 'Faturamento',
            rota: '/app/financeiro/faturamento',
            ativo: true,
            selecionado: true,
            ordem: 0,
          },
          {
            id: 11,
            descricao: 'Cobrança',
            rota: '/app/financeiro/faturamento/cobranca',
            ativo: true,
            selecionado: true,
            ordem: 1,
          },
          {
            id: 12,
            descricao: 'Relatório',
            rota: null,
            ativo: true,
            selecionado: true,
            ordem: 2,
          },
          {
            id: 20,
            descricao: 'Pagamento',
            rota: '/app/financeiro/pagamento',
            ativo: true,
            selecionado: true,
            ordem: 3,
          },
          {
            id: 21,
            descricao: 'Relatório',
            rota: null,
            ativo: true,
            selecionado: true,
            ordem: 4,
          },
        ],
      },
    ]);

    expect(service.canAccessRoute('/app/financeiro/faturamento/relatorio')).toBe(true);
    expect(service.canAccessRoute('/app/financeiro/pagamento/relatorio')).toBe(true);
    expect(service.canAccessRoute('/app/relatorios')).toBe(false);

    const filtered = service.filterSidebarItems([
      {
        label: 'Financeiro',
        route: '/app/financeiro',
        children: [
          {
            label: 'Faturamento',
            route: '/app/financeiro/faturamento',
            children: [
              { label: 'Cobrança', route: '/app/financeiro/faturamento/cobranca' },
              { label: 'Relatório', route: '/app/financeiro/faturamento/relatorio' },
            ],
          },
          {
            label: 'Pagamento',
            route: '/app/financeiro/pagamento',
            children: [
              { label: 'Relatório', route: '/app/financeiro/pagamento/relatorio' },
            ],
          },
        ],
      },
    ]);
    expect(filtered[0]?.children?.map((c) => c.route)).toEqual([
      '/app/financeiro/faturamento',
      '/app/financeiro/pagamento',
    ]);
    const fatura = filtered[0]?.children?.[0] as { children?: { route: string }[] } | undefined;
    const pagamento = filtered[0]?.children?.[1] as { children?: { route: string }[] } | undefined;
    expect(fatura?.children?.map((c) => c.route)).toEqual([
      '/app/financeiro/faturamento/cobranca',
      '/app/financeiro/faturamento/relatorio',
    ]);
    expect(pagamento?.children?.map((c) => c.route)).toEqual([
      '/app/financeiro/pagamento/relatorio',
    ]);
  });

  it('respeita Relatório pelo pai (faturamento ≠ pagamento ≠ cadastro ≠ pátio)', () => {
    service.setMenus([
      {
        id: 1,
        descricao: 'Financeiro',
        ativo: true,
        selecionado: true,
        rota: '/app/financeiro',
        subMenus: [
          {
            id: 10,
            descricao: 'Faturamento',
            rota: '/app/financeiro/faturamento',
            ativo: true,
            selecionado: true,
            ordem: 0,
            subMenus: [
              {
                id: 11,
                descricao: 'Relatório',
                rota: null,
                ativo: true,
                selecionado: true,
                ordem: 1,
              },
            ],
          },
          {
            id: 20,
            descricao: 'Pagamento',
            rota: '/app/financeiro/pagamento',
            ativo: true,
            selecionado: true,
            ordem: 2,
            // Relatório de pagamento NÃO vem no login
          },
        ],
      },
      {
        id: 2,
        descricao: 'Cadastro',
        ativo: true,
        selecionado: true,
        rota: '/app/cadastro',
        subMenus: [
          {
            id: 30,
            descricao: 'Transportadora',
            rota: '/app/cadastro/transportadoras',
            ativo: true,
            selecionado: true,
            ordem: 0,
          },
          {
            id: 31,
            descricao: 'Relatório',
            rota: null,
            ativo: true,
            selecionado: true,
            ordem: 1,
          },
        ],
      },
      {
        id: 3,
        descricao: 'Pátio',
        ativo: true,
        selecionado: true,
        rota: '/app/patio',
        subMenus: [
          {
            id: 40,
            descricao: 'Movimentações',
            rota: '/app/patio/movimentacoes',
            ativo: true,
            selecionado: true,
            ordem: 0,
          },
          {
            id: 41,
            descricao: 'Relatório',
            rota: null,
            ativo: true,
            selecionado: true,
            ordem: 1,
          },
        ],
      },
    ]);

    expect(service.canAccessRoute('/app/financeiro/faturamento/relatorio')).toBe(true);
    expect(service.canAccessRoute('/app/financeiro/pagamento/relatorio')).toBe(false);
    expect(service.canAccessRoute('/app/cadastro/transportadoras/relatorio')).toBe(true);
    expect(service.canAccessRoute('/app/patio/movimentacoes/relatorio')).toBe(true);
    expect(service.canAccessRoute('/app/relatorios')).toBe(false);

    const filtered = service.filterSidebarItems([
      {
        label: 'Financeiro',
        route: '/app/financeiro',
        children: [
          {
            label: 'Faturamento',
            route: '/app/financeiro/faturamento',
            children: [{ label: 'Relatório', route: '/app/financeiro/faturamento/relatorio' }],
          },
          {
            label: 'Pagamento',
            route: '/app/financeiro/pagamento',
            children: [{ label: 'Relatório', route: '/app/financeiro/pagamento/relatorio' }],
          },
        ],
      },
      {
        label: 'Cadastro',
        route: '/app/cadastro',
        children: [
          {
            label: 'Transportadora',
            route: '/app/cadastro/transportadoras',
            children: [
              { label: 'Relatório', route: '/app/cadastro/transportadoras/relatorio' },
            ],
          },
        ],
      },
      {
        label: 'Pátio',
        route: '/app/patio',
        children: [
          {
            label: 'Movimentações',
            route: '/app/patio/movimentacoes',
            children: [
              { label: 'Relatório', route: '/app/patio/movimentacoes/relatorio' },
            ],
          },
        ],
      },
    ]);

    const fin = filtered.find((i) => i.label === 'Financeiro');
    expect(fin?.children?.map((c) => c.route)).toEqual(['/app/financeiro/faturamento']);
    const faturaChildren = (
      fin?.children?.[0] as { children?: { route: string }[] } | undefined
    )?.children;
    expect(faturaChildren?.map((c) => c.route)).toEqual([
      '/app/financeiro/faturamento/relatorio',
    ]);

    const cadastro = filtered.find((i) => i.label === 'Cadastro');
    expect(cadastro?.children?.map((c) => c.route)).toEqual(['/app/cadastro/transportadoras']);
    expect(
      (cadastro?.children?.[0] as { children?: { route: string }[] } | undefined)?.children?.map(
        (c) => c.route
      )
    ).toEqual(['/app/cadastro/transportadoras/relatorio']);

    const patio = filtered.find((i) => i.label === 'Pátio');
    expect(patio?.children?.map((c) => c.route)).toEqual(['/app/patio/movimentacoes']);
    expect(
      (patio?.children?.[0] as { children?: { route: string }[] } | undefined)?.children?.map(
        (c) => c.route
      )
    ).toEqual(['/app/patio/movimentacoes/relatorio']);
  });

  it('não libera Ecossistema/Qualidade só porque Usuário está na sessão', () => {
    service.setMenus([
      {
        id: 20,
        descricao: 'Administração',
        ativo: true,
        ordem: 0,
        rota: '/app/administracao',
        selecionado: true,
        subMenus: [
          {
            id: 21,
            descricao: 'Usuário',
            rota: '/app/administracao/usuario',
            ativo: true,
            selecionado: true,
            ordem: 0,
          },
        ],
      },
    ]);

    const filtered = service.filterSidebarItems([
      {
        label: 'Administração',
        route: '/app/administracao',
        children: [
          { label: 'Usuário', route: '/app/administracao/usuario' },
          { label: 'Ecossistema', route: '/app/administracao/ecossistema' },
          { label: 'Qualidade e Testes', route: '/app/administracao/qualidade' },
        ],
      },
    ]);

    expect(filtered[0].children?.map((c) => c.route)).toEqual(['/app/administracao/usuario']);
    expect(service.canAccessRoute('/app/administracao/usuario')).toBe(true);
    expect(service.canAccessRoute('/app/administracao/qualidade')).toBe(false);
    expect(service.canAccessRoute('/app/administracao/ecossistema')).toBe(false);
  });
});
