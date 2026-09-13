/**
 * Estrutura plana (nível API) do menu Cadastro → itens com filhos (ex.: Transportadora → Relatório).
 * O frontend recompõe a árvore visual com `nestSubMenusByRoute`.
 */
import type { MenuSubItem } from './constants/menu-structure';
import {
  CADASTRO_MOTORISTAS_ROUTE,
  CADASTRO_ROUTE,
  CADASTRO_TRANSPORTADORAS_RELATORIO_LABEL,
  CADASTRO_TRANSPORTADORAS_RELATORIO_ROUTE,
  CADASTRO_TRANSPORTADORAS_ROUTE,
  CADASTRO_VEICULOS_ROUTE,
} from './cadastro-rotas';
import { defaultExibirNoSidebar } from '../gerenciamento/services/menu-sidebar-visibility';

export interface CadastroFlatSubMenuDef {
  nome: string;
  rota: string;
  exibirNoSidebar: boolean;
}

/** Definição canônica do módulo Cadastro para seed/admin/permissões. */
export const CADASTRO_MENU_TREE: MenuSubItem[] = [
  { id: 'sub-veiculos', label: 'Veículo', route: CADASTRO_VEICULOS_ROUTE },
  { id: 'sub-motoristas', label: 'Motorista', route: CADASTRO_MOTORISTAS_ROUTE },
  {
    id: 'sub-transportadoras',
    label: 'Transportadora',
    route: CADASTRO_TRANSPORTADORAS_ROUTE,
    children: [
      {
        id: 'sub-transportadoras-relatorio',
        label: CADASTRO_TRANSPORTADORAS_RELATORIO_LABEL,
        route: CADASTRO_TRANSPORTADORAS_RELATORIO_ROUTE,
      },
    ],
  },
];

export function flattenCadastroMenuTree(items: MenuSubItem[] = CADASTRO_MENU_TREE): CadastroFlatSubMenuDef[] {
  const out: CadastroFlatSubMenuDef[] = [];

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

export function getCadastroMenuRoute(): string {
  return CADASTRO_ROUTE;
}
