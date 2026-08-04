import { Injectable, computed, inject, signal } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import {
  MenuAdmin,
  MenuAdminState,
  MenuPermissionRow,
  PERMISSOES_ACOES,
  RolePermissionBinding,
  SubMenuAdmin,
} from '../models/menu-admin.model';
import {
  buildFullAcaoPermissao,
  hasMatchingPermissionAcao,
  removePermissionRowsForUi,
} from './menu-permission-acao';
import { MENU_STRUCTURE } from '../../cadastro/constants/menu-structure';
import { resolveAppRouteFromNome, resolveMaterialSymbolIconFromModule } from './menu-route-resolver';
import {
  defaultExibirNoSidebar,
  rememberSidebarVisibility,
} from './menu-sidebar-visibility';
import {
  SessionAccessService,
  type SessionMenuAccess,
  type SessionSubMenuAccess,
} from '../../../core/services/session-access.service';

const STORAGE_KEY = 'gts-menu-admin-state-v1';

function cloneState(s: MenuAdminState): MenuAdminState {
  return JSON.parse(JSON.stringify(s)) as MenuAdminState;
}

/**
 * Migração: estado antigo sem `existeNoServidor` / `exibirNoSidebar`.
 */
function migrateMenuServidorFlagsFromStorage(menus: MenuAdmin[]): void {
  for (const m of menus) {
    if (m.existeNoServidor === undefined) {
      m.existeNoServidor = true;
    }
    if (m.exibirNoSidebar === undefined) {
      m.exibirNoSidebar = defaultExibirNoSidebar(m.rota);
    }
    for (const s of m.subMenus ?? []) {
      if (s.exibirNoSidebar === undefined) {
        s.exibirNoSidebar = defaultExibirNoSidebar(s.rota);
      }
    }
  }
}

/** Estado inicial derivado do MENU_STRUCTURE (fallback). */
function buildSeedState(): MenuAdminState {
  let nid = 1;
  const menus: MenuAdmin[] = MENU_STRUCTURE.map((node, mi) => {
    const menuId = nid++;
    const subs: SubMenuAdmin[] = [];
    if (node.children?.length) {
      let ordem = 0;
      for (const c of node.children) {
        subs.push({
          id: nid++,
          nome: c.label,
          ordem: ordem++,
          rota: c.route,
          ativo: true,
          exibirNoSidebar: defaultExibirNoSidebar(c.route),
          permissions: [],
        });
      }
    } else {
      subs.push({
        id: nid++,
        nome: node.label,
        ordem: 0,
        rota: node.route,
        ativo: true,
        exibirNoSidebar: defaultExibirNoSidebar(node.route),
        permissions: [],
      });
    }
    return {
      id: menuId,
      nome: node.label,
      ordem: mi,
      icone: node.icon,
      rota: node.route,
      ativo: true,
      exibirNoSidebar: defaultExibirNoSidebar(node.route),
      subMenus: subs,
      existeNoServidor: false,
    };
  });
  return {
    menus,
    roles: [
      { roleId: 'admin', nome: 'Administrador', permissoesPorSubMenu: {} },
      { roleId: 'operador', nome: 'Operador', permissoesPorSubMenu: {} },
      { roleId: 'visualizador', nome: 'Visualizador', permissoesPorSubMenu: {} },
    ],
    nextId: nid,
  };
}

@Injectable({ providedIn: 'root' })
export class MenuAdminService {
  private readonly state = signal<MenuAdminState>(this.loadInitial());
  private readonly sessionAccess = inject(SessionAccessService);

  readonly menus = computed(() => this.state().menus);
  readonly roles = computed(() => this.state().roles);

  /** Menu dinâmico para a sidebar (atualiza quando o estado muda). */
  readonly sidebarMenuItems = computed(() => this.getSidebarMenuItems());

  private loadInitial(): MenuAdminState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MenuAdminState;
        if (parsed?.menus?.length) {
          migrateMenuServidorFlagsFromStorage(parsed.menus);
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
    const seed = buildSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
  }

  private patch(fn: (s: MenuAdminState) => void): void {
    this.state.update((s) => {
      const next = cloneState(s);
      fn(next);
      return next;
    });
    this.persist();
  }

