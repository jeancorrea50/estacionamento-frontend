import { Injectable, computed, signal } from '@angular/core';
import { normalizeLegacyAppRoute } from '../utils/app-route-normalizer';
import { CADASTRO_ESTACIONAMENTOS_ROUTE } from '../../features/cadastro/cadastro-rotas';
import { nestSubMenusByRouteGeneric } from '../../features/gerenciamento/services/menu-tree.util';
import {
  formatAppMenuDisplayLabel,
  resolveAppRouteFromNome,
} from '../../features/gerenciamento/services/menu-route-resolver';

const SESSION_MENUS_STORAGE_KEY = 'gts-session-menus-v1';

export interface SessionSubMenuAccess {
  id?: number;
  descricao?: string | null;
  rota?: string | null;
  ativo?: boolean | null;
  /** Se false, o item não aparece na sidebar (pode continuar acessível por rota/permissão). */
  exibirNoSidebar?: boolean | null;
  selecionado?: boolean | null;
  ordem?: number | null;
  /** Submenu de 2º nível (menu → submenu → submenu²). */
  subMenus?: SessionSubMenuAccess[] | null;
}

export interface SessionMenuAccess {
  id?: number;
  descricao?: string | null;
  icone?: string | null;
  rota?: string | null;
  ativo?: boolean | null;
  /** Se false, o item não aparece na sidebar (pode continuar acessível por rota/permissão). */
  exibirNoSidebar?: boolean | null;
  selecionado?: boolean | null;
  ordem?: number | null;
  subMenus?: SessionSubMenuAccess[] | null;
}

@Injectable({ providedIn: 'root' })
export class SessionAccessService {
  private readonly menusState = signal<SessionMenuAccess[]>(this.loadMenus());

  readonly menus = this.menusState.asReadonly();
  readonly hasSessionMenus = computed(() => this.menusState().length > 0);
  readonly allowedRoutes = computed(() => this.buildAllowedRoutes(this.menusState()));

