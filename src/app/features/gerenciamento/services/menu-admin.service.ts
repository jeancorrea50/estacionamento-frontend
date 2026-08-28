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
import { MENU_STRUCTURE, type MenuSubItem } from '../../cadastro/constants/menu-structure';
import { resolveAppRouteFromNome, resolveMaterialSymbolIconFromModule, formatAppMenuDisplayLabel } from './menu-route-resolver';
import {
  defaultExibirNoSidebar,
  rememberSidebarVisibility,
} from './menu-sidebar-visibility';
import {
  SessionAccessService,
  type SessionMenuAccess,
  type SessionSubMenuAccess,
} from '../../../core/services/session-access.service';
import {
  findSubMenuById,
  nestSubMenusByRoute,
  removeSubMenuFromTree,
  updateSubMenuInTree,
  walkSubMenus,
} from './menu-tree.util';

import { CADASTRO_ESTACIONAMENTO_ROUTE } from '../../cadastro/cadastro-rotas';

const STORAGE_KEY = 'gts-menu-admin-state-v1';
const ESTACIONAMENTO_SIDEBAR_ROUTE = CADASTRO_ESTACIONAMENTO_ROUTE;

function cloneState(s: MenuAdminState): MenuAdminState {
  return JSON.parse(JSON.stringify(s)) as MenuAdminState;
}

function collectSelectedSubMenuIds(
  subs: SessionSubMenuAccess[],
  selectedSubMenuIds: Set<number>
): void {
  for (const sub of subs) {
    if (sub.id != null && sub.selecionado !== false) {
      selectedSubMenuIds.add(sub.id);
    }
    collectSelectedSubMenuIds(sub.subMenus ?? [], selectedSubMenuIds);
  }
}

function normMenuLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isEstacionamentoNavRoute(route: string | null | undefined): boolean {
  const n = String(route ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
  return (
    n === ESTACIONAMENTO_SIDEBAR_ROUTE ||
    n.startsWith(`${ESTACIONAMENTO_SIDEBAR_ROUTE}/`) ||
    n === '/app/gerenciamento/estacionamento' ||
    n.startsWith('/app/gerenciamento/estacionamento/')
  );
}

function isEstacionamentoMenuNode(nome: string | null | undefined, rota?: string | null): boolean {
  return normMenuLabel(nome) === 'estacionamento' || isEstacionamentoNavRoute(rota);
}

function isGerenciamentoMenuNode(nome: string | null | undefined, rota?: string | null): boolean {
  if (isEstacionamentoMenuNode(nome, rota)) return false;
  if (normMenuLabel(nome) === 'gerenciamento') return true;
  const n = String(rota ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
  return n === '/app/gerenciamento' || n.startsWith('/app/gerenciamento/');
}

/**
 * Remove Estacionamento de Gerenciamento e menus de topo duplicados.
 * Estacionamento fica somente como submenu de Cadastro (seed/backend).
 */
function consolidateCadastroMenus(menus: MenuAdmin[], nextId: number): {
  menus: MenuAdmin[];
  nextId: number;
} {
  let id = nextId;
  const hasCadastro = menus.some((m) => normMenuLabel(m.nome) === 'cadastro');

  const withoutTopEstacionamento = menus.filter((menu) => {
    if (!isEstacionamentoMenuNode(menu.nome, menu.rota)) return true;
    // Remove menu de topo "Estacionamento" quando Cadastro existe.
    return !hasCadastro;
  });

  const result = withoutTopEstacionamento.map((menu) => {
    if (!isGerenciamentoMenuNode(menu.nome, menu.rota)) return menu;
    const kept = (menu.subMenus ?? []).filter((sub) => !isEstacionamentoMenuNode(sub.nome, sub.rota));
    return { ...menu, subMenus: kept };
  });

  return {
    menus: result.map((m, i) => ({ ...m, ordem: i })),
    nextId: id,
  };
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

/** Converte árvore de submenus do seed em lista plana para persistência/API. */
function flattenMenuSubItemsForSeed(items: MenuSubItem[], allocId: () => number): SubMenuAdmin[] {
  const flat: SubMenuAdmin[] = [];
  let ordem = 0;

  const walk = (nodes: MenuSubItem[]) => {
    for (const node of nodes) {
      flat.push({
        id: allocId(),
        nome: node.label,
        ordem: ordem++,
        rota: node.route,
        ativo: true,
        exibirNoSidebar: defaultExibirNoSidebar(node.route),
        permissions: [],
      });
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };

  walk(items);
  return flat;
}

/** Estado inicial derivado do MENU_STRUCTURE (fallback). */
function buildSeedState(): MenuAdminState {
  let nid = 1;
  const nextId = () => nid++;
  const menus: MenuAdmin[] = MENU_STRUCTURE.map((node, mi) => {
    const menuId = nextId();
    const flatSubs = node.children?.length
      ? flattenMenuSubItemsForSeed(node.children, nextId)
      : [
          {
            id: nextId(),
            nome: node.label,
            ordem: 0,
            rota: node.route,
            ativo: true,
            exibirNoSidebar: defaultExibirNoSidebar(node.route),
            permissions: [],
          },
        ];
    return {
      id: menuId,
      nome: node.label,
      ordem: mi,
      icone: node.icon,
      rota: node.route,
      ativo: true,
      exibirNoSidebar: defaultExibirNoSidebar(node.route),
      subMenus: nestSubMenusByRoute(flatSubs),
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
          const promoted = consolidateCadastroMenus(parsed.menus, parsed.nextId ?? 1);
          parsed.menus = promoted.menus;
          parsed.nextId = promoted.nextId;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
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
    const promoted = consolidateCadastroMenus(menus, nextId);
    this.state.update((s) => {
      const next = cloneState(s);
      // Não forçar true: menus sintéticos (Estacionamento promovido) ficam fora do OrganizarMenus.
      next.menus = promoted.menus.map((m) => ({
        ...m,
        existeNoServidor: m.existeNoServidor !== false,
      }));
      next.nextId = promoted.nextId;
      return next;
    });
    this.persist();
    this.syncSessionMenusWithCurrentTree(promoted.menus);
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
      collectSelectedSubMenuIds(menu.subMenus ?? [], selectedSubMenuIds);
    }

    const mapAdminSubToSession = (sub: SubMenuAdmin): SessionSubMenuAccess => ({
      id: sub.id,
      descricao: sub.nome,
      rota: sub.rota,
      ativo: sub.ativo,
      exibirNoSidebar: sub.exibirNoSidebar !== false,
      selecionado: selectedSubMenuIds.has(sub.id),
      ordem: sub.ordem,
      subMenus: (sub.subMenus ?? []).map(mapAdminSubToSession),
    });

    const nextSessionMenus: SessionMenuAccess[] = latestMenus
      .filter((menu) => menu.ativo !== false)
      .sort((a, b) => a.ordem - b.ordem)
      .map((menu) => {
        const subMenus: SessionSubMenuAccess[] = (menu.subMenus ?? [])
          .filter((sub) => sub.ativo !== false)
          .sort((a, b) => a.ordem - b.ordem)
          .map(mapAdminSubToSession);

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
      if (!menu) return;
      const found = findSubMenuById(menu.subMenus, subId);
      if (!found) return;
      menu.subMenus = updateSubMenuInTree(menu.subMenus, subId, patch);
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
      menu.subMenus = removeSubMenuFromTree(menu.subMenus, subId);
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
      const found = menu ? findSubMenuById(menu.subMenus, subId) : null;
      if (!menu || !found) return;
      const sub = found.sub;
      let permissions = [...sub.permissions];
      if (enabled) {
        if (hasMatchingPermissionAcao(permissions, sub.nome, acao)) return;
        const id = s.nextId++;
        permissions.push({
          id,
          ordem: permissions.length,
          subModuleId: subId,
          acao: buildFullAcaoPermissao(sub.nome, acao),
        });
      } else {
        permissions = removePermissionRowsForUi(permissions, sub.nome, acao);
      }
      menu.subMenus = updateSubMenuInTree(menu.subMenus, subId, { permissions });
    });
  }

  selecionarTodasAcoes(menuId: number, subId: number): void {
    this.patch((s) => {
      const menu = s.menus.find((x) => x.id === menuId);
      const found = menu ? findSubMenuById(menu.subMenus, subId) : null;
      if (!menu || !found) return;
      const sub = found.sub;
      const permissions = [...sub.permissions];
      for (const acao of PERMISSOES_ACOES) {
        if (!hasMatchingPermissionAcao(permissions, sub.nome, acao)) {
          const id = s.nextId++;
          permissions.push({
            id,
            ordem: permissions.length,
            subModuleId: subId,
            acao: buildFullAcaoPermissao(sub.nome, acao),
          });
        }
      }
      menu.subMenus = updateSubMenuInTree(menu.subMenus, subId, { permissions });
    });
  }

  /** Substitui permissões do submenu (ex.: após edição em rascunho antes do PUT Alterar). */
  setSubMenuPermissions(menuId: number, subId: number, permissions: MenuPermissionRow[]): void {
    this.patch((s) => {
      const menu = s.menus.find((x) => x.id === menuId);
      if (!menu) return;
      menu.subMenus = updateSubMenuInTree(menu.subMenus, subId, {
        permissions: permissions.map((p, i) => ({
          ...p,
          ordem: i,
          subModuleId: subId,
        })),
      });
    });
  }

  limparAcoes(menuId: number, subId: number): void {
    this.patch((s) => {
      const menu = s.menus.find((x) => x.id === menuId);
      if (!menu) return;
      menu.subMenus = updateSubMenuInTree(menu.subMenus, subId, { permissions: [] });
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
   * Itens para sidebar. Gerenciamento: link único. Cadastro: submenus conforme API/seed.
   */
  getSidebarMenuItems(): {
    label: string;
    route: string;
    icon: string;
    children?: { label: string; route: string; children?: { label: string; route: string }[] }[];
  }[] {
    type NavItem = {
      label: string;
      route: string;
      icon: string;
      children?: { label: string; route: string; children?: { label: string; route: string }[] }[];
    };

    const source = this.sessionAccess.hasSessionMenus()
      ? this.buildNavItemsFromSessionMenus()
      : this.buildNavItemsFromState();

    const hasCadastroMenu = source.some(
      (item) => item.route.replace(/\/+$/, '').toLowerCase() === '/app/cadastro'
    );

    const stripped = source
      .filter((item) => {
        if (!hasCadastroMenu) return true;
        const route = item.route.replace(/\/+$/, '').toLowerCase();
        return !(normMenuLabel(item.label) === 'estacionamento' && route === ESTACIONAMENTO_SIDEBAR_ROUTE);
      })
      .map((item) => ({
        ...item,
        children: (item.children ?? []).length > 0 ? [...item.children!] : undefined,
      }));

    const flattened = stripped.map((item) => {
      if (!this.isGerenciamentoNavItem(item)) return item;
      return {
        label: item.label,
        route: '/app/gerenciamento',
        icon: item.icon,
      };
    });

    const withCadastro = flattened.map((item) => this.sanitizeCadastroSidebarNavItem(item));

    const labeled = withCadastro.map((item) => this.applyDisplayLabelsToNavItem(item));
    return this.ensureMovimentosListaNavItem(labeled);
  }

  /**
   * Garante item "Movimentos" na sidebar logo após "Entrada e Saída"
   * quando a sessão/API ainda não expõe `/app/patio/movimentacoes`.
   */
  private ensureMovimentosListaNavItem<
    T extends { label: string; route: string; icon: string; children?: unknown[] },
  >(items: T[]): T[] {
    const listaRoute = '/app/patio/movimentacoes';
    const entradaRoute = '/app/patio/entrada-saida';

    const hasLista = items.some((item) => this.normalizeSidebarRoute(item.route) === listaRoute);
    if (hasLista) return items;

    const entradaIdx = items.findIndex(
      (item) =>
        this.normalizeSidebarRoute(item.route) === entradaRoute ||
        item.route.startsWith(`${entradaRoute}/`)
    );
    if (entradaIdx < 0) return items;

    const movimentosItem = {
      ...items[entradaIdx],
      label: 'Movimentações',
      route: listaRoute,
      icon: resolveMaterialSymbolIconFromModule('Movimentações', 'format_list_bulleted'),
      children: undefined,
    } as T;

    return [...items.slice(0, entradaIdx + 1), movimentosItem, ...items.slice(entradaIdx + 1)];
  }

  private normalizeSidebarRoute(route: string): string {
    const trimmed = route.trim().replace(/\/+$/, '');
    return trimmed || '/app';
  }

  /** Padroniza rótulos legados da API (ex.: Movimento → Entrada e Saída). */
  private applyDisplayLabelsToNavItem<
    T extends {
      label: string;
      route: string;
      children?: {
        label: string;
        route: string;
        children?: { label: string; route: string }[];
      }[];
    },
  >(item: T): T {
    const children = item.children?.map((c) => {
      const nested = c.children?.map((n) => ({
        ...n,
        label: formatAppMenuDisplayLabel(n.label, n.route),
      }));
      return {
        ...c,
        label: formatAppMenuDisplayLabel(c.label, c.route),
        children: nested?.length ? nested : c.children,
      };
    });
    return {
      ...item,
      label: formatAppMenuDisplayLabel(item.label, item.route),
      children: children?.length ? children : item.children,
    } as T;
  }

  /**
   * Cadastro na sidebar: padroniza rótulos dos submenus.
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
      .map((c) => ({
        ...c,
        label: this.formatCadastroSubmenuSidebarLabel(c.route, c.label),
      }));

    return {
      ...item,
      children: children.length ? children : undefined,
    } as T;
  }

  private formatCadastroSubmenuSidebarLabel(route: string, label: string): string {
    const path = route.replace(/\/+$/, '').toLowerCase();
    if (/(?:^|\/)cadastro\/transportadoras?(?:\/|$)/.test(path)) return 'Transportadoras';
    if (/(?:^|\/)cadastro\/veiculos?(?:\/|$)/.test(path)) return 'Veículos';
    if (/(?:^|\/)cadastro\/motoristas?(?:\/|$)/.test(path)) return 'Motoristas';
    if (/(?:^|\/)cadastro\/estacionamento(?:\/|$)/.test(path)) return 'Estacionamento';
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
          const mapped = this.mapSessionSubToNavChild(sub, menuLabel);
          if (mapped.children?.length) {
            const base = mapped.route.replace(/\/[^/]*$/, '') || mapped.route;
            return {
              label: menuLabel,
              route: base,
              icon,
              children: [mapped],
            };
          }
          return {
            label: menuLabel,
            route: mapped.route,
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
          children: activeSubs.map((s) => this.mapSessionSubToNavChild(s, menuLabel)),
        };
      });
  }

  private mapSessionSubToNavChild(
    sub: SessionSubMenuAccess,
    menuLabel: string
  ): { label: string; route: string; children?: { label: string; route: string }[] } {
    const label = sub.descricao?.trim() || 'submenu';
    const route = resolveAppRouteFromNome(label, sub.rota ?? null);
    const nested = (sub.subMenus ?? [])
      .filter((s) => s.ativo !== false && this.resolveShowInSidebar(s, 'sub'))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((s) => this.mapSessionSubToNavChild(s, menuLabel));
    if (nested.length) {
      return { label, route, children: nested };
    }
    return { label, route };
  }

  private mapAdminSubToNavChild(
    sub: SubMenuAdmin,
    menuLabel: string
  ): { label: string; route: string; children?: { label: string; route: string }[] } {
    const route = resolveAppRouteFromNome(sub.nome, sub.rota);
    const nested = (sub.subMenus ?? [])
      .filter((s) => s.ativo && s.exibirNoSidebar !== false)
      .sort((a, b) => a.ordem - b.ordem)
      .map((s) => this.mapAdminSubToNavChild(s, menuLabel));
    if (nested.length) {
      return { label: sub.nome, route, children: nested };
    }
    return { label: sub.nome, route };
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
          const mapped = this.mapAdminSubToNavChild(subs[0], m.nome);
          if (mapped.children?.length) {
            const base = mapped.route.replace(/\/[^/]*$/, '') || mapped.route;
            return {
              label: m.nome,
              route: base,
              icon: resolveMaterialSymbolIconFromModule(m.nome, m.icone),
              children: [mapped],
            };
          }
          return {
            label: m.nome,
            route: mapped.route,
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
          children: subs.map((s) => this.mapAdminSubToNavChild(s, m.nome)),
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
          let found = false;
          walkSubMenus(menu.subMenus, (sub) => {
            if (sub.id === item.id) found = true;
          });
          if (found) {
            const match = findSubMenuById(menu.subMenus, item.id!);
            if (match) return match.sub.exibirNoSidebar !== false;
          }
        }
      }
    }

    return defaultExibirNoSidebar(item.rota);
  }

  /** Sidebar: Gerenciamento é sempre um único link (sem filhos). */
  private isGerenciamentoNavItem(item: {
    label?: string;
    route: string;
    children?: { route: string; children?: { route: string }[] }[];
  }): boolean {
    if (isEstacionamentoMenuNode(item.label, item.route)) return false;
    if (item.route.startsWith('/app/gerenciamento') && !isEstacionamentoNavRoute(item.route)) {
      return true;
    }
    return (
      item.children?.some((c) => {
        if (isEstacionamentoNavRoute(c.route)) return false;
        if (c.route.startsWith('/app/gerenciamento')) return true;
        return c.children?.some((n) => n.route.startsWith('/app/gerenciamento') && !isEstacionamentoNavRoute(n.route)) ?? false;
      }) ?? false
    );
  }
}