  /** Cópia do estado atual (para sincronizar com o backend sem alterar a referência interna). */
  getSnapshot(): MenuAdminState {
    return cloneState(this.state());
  }

  /**
   * Após salvar no servidor e nova Buscar: substitui menus e nextId; mantém roles.
   */
  replaceMenusHidratar(menus: MenuAdmin[], nextId: number): void {
    this.state.update((s) => {
      const next = cloneState(s);
      next.menus = menus.map((m) => ({ ...m, existeNoServidor: true }));
      next.nextId = nextId;
      return next;
    });
    this.persist();
    this.syncSessionMenusWithCurrentTree(menus);
  }

  /**
   * Reaplica a árvore de menus atual no estado de sessão do usuário, preservando o que já estava selecionado
   * por id (menu/submenu). Isso mantém o sidebar coerente após mover submenu entre menus no admin.
   */
  private syncSessionMenusWithCurrentTree(latestMenus: MenuAdmin[]): void {
    if (!this.sessionAccess.hasSessionMenus()) return;

    const previous = this.sessionAccess.menus();
    const selectedMenuIds = new Set<number>();
    const selectedSubMenuIds = new Set<number>();

    for (const menu of previous) {
      if (menu.id != null && menu.selecionado !== false) {
        selectedMenuIds.add(menu.id);
      }
      for (const sub of menu.subMenus ?? []) {
        if (sub.id != null && sub.selecionado !== false) {
          selectedSubMenuIds.add(sub.id);
        }
      }
    }

    const nextSessionMenus: SessionMenuAccess[] = latestMenus
      .filter((menu) => menu.ativo !== false)
      .sort((a, b) => a.ordem - b.ordem)
      .map((menu) => {
        const subMenus: SessionSubMenuAccess[] = (menu.subMenus ?? [])
          .filter((sub) => sub.ativo !== false)
          .sort((a, b) => a.ordem - b.ordem)
          .map((sub) => ({
            id: sub.id,
            descricao: sub.nome,
            rota: sub.rota,
            ativo: sub.ativo,
            exibirNoSidebar: sub.exibirNoSidebar !== false,
            selecionado: selectedSubMenuIds.has(sub.id),
            ordem: sub.ordem,
          }));

        const menuSelecionado =
          selectedMenuIds.has(menu.id) || subMenus.some((sub) => sub.selecionado !== false);

        return {
          id: menu.id,
          descricao: menu.nome,
          icone: menu.icone,
          rota: menu.rota,
          ativo: menu.ativo,
          exibirNoSidebar: menu.exibirNoSidebar !== false,
          selecionado: menuSelecionado,
          ordem: menu.ordem,
          subMenus,
        };
      });

    this.sessionAccess.setMenus(nextSessionMenus);
  }

  exportJson(): string {
    return JSON.stringify(this.state(), null, 2);
  }

  importJson(json: string): void {
    const parsed = JSON.parse(json) as MenuAdminState;
    if (!parsed?.menus?.length) throw new Error('JSON inválido');
    if (typeof parsed.nextId !== 'number') {
      let max = 0;
      for (const m of parsed.menus) {
        max = Math.max(max, m.id);
        for (const s of m.subMenus) {
          max = Math.max(max, s.id);
          for (const p of s.permissions) max = Math.max(max, p.id);
        }
      }
      parsed.nextId = max + 1;
    }
    if (!parsed.roles?.length) {
      parsed.roles = [
        { roleId: 'admin', nome: 'Administrador', permissoesPorSubMenu: {} },
      ];
    }
    for (const m of parsed.menus) {
      m.existeNoServidor = false;
    }
    this.state.set(parsed);
    this.persist();
  }

  resetToSeed(): void {
    const seed = buildSeedState();
    this.state.set(seed);
    this.persist();
  }

  // ——— Menus ———

  addMenu(nome: string, icone: string): void {
    this.patch((s) => {
      const id = s.nextId++;
      s.menus.push({
        id,
        nome,
        ordem: s.menus.length,
        icone: icone || 'menu',
        ativo: true,
        exibirNoSidebar: true,
        subMenus: [],
        existeNoServidor: false,
      });
    });
  }

