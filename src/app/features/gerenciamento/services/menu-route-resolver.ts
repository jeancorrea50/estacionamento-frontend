import { MENU_STRUCTURE, type MenuSubItem } from '../../cadastro/constants/menu-structure';
import {
  FATURAMENTO_ROUTE,
  FATURAMENTO_TABS,
  normalizeFaturamentoAppRoute,
} from '../../financeiro/faturamento-rotas';

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Sinônimos comuns entre API (descricao) e rotas reais do front.
 * Evita que `rota: null` vire `/app` e todos os itens caiam no dashboard.
 */
const ALIAS_NOME_PARA_ROTA: Record<string, string> = {
  dashbord: '/app/dashboard',
  dashboard: '/app/dashboard',
  movimentos: '/app/movimentos/entrada-saida',
  'entrada e saida': '/app/movimentos/entrada-saida',
  entradaesaida: '/app/movimentos/entrada-saida',
  'entrada e saída': '/app/movimentos/entrada-saida',
  /** API costuma mandar singular; rota real do SPA é plural */
  movimento: '/app/movimentos/entrada-saida',
  relatorio: '/app/relatorios',
  relatorios: '/app/relatorios',
  financeiro: FATURAMENTO_ROUTE,
  faturamento: FATURAMENTO_ROUTE,
  /** Abas de Faturamento (API pode mandar apenas a descrição do submenu). */
  'visao geral': `${FATURAMENTO_ROUTE}/visao-geral`,
  fechamentos: `${FATURAMENTO_ROUTE}/fechamentos`,
  recebimentos: `${FATURAMENTO_ROUTE}/recebimentos`,
  inadimplencia: `${FATURAMENTO_ROUTE}/inadimplencia`,
  faturas: `${FATURAMENTO_ROUTE}/faturas`,
  'configuracoes de cobranca': `${FATURAMENTO_ROUTE}/config-cobranca`,
  'config cobranca': `${FATURAMENTO_ROUTE}/config-cobranca`,
  configuracoes: '/app/configuracoes',
  configuracao: '/app/configuracoes',
  cadastros: '/app/cadastro',
  cadastro: '/app/cadastro',
  gerenciamento: '/app/gerenciamento',
  transportadora: '/app/cadastro/transportadora',
  estacionamento: '/app/cadastro/estacionamento',
  motorista: '/app/cadastro/motorista',
  usuarios: '/app/configuracoes/usuarios',
  horario: '/app/configuracoes/horario',
  'fuso horario': '/app/configuracoes/horario',
  fusohorario: '/app/configuracoes/horario',
  /** Submódulo "menu" na API ≈ aba Menu em Gerenciamento */
  menu: '/app/gerenciamento/menu',
  /** Alias legado / API — gestão de usuários em Configurações */
  acessos: '/app/configuracoes/usuarios',
  admin: '/app/gerenciamento/menu',
  perfil: '/app/gerenciamento/perfil',
  bancodados: '/app/gerenciamento/bancoDados',
  'banco de dados': '/app/gerenciamento/bancoDados',
  'banco dados': '/app/gerenciamento/bancoDados',
};

const ALIAS_PATH_PARA_ROTA: Record<string, string> = {
  '/app/movimento': '/app/movimentos/entrada-saida',
  '/app/movimentos': '/app/movimentos/entrada-saida',
  '/app/movimentos/operacao': '/app/movimentos/entrada-saida',
  '/app/relatorio': '/app/relatorios',
  '/app/gerenciamento': '/app/gerenciamento',
  '/app/financeiro': FATURAMENTO_ROUTE,
  '/app/financeiro/faturamento': FATURAMENTO_ROUTE,
  ...Object.fromEntries(
    FATURAMENTO_TABS.map((t) => [`/app/financeiro/faturamento/${t.path}`, t.route] as const)
  ),
  ...Object.fromEntries(FATURAMENTO_TABS.map((t) => [`/app/financeiro/${t.path}`, t.route] as const)),
};

function matchSubItems(nomeNorm: string, subs: MenuSubItem[] | undefined): string | null {
  if (!subs?.length) return null;
  for (const c of subs) {
    if (norm(c.label) === nomeNorm) return c.route;
    const nested = matchSubItems(nomeNorm, c.children);
    if (nested) return nested;
  }
  return null;
}

function tryMatchMenuStructure(nome: string): string | null {
  const key = norm(nome);
  for (const node of MENU_STRUCTURE) {
    if (norm(node.label) === key) return node.route;
    const fromSubs = matchSubItems(key, node.children);
    if (fromSubs) return fromSubs;
  }
  return null;
}

function normalizeApiRota(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!t || t === '/app' || t === '/app/') return null;

  /**
   * API costuma enviar `app/{menu}/...` sem barra inicial.
   * Deve virar `/app/...` — nunca `/app/app/...` (bug do antigo `\/app${t}` quando t já começava com `app/`).
   */
  if (!t.startsWith('/')) {
    if (/^app\//i.test(t)) {
      t = `/${t}`;
    } else {
      t = `/app/${t.replace(/^\/+/, '')}`;
    }
  }

  const tl = t.toLowerCase();
  if (tl === '/app') return null;

  if (tl.startsWith('/app/')) {
    const aliased = ALIAS_PATH_PARA_ROTA[tl] ?? t;
    return normalizeFaturamentoAppRoute(aliased) ?? aliased;
  }

  const route = `/app${t}`.replace(/\/{2,}/g, '/');
  const routeL = route.toLowerCase();
  const aliased = ALIAS_PATH_PARA_ROTA[routeL] ?? route;
  return normalizeFaturamentoAppRoute(aliased) ?? aliased;
}

