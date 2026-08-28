import type { SubMenuAdmin } from '../models/menu-admin.model';

export function normMenuRoute(route: string | null | undefined): string {
  return String(route ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
}

/**
 * Agrupa submenus planos (API) em árvore menu → submenu → submenu²
 * usando prefixo de rota (`/app/faturamento` pai de `/app/faturamento/fechamentos`).
 */
export function nestSubMenusByRoute(subMenus: SubMenuAdmin[]): SubMenuAdmin[] {
  if (!subMenus.length) return [];

  const nodes = subMenus.map((s) => ({
    ...s,
    subMenus: [...(s.subMenus ?? [])],
  }));

  const byRoute = new Map(nodes.map((n) => [normMenuRoute(n.rota), n]));
  const assigned = new Set<SubMenuAdmin>();

  for (const node of nodes) {
    const route = normMenuRoute(node.rota);
    if (!route) {
      continue;
    }

    let parent: SubMenuAdmin | undefined;
    let bestLen = 0;
    for (const [parentRoute, candidate] of byRoute) {
      if (!parentRoute || parentRoute === route) continue;
      if (!route.startsWith(`${parentRoute}/`)) continue;
      if (parentRoute.length > bestLen) {
        bestLen = parentRoute.length;
        parent = candidate;
      }
    }

    if (parent) {
      parent.subMenus = parent.subMenus ?? [];
      if (!parent.subMenus.some((c) => c.id === node.id)) {
        parent.subMenus.push(node);
        assigned.add(node);
      }
    }
  }

  const roots = nodes.filter((n) => !assigned.has(n));
  sortSubMenuLevel(roots);
  return roots;
}

export function flattenSubMenus(subMenus: SubMenuAdmin[]): SubMenuAdmin[] {
  const out: SubMenuAdmin[] = [];

  const walk = (items: SubMenuAdmin[]) => {
    for (const item of items) {
      const { subMenus: children, ...rest } = item;
      out.push({ ...rest, subMenus: [] });
      if (children?.length) {
        walk(children);
      }
    }
  };

  walk(subMenus);
  return out.map((s, index) => ({ ...s, ordem: index }));
}

export function sortSubMenuLevel(items: SubMenuAdmin[]): void {
  items.sort((a, b) => a.ordem - b.ordem);
  for (const item of items) {
    if (item.subMenus?.length) {
      sortSubMenuLevel(item.subMenus);
    }
  }
}

export function walkSubMenus(subMenus: SubMenuAdmin[], visit: (sub: SubMenuAdmin) => void): void {
  for (const sub of subMenus) {
    visit(sub);
    if (sub.subMenus?.length) {
      walkSubMenus(sub.subMenus, visit);
    }
  }
}

export function findSubMenuById(
  subMenus: SubMenuAdmin[],
  subId: number
): { sub: SubMenuAdmin; parent?: SubMenuAdmin } | null {
  for (const sub of subMenus) {
    if (sub.id === subId) {
      return { sub };
    }
    if (sub.subMenus?.length) {
      const nested = findSubMenuById(sub.subMenus, subId);
      if (nested) {
        return { sub: nested.sub, parent: nested.parent ?? sub };
      }
    }
  }
  return null;
}

/** Interface mínima para aninhar submenus de sessão/login pelo prefixo de rota. */
export interface RouteNestableSubMenu {
  rota?: string | null;
  ordem?: number | null;
  subMenus?: RouteNestableSubMenu[] | null;
}

/**
 * Agrupa submenus planos (login/API) em árvore pelo prefixo de rota.
 */
export function nestSubMenusByRouteGeneric<T extends RouteNestableSubMenu>(subMenus: T[]): T[] {
  if (!subMenus.length) return [];

  const nodes = subMenus.map((s) => ({
    ...s,
    subMenus: [...(s.subMenus ?? [])],
  })) as T[];

  const byRoute = new Map(nodes.map((n) => [normMenuRoute(n.rota), n]));
  const assigned = new Set<T>();

  for (const node of nodes) {
    const route = normMenuRoute(node.rota);
    if (!route) continue;

    let parent: T | undefined;
    let bestLen = 0;
    for (const [parentRoute, candidate] of byRoute) {
      if (!parentRoute || parentRoute === route) continue;
      if (!route.startsWith(`${parentRoute}/`)) continue;
      if (parentRoute.length > bestLen) {
        bestLen = parentRoute.length;
        parent = candidate;
      }
    }

    if (parent) {
      parent.subMenus = parent.subMenus ?? [];
      if (!parent.subMenus.some((c) => normMenuRoute(c.rota) === route)) {
        (parent.subMenus as T[]).push(node);
        assigned.add(node);
      }
    }
  }

  const roots = nodes.filter((n) => !assigned.has(n));
  roots.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  for (const root of roots) {
    if (root.subMenus?.length) {
      (root.subMenus as T[]).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    }
  }
  return roots;
}

export function appendSubMenuToTree(
  subMenus: SubMenuAdmin[],
  parentSubId: number | null,
  novo: SubMenuAdmin
): SubMenuAdmin[] {
  if (parentSubId == null) {
    return [...subMenus, { ...novo, ordem: subMenus.length }];
  }
  return subMenus.map((sub) => {
    if (sub.id === parentSubId) {
      const children = sub.subMenus ?? [];
      return {
        ...sub,
        subMenus: [...children, { ...novo, ordem: children.length }],
      };
    }
    if (sub.subMenus?.length) {
      return { ...sub, subMenus: appendSubMenuToTree(sub.subMenus, parentSubId, novo) };
    }
    return sub;
  });
}

export function updateSubMenuInTree(
  subMenus: SubMenuAdmin[],
  subId: number,
  patch: Partial<SubMenuAdmin>
): SubMenuAdmin[] {
  return subMenus.map((sub) => {
    if (sub.id === subId) {
      return { ...sub, ...patch };
    }
    if (sub.subMenus?.length) {
      return { ...sub, subMenus: updateSubMenuInTree(sub.subMenus, subId, patch) };
    }
    return sub;
  });
}

export function removeSubMenuFromTree(subMenus: SubMenuAdmin[], subId: number): SubMenuAdmin[] {
  const filtered = subMenus.filter((sub) => sub.id !== subId);
  if (filtered.length !== subMenus.length) {
    return filtered.map((sub, index) => ({ ...sub, ordem: index }));
  }
  return subMenus.map((sub) => {
    if (!sub.subMenus?.length) return sub;
    return { ...sub, subMenus: removeSubMenuFromTree(sub.subMenus, subId) };
  });
}