  updateMenu(
    id: number,
    patch: Partial<Pick<MenuAdmin, 'nome' | 'icone' | 'ativo' | 'rota' | 'exibirNoSidebar'>>
  ): void {
    this.patch((s) => {
      const m = s.menus.find((x) => x.id === id);
      if (!m) return;
      Object.assign(m, patch);
      if (patch.exibirNoSidebar !== undefined) {
        rememberSidebarVisibility('menu', id, patch.exibirNoSidebar);
      }
    });
    this.syncSessionMenusWithCurrentTree(this.state().menus);
  }

  deleteMenu(id: number): void {
    this.patch((s) => {
      s.menus = s.menus.filter((x) => x.id !== id).map((x, i) => ({ ...x, ordem: i }));
    });
  }

  onMenuDrop(event: CdkDragDrop<MenuAdmin[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.patch((s) => {
      moveItemInArray(s.menus, event.previousIndex, event.currentIndex);
      s.menus = s.menus.map((m, i) => ({ ...m, ordem: i }));
    });
  }

  // ——— Submenus ———

  addSubMenu(menuId: number, nome: string, rota: string): void {
    this.patch((s) => {
      const menu = s.menus.find((x) => x.id === menuId);
      if (!menu) return;
      const id = s.nextId++;
      const normalized = rota.trim();
      const path = normalized.startsWith('/app') ? normalized : `/app/${normalized.replace(/^\//, '')}`;
      menu.subMenus.push({
        id,
        nome,
        ordem: menu.subMenus.length,
        rota: path,
        ativo: true,
        exibirNoSidebar: defaultExibirNoSidebar(path),
        permissions: [],
      });
    });
  }

  updateSubMenu(
    menuId: number,
    subId: number,
    patch: Partial<Pick<SubMenuAdmin, 'nome' | 'rota' | 'ativo' | 'exibirNoSidebar'>>
  ): void {
    this.patch((s) => {
      const menu = s.menus.find((x) => x.id === menuId);
      const sub = menu?.subMenus.find((x) => x.id === subId);
      if (!sub) return;
      Object.assign(sub, patch);
      if (patch.exibirNoSidebar !== undefined) {
        rememberSidebarVisibility('sub', subId, patch.exibirNoSidebar);
      }
    });
    this.syncSessionMenusWithCurrentTree(this.state().menus);
  }

  deleteSubMenu(menuId: number, subId: number): void {
    this.patch((s) => {
      const menu = s.menus.find((x) => x.id === menuId);
      if (!menu) return;
      menu.subMenus = menu.subMenus
        .filter((x) => x.id !== subId)
        .map((x, i) => ({ ...x, ordem: i }));
    });
  }

  /**
   * Reordena submenus no mesmo menu ou transfere entre menus (Salvar → OrganizarMenus persiste no backend).
   */
  onSubMenuDrop(targetMenuId: number, event: CdkDragDrop<SubMenuAdmin[]>): void {
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;
      this.patch((s) => {
        const menu = s.menus.find((x) => x.id === targetMenuId);
        if (!menu) return;
        moveItemInArray(menu.subMenus, event.previousIndex, event.currentIndex);
        menu.subMenus = menu.subMenus.map((x, i) => ({ ...x, ordem: i }));
      });
      return;
    }

    this.patch((s) => {
      const targetMenu = s.menus.find((x) => x.id === targetMenuId);
      if (!targetMenu) return;

      let sourceMenu: MenuAdmin | undefined;
      const prevId = event.previousContainer.id;
      if (typeof prevId === 'string' && prevId.startsWith('submenu-drop-')) {
        const parsed = Number(prevId.replace(/^submenu-drop-/, ''));
        if (!Number.isNaN(parsed)) {
          sourceMenu = s.menus.find((m) => m.id === parsed);
        }
      }
      if (!sourceMenu) {
        const prevData = event.previousContainer.data as SubMenuAdmin[];
        sourceMenu = s.menus.find((m) => m.subMenus === prevData);
      }
      if (!sourceMenu || sourceMenu.id === targetMenu.id) return;

      transferArrayItem(
        sourceMenu.subMenus,
        targetMenu.subMenus,
        event.previousIndex,
        event.currentIndex
      );
      sourceMenu.subMenus = sourceMenu.subMenus.map((x, i) => ({ ...x, ordem: i }));
      targetMenu.subMenus = targetMenu.subMenus.map((x, i) => ({ ...x, ordem: i }));
    });
  }

