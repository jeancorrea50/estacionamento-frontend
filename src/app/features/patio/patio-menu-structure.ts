/**
 * Estrutura plana (nível API) do menu Pátio → itens com filhos (ex.: Movimentações → Relatório).
 * O frontend recompõe a árvore visual com `nestSubMenusByRoute`.
 */
import type { MenuSubItem } from '../cadastro/constants/menu-structure';
import {
  PATIO_ENTRADA_SAIDA_ROUTE,
  PATIO_MOVIMENTACOES_RELATORIO_LABEL,
  PATIO_MOVIMENTACOES_RELATORIO_ROUTE,
  PATIO_MOVIMENTACOES_ROUTE,
  PATIO_ROUTE,
} from './patio-rotas';
import { defaultExibirNoSidebar } from '../gerenciamento/services/menu-sidebar-visibility';

export interface PatioFlatSubMenuDef {
  nome: string;
  rota: string;
  exibirNoSidebar: boolean;
}

/** Definição canônica do módulo Pátio para seed/admin/permissões. */
export const PATIO_MENU_TREE: MenuSubItem[] = [
  {
    id: 'sub-movimentacoes',
    label: 'Movimentações',
    route: PATIO_MOVIMENTACOES_ROUTE,
    children: [
      {
        id: 'sub-movimentacoes-relatorio',
        label: PATIO_MOVIMENTACOES_RELATORIO_LABEL,
        route: PATIO_MOVIMENTACOES_RELATORIO_ROUTE,
      },
    ],
  },
  {
    id: 'sub-entrada-saida',
    label: 'Entrada e Saída',
    route: PATIO_ENTRADA_SAIDA_ROUTE,
  },
];

export function flattenPatioMenuTree(items: MenuSubItem[] = PATIO_MENU_TREE): PatioFlatSubMenuDef[] {
  const out: PatioFlatSubMenuDef[] = [];

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

export function getPatioMenuRoute(): string {
  return PATIO_ROUTE;
}
