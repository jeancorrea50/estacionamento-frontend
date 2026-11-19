import { Injectable, computed, signal } from '@angular/core';
import { normalizeLegacyAppRoute } from '../utils/app-route-normalizer';
import { CADASTRO_ESTACIONAMENTOS_ROUTE } from '../../features/cadastro/cadastro-rotas';
import { MENU_STRUCTURE } from '../../features/cadastro/constants/menu-structure';
import { nestSubMenusByRouteGeneric } from '../../features/gerenciamento/services/menu-tree.util';
import {
  formatAppMenuDisplayLabel,
  resolveAppRouteFromNome,
} from '../../features/gerenciamento/services/menu-route-resolver';

/** v3: Relatório filho usa rota do pai (não colapsa tudo em `/app/relatorios`). */
const SESSION_MENUS_STORAGE_KEY = 'gts-session-menus-v3';
const LEGACY_SESSION_MENUS_KEYS = ['gts-session-menus-v1', 'gts-session-menus-v2'] as const;

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

/** Rotas canônicas conhecidas da árvore fixa (para não herdar irmãos por prefixo). */
const KNOWN_MENU_ROUTES: readonly string[] = (() => {
  const out = new Set<string>();
  const walk = (nodes: { route: string; children?: { route: string; children?: { route: string }[] }[] }[]) => {
    for (const node of nodes) {
      const r = normalizeRoute(node.route);
      if (r) out.add(r);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(MENU_STRUCTURE);
  return [...out];
})();

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
      for (const key of LEGACY_SESSION_MENUS_KEYS) {
        localStorage.removeItem(key);
      }
      localStorage.setItem(SESSION_MENUS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
  }

  clear(): void {
    this.menusState.set([]);
    try {
      localStorage.removeItem(SESSION_MENUS_STORAGE_KEY);
      for (const key of LEGACY_SESSION_MENUS_KEYS) {
        localStorage.removeItem(key);
      }
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
    if (isAccessGranted(current, allowed)) {
      return true;
    }
    /** Estacionamento: Gerenciamento e Cadastro (legado/forms) compartilham o mesmo acesso. */
    if (
      current === '/app/gerenciamento/estacionamento' ||
      current.startsWith('/app/gerenciamento/estacionamento/') ||
      current === CADASTRO_ESTACIONAMENTOS_ROUTE ||
      current.startsWith(`${CADASTRO_ESTACIONAMENTOS_ROUTE}/`) ||
      current === '/app/cadastro/estacionamento' ||
      current.startsWith('/app/cadastro/estacionamento/')
    ) {
      return allowed.some((route) => {
        const r = normalizeRoute(route);
        return (
          r === '/app/gerenciamento/estacionamento' ||
          r.startsWith('/app/gerenciamento/estacionamento/') ||
          r === CADASTRO_ESTACIONAMENTOS_ROUTE ||
          r.startsWith(`${CADASTRO_ESTACIONAMENTOS_ROUTE}/`) ||
          r === '/app/cadastro/estacionamento' ||
          r.startsWith('/app/cadastro/estacionamento/')
        );
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
   * Suporta um nível extra de filhos (ex.: Cobrança sob Faturamento).
   * Grupo sem nenhum filho liberado é ocultado.
   *
   * Liberar Transportadora NÃO libera Convites/Relatório (irmãos sob o mesmo prefixo).
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
      if (isSidebarRouteVisible(normalized, allowed)) {
        return true;
      }
      /** Estacionamento: login pode vir com rota de Gerenciamento ou Cadastro. */
      if (
        normalized === '/app/gerenciamento/estacionamento' ||
        normalized === CADASTRO_ESTACIONAMENTOS_ROUTE ||
        normalized === '/app/cadastro/estacionamento'
      ) {
        return allowed.some((r) => {
          const a = normalizeRoute(r);
          return (
            a === '/app/gerenciamento/estacionamento' ||
            a === CADASTRO_ESTACIONAMENTOS_ROUTE ||
            a === '/app/cadastro/estacionamento' ||
            a.startsWith('/app/gerenciamento/estacionamento/') ||
            a.startsWith(`${CADASTRO_ESTACIONAMENTOS_ROUTE}/`) ||
            a.startsWith('/app/cadastro/estacionamento/')
          );
        });
      }
      return false;
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
      for (const key of LEGACY_SESSION_MENUS_KEYS) {
        localStorage.removeItem(key);
      }
      const raw = localStorage.getItem(SESSION_MENUS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SessionMenuAccess[];
      if (!Array.isArray(parsed)) return [];
      const normalized = normalizeMenus(parsed);
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
        addGrantedRoute(routeSet, route);
        continue;
      }

      collectSessionSubRoutesLevel(activeSubs, routeSet, menu.rota ?? null);
    }

    return [...routeSet];
  }
}

/** Pais de seção usados para inferir Relatório em lista plana (login). */
const RELATORIO_SECTION_PARENTS = [
  '/app/financeiro/faturamento',
  '/app/financeiro/pagamento',
  '/app/financeiro/pagamentos',
  '/app/cadastro/transportadoras',
  '/app/cadastro/transportadora',
  '/app/patio/movimentacoes',
] as const;

function collectSessionSubRoutesLevel(
  siblings: SessionSubMenuAccess[],
  routeSet: Set<string>,
  menuOrParentRoute: string | null
): void {
  const ordered = [...siblings].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  for (let i = 0; i < ordered.length; i++) {
    const sub = ordered[i];
    if (sub.ativo === false || sub.selecionado === false) continue;
    const parentFromSibling = findPrecedingSectionParent(ordered, i);
    const route = resolveAppRouteFromNome(
      safeText(sub.descricao),
      sub.rota ?? null,
      parentFromSibling ?? menuOrParentRoute
    );
    addGrantedRoute(routeSet, route);
    const nested = Array.isArray(sub.subMenus) ? sub.subMenus : [];
    if (nested.length) {
      collectSessionSubRoutesLevel(nested, routeSet, route);
    }
  }
}

function isRelatorioDescricao(descricao: string | null | undefined): boolean {
  const key = safeText(descricao)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return key === 'relatorio' || key === 'relatorios';
}

function findPrecedingSectionParent(
  ordered: SessionSubMenuAccess[],
  index: number
): string | null {
  for (let i = index - 1; i >= 0; i--) {
    const sibling = ordered[i];
    // Não usar outro "Relatório" como âncora (ex.: faturamento/relatorio antes de pagamento/relatorio).
    if (isRelatorioDescricao(sibling?.descricao)) continue;
    const r = normalizeRoute(String(sibling?.rota ?? ''));
    if (!r || r.endsWith('/relatorio') || r === '/app/relatorios' || r === '/app/relatorio') {
      continue;
    }
    for (const parent of RELATORIO_SECTION_PARENTS) {
      if (r === parent || r.startsWith(`${parent}/`)) {
        if (parent.startsWith('/app/cadastro/transportadora')) {
          return '/app/cadastro/transportadoras';
        }
        if (parent === '/app/financeiro/pagamentos') {
          return '/app/financeiro/pagamento';
        }
        return parent;
      }
    }
  }
  return null;
}

function normalizeSessionSubMenus(
  subs: SessionSubMenuAccess[],
  parentRoute?: string | null
): SessionSubMenuAccess[] {
  const ordered = [...subs].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const mapped: SessionSubMenuAccess[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const sub = ordered[i];
    const parentFromSibling = findPrecedingSectionParent(
      [
        ...mapped,
        ...ordered.slice(i).map((s) => ({
          ...s,
          rota: normalizeOptionalRoute(s.rota),
        })),
      ],
      i
    );
    mapped.push(normalizeSessionSubMenu(sub, parentFromSibling ?? parentRoute));
  }
  return nestSubMenusByRouteGeneric(mapped);
}

function normalizeSessionSubMenu(
  sub: SessionSubMenuAccess,
  parentRoute?: string | null
): SessionSubMenuAccess {
  const descricao = safeText(sub.descricao);
  const rotaRaw = normalizeOptionalRoute(sub.rota);
  const rota = normalizeOptionalRoute(
    resolveAppRouteFromNome(descricao, rotaRaw, parentRoute)
  );
  const nestedRaw = sub.subMenus ?? [];
  const nested = nestedRaw.length ? normalizeSessionSubMenus(nestedRaw, rota) : [];
  return {
    ...sub,
    descricao,
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
      subMenus: normalizeSessionSubMenus(menu.subMenus ?? [], rota),
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

/**
 * Registra apenas a rota concedida no login.
 * Não inclui ancestrais: liberar `/app/patio/movimentacoes` não pode liberar
 * `/app/patio/entrada-saida` (irmãos sob o mesmo pai).
 */
function addGrantedRoute(set: Set<string>, route: string): void {
  const normalized = normalizeRoute(route);
  if (!normalized.startsWith('/app') || normalized === '/app') return;
  set.add(normalized);
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

/** Sidebar: rota exatamente concedida, ou ancestral de uma rota concedida. */
function isSidebarRouteVisible(route: string, allowed: string[]): boolean {
  const normalized = normalizeRoute(route);
  if (!normalized) return false;
  if (allowed.some((r) => normalizeRoute(r) === normalized)) return true;
  return allowed.some((r) => normalizeRoute(r).startsWith(`${normalized}/`));
}

/**
 * Acesso: usa a rota de menu conhecida mais específica que cobre a URL.
 * Assim `/transportadoras` não libera `/transportadoras/convites`.
 */
function isAccessGranted(current: string, allowed: string[]): boolean {
  const cur = normalizeRoute(current);
  if (!cur) return false;

  const allowedNorm = allowed.map(normalizeRoute).filter(Boolean);
  if (allowedNorm.some((a) => a === cur)) return true;

  const matchingKnown = KNOWN_MENU_ROUTES.filter((k) => cur === k || cur.startsWith(`${k}/`)).sort(
    (a, b) => b.length - a.length
  );
  const bestKnown = matchingKnown[0];
  if (bestKnown) {
    return allowedNorm.some((a) => a === bestKnown);
  }

  // Detalhe/rota dinâmica sob uma concedida (ex.: /transportadoras/42).
  return allowedNorm.some((a) => cur === a || cur.startsWith(`${a}/`));
}
