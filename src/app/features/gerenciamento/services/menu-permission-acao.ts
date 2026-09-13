import type { MenuPermissionRow } from '../models/menu-admin.model';

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Slug do nome do submenu (ex.: "menu" → "menu", "Estacionamento" → "Estacionamento"). */
export function slugSubModuloNome(nome: string): string {
  return norm(nome).replace(/\s+/g, '') || 'modulo';
}

/**
 * UI: visualizar | criar | editar | excluir → sufixo na API (ex.: menu.gravar, menu.alterar).
 * Alinhado a respostas típicas do Buscar (ex.: Estacionamento.visualizar, menu.excluir).
 */
export const UI_TO_API_SUFFIX: Record<string, string> = {
  visualizar: 'visualizar',
  criar: 'gravar',
  editar: 'alterar',
  excluir: 'excluir',
};

export function buildFullAcaoPermissao(subNome: string, uiAcao: string): string {
  const suffix = UI_TO_API_SUFFIX[uiAcao] ?? uiAcao;
  return `${slugSubModuloNome(subNome)}.${suffix}`;
}

/**
 * Vários submenus usam o label curto "Relatório". A claim deve ser única por rota
 * para não colidir com `relatorio.visualizar` do faturamento.
 */
export function buildPermissaoAcaoPorRota(
  rota: string | null | undefined,
  subNome: string,
  uiAcao: string = 'visualizar'
): string {
  const r = String(rota ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
  const suffix = UI_TO_API_SUFFIX[uiAcao] ?? uiAcao;

  if (r.endsWith('/cadastro/transportadoras/relatorio')) {
    return `relatoriodetransportadoras.${suffix}`;
  }
  if (r.endsWith('/patio/movimentacoes/relatorio')) {
    return `relatoriodemovimentacoes.${suffix}`;
  }
  if (r.endsWith('/financeiro/pagamento/relatorio') || r.endsWith('/financeiro/pagamentos/relatorio')) {
    return `relatoriodepagamentos.${suffix}`;
  }
  if (r.endsWith('/financeiro/faturamento/relatorio') || r.endsWith('/faturamento/relatorio')) {
    return `relatorio.${suffix}`;
  }
  return buildFullAcaoPermissao(subNome, uiAcao);
}

/** Verifica se a linha de permissão corresponde à ação da UI (nome curto ou string completa da API). */
export function permissionRowMatchesUi(p: MenuPermissionRow, subNome: string, uiAcao: string): boolean {
  const target = norm(buildFullAcaoPermissao(subNome, uiAcao));
  const suffix = norm(UI_TO_API_SUFFIX[uiAcao] ?? uiAcao);
  const ui = norm(uiAcao);
  const a = norm(p.acao);
  if (a === target) return true;
  if (a === ui) return true;
  if (a.endsWith(`.${suffix}`)) return true;
  return false;
}

export function hasMatchingPermissionAcao(
  permissions: MenuPermissionRow[],
  subNome: string,
  uiAcao: string
): boolean {
  return permissions.some((p) => permissionRowMatchesUi(p, subNome, uiAcao));
}

export function removePermissionRowsForUi(
  permissions: MenuPermissionRow[],
  subNome: string,
  uiAcao: string
): MenuPermissionRow[] {
  return permissions.filter((p) => !permissionRowMatchesUi(p, subNome, uiAcao));
}
