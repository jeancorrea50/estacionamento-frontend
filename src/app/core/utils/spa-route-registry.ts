import { MENU_STRUCTURE } from '../../features/cadastro/constants/menu-structure';
import {
  FATURAMENTO_CONFIG_ROUTE,
  FATURAMENTO_ROUTE,
  FATURAMENTO_TABS,
  FINANCEIRO_ROUTE,
  PAGAMENTOS_ROUTE,
} from '../../features/financeiro/faturamento-rotas';

const KNOWN_SPA_ROUTES = new Set<string>();

function addRoute(route: string | null | undefined): void {
  if (!route?.trim()) return;
  const normalized = route.trim().replace(/\/+$/, '').toLowerCase();
  if (!normalized.startsWith('/app')) return;
  KNOWN_SPA_ROUTES.add(normalized);
}

function collectMenuStructure(): void {
  for (const node of MENU_STRUCTURE) {
    addRoute(node.route);
    for (const child of node.children ?? []) {
      addRoute(child.route);
      for (const nested of child.children ?? []) {
        addRoute(nested.route);
      }
    }
  }
}

function collectFaturamentoRoutes(): void {
  addRoute(FINANCEIRO_ROUTE);
  addRoute(FATURAMENTO_ROUTE);
  addRoute(PAGAMENTOS_ROUTE);
  addRoute(FATURAMENTO_CONFIG_ROUTE);
  for (const tab of FATURAMENTO_TABS) {
    addRoute(tab.route);
  }
}

function collectStaticRoutes(): void {
  const extras = [
    '/app',
    '/app/dashboard',
    '/app/movimentos',
    '/app/movimentos/entrada-saida',
    '/app/movimentos/lista',
    '/app/relatorios',
    '/app/configuracoes',
    '/app/configuracoes/usuarios',
    '/app/configuracoes/horario',
    '/app/gerenciamento',
    '/app/gerenciamento/menu',
    '/app/gerenciamento/perfil',
    '/app/gerenciamento/bancodados',
    '/app/cadastro',
    '/app/cadastro/transportadora',
    '/app/cadastro/estacionamento',
    '/app/cadastro/motorista',
  ];
  for (const route of extras) {
    addRoute(route);
  }
}

collectMenuStructure();
collectFaturamentoRoutes();
collectStaticRoutes();

function normalizePath(path: string): string {
  let p = path.trim().replace(/\/{2,}/g, '/');
  if (!p.startsWith('/')) {
    p = `/app/${p.replace(/^\/+/, '')}`;
  }
  return p.replace(/\/+$/, '').toLowerCase();
}

/**
 * Verifica se a rota existe no SPA (ou é prefixo válido de rota cadastrada).
 */
export function isRegisteredSpaRoute(path: string | null | undefined): boolean {
  const normalized = normalizePath(String(path ?? ''));
  if (!normalized.startsWith('/app')) return false;
  if (KNOWN_SPA_ROUTES.has(normalized)) return true;

  for (const known of KNOWN_SPA_ROUTES) {
    if (normalized.startsWith(`${known}/`)) return true;
  }
  return false;
}

export function getSpaRouteValidationMessage(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  if (isRegisteredSpaRoute(path)) return null;
  return `Rota "${path.trim()}" não está configurada no frontend. Cadastre a tela nas rotas do SPA antes de usar esta URL.`;
}

/** Lista ordenada de rotas conhecidas (para autocomplete / documentação interna). */
export function listRegisteredSpaRoutes(): string[] {
  return [...KNOWN_SPA_ROUTES].sort();
}
