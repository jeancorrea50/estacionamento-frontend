/**
 * Estrutura plana (nível API) do menu Financeiro → Faturamento/Pagamentos → abas.
 * O frontend recompõe a árvore visual com `nestSubMenusByRoute`.
 */
import type { MenuSubItem } from '../cadastro/constants/menu-structure';
import {
  FATURAMENTO_CONFIG_LABEL,
  FATURAMENTO_CONFIG_ROUTE,
  FATURAMENTO_ROUTE,
  FATURAMENTO_TABS,
  FINANCEIRO_ROUTE,
  PAGAMENTOS_ROUTE,
} from './faturamento-rotas';
import { defaultExibirNoSidebar } from '../gerenciamento/services/menu-sidebar-visibility';

export interface FinanceiroFlatSubMenuDef {
  nome: string;
  rota: string;
  exibirNoSidebar: boolean;
}

/** Submenus de 2º nível (Faturamento) com filhos de 3º nível (abas + configuração). */
export const FINANCEIRO_FATURAMENTO_CHILDREN: MenuSubItem[] = [
  ...FATURAMENTO_TABS.map((t) => ({
    id: `sub-faturamento-${t.id}`,
    label: t.label,
    route: t.route,
  })),
  {
    id: 'sub-faturamento-cobranca',
    label: FATURAMENTO_CONFIG_LABEL,
    route: FATURAMENTO_CONFIG_ROUTE,
  },
];

/** Definição canônica do módulo Financeiro para seed/admin/permissões. */
export const FINANCEIRO_MENU_TREE: MenuSubItem[] = [
  {
    id: 'sub-faturamento',
    label: 'Faturamento',
    route: FATURAMENTO_ROUTE,
    children: FINANCEIRO_FATURAMENTO_CHILDREN,
  },
  {
    id: 'sub-pagamentos',
    label: 'Pagamentos',
    route: PAGAMENTOS_ROUTE,
  },
];

export function flattenFinanceiroMenuTree(items: MenuSubItem[] = FINANCEIRO_MENU_TREE): FinanceiroFlatSubMenuDef[] {
  const out: FinanceiroFlatSubMenuDef[] = [];

  const walk = (nodes: MenuSubItem[]) => {
    for (const node of nodes) {
      out.push({
        nome: node.label,
        rota: node.route,
        exibirNoSidebar: defaultExibirNoSidebar(node.route),
      });
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };

  walk(items);
  return out;
}

export function getFinanceiroMenuRoute(): string {
  return FINANCEIRO_ROUTE;
}