  // ——— Permissões no submenu (ações CRUD) ———

  hasAcao(sub: SubMenuAdmin, acao: string): boolean {
    return hasMatchingPermissionAcao(sub.permissions, sub.nome, acao);
  }

  togglePermissaoAcao(menuId: number, subId: number, acao: string, enabled: boolean): void {
    this.patch((s) => {
      const menu = s.menus.find((x) => x.id === menuId);
      const sub = menu?.subMenus.find((x) => x.id === subId);
      if (!sub) return;
      if (enabled) {
        if (hasMatchingPermissionAcao(sub.permissions, sub.nome, acao)) return;
        const id = s.nextId++;
        sub.permissions.push({
          id,
          ordem: sub.permissions.length,
          subModuleId: subId,
          acao: buildFullAcaoPermissao(sub.nome, acao),
        });
      } else {
        sub.permissions = removePermissionRowsForUi(sub.permissions, sub.nome, acao);
      }
    });
  }

  selecionarTodasAcoes(menuId: number, subId: number): void {
    this.patch((s) => {
      const menu = s.menus.find((x) => x.id === menuId);
      const sub = menu?.subMenus.find((x) => x.id === subId);
      if (!sub) return;
      for (const acao of PERMISSOES_ACOES) {
        if (!hasMatchingPermissionAcao(sub.permissions, sub.nome, acao)) {
          const id = s.nextId++;
          sub.permissions.push({
            id,
            ordem: sub.permissions.length,
            subModuleId: subId,
            acao: buildFullAcaoPermissao(sub.nome, acao),
          });
        }
      }
    });
  }

  /** Substitui permissões do submenu (ex.: após edição em rascunho antes do PUT Alterar). */
  setSubMenuPermissions(menuId: number, subId: number, permissions: MenuPermissionRow[]): void {
    this.patch((s) => {
      const menu = s.menus.find((x) => x.id === menuId);
      const sub = menu?.subMenus.find((x) => x.id === subId);
      if (!sub) return;
      sub.permissions = permissions.map((p, i) => ({
        ...p,
        ordem: i,
        subModuleId: subId,
      }));
    });
  }

  limparAcoes(menuId: number, subId: number): void {
    this.patch((s) => {
      const menu = s.menus.find((x) => x.id === menuId);
      const sub = menu?.subMenus.find((x) => x.id === subId);
      if (!sub) return;
      sub.permissions = [];
    });
  }

  todasAcoesSelecionadas(sub: SubMenuAdmin): boolean {
    return PERMISSOES_ACOES.every((a) => this.hasAcao(sub, a));
  }

  // ——— Perfis ———

  setRoleSubMenuPermissoes(
    roleId: string,
    subMenuId: number,
    acoes: string[]
  ): void {
    this.patch((s) => {
      const r = s.roles.find((x) => x.roleId === roleId);
      if (!r) return;
      r.permissoesPorSubMenu[subMenuId] = [...acoes];
    });
  }

  getRolePermissoes(roleId: string, subMenuId: number): string[] {
    const r = this.state().roles.find((x) => x.roleId === roleId);
    return r?.permissoesPorSubMenu[subMenuId] ?? [];
  }

  toggleRoleAcao(roleId: string, subMenuId: number, acao: string, on: boolean): void {
    const cur = [...this.getRolePermissoes(roleId, subMenuId)];
    if (on) {
      if (!cur.includes(acao)) cur.push(acao);
    } else {
      const i = cur.indexOf(acao);
      if (i >= 0) cur.splice(i, 1);
    }
    this.setRoleSubMenuPermissoes(roleId, subMenuId, cur);
  }

