import type { MenuAdmin, SubMenuAdmin } from '../../../gerenciamento/models/menu-admin.model';
import type { PerfilModuloInput } from '../../services/acessos-perfis.service';

export interface TreePermissaoNode {
  permissaoId: number;
  key: string;
  nome: string;
  selecionado: boolean;
}

export interface TreeSubMenuNode {
  subMenuId: number;
  nome: string;
  selecionado: boolean;
  permissoes: TreePermissaoNode[];
  /** Submenu de 2º nível (menu → submenu → submenu²). */
  subMenus?: TreeSubMenuNode[];
}

export interface TreeMenuNode {
  menuId: number;
  nome: string;
  selecionado: boolean;
  subMenus: TreeSubMenuNode[];
}

interface SelectedLookup {
  selectedMenus: Set<number>;
  selectedSubMenus: Set<number>;
  selectedPermissoes: Set<number>;
}

function mapSubMenuToTreeNode(sub: SubMenuAdmin): TreeSubMenuNode {
  const nested = (sub.subMenus ?? []).map(mapSubMenuToTreeNode);
  return {
    subMenuId: sub.id,
    nome: sub.nome,
    selecionado: false,
    permissoes: (sub.permissions ?? []).map((permission) => ({
      permissaoId: permission.id,
      key: (permission.acao ?? '').trim(),
      nome: (permission.acao ?? '').trim(),
      selecionado: false,
    })),
    subMenus: nested.length ? nested : undefined,
  };
}

export function buildPermissionTreeFromCatalog(catalog: MenuAdmin[]): TreeMenuNode[] {
  return catalog.map((menu) => ({
    menuId: menu.id,
    nome: menu.nome,
    selecionado: false,
    subMenus: (menu.subMenus ?? []).map(mapSubMenuToTreeNode),
  }));
}

function seedSubMenuNode(
  subMenu: TreeSubMenuNode,
  lookup: SelectedLookup,
  selectedKeys: Set<string>
): TreeSubMenuNode {
  const subSelectedFromFlag = lookup.selectedSubMenus.has(subMenu.subMenuId);
  const permissoes = subMenu.permissoes.map((permission) => {
    const keySelected = permission.key ? selectedKeys.has(permission.key.toLowerCase()) : false;
    const selected = lookup.selectedPermissoes.has(permission.permissaoId) || keySelected;
    return { ...permission, selecionado: selected };
  });
  const nested = (subMenu.subMenus ?? []).map((child) =>
    seedSubMenuNode(child, lookup, selectedKeys)
  );
  return {
    ...subMenu,
    selecionado: subSelectedFromFlag,
    permissoes,
    subMenus: nested.length ? nested : undefined,
  };
}

export function buildPermissionTreeState(
  catalog: MenuAdmin[],
  roleMenus: unknown[] | null,
  selectedPermissionKeys: string[]
): TreeMenuNode[] {
  const lookup = extractSelectionLookup(roleMenus);
  const selectedKeys = new Set(selectedPermissionKeys.map((k) => k.trim().toLowerCase()).filter(Boolean));
  const baseTree = buildPermissionTreeFromCatalog(catalog);

  return baseTree.map((menu) => {
    const menuSelectedFromFlag = lookup.selectedMenus.has(menu.menuId);
    const subMenus = menu.subMenus.map((subMenu) => seedSubMenuNode(subMenu, lookup, selectedKeys));
    return {
      ...menu,
      selecionado: menuSelectedFromFlag,
      subMenus,
    };
  });
}

function mapSubMenuToggle(
  subMenus: TreeSubMenuNode[],
  subMenuId: number,
  selecionado: boolean
): TreeSubMenuNode[] {
  const toggleBranch = (sub: TreeSubMenuNode): TreeSubMenuNode => ({
    ...sub,
    selecionado,
    permissoes: sub.permissoes.map((permission) => ({ ...permission, selecionado })),
    subMenus: sub.subMenus?.map(toggleBranch),
  });

  return subMenus.map((subMenu) => {
    if (subMenu.subMenuId === subMenuId) {
      return toggleBranch(subMenu);
    }
    if (subMenu.subMenus?.length) {
      return { ...subMenu, subMenus: mapSubMenuToggle(subMenu.subMenus, subMenuId, selecionado) };
    }
    return subMenu;
  });
}