  setMenus(menus: SessionMenuAccess[]): void {
    const normalized = normalizeMenus(menus);
    this.menusState.set(normalized);
    try {
      localStorage.setItem(SESSION_MENUS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
  }

  clear(): void {
    this.menusState.set([]);
    try {
      localStorage.removeItem(SESSION_MENUS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /**
   * Verifica se a URL atual está entre as rotas liberadas no payload `menus` do login.
   * Sem menus na sessão (legado/dev), libera o acesso.
   */
  canAccessRoute(url: string): boolean {
    if (!this.hasSessionMenus()) {
      return true;
    }
    const allowed = this.allowedRoutes();
    if (allowed.length === 0) {
      return false;
    }
    const current = normalizeRoute(url);
    if (current === '/app' || current === '') {
      return true;
    }
    if (allowed.some((route) => isRouteMatch(current, route))) {
      return true;
    }
    /** Lista em Gerenciamento espelha o mesmo acesso da rota canônica em Cadastro. */
    if (current === '/app/gerenciamento/estacionamento') {
      return allowed.some((route) => {
        const r = normalizeRoute(route);
        return r === CADASTRO_ESTACIONAMENTOS_ROUTE || r.startsWith(`${CADASTRO_ESTACIONAMENTOS_ROUTE}/`)
          || r === '/app/cadastro/estacionamento' || r.startsWith('/app/cadastro/estacionamento/');
      });
    }
    return false;
  }

  getDefaultRoute(): string | null {
    const allowed = this.allowedRoutes();
    return allowed[0] ?? null;
  }

  /**
   * Filtra itens da sidebar FIXA pelas rotas permitidas na sessão.
   * Suporta um nível extra de filhos (ex.: Configuração sob Faturamento).
   * Grupo sem nenhum filho liberado é ocultado.
   */
  filterSidebarItems<
    T extends {
      route: string;
      children?: { route: string; label?: string; children?: { route: string }[] }[];
    },
  >(items: T[]): T[] {
    if (!this.hasSessionMenus()) {
      return items;
    }

    const allowed = this.allowedRoutes();
    const hasRoute = (route: string): boolean => {
      const normalized = normalizeRoute(route);
      return allowed.some((r) => isRouteMatch(normalized, r));
    };

    return items
      .map((item) => {
        if (!item.children?.length) {
          return hasRoute(item.route) ? item : null;
        }

        const children = item.children
          .map((child) => {
            if (child.children?.length) {
              const nestedVisible = child.children.filter((n) => hasRoute(n.route));
              if (nestedVisible.length > 0) {
                return { ...child, children: nestedVisible };
              }
              return hasRoute(child.route) ? { ...child, children: undefined } : null;
            }
            return hasRoute(child.route) ? child : null;
          })
          .filter((child): child is NonNullable<typeof child> => child !== null);

        if (children.length === 0) {
          return null;
        }
        return { ...item, children } as T;
      })
      .filter((item): item is T => item !== null);
  }

  private loadMenus(): SessionMenuAccess[] {
    try {
      const raw = localStorage.getItem(SESSION_MENUS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SessionMenuAccess[];
      if (!Array.isArray(parsed)) return [];
      const normalized = normalizeMenus(parsed);
      // Regrava sessão com rotas canônicas (ex.: financeiro → faturamento) após deploy.
      try {
        localStorage.setItem(SESSION_MENUS_STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        /* ignore */
      }
      return normalized;
    } catch {
      return [];
    }
  }

  private buildAllowedRoutes(menus: SessionMenuAccess[]): string[] {
    const routeSet = new Set<string>();

    for (const menu of menus) {
      if (menu.ativo === false || menu.selecionado === false) continue;
      const subMenus = Array.isArray(menu.subMenus) ? menu.subMenus : [];
      const activeSubs = subMenus.filter((s) => s.ativo !== false && s.selecionado !== false);

      if (activeSubs.length === 0) {
        const route = resolveAppRouteFromNome(safeText(menu.descricao), menu.rota ?? null);
        addRouteWithAncestors(routeSet, route);
        continue;
      }

      for (const sub of activeSubs) {
        collectSessionSubRoutes(sub, routeSet, safeText(menu.descricao));
      }
    }

    return [...routeSet];
  }
}

function collectSessionSubRoutes(
  sub: SessionSubMenuAccess,
  routeSet: Set<string>,
  menuLabel: string
): void {
  if (sub.ativo === false || sub.selecionado === false) return;
  const route = resolveAppRouteFromNome(safeText(sub.descricao), sub.rota ?? null);
  addRouteWithAncestors(routeSet, route);
  for (const nested of sub.subMenus ?? []) {
    collectSessionSubRoutes(nested, routeSet, menuLabel);
  }
}

function normalizeSessionSubMenus(subs: SessionSubMenuAccess[]): SessionSubMenuAccess[] {
  const mapped = subs.map((sub) => normalizeSessionSubMenu(sub));
  return nestSubMenusByRouteGeneric(mapped);
}

function normalizeSessionSubMenu(sub: SessionSubMenuAccess): SessionSubMenuAccess {
  const rota = normalizeOptionalRoute(sub.rota);
  const nestedRaw = sub.subMenus ?? [];
  const nested = nestedRaw.length ? normalizeSessionSubMenus(nestedRaw) : [];
  return {
    ...sub,
    descricao: safeText(sub.descricao),
    rota,
    selecionado: normalizeBoolean(sub.selecionado),
    subMenus: nested.length ? nested : undefined,
  };
}

function normalizeMenus(menus: SessionMenuAccess[]): SessionMenuAccess[] {
  return menus.map((menu) => {
    const rota = normalizeOptionalRoute(menu.rota);
    const descricaoRaw = safeText(menu.descricao);
    return {
      ...menu,
      descricao: formatAppMenuDisplayLabel(descricaoRaw, rota) || descricaoRaw,
      rota,
      selecionado: normalizeBoolean(menu.selecionado),
      subMenus: normalizeSessionSubMenus(menu.subMenus ?? []),
    };
  });
}

function normalizeOptionalRoute(route: string | null | undefined): string | null {
  if (typeof route !== 'string') return null;
  const value = route.trim();
  if (!value) return null;
  return normalizeLegacyAppRoute(value) ?? value;
}

function normalizeBoolean(value: boolean | null | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function addRouteWithAncestors(set: Set<string>, route: string): void {
  const normalized = normalizeRoute(route);
  if (!normalized.startsWith('/app')) return;
  if (normalized !== '/app') {
    set.add(normalized);
  }

  const parts = normalized.split('/').filter(Boolean);
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    if (acc.startsWith('/app') && acc !== '/app') {
      set.add(acc);
    }
  }
}

function normalizeRoute(route: string): string {
  const noHash = route.split('#')[0] ?? '';
  const noQuery = noHash.split('?')[0] ?? '';
  const trimmed = noQuery.trim();
  if (!trimmed) return '';
  if (trimmed === '/app/') return '/app';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function safeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRouteMatch(current: string, allowed: string): boolean {
  const normalizedAllowed = normalizeRoute(allowed);
  if (!normalizedAllowed || normalizedAllowed === '/app') return false;
  return current === normalizedAllowed || current.startsWith(`${normalizedAllowed}/`);
}
