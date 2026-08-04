import { FATURAMENTO_ROUTE, FATURAMENTO_TABS } from '../../financeiro/faturamento-rotas';

/** Prefixo de chave no localStorage de preferências de sidebar. */
export const SIDEBAR_VISIBILITY_STORAGE_KEY = 'gts-menu-sidebar-visibility-v1';

function normRoute(route: string | null | undefined): string {
  return String(route ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
}

/**
 * Default: aparece no sidebar.
 * Exceção: abas internas de Faturamento (visão geral, faturas, etc.) — ficam acessíveis
 * pelas abas da tela e pelos alertas, sem poluir o menu lateral.
 */
export function defaultExibirNoSidebar(rota: string | null | undefined): boolean {
  const r = normRoute(rota);
  if (!r) return true;
  if (r === normRoute(FATURAMENTO_ROUTE)) return true;
  return !FATURAMENTO_TABS.some((t) => r === normRoute(t.route) || r.endsWith(`/${t.path}`));
}

export function readBoolProp(row: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const v = row[key] ?? row[key.charAt(0).toUpperCase() + key.slice(1)];
    if (typeof v === 'boolean') return v;
    if (v === 0 || v === '0' || v === 'false' || v === 'False') return false;
    if (v === 1 || v === '1' || v === 'true' || v === 'True') return true;
  }
  return undefined;
}

export function loadSidebarVisibilityPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SIDEBAR_VISIBILITY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function persistSidebarVisibilityPrefs(prefs: Record<string, boolean>): void {
  try {
    localStorage.setItem(SIDEBAR_VISIBILITY_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function menuSidebarPrefKey(id: number): string {
  return `m:${id}`;
}

export function subSidebarPrefKey(id: number): string {
  return `s:${id}`;
}

/**
 * Resolve se item aparece no sidebar: preferência salva > valor da API > default por rota.
 */
export function resolveExibirNoSidebar(params: {
  id: number;
  kind: 'menu' | 'sub';
  rota: string | null | undefined;
  fromApi?: boolean | undefined;
  prefs?: Record<string, boolean>;
}): boolean {
  const prefs = params.prefs ?? loadSidebarVisibilityPrefs();
  const key = params.kind === 'menu' ? menuSidebarPrefKey(params.id) : subSidebarPrefKey(params.id);
  if (params.id > 0 && key in prefs) {
    return prefs[key] !== false;
  }
  if (params.fromApi !== undefined) {
    return params.fromApi !== false;
  }
  return defaultExibirNoSidebar(params.rota);
}

export function rememberSidebarVisibility(
  kind: 'menu' | 'sub',
  id: number,
  exibir: boolean
): void {
  if (id <= 0) return;
  const prefs = loadSidebarVisibilityPrefs();
  prefs[kind === 'menu' ? menuSidebarPrefKey(id) : subSidebarPrefKey(id)] = exibir;
  persistSidebarVisibilityPrefs(prefs);
}