function isSubMenuBranchSelected(subMenu: TreeSubMenuNode): boolean {
  if (subMenu.selecionado) return true;
  if (subMenu.permissoes.some((p) => p.selecionado)) return true;
  return (subMenu.subMenus ?? []).some(isSubMenuBranchSelected);
}

export function toggleMenuSelection(
  tree: TreeMenuNode[],
  menuId: number,
  selecionado: boolean
): TreeMenuNode[] {
  return tree.map((menu) => {
    if (menu.menuId !== menuId) return menu;
    const toggleBranch = (sub: TreeSubMenuNode): TreeSubMenuNode => ({
      ...sub,
      selecionado,
      permissoes: sub.permissoes.map((permission) => ({ ...permission, selecionado })),
      subMenus: sub.subMenus?.map(toggleBranch),
    });
    return {
      ...menu,
      selecionado,
      subMenus: menu.subMenus.map(toggleBranch),
    };
  });
}

export function toggleSubMenuSelection(
  tree: TreeMenuNode[],
  menuId: number,
  subMenuId: number,
  selecionado: boolean
): TreeMenuNode[] {
  return tree.map((menu) => {
    if (menu.menuId !== menuId) return menu;
    const subMenus = mapSubMenuToggle(menu.subMenus, subMenuId, selecionado);
    const anyChildSelected = subMenus.some(isSubMenuBranchSelected);
    return {
      ...menu,
      selecionado: selecionado ? true : anyChildSelected,
      subMenus,
    };
  });
}

function mapPermissaoToggle(
  subMenus: TreeSubMenuNode[],
  subMenuId: number,
  permissaoId: number,
  selecionado: boolean
): TreeSubMenuNode[] {
  return subMenus.map((subMenu) => {
    if (subMenu.subMenuId === subMenuId) {
      const permissoes = subMenu.permissoes.map((permission) =>
        permission.permissaoId === permissaoId ? { ...permission, selecionado } : permission
      );
      const anyPermSelected = permissoes.some((p) => p.selecionado);
      return {
        ...subMenu,
        selecionado: anyPermSelected,
        permissoes,
      };
    }
    if (subMenu.subMenus?.length) {
      return {
        ...subMenu,
        subMenus: mapPermissaoToggle(subMenu.subMenus, subMenuId, permissaoId, selecionado),
      };
    }
    return subMenu;
  });
}

export function togglePermissaoSelection(
  tree: TreeMenuNode[],
  menuId: number,
  subMenuId: number,
  permissaoId: number,
  selecionado: boolean
): TreeMenuNode[] {
  return tree.map((menu) => {
    if (menu.menuId !== menuId) return menu;
    const subMenus = mapPermissaoToggle(menu.subMenus, subMenuId, permissaoId, selecionado);
    const anyChildSelected = subMenus.some(isSubMenuBranchSelected);
    return {
      ...menu,
      selecionado: anyChildSelected,
      subMenus,
    };
  });
}

function permissionActionKey(permission: TreePermissaoNode): string {
  const raw = (permission.key || permission.nome || '').trim().toLowerCase();
  if (!raw) return '';
  const parts = raw.split('.');
  return parts[parts.length - 1] ?? raw;
}

function mapActionToggleInBranch(
  subMenus: TreeSubMenuNode[],
  action: string,
  selecionado: boolean
): TreeSubMenuNode[] {
  const actionNorm = action.trim().toLowerCase();
  return subMenus.map((subMenu) => {
    const permissoes = subMenu.permissoes.map((permission) =>
      permissionActionKey(permission) === actionNorm
        ? { ...permission, selecionado }
        : permission
    );
    const nested = subMenu.subMenus?.length
      ? mapActionToggleInBranch(subMenu.subMenus, actionNorm, selecionado)
      : subMenu.subMenus;
    const anySelected =
      permissoes.some((p) => p.selecionado) || (nested ?? []).some(isSubMenuBranchSelected);
    return {
      ...subMenu,
      selecionado: anySelected,
      permissoes,
      subMenus: nested,
    };
  });
}

