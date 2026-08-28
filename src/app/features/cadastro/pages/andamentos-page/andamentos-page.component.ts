import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface MenuLink {
  label: string;
  route: string;
}

interface TelaItem {
  rota: string;
  tela: string;
  descricao: string;
}

interface Ligamento {
  origem: string;
  acao: string;
  destino: string;
}

@Component({
  selector: 'app-andamentos-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './andamentos-page.component.html',
  styleUrls: ['./andamentos-page.component.scss'],
})
export class AndamentosPageComponent {
  readonly arvoreRotas: string[] = [
    '/                          → Login (público) ou redirect /app/dashboard',
    '/app                       → redirect /app/dashboard',
    '/app (MainLayout)',
    '├── /dashboard             → Dashboard',
    '├── /patio                 → Pátio (Entrada e Saída / Movimentações)',
    '├── /relatorios            → Relatórios',
    '├── /faturamento           → Faturamento',
    '├── /configuracoes         → Configurações',
    '└── /cadastro (CadastroLayoutComponent)',
    "    ├── ''                 → redirect /cadastro/Estacionamento",
    '    ├── /Estacionamento (EstacionamentoLayoutComponent)',
    "    │   ├── ''             → Lista de Estacionamentos",
    '    │   ├── /novo          → Formulário novo Estacionamento',
    '    │   └── /editar/:id    → Formulário editar Estacionamento',
    '    ├── /transportadora    → Página Cadastro Transportadora',
    '    └── /acessos (CadastroAcessosPageComponent – com abas)',
    "        (Acessos movido para Configurações: /app/configuracoes/usuarios)",
    '        ├── /usuarios (AcessosUsuariosLayoutComponent)',
    "        │   └── ''         → Lista Usuários + modal Novo/Editar",
    '        └── /perfis        → Página Perfis (modal criar/editar/excluir)',
  ];

  readonly menuSidebar: MenuLink[] = [
    { label: 'Dashboard', route: '/app/dashboard' },
    { label: 'Entrada e Saída', route: '/app/patio/entrada-saida' },
    { label: 'Movimentações', route: '/app/patio/movimentacoes' },
    { label: 'Relatórios', route: '/app/relatorios' },
    { label: 'Faturamento', route: '/app/financeiro/faturamento' },
    { label: 'Gerenciamento', route: '/app/gerenciamento' },
    { label: 'Cadastro > Transportadora', route: '/app/cadastro/transportadora' },
    { label: 'Configurações', route: '/app/configuracoes' },
    { label: 'Configurações > Usuários', route: '/app/configuracoes/usuarios' },
  ];

  readonly telas: TelaItem[] = [
    { rota: '/', tela: 'Login', descricao: 'Login (usuário/senha). Após sucesso → navega para /app/dashboard.' },
    { rota: '/app/dashboard', tela: 'Dashboard', descricao: 'Página inicial da área logada.' },
    { rota: '/app/patio/entrada-saida', tela: 'Entrada e Saída', descricao: 'Operação de entrada e saída no pátio.' },
    { rota: '/app/patio/movimentacoes', tela: 'Movimentações', descricao: 'Listagem e operação de movimentações no pátio.' },
    { rota: '/app/relatorios', tela: 'Relatórios', descricao: 'Página de relatórios.' },
    { rota: '/app/financeiro/faturamento', tela: 'Faturamento', descricao: 'Página de faturamento.' },
    { rota: '/app/configuracoes', tela: 'Configurações', descricao: 'Página de configurações.' },
    { rota: '/app/cadastro/Estacionamento', tela: 'Lista Estacionamento', descricao: 'Listagem, busca, botão Novo, link Editar por item.' },
    { rota: '/app/cadastro/Estacionamento/novo', tela: 'Form Estacionamento (novo)', descricao: 'Formulário em etapas (stepper) para novo Estacionamento.' },
    { rota: '/app/cadastro/Estacionamento/editar/:id', tela: 'Form Estacionamento (editar)', descricao: 'Mesmo formulário, modo edição.' },
    { rota: '/app/cadastro/transportadora', tela: 'Cadastro Transportadora', descricao: 'Página de cadastro de transportadora.' },
    { rota: '/app/configuracoes', tela: 'Configurações (container)', descricao: 'Abas: Usuários.' },
    { rota: '/app/configuracoes/usuarios', tela: 'Usuários', descricao: 'Lista de usuários, busca, modal Novo usuário / Editar.' },
    { rota: '/app/gerenciamento/perfil', tela: 'Perfil', descricao: 'Lista de perfis, modal Criar/Editar/Excluir com permissões.' },
  ];

  readonly ligamentosEstacionamento: Ligamento[] = [
    { origem: 'Lista Estacionamento', acao: 'Botão Novo', destino: '/app/cadastro/Estacionamento/novo' },
    { origem: 'Lista Estacionamento', acao: 'Link Editar na linha', destino: '/app/cadastro/Estacionamento/editar/:id' },
    { origem: 'Form (novo/editar)', acao: 'Botão Voltar', destino: '/app/cadastro/Estacionamento' },
  ];

  readonly ligamentosAcessos: Ligamento[] = [
    { origem: 'Container Configurações', acao: 'Aba Usuários', destino: '/app/configuracoes/usuarios' },
    { origem: 'Container Gerenciamento', acao: 'Aba Perfil', destino: '/app/gerenciamento/perfil' },
    { origem: 'Modal Novo/Editar usuário', acao: 'Cancelar / após Salvar', destino: 'Fecha modal (permanece em Usuários)' },
  ];

  readonly arquivosRotas: { arquivo: string; responsabilidade: string }[] = [
    { arquivo: 'src/app/app.routes.ts', responsabilidade: 'Rotas raiz, layout /app, guard, redirects.' },
    { arquivo: 'src/app/features/login/login.routes.ts', responsabilidade: 'Rota pública / (login).' },
    { arquivo: 'src/app/features/dashboard/dashboard.routes.ts', responsabilidade: '/app/dashboard.' },
    { arquivo: 'src/app/features/patio/patio.routes.ts', responsabilidade: '/app/patio.' },
    { arquivo: 'src/app/features/movimentos/movimentos.routes.ts', responsabilidade: 'Redirects legados /app/movimentos/*.' },
    { arquivo: 'src/app/features/relatorios/relatorios.routes.ts', responsabilidade: '/app/relatorios.' },
    { arquivo: 'src/app/features/financeiro/financeiro.routes.ts', responsabilidade: '/app/financeiro/faturamento.' },
    { arquivo: 'src/app/features/configuracoes/configuracoes.routes.ts', responsabilidade: '/app/configuracoes.' },
    { arquivo: 'src/app/features/cadastro/cadastro.routes.ts', responsabilidade: 'Estacionamento (lista/novo/editar), Transportadora, Acessos (Usuários/Perfis).' },
  ];
}