  /**
   * Itens para sidebar. Gerenciamento: só link único `/app/gerenciamento` (Estacionamento só dentro da área Gerenciamento).
   */
  getSidebarMenuItems(): {
    label: string;
    route: string;
    icon: string;
    children?: { label: string; route: string; children?: { label: string; route: string }[] }[];
  }[] {
    const source = this.sessionAccess.hasSessionMenus()
      ? this.buildNavItemsFromSessionMenus()
      : this.buildNavItemsFromState();

    return source
      .map((item) => {
        const baseItem = {
          ...item,
          children: (item.children ?? []).length > 0 ? item.children : undefined,
        };
        if (!this.isGerenciamentoNavItem(baseItem)) return baseItem;
        return {
          label: item.label,
          route: '/app/gerenciamento',
          icon: item.icon,
        };
      })
      .map((item) => this.sanitizeCadastroSidebarNavItem(item));
  }

  /**
   * Cadastro na sidebar: remove itens que não devem aparecer (Estacionamento, motorista, veículo) e
   * padroniza rótulos quando aplicável (ex.: Transportadora).
   */
  private sanitizeCadastroSidebarNavItem<
    T extends {
      route: string;
      children?: {
        label: string;
        route: string;
        children?: { label: string; route: string }[];
      }[];
    },
  >(item: T): T {
    const base = item.route.replace(/\/+$/, '').toLowerCase();
    if (base !== '/app/cadastro' || !item.children?.length) {
      return item;
    }

    const children = item.children
      .filter((c) => !this.isHiddenCadastroSidebarRoute(c.route))
      .map((c) => {
        const mapped = {
          ...c,
          label: this.formatCadastroSubmenuSidebarLabel(c.route, c.label),
        };
        if (!c.children?.length) return mapped;
        const nested = c.children
          .filter((n) => !this.isHiddenCadastroSidebarRoute(n.route))
          .map((n) => ({
            ...n,
            label: this.formatCadastroSubmenuSidebarLabel(n.route, n.label),
          }));
        return nested.length ? { ...mapped, children: nested } : { ...mapped, children: undefined };
      });

    return {
      ...item,
      children: children.length ? children : undefined,
    } as T;
  }

  /** Estacionamento: só na área Gerenciamento. Motorista/veículo: fora da sidebar em Cadastro. */
  private isHiddenCadastroSidebarRoute(route: string): boolean {
    const n = route.replace(/\/+$/, '').toLowerCase();
    if (n === '/app/cadastro/estacionamento' || n.startsWith('/app/cadastro/estacionamento/')) {
      return true;
    }
    if (n === '/app/cadastro/motorista') return true;
    return /\/app\/cadastro\/veicul/i.test(n);
  }

  private formatCadastroSubmenuSidebarLabel(route: string, label: string): string {
    const path = route.replace(/\/+$/, '').toLowerCase();
    if (/(?:^|\/)cadastro\/transportadora(?:\/|$)/.test(path)) return 'Transportadora';
    return label;
  }

  private buildNavItemsFromSessionMenus(): {
    label: string;
    route: string;
    icon: string;
    children?: { label: string; route: string; children?: { label: string; route: string }[] }[];
  }[] {
    return this.sessionAccess
      .menus()
      .filter((m) => m.ativo !== false && this.resolveShowInSidebar(m, 'menu'))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((m) => {
        const menuLabel = m.descricao?.trim() ?? 'menu';
        const icon = resolveMaterialSymbolIconFromModule(menuLabel, m.icone);
        const activeSubs = (m.subMenus ?? [])
          .filter((s) => s.ativo !== false && this.resolveShowInSidebar(s, 'sub'))
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        if (activeSubs.length === 0) {
          return {
            label: menuLabel,
            route: resolveAppRouteFromNome(menuLabel, m.rota ?? null),
            icon,
          };
        }

        if (activeSubs.length === 1) {
          const sub = activeSubs[0];
          const subLabel = sub.descricao?.trim() || menuLabel;
          return {
            label: menuLabel,
            route: resolveAppRouteFromNome(subLabel, sub.rota),
            icon,
          };
        }

        const first = activeSubs[0];
        const firstRoute = resolveAppRouteFromNome(first.descricao?.trim() || menuLabel, first.rota);
        const rawParent = m.rota?.trim();
        const base =
          rawParent && rawParent.startsWith('/app')
            ? rawParent.replace(/\/+$/, '')
            : firstRoute.replace(/\/[^/]*$/, '') || '/app';
        return {
          label: menuLabel,
          route: base,
          icon,
          children: activeSubs.map((s) => ({
            label: s.descricao?.trim() || 'submenu',
            route: resolveAppRouteFromNome(s.descricao?.trim() || menuLabel, s.rota),
          })),
        };
      });
  }