/** Marca/desmarca todas as ações iguais (ex.: visualizar) dentro de um módulo. */
export function toggleActionColumnInMenu(
  tree: TreeMenuNode[],
  menuId: number,
  action: string,
  selecionado: boolean
): TreeMenuNode[] {
  return tree.map((menu) => {
    if (menu.menuId !== menuId) return menu;
    const subMenus = mapActionToggleInBranch(menu.subMenus, action, selecionado);
    return {
      ...menu,
      selecionado: subMenus.some(isSubMenuBranchSelected),
      subMenus,
    };
  });
}

export function setAllPermissionsInTree(tree: TreeMenuNode[], selecionado: boolean): TreeMenuNode[] {
  const toggleBranch = (sub: TreeSubMenuNode): TreeSubMenuNode => ({
    ...sub,
    selecionado,
    permissoes: sub.permissoes.map((permission) => ({ ...permission, selecionado })),
    subMenus: sub.subMenus?.map(toggleBranch),
  });
  return tree.map((menu) => ({
    ...menu,
    selecionado,
    subMenus: menu.subMenus.map(toggleBranch),
  }));
}

export function countPermissionsInMenu(menu: TreeMenuNode): { total: number; selected: number } {
  let total = 0;
  let selected = 0;
  for (const sub of flattenTreeSubMenus(menu.subMenus)) {
    for (const permission of sub.permissoes) {
      total += 1;
      if (permission.selecionado) selected += 1;
    }
  }
  return { total, selected };
}

export function countMenusInTree(tree: TreeMenuNode[]): { total: number; selected: number } {
  let total = 0;
  let selected = 0;
  for (const menu of tree) {
    for (const sub of flattenTreeSubMenus(menu.subMenus)) {
      total += 1;
      if (sub.selecionado || sub.permissoes.some((p) => p.selecionado)) selected += 1;
    }
  }
  return { total, selected };
}

export function countTotalPermissionsInTree(tree: TreeMenuNode[]): number {
  let total = 0;
  for (const menu of tree) {
    total += countPermissionsInMenu(menu).total;
  }
  return total;
}

export function findPermissionByAction(
  subMenu: TreeSubMenuNode,
  action: string
): TreePermissaoNode | undefined {
  const actionNorm = action.trim().toLowerCase();
  return subMenu.permissoes.find((p) => permissionActionKey(p) === actionNorm);
}

export function getExtraPermissions(subMenu: TreeSubMenuNode): TreePermissaoNode[] {
  const padrao = new Set(['visualizar', 'gravar', 'alterar', 'excluir']);
  return subMenu.permissoes.filter((p) => !padrao.has(permissionActionKey(p)));
}

export function isActionColumnFullySelected(menu: TreeMenuNode, action: string): boolean {
  const actionNorm = action.trim().toLowerCase();
  const relevant = flattenTreeSubMenus(menu.subMenus).flatMap((sub) =>
    sub.permissoes.filter((p) => permissionActionKey(p) === actionNorm)
  );
  return relevant.length > 0 && relevant.every((p) => p.selecionado);
}

export function isActionColumnIndeterminate(menu: TreeMenuNode, action: string): boolean {
  const actionNorm = action.trim().toLowerCase();
  const relevant = flattenTreeSubMenus(menu.subMenus).flatMap((sub) =>
    sub.permissoes.filter((p) => permissionActionKey(p) === actionNorm)
  );
  if (relevant.length === 0) return false;
  const selected = relevant.filter((p) => p.selecionado).length;
  return selected > 0 && selected < relevant.length;
}

function flattenTreeSubMenus(subMenus: TreeSubMenuNode[]): TreeSubMenuNode[] {
  const out: TreeSubMenuNode[] = [];
  const walk = (items: TreeSubMenuNode[]) => {
    for (const item of items) {
      out.push(item);
      if (item.subMenus?.length) walk(item.subMenus);
    }
  };
  walk(subMenus);
  return out;
}

