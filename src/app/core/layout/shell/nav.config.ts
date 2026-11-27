// Menu do GTS — fonte única para sidebar, trilha (breadcrumb), busca rápida (Ctrl+K)
// e barra inferior do celular. Regra: no máximo 2 níveis (o 3º nível virou item irmão).
// As rotas são as REAIS do app: a liberação continua vindo do login (cadastro de Menu),
// que filtra este menu pelas rotas permitidas (SessionAccessService.filterSidebarItems).
import {
  FATURAMENTO_ACORDOS_ROUTE,
  FATURAMENTO_CONFIG_ROUTE,
  FATURAMENTO_RELATORIO_ROUTE,
  FATURAMENTO_ROUTE,
  PAGAMENTOS_RELATORIO_ROUTE,
  PAGAMENTOS_ROUTE,
} from '../../../features/financeiro/faturamento-rotas';
import {
  CADASTRO_MOTORISTAS_ROUTE,
  CADASTRO_RESPONSAVEIS_FATURAMENTO_ROUTE,
  CADASTRO_TRANSPORTADORAS_CONVITES_ROUTE,
  CADASTRO_TRANSPORTADORAS_RELATORIO_ROUTE,
  CADASTRO_TRANSPORTADORAS_ROUTE,
  CADASTRO_VEICULOS_ROUTE,
} from '../../../features/cadastro/cadastro-rotas';
import {
  PATIO_ENTRADA_SAIDA_ROUTE,
  PATIO_MOVIMENTACOES_RELATORIO_ROUTE,
  PATIO_MOVIMENTACOES_ROUTE,
} from '../../../features/patio/patio-rotas';
import {
  AGENDAMENTO_PAINEL_ROUTE,
  AGENDAR_ROUTE,
  DESTINACAO_DASHBOARD_ROUTE,
  DESTINACAO_LAB_ROUTE,
  DESTINACAO_ROUTE,
  JANELAS_ROUTE,
} from '../../../features/agendamento/agendamento-rotas';
import {
  ADMINISTRACAO_PERMISSAO_ROUTE,
  ADMINISTRACAO_USUARIO_ROUTE,
} from '../../../features/administracao/administracao-rotas';
import { ECOSSISTEMA_ROUTE } from '../../../features/ecossistema/ecossistema-rotas';
import { QUALIDADE_ROUTE } from '../../../features/qualidade/qualidade-rotas';
import { REDE_CREDENCIADA_ROUTE } from '../../../features/rede-credenciada/rede-credenciada-rotas';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  /** Rotas extras que também marcam este item como ativo (ex.: abas internas). */
  match?: string[];
  children?: NavItem[];
  /** Palavras para a busca rápida (sinônimos que o usuário usa). */
  keywords?: string[];
  /** Só Admin vê (além da liberação do login). */
  admin?: boolean;
  /** Aparece na barra inferior do celular. */
  mobile?: boolean;
  /** Rótulo curto para a barra inferior do celular. */
  curto?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    id: 'operacao',
    label: 'Operação',
    items: [
      {
        id: 'painel',
        label: 'Painel do pátio',
        icon: 'space_dashboard',
        route: AGENDAMENTO_PAINEL_ROUTE,
        keywords: ['dashboard', 'vagas', 'linha do tempo', 'ocupação', 'agendamentos'],
        mobile: true,
        curto: 'Painel',
      },
      {
        id: 'entrada-saida',
        label: 'Entrada e saída',
        icon: 'swap_horiz',
        route: PATIO_ENTRADA_SAIDA_ROUTE,
        keywords: ['portaria', 'registrar', 'placa', 'check-in', 'movimento'],
        mobile: true,
        curto: 'Portaria',
      },
      {
        id: 'movimentacoes',
        label: 'Movimentações',
        icon: 'receipt_long',
        route: PATIO_MOVIMENTACOES_ROUTE,
        keywords: ['histórico', 'veículos', 'lista'],
      },
      {
        id: 'movimentacoes-relatorio',
        label: 'Relatório do pátio',
        icon: 'summarize',
        route: PATIO_MOVIMENTACOES_RELATORIO_ROUTE,
        keywords: ['relatório', 'movimentações', 'pdf', 'excel', 'permanência'],
      },
      {
        id: 'agendar',
        label: 'Agendar',
        icon: 'event_available',
        route: AGENDAR_ROUTE,
        keywords: ['novo agendamento', 'reservar vaga', 'meus agendamentos'],
        mobile: true,
      },
    ],
  },
  {
    id: 'planejamento',
    label: 'Planejamento',
    items: [
      {
        id: 'destinacao',
        label: 'Destinação',
        icon: 'assignment_add',
        route: DESTINACAO_ROUTE,
        match: [DESTINACAO_LAB_ROUTE, DESTINACAO_DASHBOARD_ROUTE],
        keywords: ['destinar vagas', 'cif', 'fob', 'reserva'],
      },
      {
        id: 'janelas',
        label: 'Janelas de horário',
        icon: 'schedule',
        route: JANELAS_ROUTE,
        keywords: ['horários', 'capacidade', 'vagas por horário'],
      },
      {
        id: 'rede',
        label: 'Rede credenciada',
        icon: 'hub',
        route: REDE_CREDENCIADA_ROUTE,
        keywords: ['parceiros', 'credenciados', 'mapa'],
      },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    items: [
      {
        id: 'financeiro',
        label: 'Financeiro',
        icon: 'payments',
        children: [
          {
            id: 'faturamento',
            label: 'Faturamento',
            icon: 'request_quote',
            route: FATURAMENTO_ROUTE,
            keywords: ['faturas', 'visão geral', 'fechamento'],
          },
          {
            id: 'cobranca',
            label: 'Cobrança',
            icon: 'price_change',
            route: FATURAMENTO_CONFIG_ROUTE,
            keywords: ['regra de cobrança', 'tarifa', 'preço'],
          },
          { id: 'acordos', label: 'Acordos', icon: 'handshake', route: FATURAMENTO_ACORDOS_ROUTE },
          {
            id: 'faturamento-relatorio',
            label: 'Relatório de faturamento',
            icon: 'bar_chart',
            route: FATURAMENTO_RELATORIO_ROUTE,
          },
          {
            id: 'pagamento',
            label: 'Pagamentos',
            icon: 'account_balance_wallet',
            route: PAGAMENTOS_ROUTE,
            keywords: ['recebimentos', 'baixa'],
          },
          {
            id: 'pagamento-relatorio',
            label: 'Relatório de pagamentos',
            icon: 'summarize',
            route: PAGAMENTOS_RELATORIO_ROUTE,
          },
        ],
      },
      {
        id: 'cadastro',
        label: 'Cadastro',
        icon: 'local_shipping',
        children: [
          {
            id: 'transportadoras',
            label: 'Transportadoras',
            icon: 'local_shipping',
            route: CADASTRO_TRANSPORTADORAS_ROUTE,
          },
          {
            id: 'convites',
            label: 'Convites de transportadora',
            icon: 'forward_to_inbox',
            route: CADASTRO_TRANSPORTADORAS_CONVITES_ROUTE,
          },
          {
            id: 'transportadoras-relatorio',
            label: 'Relatório de transportadoras',
            icon: 'summarize',
            route: CADASTRO_TRANSPORTADORAS_RELATORIO_ROUTE,
          },
          {
            id: 'motoristas',
            label: 'Motoristas',
            icon: 'badge',
            route: CADASTRO_MOTORISTAS_ROUTE,
          },
          {
            id: 'veiculos',
            label: 'Veículos',
            icon: 'directions_car',
            route: CADASTRO_VEICULOS_ROUTE,
            keywords: ['placas', 'frota'],
          },
          {
            id: 'responsaveis',
            label: 'Responsáveis de faturamento',
            icon: 'account_box',
            route: CADASTRO_RESPONSAVEIS_FATURAMENTO_ROUTE,
            keywords: ['pagador', 'terceiro', 'fob'],
          },
        ],
      },
      {
        id: 'administracao',
        label: 'Administração',
        icon: 'manage_accounts',
        children: [
          { id: 'usuarios', label: 'Usuários', icon: 'group', route: ADMINISTRACAO_USUARIO_ROUTE },
          {
            id: 'permissoes',
            label: 'Permissões',
            icon: 'shield_person',
            route: ADMINISTRACAO_PERMISSAO_ROUTE,
            keywords: ['perfis', 'acesso'],
          },
          { id: 'ecossistema', label: 'Ecossistema', icon: 'hub', route: ECOSSISTEMA_ROUTE },
          {
            id: 'qualidade',
            label: 'Qualidade e testes',
            icon: 'fact_check',
            route: QUALIDADE_ROUTE,
          },
        ],
      },
      {
        id: 'gerenciamento',
        label: 'Gerenciamento',
        icon: 'admin_panel_settings',
        children: [
          { id: 'menu', label: 'Menu', icon: 'menu_open', route: '/app/gerenciamento/menu' },
          {
            id: 'banco',
            label: 'Banco de dados',
            icon: 'database',
            route: '/app/gerenciamento/bancoDados',
          },
          {
            id: 'auditoria',
            label: 'Auditoria',
            icon: 'history',
            route: '/app/gerenciamento/auditoria',
          },
          {
            id: 'estacionamento',
            label: 'Estacionamentos',
            icon: 'warehouse',
            route: '/app/gerenciamento/estacionamento',
            keywords: ['pátios'],
          },
          {
            id: 'horario',
            label: 'Horário',
            icon: 'schedule',
            route: '/app/gerenciamento/horario',
          },
          {
            id: 'custos',
            label: 'Custos gerenciais',
            icon: 'monitoring',
            route: '/app/gerenciamento/custos',
          },
        ],
      },
      {
        id: 'configuracoes',
        label: 'Configurações',
        icon: 'settings',
        children: [
          {
            id: 'parametros',
            label: 'Parâmetros',
            icon: 'tune',
            route: '/app/configuracoes/parametros',
          },
        ],
      },
    ],
  },
];

export interface NavEntry {
  group: NavGroup;
  parent: NavItem | null;
  item: NavItem;
}

/** Lista plana de destinos navegáveis (para busca rápida, trilha e barra inferior). */
export const flattenNav = (groups: NavGroup[] = NAV): NavEntry[] =>
  groups.flatMap((group) =>
    group.items.flatMap((item): NavEntry[] =>
      item.children
        ? item.children.map((child) => ({ group, parent: item, item: child }))
        : [{ group, parent: null, item }],
    ),
  );