/**
 * Rótulo amigável na sidebar/UI. API e seeds legados ainda usam "Movimento(s)".
 */
export function formatAppMenuDisplayLabel(label: string, route?: string | null): string {
  const raw = (label ?? '').trim();
  const key = norm(raw);
  if (key === 'movimento' || key === 'movimentos') {
    return 'Entrada e Saída';
  }
  if (key === 'financeiro') {
    return 'Faturamento';
  }

  const path = (route ?? '').replace(/\/+$/, '').toLowerCase();
  if (
    path === '/app/movimento' ||
    path === '/app/movimentos' ||
    path.startsWith('/app/movimentos/') ||
    path.startsWith('/app/movimento/')
  ) {
    // Rótulo de menu de topo associado à feature (não reescreve subrótulos técnicos).
    if (!raw || key === 'movimento' || key === 'movimentos' || key === 'entrada e saida') {
      return 'Entrada e Saída';
    }
  }
  if (
    path === '/app/financeiro' ||
    path.startsWith('/app/financeiro/') ||
    path === FATURAMENTO_ROUTE.toLowerCase() ||
    path.startsWith(`${FATURAMENTO_ROUTE.toLowerCase()}/`)
  ) {
    if (!raw || key === 'financeiro' || key === 'faturamento') {
      return 'Faturamento';
    }
  }

  return raw || label;
}

/**
 * Define a rota do Angular para sidebar/navegação quando a API omite `rota` ou
 * envia só `/app` (equivalente a "sem rota").
 */
export function resolveAppRouteFromNome(nome: string, rotaFromApi?: string | null): string {
  const fromApi = normalizeApiRota(rotaFromApi ?? undefined);
  if (fromApi) return fromApi;

  const key = norm(nome);
  if (key && ALIAS_NOME_PARA_ROTA[key]) {
    return ALIAS_NOME_PARA_ROTA[key];
  }

  const fromStructure = tryMatchMenuStructure(nome);
  if (fromStructure) return fromStructure;

  const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (slug) return `/app/${slug}`;
  return '/app/dashboard';
}

/** Rota → nome do ícone Material Symbols (mesmos usados em `MENU_STRUCTURE`). */
const ROUTE_TO_MATERIAL_ICON = new Map<string, string>();
/** Label normalizado → ícone (módulos de topo). */
const LABEL_TO_MATERIAL_ICON = new Map<string, string>();

for (const node of MENU_STRUCTURE) {
  LABEL_TO_MATERIAL_ICON.set(norm(node.label), node.icon);
  ROUTE_TO_MATERIAL_ICON.set(node.route, node.icon);
  if (node.children?.length) {
    for (const c of node.children) {
      ROUTE_TO_MATERIAL_ICON.set(c.route, node.icon);
    }
  }
}
// Aliases legados da API (singular/plural)
LABEL_TO_MATERIAL_ICON.set('movimento', 'swap_horiz');
LABEL_TO_MATERIAL_ICON.set('movimentos', 'swap_horiz');
LABEL_TO_MATERIAL_ICON.set('transportadora', 'local_shipping');
LABEL_TO_MATERIAL_ICON.set('cadastro', 'local_shipping');
LABEL_TO_MATERIAL_ICON.set('estacionamento', 'local_parking');
ROUTE_TO_MATERIAL_ICON.set('/app/movimentos', 'swap_horiz');
ROUTE_TO_MATERIAL_ICON.set('/app/movimento', 'swap_horiz');
ROUTE_TO_MATERIAL_ICON.set('/app/cadastro/transportadora', 'local_shipping');
ROUTE_TO_MATERIAL_ICON.set('/app/cadastro', 'local_shipping');
ROUTE_TO_MATERIAL_ICON.set('/app/cadastro/estacionamento', 'local_parking');
ROUTE_TO_MATERIAL_ICON.set('/app/gerenciamento/estacionamento', 'local_parking');

/** Ícones legados de lista que devem virar caminhão em Transportadora/Cadastro. */
const LEGACY_LIST_ICONS = new Set(['playlist_add', 'list', 'format_list_bulleted', 'playlist_add_check']);

/**
 * Ícone Material Symbols para a sidebar (`<span class="material-symbols-outlined">`).
 * Quando a API não manda `icone` ou manda só `menu`, recupera o mesmo símbolo do
 * `MENU_STRUCTURE` / rota resolvida (comportamento anterior ao seed local).
 */
export function resolveMaterialSymbolIconFromModule(
  nomeModulo: string,
  iconeApi?: string | null
): string {
  const key = norm(nomeModulo);
  const t = (iconeApi ?? '').trim();

  if (key === 'estacionamento') {
    if (!t || t === 'menu' || LEGACY_LIST_ICONS.has(t) || t === 'admin_panel_settings') {
      return 'local_parking';
    }
  }

  if (key === 'transportadora' || key === 'cadastro') {
    if (!t || t === 'menu' || LEGACY_LIST_ICONS.has(t)) {
      return 'local_shipping';
    }
  }

  if (t && t !== 'menu') {
    return t;
  }

  const byLabel = LABEL_TO_MATERIAL_ICON.get(key);
  if (byLabel) return byLabel;

  const route = resolveAppRouteFromNome(nomeModulo, null);
  if (ROUTE_TO_MATERIAL_ICON.has(route)) {
    return ROUTE_TO_MATERIAL_ICON.get(route)!;
  }

  let bestLen = -1;
  let bestIcon: string | null = null;
  for (const [r, icon] of ROUTE_TO_MATERIAL_ICON) {
    if (route === r || route.startsWith(r + '/')) {
      if (r.length > bestLen) {
        bestLen = r.length;
        bestIcon = icon;
      }
    }
  }
  if (bestIcon) return bestIcon;

  return 'menu';
}

