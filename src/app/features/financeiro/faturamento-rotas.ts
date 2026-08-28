/**
 * Fonte única das rotas do módulo Financeiro (rota, path e rótulo).
 * Usada pelas abas da página, pelo seed de Gerenciamento > Menu e pelos links da Visão Geral.
 *
 * Canônico: `/app/financeiro/faturamento/{aba}` e `/app/financeiro/pagamentos`.
 */
import type { FaturamentoTabId } from './pages/faturamento-page/faturamento-visao.types';

/** Módulo Financeiro (agrupador na sidebar). */
export const FINANCEIRO_ROUTE = '/app/financeiro';

/** Container das abas de Faturamento. */
export const FATURAMENTO_ROUTE = '/app/financeiro/faturamento';

/** Tela Pagamentos (antes Recebimentos) — rota própria, fora das abas internas. */
export const PAGAMENTOS_ROUTE = '/app/financeiro/pagamentos';
export const PAGAMENTOS_PATH = 'pagamentos';

/** Submenu Configuração — rota própria, fora das abas internas. */
export const FATURAMENTO_CONFIG_ROUTE = '/app/financeiro/faturamento/configuracao';
export const FATURAMENTO_CONFIG_PATH = 'configuracao';
export const FATURAMENTO_CONFIG_LABEL = 'Configuração';

/** Prefixo legado (menu/API antigos). */
const LEGACY_FATURAMENTO_PREFIX = '/app/faturamento';
const LEGACY_CONFIG_SLUGS = ['config-cobranca', 'configuracao-cobranca'] as const;

export interface FaturamentoTabDef {
  id: FaturamentoTabId;
  label: string;
  /** Path relativo usado em `financeiro.routes.ts` e nas abas. */
  path: string;
  /** Rota absoluta do SPA (mesmo valor cadastrado em Gerenciamento > Menu). */
  route: string;
}

function tab(id: FaturamentoTabId, label: string): FaturamentoTabDef {
  return { id, label, path: id, route: `${FATURAMENTO_ROUTE}/${id}` };
}

/** Abas internas da tela Faturamento (sem Pagamentos — submenu separado). */
export const FATURAMENTO_TABS: readonly FaturamentoTabDef[] = [
  tab('visao-geral', 'Visão Geral'),
  tab('fechamentos', 'Fechamentos'),
  tab('inadimplencia', 'Inadimplência'),
  tab('faturas', 'Faturas'),
];

export function faturamentoTabRoute(id: FaturamentoTabId): string {
  return FATURAMENTO_TABS.find((t) => t.id === id)?.route ?? FATURAMENTO_ROUTE;
}

export function faturamentoTabLabel(id: FaturamentoTabId): string {
  return FATURAMENTO_TABS.find((t) => t.id === id)?.label ?? 'Faturamento';
}

function rewriteLegacyConfigSlug(path: string): string {
  const lower = path.toLowerCase();
  for (const legacy of LEGACY_CONFIG_SLUGS) {
    const suffix = `/${legacy}`;
    if (lower === suffix.slice(1) || lower.endsWith(suffix)) {
      return FATURAMENTO_CONFIG_ROUTE;
    }
  }
  if (lower === FATURAMENTO_CONFIG_ROUTE.toLowerCase()) {
    return FATURAMENTO_CONFIG_ROUTE;
  }
  return path;
}

function mapLegacyRecebimentosToPagamentos(path: string): string {
  const lower = path.toLowerCase();
  if (
    lower === `${LEGACY_FATURAMENTO_PREFIX}/recebimentos` ||
    lower === `${FATURAMENTO_ROUTE}/recebimentos` ||
    lower === `${FINANCEIRO_ROUTE}/recebimentos` ||
    lower === `${FINANCEIRO_ROUTE}/pagamento`
  ) {
    return PAGAMENTOS_ROUTE;
  }
  return path;
}

/**
 * Converte rotas legadas `/app/faturamento/...` e aliases antigos
 * para o canônico `/app/financeiro/...`.
 */
export function normalizeFaturamentoAppRoute(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  let path = trimmed.replace(/\/{2,}/g, '/');
  if (!path.startsWith('/')) {
    path = /^app\//i.test(path) ? `/${path}` : `/app/${path.replace(/^\/+/, '')}`;
  }
  path = path.replace(/\/+$/, '') || '/app';
  const lower = path.toLowerCase();

  if (lower === LEGACY_FATURAMENTO_PREFIX) {
    return FATURAMENTO_ROUTE;
  }
  if (lower.startsWith(`${LEGACY_FATURAMENTO_PREFIX}/`)) {
    path = `${FATURAMENTO_ROUTE}${path.slice(LEGACY_FATURAMENTO_PREFIX.length)}`;
  } else if (lower === FINANCEIRO_ROUTE) {
    return FINANCEIRO_ROUTE;
  }

  path = mapLegacyRecebimentosToPagamentos(path);
  path = rewriteLegacyConfigSlug(path);
  return path === '/app' ? null : path;
}
