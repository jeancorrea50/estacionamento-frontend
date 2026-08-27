/**
 * Estrutura do menu da aplicação (menu > módulos > submenus).
 * Usada na tela de Permissões para exibir e vincular permissões por item.
 */
import { FATURAMENTO_ROUTE, FATURAMENTO_TABS } from '../../financeiro/faturamento-rotas';

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

/** Submenus do Faturamento: uma entrada por aba (mesmas rotas do SPA). */
const FATURAMENTO_SUBMENUS: MenuSubItem[] = FATURAMENTO_TABS.map((t) => ({
  id: `sub-faturamento-${t.id}`,
  label: t.label,
  route: t.route,
}));

/** Estrutura completa do menu (seed admin / permissões). Estacionamento é item de topo na sidebar. */
export const MENU_STRUCTURE: MenuNode[] = [
  { id: 'menu-dashboard', label: 'Dashboard', route: '/app/dashboard', icon: 'dashboard' },
  { id: 'menu-movimentos', label: 'Entrada e Saída', route: '/app/movimentos/entrada-saida', icon: 'swap_horiz' },
  { id: 'menu-relatorios', label: 'Relatórios', route: '/app/relatorios', icon: 'assessment' },
  {
    id: 'menu-faturamento',
    label: 'Faturamento',
    route: FATURAMENTO_ROUTE,
    icon: 'payments',
    children: FATURAMENTO_SUBMENUS,
  },
  {
    id: 'menu-configuracoes',
    label: 'Configurações',
    route: '/app/configuracoes',
    icon: 'settings',
    children: [
      { id: 'sub-usuarios', label: 'Usuários', route: '/app/configuracoes/usuarios' },
      { id: 'sub-horario', label: 'Horário', route: '/app/configuracoes/horario' },
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
    route: '/app/cadastro',
    icon: 'local_shipping',
    children: [{ id: 'sub-transportadora', label: 'Transportadora', route: '/app/cadastro/transportadora' }],
  },
  {
    id: 'menu-estacionamento',
    label: 'Estacionamento',
    route: '/app/cadastro/estacionamento',
    icon: 'local_parking',
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
