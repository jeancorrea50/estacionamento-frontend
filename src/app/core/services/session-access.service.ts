import { Injectable, computed, signal } from '@angular/core';
import { resolveAppRouteFromNome } from '../../features/gerenciamento/services/menu-route-resolver';

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
        return r === '/app/cadastro/estacionamento' || r.startsWith('/app/cadastro/estacionamento/');
      });
    }
    return false;
  }

  getDefaultRoute(): string | null {
    const allowed = this.allowedRoutes();
    return allowed[0] ?? null;
  }

  /**
   * Filtra itens da sidebar pelas rotas permitidas na sessão.
   * Suporta um nível extra de filhos (ex.: Motorista sob Transportadora).
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
        if (item.children?.length) {
          const children = item.children
            .map((child) => {
              if (child.children?.length) {
                const nestedVisible = child.children.filter((n) => hasRoute(n.route));
                if (nestedVisible.length > 0) {
                  return { ...child, children: nestedVisible };
                }
              }
              return hasRoute(child.route) ? child : null;
            })
            .filter((child): child is NonNullable<typeof child> => child !== null);

          if (children.length === 0 && !hasRoute(item.route)) {
            return null;
          }
          return { ...item, children } as T;
        }
        return hasRoute(item.route) ? item : null;
      })
      .filter((item): item is T => item !== null);
  }

  private loadMenus(): SessionMenuAccess[] {
    try {
      const raw = localStorage.getItem(SESSION_MENUS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SessionMenuAccess[];
      if (!Array.isArray(parsed)) return [];
      return normalizeMenus(parsed);
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
        const route = resolveAppRouteFromNome(safeText(sub.descricao), sub.rota ?? null);
        addRouteWithAncestors(routeSet, route);
      }
    }

    return [...routeSet];
  }
}

function normalizeMenus(menus: SessionMenuAccess[]): SessionMenuAccess[] {
  return menus.map((menu) => ({
    ...menu,
    descricao: safeText(menu.descricao),
    rota: normalizeOptionalRoute(menu.rota),
    selecionado: normalizeBoolean(menu.selecionado),
    subMenus: (menu.subMenus ?? []).map((sub) => ({
      ...sub,
      descricao: safeText(sub.descricao),
      rota: normalizeOptionalRoute(sub.rota),
      selecionado: normalizeBoolean(sub.selecionado),
    })),
  }));
}

function normalizeOptionalRoute(route: string | null | undefined): string | null {
  if (typeof route !== 'string') return null;
  const value = route.trim();
  return value || null;
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