export function mapTreeToPerfilMenusPayload(tree: TreeMenuNode[]): PerfilModuloInput[] {
  return tree
    .filter((menu) => menu.menuId > 0)
    .map((menu) => ({
      menuId: menu.menuId,
      selecionado: menu.selecionado,
      subMenus: flattenTreeSubMenus(menu.subMenus)
        .filter((subMenu) => subMenu.subMenuId > 0)
        .map((subMenu) => ({
          subMenuId: subMenu.subMenuId,
          selecionado: subMenu.selecionado,
          permissoes: subMenu.permissoes
            .filter((permission) => permission.permissaoId > 0)
            .map((permission) => ({
              permissaoId: permission.permissaoId,
              selecionado: permission.selecionado,
            })),
        })),
    }));
}

export function getSelectedPermissionKeys(tree: TreeMenuNode[]): string[] {
  return tree.flatMap((menu) =>
    flattenTreeSubMenus(menu.subMenus).flatMap((subMenu) =>
      subMenu.permissoes
        .filter((permission) => permission.selecionado && permission.key)
        .map((permission) => permission.key)
    )
  );
}

export function getSelectedPermissionCount(tree: TreeMenuNode[]): number {
  let total = 0;
  for (const menu of tree) {
    for (const subMenu of flattenTreeSubMenus(menu.subMenus)) {
      for (const permission of subMenu.permissoes) {
        if (permission.selecionado) total += 1;
      }
    }
  }
  return total;
}

export function hasAnyPermissionSelected(tree: TreeMenuNode[]): boolean {
  return getSelectedPermissionCount(tree) > 0;
}

export function getSelectedMenuCount(tree: TreeMenuNode[]): number {
  return tree.filter((menu) => menu.selecionado).length;
}

export function hasAnyMenuSelected(tree: TreeMenuNode[]): boolean {
  return getSelectedMenuCount(tree) > 0;
}

function extractSelectionLookup(roleMenus: unknown[] | null): SelectedLookup {
  const selectedMenus = new Set<number>();
  const selectedSubMenus = new Set<number>();
  const selectedPermissoes = new Set<number>();

  const walkSubMenusFromApi = (subMenus: unknown[]) => {
    for (const subMenu of subMenus) {
      if (!subMenu || typeof subMenu !== 'object') continue;
      const subRec = subMenu as Record<string, unknown>;
      const subMenuId = toOptionalNumber(subRec['subMenuId'] ?? subRec['id']);
      if (
        subMenuId != null &&
        readBoolean(subRec, 'subSelecionado', 'selecionadoSub', 'selecionado', 'selected')
      ) {
        selectedSubMenus.add(subMenuId);
      }

      const permissoes = getArray(
        subRec,
        'permissoes',
        'permissions',
        'Permissoes',
        'Permissions'
      );
      for (const permissao of permissoes) {
        if (!permissao || typeof permissao !== 'object') continue;
        const permissaoRec = permissao as Record<string, unknown>;
        const permissaoId = toOptionalNumber(
          permissaoRec['permissaoId'] ?? permissaoRec['permissionId'] ?? permissaoRec['id']
        );
        const permissionSelected = readBoolean(
          permissaoRec,
          'selecionadoPerm',
          'selecionado',
          'permSelecionado',
          'selected'
        );
        if (permissionSelected && permissaoId != null) {
          selectedPermissoes.add(permissaoId);
        }
      }

      const nested = getArray(subRec, 'subMenus', 'submenus', 'subModules', 'submodulos', 'SubMenus');
      if (nested.length) walkSubMenusFromApi(nested);
    }
  };

  for (const menu of roleMenus ?? []) {
    if (!menu || typeof menu !== 'object') continue;
    const menuRec = menu as Record<string, unknown>;
    const menuId = toOptionalNumber(menuRec['menuId'] ?? menuRec['id']);
    if (menuId != null && readBoolean(menuRec, 'selecionado', 'selected')) {
      selectedMenus.add(menuId);
    }

    const subMenus = getArray(menuRec, 'subMenus', 'submenus', 'subModules', 'submodulos', 'SubMenus');
    walkSubMenusFromApi(subMenus);
  }

  return { selectedMenus, selectedSubMenus, selectedPermissoes };
}

function readBoolean(record: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((key) => record[key] === true);
}

function getArray(record: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}
