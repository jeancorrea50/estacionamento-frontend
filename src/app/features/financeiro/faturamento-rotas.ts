/**
 * Fonte única das abas de Faturamento (rota, path e rótulo).
 * Usada pelas abas da página, pelo seed de Gerenciamento > Menu e pelos links da Visão Geral,
 * evitando divergência entre menu cadastrado e navegação da aplicação.
 */
import type { FaturamentoTabId } from './pages/faturamento-page/faturamento-visao.types';

/** Rota base do módulo (container das abas). */
export const FATURAMENTO_ROUTE = '/app/faturamento';

/** Prefixo legado (menu/API antigos). */
const LEGACY_FINANCEIRO_PREFIX = '/app/financeiro';
const LEGACY_FINANCEIRO_FATURAMENTO = `${LEGACY_FINANCEIRO_PREFIX}/faturamento`;

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

export const FATURAMENTO_TABS: readonly FaturamentoTabDef[] = [
  tab('visao-geral', 'Visão Geral'),
  tab('fechamentos', 'Fechamentos'),
  tab('recebimentos', 'Recebimentos'),
  tab('inadimplencia', 'Inadimplência'),
  tab('faturas', 'Faturas'),
  tab('config-cobranca', 'Configurações de Cobrança')
];

export function faturamentoTabRoute(id: FaturamentoTabId): string {
  return FATURAMENTO_TABS.find((t) => t.id === id)?.route ?? FATURAMENTO_ROUTE;
}

export function faturamentoTabLabel(id: FaturamentoTabId): string {
  return FATURAMENTO_TABS.find((t) => t.id === id)?.label ?? 'Faturamento';
}

/**
 * Converte rotas legadas `/app/financeiro(/faturamento)?/...` para `/app/faturamento/...`.
 * Mantém o valor original quando não for rota financeira/faturamento.
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

  if (lower === LEGACY_FINANCEIRO_PREFIX || lower === LEGACY_FINANCEIRO_FATURAMENTO) {
    return FATURAMENTO_ROUTE;
  }
  if (lower.startsWith(`${LEGACY_FINANCEIRO_FATURAMENTO}/`)) {
    return `${FATURAMENTO_ROUTE}${path.slice(LEGACY_FINANCEIRO_FATURAMENTO.length)}`;
  }
  if (lower.startsWith(`${LEGACY_FINANCEIRO_PREFIX}/`)) {
    const rest = path.slice(LEGACY_FINANCEIRO_PREFIX.length);
    return `${FATURAMENTO_ROUTE}${rest}`;
  }

  return path === '/app' ? null : path;
}
