import type { MenuAdmin, MenuPermissionRow, SubMenuAdmin } from '../models/menu-admin.model';
import type { MenuCreateInput, MenuUpdateInput, PermissionInput, SubMenuCreateInput } from './menu-api.types';
import { flattenSubMenus, nestSubMenusByRoute, walkSubMenus } from './menu-tree.util';
import { resolveAppRouteFromNome, resolveMaterialSymbolIconFromModule } from './menu-route-resolver';
import { normalizeFaturamentoAppRoute } from '../../financeiro/faturamento-rotas';
import { readBoolProp, resolveExibirNoSidebar } from './menu-sidebar-visibility';

function getProp(row: Record<string, unknown>, k: string): unknown {
  return row[k] ?? row[k.charAt(0).toUpperCase() + k.slice(1)];
}

/** Extrai lista de menus do corpo da Buscar (vários formatos comuns da API). */
export function extractMenuArrayFromBuscar(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    for (const key of ['result', 'results', 'items', 'itens', 'data', 'menus', 'Menus']) {
      const v = o[key];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

function mapPermissionRow(row: Record<string, unknown>, subId: number, index: number): MenuPermissionRow {
  const id = Number(getProp(row, 'id')) || 0;
  const acao = getProp(row, 'acao') ?? getProp(row, 'descricao');
  return {
    id,
    ordem: Number(getProp(row, 'ordem')) ?? index,
    subModuleId: Number(getProp(row, 'subModuleId')) || subId,
    acao: String(acao ?? ''),
  };
}

function nomeOuDescricao(row: Record<string, unknown>): string {
  const n = getProp(row, 'nome') ?? getProp(row, 'Nome');
  if (n != null && String(n).trim() !== '') return String(n);
  return String(getProp(row, 'descricao') ?? getProp(row, 'Descricao') ?? '');
}

function mapSubMenuRow(row: Record<string, unknown>, fallbackOrdem: number): SubMenuAdmin {
  const id = Number(getProp(row, 'id')) || 0;
  const permRaw = getProp(row, 'permissions') ?? getProp(row, 'Permissions');
  const arr = Array.isArray(permRaw) ? permRaw : [];
  const permissions = arr.map((p, i) =>
    mapPermissionRow(p as Record<string, unknown>, id, i)
  );
  const ativo = getProp(row, 'ativo');
  const Ativo = getProp(row, 'Ativo');
  const nome = nomeOuDescricao(row);
  const rawRota = getProp(row, 'rota') ?? getProp(row, 'Rota');
  const rotaApi = rawRota == null ? null : String(rawRota).trim();
  // Quando a API já devolve rota, preserva o cadastro do servidor (não reescreve pelo slug legado).
  const rota = rotaApi
    ? normalizeFaturamentoAppRoute(rotaApi) ?? rotaApi
    : resolveAppRouteFromNome(nome, null);
  const fromApi = readBoolProp(row as Record<string, unknown>, [
    'exibirNoSidebar',
    'mostrarSidebar',
    'exibeSidebar',
    'sidebar',
  ]);
  return {
    id,
    nome,
    ordem: Number(getProp(row, 'ordem')) ?? fallbackOrdem,
    rota,
    ativo: ativo !== false && Ativo !== false,
    exibirNoSidebar: resolveExibirNoSidebar({ id, kind: 'sub', rota, fromApi }),
    permissions,
  };
}

function mapMenuRow(row: Record<string, unknown>): MenuAdmin {
  const id = Number(getProp(row, 'id')) || 0;
  const subRaw =
    getProp(row, 'subMenus') ??
    getProp(row, 'SubMenus') ??
    getProp(row, 'subModules') ??
    getProp(row, 'SubModules');
  const subs = (Array.isArray(subRaw) ? subRaw : []).map((s, i) =>
    mapSubMenuRow(s as Record<string, unknown>, i)
  );
  const ativo = getProp(row, 'ativo');
  const Ativo = getProp(row, 'Ativo');
  const nomeMenu = nomeOuDescricao(row);
  const rawIcone = getProp(row, 'icone') ?? getProp(row, 'Icone');
  const rawMenuRota = getProp(row, 'rota') ?? getProp(row, 'Rota');
  const rotaApi = rawMenuRota == null ? null : String(rawMenuRota).trim();
  const rota = rotaApi
    ? normalizeFaturamentoAppRoute(rotaApi) ?? rotaApi
    : resolveAppRouteFromNome(nomeMenu, null);
  const fromApi = readBoolProp(row as Record<string, unknown>, [
    'exibirNoSidebar',
    'mostrarSidebar',
    'exibeSidebar',
    'sidebar',
  ]);
  return {
    id,
    nome: nomeMenu,
    ordem: Number(getProp(row, 'ordem')) ?? 0,
    icone: resolveMaterialSymbolIconFromModule(
      nomeMenu,
      rawIcone == null ? null : String(rawIcone)
    ),
    rota,
    ativo: ativo !== false && Ativo !== false,
    exibirNoSidebar: resolveExibirNoSidebar({ id, kind: 'menu', rota, fromApi }),
    subMenus: nestSubMenusByRoute(subs),
    existeNoServidor: true,
  };
}

/** Converte resposta da Buscar em lista de MenuAdmin. */
export function mapBuscarResponseToMenuAdmins(body: unknown): MenuAdmin[] {
  return extractMenuArrayFromBuscar(body).map((row) => mapMenuRow(row as Record<string, unknown>));
}

/** Próximo id local após hidratar (max id + 1). */
export function computeNextIdFromMenus(menus: MenuAdmin[]): number {
  let max = 0;
  for (const m of menus) {
    max = Math.max(max, m.id);
    walkSubMenus(m.subMenus ?? [], (s) => {
      max = Math.max(max, s.id);
      for (const p of s.permissions) max = Math.max(max, p.id);
    });
  }
  return max + 1;
}

function toPermissionInput(p: MenuPermissionRow): PermissionInput {
  return {
    id: p.id > 0 ? p.id : 0,
    ordem: p.ordem,
    subModuleId: p.subModuleId > 0 ? p.subModuleId : 0,
    descricao: String(p.acao ?? '').trim().toLowerCase(),
  };
}

function sidebarPayload(exibir: boolean): Pick<SubMenuCreateInput, 'exibirNoSidebar' | 'mostrarSidebar'> {
  return { exibirNoSidebar: exibir, mostrarSidebar: exibir };
}

/** Payload para **Alterar** — mantém ids do servidor/front sincronizados. */
function toSubMenuInputForUpdate(
  s: SubMenuAdmin,
  options?: { includePermissions?: boolean }
): SubMenuCreateInput {
  const includePermissions = options?.includePermissions === true;
  const base: SubMenuCreateInput = {
    id: s.id,
    nome: s.nome,
    descricao: s.nome,
    ordem: s.ordem,
    rota: s.rota?.trim() || resolveAppRouteFromNome(s.nome, null),
    ativo: s.ativo !== false,
    ...sidebarPayload(s.exibirNoSidebar !== false),
  };
  if (!includePermissions) return base;
  return {
    ...base,
    permissions: (s.permissions ?? []).map(toPermissionInput),
  };
}

/**
 * Payload para **Gravar** (criação) — ids zerados para o AutoMapper tratar como novo registro.
 */
function toSubMenuInputForInsert(s: SubMenuAdmin): SubMenuCreateInput {
  return {
    id: 0,
    nome: s.nome,
    descricao: s.nome,
    ordem: s.ordem,
    permissions: (s.permissions ?? []).map((p, i) => ({
      id: 0,
      ordem: p.ordem ?? i,
      subModuleId: 0,
      descricao: String(p.acao ?? '').trim().toLowerCase(),
    })),
    rota: s.rota?.trim() || resolveAppRouteFromNome(s.nome, null),
    ativo: s.ativo !== false,
    ...sidebarPayload(s.exibirNoSidebar !== false),
  };
}

/** Criação no servidor: sem ids locais (evita confundir com Update no backend). */
export function menuAdminToCreateInput(m: MenuAdmin): MenuCreateInput {
  return {
    id: 0,
    nome: m.nome,
    descricao: m.nome,
    ordem: m.ordem,
    rota: m.rota?.trim() ? m.rota.trim() : undefined,
    ativo: m.ativo,
    ...sidebarPayload(m.exibirNoSidebar !== false),
    subMenus: flattenSubMenus(m.subMenus).map(toSubMenuInputForInsert),
  };
}

export function menuAdminToUpdateInput(
  m: MenuAdmin,
  options?: { includePermissions?: boolean; permissionSubMenuId?: number; permissionSubMenuNome?: string }
): MenuUpdateInput {
  const includePermissions = options?.includePermissions === true;
  const permissionSubMenuId = options?.permissionSubMenuId;
  const permissionSubMenuNome = options?.permissionSubMenuNome?.trim().toLowerCase() ?? '';

  const shouldIncludePermissions = (sub: SubMenuAdmin): boolean => {
    if (!includePermissions) return false;
    if (permissionSubMenuId == null && !permissionSubMenuNome) return true;
    if (permissionSubMenuId != null) {
      if (permissionSubMenuId === sub.id) return true;
      if (permissionSubMenuId === 0 && sub.id === 0 && permissionSubMenuNome) {
        return sub.nome.trim().toLowerCase() === permissionSubMenuNome;
      }
      return false;
    }
    return sub.nome.trim().toLowerCase() === permissionSubMenuNome;
  };

  return {
    id: m.id,
    nome: m.nome,
    descricao: m.nome,
    ordem: m.ordem,
    rota: m.rota?.trim() ? m.rota.trim() : undefined,
    ativo: m.ativo !== false,
    ...sidebarPayload(m.exibirNoSidebar !== false),
    subMenus: m.subMenus.map((s) =>
      toSubMenuInputForUpdate(s, {
        includePermissions: shouldIncludePermissions(s),
      })
    ),
  };
}
