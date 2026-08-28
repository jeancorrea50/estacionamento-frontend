/**
 * Estrutura do menu da aplicação (menu > módulos > submenus).
 * Usada na tela de Permissões para exibir e vincular permissões por item.
 */
import { FINANCEIRO_ROUTE } from '../../financeiro/faturamento-rotas';
import { FINANCEIRO_MENU_TREE } from '../../financeiro/financeiro-menu-structure';
import { CADASTRO_MENU_TREE } from '../cadastro-menu-structure';
import { CADASTRO_ROUTE } from '../cadastro-rotas';
import {
  PATIO_ENTRADA_SAIDA_ROUTE,
  PATIO_MOVIMENTACOES_ROUTE,
  PATIO_ROUTE,
} from '../../patio/patio-rotas';

export interface MenuSubItem {
  id: string;
  label: string;
  route: string;
  children?: MenuSubItem[];
}

export interface MenuNode {
  id: string;
  label: string;
  route: string;
  icon: string;
  children?: MenuSubItem[];
}

/** Estrutura completa do menu (seed admin / permissões / validação SPA). */
export const MENU_STRUCTURE: MenuNode[] = [
  {
    id: 'menu-patio',
    label: 'Pátio',
    route: PATIO_ROUTE,
    icon: 'local_parking',
    children: [
      { id: 'sub-movimentacoes', label: 'Movimentações', route: PATIO_MOVIMENTACOES_ROUTE },
      { id: 'sub-entrada-saida', label: 'Entrada / Saída', route: PATIO_ENTRADA_SAIDA_ROUTE },
    ],
  },
  { id: 'menu-dashboard', label: 'Dashboard', route: '/app/dashboard', icon: 'dashboard' },
  { id: 'menu-relatorios', label: 'Relatórios', route: '/app/relatorios', icon: 'assessment' },
  {
    id: 'menu-financeiro',
    label: 'Financeiro',
    route: FINANCEIRO_ROUTE,
    icon: 'payments',
    children: FINANCEIRO_MENU_TREE,
  },
  {
    id: 'menu-configuracoes',
    label: 'Configurações',
    route: '/app/configuracoes',
    icon: 'settings',
    children: [
      { id: 'sub-usuarios', label: 'Usuários', route: '/app/configuracoes/usuarios' },
      { id: 'sub-horario', label: 'Parâmetros', route: '/app/configuracoes/horario' },
    ],
  },
  {
    id: 'menu-gerenciamento',
    label: 'Gerenciamento',
    route: '/app/gerenciamento',
    icon: 'admin_panel_settings',
    children: [
      { id: 'sub-menu', label: 'Menu', route: '/app/gerenciamento/menu' },
      { id: 'sub-perfil', label: 'Perfil', route: '/app/gerenciamento/perfil' },
      { id: 'sub-banco-dados', label: 'Banco de dados', route: '/app/gerenciamento/bancoDados' },
    ],
  },
  {
    id: 'menu-cadastro',
    label: 'Cadastro',
    route: CADASTRO_ROUTE,
    icon: 'local_shipping',
    children: CADASTRO_MENU_TREE.map((item) => ({
      id: item.id,
      label: item.label,
      route: item.route,
    })),
  },
];

function collectSubMenuIds(subs: MenuSubItem[], ids: string[]): void {
  for (const sub of subs) {
    ids.push(sub.id);
    if (sub.children?.length) {
      collectSubMenuIds(sub.children, ids);
    }
  }
}

/** Todos os nós (menu ou submenu) que podem ter permissões vinculadas. */
export function getAllMenuNodeIds(): string[] {
  const ids: string[] = [];
  for (const node of MENU_STRUCTURE) {
    if (node.children?.length) {
      collectSubMenuIds(node.children, ids);
    } else {
      ids.push(node.id);
    }
  }
  return ids;
}
