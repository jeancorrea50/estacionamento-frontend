/**
 * Árvore FIXA da sidebar (fonte única de estrutura).
 * O login só filtra o que o usuário pode ver — não redefine hierarquia/ordem.
 */
import {
  FATURAMENTO_CONFIG_LABEL,
  FATURAMENTO_CONFIG_ROUTE,
  FATURAMENTO_ROUTE,
  FINANCEIRO_ROUTE,
  PAGAMENTOS_ROUTE,
} from '../../financeiro/faturamento-rotas';
import {
  CADASTRO_ESTACIONAMENTOS_ROUTE,
  CADASTRO_MOTORISTAS_ROUTE,
  CADASTRO_ROUTE,
  CADASTRO_TRANSPORTADORAS_ROUTE,
  CADASTRO_VEICULOS_ROUTE,
} from '../cadastro-rotas';
import {
  PATIO_ENTRADA_SAIDA_ROUTE,
  PATIO_MOVIMENTACOES_ROUTE,
  PATIO_ROUTE,
} from '../../patio/patio-rotas';
import { AGENDAMENTO_ROUTE, AGENDAMENTOS_ROUTE } from '../../agendamento/agendamento-rotas';
import {
  ADMINISTRACAO_ROUTE,
  ADMINISTRACAO_USUARIO_ROUTE,
  ADMINISTRACAO_PERMISSAO_ROUTE,
} from '../../administracao/administracao-rotas';

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

/** Estrutura completa e fixa do menu lateral. */
export const MENU_STRUCTURE: MenuNode[] = [
  {
    id: 'menu-patio',
    label: 'Pátio',
    route: PATIO_ROUTE,
    icon: 'local_parking',
    children: [
      { id: 'sub-movimentacoes', label: 'Movimentações', route: PATIO_MOVIMENTACOES_ROUTE },
      { id: 'sub-entrada-saida', label: 'Entrada e Saída', route: PATIO_ENTRADA_SAIDA_ROUTE },
    ],
  },
  {
    id: 'menu-agendamento',
    label: 'Agendamento',
    route: AGENDAMENTO_ROUTE,
    icon: 'calendar_month',
    children: [
      { id: 'sub-agendamentos', label: 'Agendamentos', route: AGENDAMENTOS_ROUTE },
    ],
  },
  {
    id: 'menu-financeiro',
    label: 'Financeiro',
    route: FINANCEIRO_ROUTE,
    icon: 'payments',
    children: [
      {
        id: 'sub-faturamento',
        label: 'Faturamento',
        route: FATURAMENTO_ROUTE,
        children: [
          {
            id: 'sub-faturamento-configuracao',
            label: FATURAMENTO_CONFIG_LABEL,
            route: FATURAMENTO_CONFIG_ROUTE,
          },
        ],
      },
      { id: 'sub-pagamentos', label: 'Pagamentos', route: PAGAMENTOS_ROUTE },
    ],
  },
  {
    id: 'menu-cadastro',
    label: 'Cadastro',
    route: CADASTRO_ROUTE,
    icon: 'local_shipping',
    children: [
      { id: 'sub-veiculos', label: 'Veículo', route: CADASTRO_VEICULOS_ROUTE },
      { id: 'sub-motoristas', label: 'Motorista', route: CADASTRO_MOTORISTAS_ROUTE },
      { id: 'sub-transportadoras', label: 'Transportadora', route: CADASTRO_TRANSPORTADORAS_ROUTE },
    ],
  },
  {
    id: 'menu-administracao',
    label: 'Administração',
    route: ADMINISTRACAO_ROUTE,
    icon: 'manage_accounts',
    children: [
      { id: 'sub-usuario', label: 'Usuário', route: ADMINISTRACAO_USUARIO_ROUTE },
      { id: 'sub-permissao', label: 'Permissão', route: ADMINISTRACAO_PERMISSAO_ROUTE },
    ],
  },
  {
    id: 'menu-gerenciamento',
    label: 'Gerenciamento',
    route: '/app/gerenciamento',
    icon: 'admin_panel_settings',
    children: [
      { id: 'sub-menu', label: 'Menu', route: '/app/gerenciamento/menu' },
      { id: 'sub-banco-dados', label: 'Banco de dados', route: '/app/gerenciamento/bancoDados' },
      { id: 'sub-estacionamento', label: 'Estacionamento', route: CADASTRO_ESTACIONAMENTOS_ROUTE },
      { id: 'sub-horario', label: 'Horário', route: '/app/configuracoes/horario' },
    ],
  },
  {
    id: 'menu-configuracoes',
    label: 'Configurações',
    route: '/app/configuracoes',
    icon: 'settings',
    children: [
      { id: 'sub-parametros', label: 'Parâmetros', route: '/app/configuracoes/horario' },
    ],
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