  private buildNavItemsFromState(): {
    label: string;
    route: string;
    icon: string;
    children?: { label: string; route: string; children?: { label: string; route: string }[] }[];
  }[] {
    return this.state()
      .menus.filter((m) => m.ativo && m.exibirNoSidebar !== false)
      .sort((a, b) => a.ordem - b.ordem)
      .map((m) => {
        const subs = m.subMenus
          .filter((s) => s.ativo && s.exibirNoSidebar !== false)
          .sort((a, b) => a.ordem - b.ordem);
        if (m.subMenus.length > 0 && subs.length === 0) {
          // Tem submenus, mas nenhum no sidebar: link único para a rota do módulo.
          return {
            label: m.nome,
            route: resolveAppRouteFromNome(m.nome, m.rota ?? null),
            icon: resolveMaterialSymbolIconFromModule(m.nome, m.icone),
          };
        }
        if (subs.length === 0) {
          return {
            label: m.nome,
            route: resolveAppRouteFromNome(m.nome, m.rota ?? null),
            icon: resolveMaterialSymbolIconFromModule(m.nome, m.icone),
          };
        }
        if (subs.length === 1) {
          return {
            label: m.nome,
            route: resolveAppRouteFromNome(subs[0].nome, subs[0].rota),
            icon: resolveMaterialSymbolIconFromModule(m.nome, m.icone),
          };
        }
        const firstRota = resolveAppRouteFromNome(subs[0].nome, subs[0].rota);
        const rawParent = m.rota?.trim();
        const base =
          rawParent && rawParent.startsWith('/app')
            ? rawParent.replace(/\/+$/, '')
            : firstRota.replace(/\/[^/]*$/, '') || '/app';
        return {
          label: m.nome,
          route: base,
          icon: resolveMaterialSymbolIconFromModule(m.nome, m.icone),
          children: subs.map((s) => ({
            label: s.nome,
            route: resolveAppRouteFromNome(s.nome, s.rota),
          })),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  /**
   * Preferência explícita no item > valor no admin local > rota default.
   * Abas internas de faturamento ficam ocultas na sidebar por padrão.
   */
  private resolveShowInSidebar(
    item: {
      id?: number | null;
      rota?: string | null;
      exibirNoSidebar?: boolean | null;
    },
    kind: 'menu' | 'sub'
  ): boolean {
    if (item.exibirNoSidebar === false) return false;
    if (item.exibirNoSidebar === true) return true;

    if (item.id != null && item.id > 0) {
      if (kind === 'menu') {
        const menu = this.state().menus.find((m) => m.id === item.id);
        if (menu) return menu.exibirNoSidebar !== false;
      } else {
        for (const menu of this.state().menus) {
          const sub = menu.subMenus.find((s) => s.id === item.id);
          if (sub) return sub.exibirNoSidebar !== false;
        }
      }
    }

    return defaultExibirNoSidebar(item.rota);
  }

  /** Sidebar: Gerenciamento é sempre um único link (sem filhos). */
  private isGerenciamentoNavItem(item: {
    route: string;
    children?: { route: string; children?: { route: string }[] }[];
  }): boolean {
    if (item.route.startsWith('/app/gerenciamento')) {
      return true;
    }
    return (
      item.children?.some((c) => {
        if (c.route.startsWith('/app/gerenciamento')) return true;
        return c.children?.some((n) => n.route.startsWith('/app/gerenciamento')) ?? false;
      }) ?? false
    );
  }
}
