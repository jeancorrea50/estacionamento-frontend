import type { MenuAdmin } from '../../../gerenciamento/models/menu-admin.model';
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

export function buildPermissionTreeFromCatalog(catalog: MenuAdmin[]): TreeMenuNode[] {
  return catalog.map((menu) => ({
    menuId: menu.id,
    nome: menu.nome,
    selecionado: false,
    subMenus: (menu.subMenus ?? []).map((sub) => ({
      subMenuId: sub.id,
      nome: sub.nome,
      selecionado: false,
      permissoes: (sub.permissions ?? []).map((permission) => ({
        permissaoId: permission.id,
        key: (permission.acao ?? '').trim(),
        nome: (permission.acao ?? '').trim(),
        selecionado: false,
      })),
    })),
  }));
}

export function buildPermissionTreeState(
  catalog: MenuAdmin[],
  roleMenus: unknown[] | null,
  selectedPermissionKeys: string[]
): TreeMenuNode[] {
  const lookup = extractSelectionLookup(roleMenus);
  const selectedKeys = new Set(selectedPermissionKeys.map((k) => k.trim().toLowerCase()).filter(Boolean));
  const baseTree = buildPermissionTreeFromCatalog(catalog);

  const seeded = baseTree.map((menu) => {
    const menuSelectedFromFlag = lookup.selectedMenus.has(menu.menuId);
    const subMenus = menu.subMenus.map((subMenu) => {
      const subSelectedFromFlag = lookup.selectedSubMenus.has(subMenu.subMenuId);
      const permissoes = subMenu.permissoes.map((permission) => {
        const keySelected = permission.key ? selectedKeys.has(permission.key.toLowerCase()) : false;
        const selected = lookup.selectedPermissoes.has(permission.permissaoId) || keySelected;

        return { ...permission, selecionado: selected };
      });
      const selecionado = subSelectedFromFlag;
      return { ...subMenu, selecionado, permissoes };
    });

    const selecionado = menuSelectedFromFlag;
    return { ...menu, selecionado, subMenus };
  });

  return seeded;
}

export function toggleMenuSelection(
  tree: TreeMenuNode[],
  menuId: number,
  selecionado: boolean
): TreeMenuNode[] {
  return tree.map((menu) => {
    if (menu.menuId !== menuId) return menu;
    return {
      ...menu,
      selecionado,
      subMenus: menu.subMenus.map((subMenu) => ({
        ...subMenu,
        selecionado,
        permissoes: subMenu.permissoes.map((permission) => ({
          ...permission,
          selecionado,
        })),
      })),
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
    const subMenus = menu.subMenus.map((subMenu) => {
      if (subMenu.subMenuId !== subMenuId) return subMenu;
      return {
        ...subMenu,
        selecionado,
        permissoes: subMenu.permissoes.map((permission) => ({
          ...permission,
          selecionado,
        })),
      };
    });
    const anyChildSelected = subMenus.some(
      (sub) => sub.selecionado || sub.permissoes.some((p) => p.selecionado)
    );
    return {
      ...menu,
      selecionado: selecionado ? true : anyChildSelected,
      subMenus,
    };
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
    const subMenus = menu.subMenus.map((subMenu) => {
      if (subMenu.subMenuId !== subMenuId) return subMenu;
      const permissoes = subMenu.permissoes.map((permission) =>
        permission.permissaoId === permissaoId
          ? { ...permission, selecionado }
          : permission
      );
      const anyPermSelected = permissoes.some((p) => p.selecionado);
      return {
        ...subMenu,
        // Marca o submenu quando há permissão marcada; limpa se nenhuma restar.
        selecionado: anyPermSelected,
        permissoes,
      };
    });
    const anyChildSelected = subMenus.some(
      (sub) => sub.selecionado || sub.permissoes.some((p) => p.selecionado)
    );
    return {
      ...menu,
      selecionado: anyChildSelected,
      subMenus,
    };
  });
}

export function mapTreeToPerfilMenusPayload(tree: TreeMenuNode[]): PerfilModuloInput[] {
  return tree
    .filter((menu) => menu.menuId > 0)
    .map((menu) => ({
      menuId: menu.menuId,
      selecionado: menu.selecionado,
      subMenus: menu.subMenus
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
    menu.subMenus.flatMap((subMenu) =>
      subMenu.permissoes
        .filter((permission) => permission.selecionado && permission.key)
        .map((permission) => permission.key)
    )
  );
}

export function getSelectedPermissionCount(tree: TreeMenuNode[]): number {
  let total = 0;
  for (const menu of tree) {
    for (const subMenu of menu.subMenus) {
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

  for (const menu of roleMenus ?? []) {
    if (!menu || typeof menu !== 'object') continue;
    const menuRec = menu as Record<string, unknown>;
    const menuId = toOptionalNumber(menuRec['menuId'] ?? menuRec['id']);
    if (menuId != null && readBoolean(menuRec, 'selecionado', 'selected')) {
      selectedMenus.add(menuId);
    }

    const subMenus = getArray(menuRec, 'subMenus', 'submenus', 'subModules', 'submodulos', 'SubMenus');
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
    }
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
