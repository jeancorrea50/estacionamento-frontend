import type { TreePermissaoNode } from './perfil-permissoes-tree.util';

export type PermissaoAcaoPadrao = 'visualizar' | 'gravar' | 'alterar' | 'excluir';

export interface PermissaoAcaoMeta {
  action: string;
  label: string;
  icon: string;
  isPadrao: boolean;
}

/** Ícones no estilo das referências: check / + / lápis / X. */
const ACAO_META: Record<string, Omit<PermissaoAcaoMeta, 'action' | 'isPadrao'>> = {
  visualizar: { label: 'Visualizar', icon: 'check' },
  gravar: { label: 'Gravar', icon: 'add' },
  alterar: { label: 'Alterar', icon: 'edit' },
  excluir: { label: 'Excluir', icon: 'close' },
  gerenciar: { label: 'Gerenciar', icon: 'manage_accounts' },
  exportar: { label: 'Exportar', icon: 'download' },
  ver: { label: 'Ver', icon: 'check' },
  upload: { label: 'Upload', icon: 'upload' },
};

const ORDEM_ACOES: string[] = [
  'visualizar',
  'gravar',
  'alterar',
  'excluir',
  'ver',
  'gerenciar',
  'exportar',
  'upload',
];

const PADRAO = new Set<string>(['visualizar', 'gravar', 'alterar', 'excluir']);

export const PERMISSAO_ACOES_LEGENDA: ReadonlyArray<{
  action: PermissaoAcaoPadrao;
  label: string;
  icon: string;
}> = [
  { action: 'visualizar', label: 'Visualizar', icon: 'check' },
  { action: 'gravar', label: 'Gravar', icon: 'add' },
  { action: 'alterar', label: 'Alterar', icon: 'edit' },
  { action: 'excluir', label: 'Excluir', icon: 'close' },
];

/** Extrai o sufixo da claim (`entradasaida.visualizar` → `visualizar`). */
export function extractPermissionAction(key: string): string {
  const normalized = (key ?? '').trim().toLowerCase();
  if (!normalized) return '';
  const parts = normalized.split('.');
  return parts[parts.length - 1] ?? normalized;
}

export function resolvePermissaoAcaoMeta(key: string): PermissaoAcaoMeta {
  const action = extractPermissionAction(key);
  const known = ACAO_META[action];
  if (known) {
    return {
      action,
      label: known.label,
      icon: known.icon,
      isPadrao: PADRAO.has(action),
    };
  }
  const fallbackLabel = action
    ? action.charAt(0).toUpperCase() + action.slice(1)
    : 'Permissão';
  return {
    action: action || 'custom',
    label: fallbackLabel,
    icon: 'tune',
    isPadrao: false,
  };
}

export function sortPermissoesByAction(permissoes: TreePermissaoNode[]): TreePermissaoNode[] {
  return [...permissoes].sort((a, b) => {
    const actionA = extractPermissionAction(a.key || a.nome);
    const actionB = extractPermissionAction(b.key || b.nome);
    const idxA = ORDEM_ACOES.indexOf(actionA);
    const idxB = ORDEM_ACOES.indexOf(actionB);
    const rankA = idxA === -1 ? ORDEM_ACOES.length : idxA;
    const rankB = idxB === -1 ? ORDEM_ACOES.length : idxB;
    if (rankA !== rankB) return rankA - rankB;
    return actionA.localeCompare(actionB, 'pt-BR');
  });
}

/** Localiza a claim padrão (visualizar/gravar/alterar/excluir) na linha do submenu. */
export function findPermissaoByAction(
  permissoes: TreePermissaoNode[] | null | undefined,
  action: string
): TreePermissaoNode | undefined {
  const target = (action ?? '').trim().toLowerCase();
  if (!target || !permissoes?.length) return undefined;
  return permissoes.find((p) => extractPermissionAction(p.key || p.nome) === target);
}

/** Claims fora das 4 ações padrão (ex.: custom / exportar). */
export function listCustomPermissoes(
  permissoes: TreePermissaoNode[] | null | undefined
): TreePermissaoNode[] {
  if (!permissoes?.length) return [];
  return sortPermissoesByAction(
    permissoes.filter((p) => !PADRAO.has(extractPermissionAction(p.key || p.nome)))
  );
}
