import { MENU_STRUCTURE } from '../../features/cadastro/constants/menu-structure';
import {
  FATURAMENTO_CONFIG_ROUTE,
  FATURAMENTO_ROUTE,
  FATURAMENTO_TABS,
  FINANCEIRO_ROUTE,
  PAGAMENTOS_ROUTE,
} from '../../features/financeiro/faturamento-rotas';
import {
  CADASTRO_ESTACIONAMENTOS_ROUTE,
  CADASTRO_MOTORISTAS_ROUTE,
  CADASTRO_ROUTE,
  CADASTRO_TRANSPORTADORAS_ROUTE,
  CADASTRO_VEICULOS_ROUTE,
} from '../../features/cadastro/cadastro-rotas';
import {
  PATIO_ENTRADA_SAIDA_ROUTE,
  PATIO_MOVIMENTACOES_ROUTE,
  PATIO_ROUTE,
} from '../../features/patio/patio-rotas';

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

function collectCadastroRoutes(): void {
  addRoute(CADASTRO_ROUTE);
  addRoute(CADASTRO_TRANSPORTADORAS_ROUTE);
  addRoute(CADASTRO_VEICULOS_ROUTE);
  addRoute(CADASTRO_MOTORISTAS_ROUTE);
  addRoute(CADASTRO_ESTACIONAMENTOS_ROUTE);
}

function collectPatioRoutes(): void {
  addRoute(PATIO_ROUTE);
  addRoute(PATIO_MOVIMENTACOES_ROUTE);
  addRoute(PATIO_ENTRADA_SAIDA_ROUTE);
}

function collectStaticRoutes(): void {
  const extras = [
    '/app',
    '/app/dashboard',
    '/app/movimentos',
    '/app/movimentos/entrada-saida',
    '/app/movimentos/lista',
    '/app/relatorios',
    '/app/agendamento',
    '/app/agendamento/agendamentos',
    '/app/administracao',
    '/app/administracao/usuario',
    '/app/configuracoes',
    '/app/configuracoes/usuarios',
    '/app/configuracoes/horario',
    '/app/gerenciamento',
    '/app/gerenciamento/menu',
    '/app/gerenciamento/perfil',
    '/app/gerenciamento/bancodados',
    '/app/gerenciamento/usuario',
    '/app/gerenciamento/estacionamento',
    '/app/cadastro',
    '/app/cadastro/transportadoras',
    '/app/cadastro/veiculos',
    '/app/cadastro/motoristas',
    '/app/cadastro/estacionamentos',
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
collectCadastroRoutes();
collectPatioRoutes();
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
  return (
    `Rota "${path.trim()}" não existe no frontend. ` +
    `Crie a tela/rota no SPA antes de gravar no banco (evita menus quebrados).`
  );
}

/**
 * Lista rotas inválidas em uma árvore de menus (menu + submenus aninhados).
 * Usado antes de OrganizarMenus / salvar para bloquear URLs inexistentes no SPA.
 */
export function listInvalidSpaRoutesInMenus(
  menus: ReadonlyArray<{
    nome?: string | null;
    rota?: string | null;
    subMenus?: ReadonlyArray<SpaMenuNodeLike> | null;
  }>
): string[] {
  const invalid: string[] = [];

  const visitSub = (sub: SpaMenuNodeLike): void => {
    const rota = String(sub.rota ?? '').trim();
    if (rota && !isRegisteredSpaRoute(rota)) {
      invalid.push(`${sub.nome?.trim() || 'submenu'}: ${rota}`);
    }
    for (const child of sub.subMenus ?? []) {
      visitSub(child);
    }
  };

  for (const menu of menus) {
    const rota = String(menu.rota ?? '').trim();
    if (rota && !isRegisteredSpaRoute(rota)) {
      invalid.push(`${menu.nome?.trim() || 'menu'}: ${rota}`);
    }
    for (const sub of menu.subMenus ?? []) {
      visitSub(sub);
    }
  }

  return invalid;
}

interface SpaMenuNodeLike {
  nome?: string | null;
  rota?: string | null;
  subMenus?: ReadonlyArray<SpaMenuNodeLike> | null;
}

/** Lista ordenada de rotas conhecidas (para autocomplete / documentação interna). */
export function listRegisteredSpaRoutes(): string[] {
  return [...KNOWN_SPA_ROUTES].sort();
}
