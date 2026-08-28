/**
 * Fonte única das rotas do módulo Pátio (rota, path e normalização legada).
 * Canônico: `/app/patio/movimentacoes` e `/app/patio/entrada-saida`.
 */

/** Módulo Pátio (agrupador na sidebar). */
export const PATIO_ROUTE = '/app/patio';

/** Lista de movimentações no pátio. */
export const PATIO_MOVIMENTACOES_ROUTE = '/app/patio/movimentacoes';
export const PATIO_MOVIMENTACOES_PATH = 'movimentacoes';

/** Operação de entrada e saída (portaria). */
export const PATIO_ENTRADA_SAIDA_ROUTE = '/app/patio/entrada-saida';
export const PATIO_ENTRADA_SAIDA_PATH = 'entrada-saida';

const LEGACY_MOVIMENTOS_PREFIX = '/app/movimentos';

function normalizePath(raw: string): string {
  let path = raw.replace(/\/{2,}/g, '/');
  if (!path.startsWith('/')) {
    path = /^app\//i.test(path) ? `/${path}` : `/app/${path.replace(/^\/+/, '')}`;
  }
  return path.replace(/\/+$/, '') || '/app';
}

/**
 * Converte rotas legadas `/app/movimentos/...` e aliases antigos
 * para o canônico `/app/patio/...`.
 */
export function normalizePatioAppRoute(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const path = normalizePath(trimmed);
  const lower = path.toLowerCase();

  if (lower === '/app/movimento' || lower === '/app/entrada-saida') {
    return PATIO_ENTRADA_SAIDA_ROUTE;
  }

  if (lower === LEGACY_MOVIMENTOS_PREFIX) {
    return PATIO_MOVIMENTACOES_ROUTE;
  }

  if (lower === `${LEGACY_MOVIMENTOS_PREFIX}/lista` || lower === `${LEGACY_MOVIMENTOS_PREFIX}/operacao`) {
    return PATIO_MOVIMENTACOES_ROUTE;
  }

  if (
    lower === `${LEGACY_MOVIMENTOS_PREFIX}/entrada-saida` ||
    lower.startsWith(`${LEGACY_MOVIMENTOS_PREFIX}/entrada-saida/`) ||
    lower === `${LEGACY_MOVIMENTOS_PREFIX}/historico`
  ) {
    if (lower.startsWith(`${LEGACY_MOVIMENTOS_PREFIX}/entrada-saida/`)) {
      const suffix = path.slice(`${LEGACY_MOVIMENTOS_PREFIX}/entrada-saida`.length);
      return `${PATIO_ENTRADA_SAIDA_ROUTE}${suffix}`;
    }
    return PATIO_ENTRADA_SAIDA_ROUTE;
  }

  if (lower === PATIO_ROUTE) {
    return PATIO_ROUTE;
  }

  return path === '/app' ? null : path;
}
