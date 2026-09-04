import { Routes } from '@angular/router';
import { LOGIN_ROUTES } from './features/login/login.routes';
import { CONFIGURACOES_ROUTES } from './features/configuracoes/configuracoes.routes';
import { GERENCIAMENTO_ROUTES } from './features/gerenciamento/gerenciamento.routes';
import { DASHBOARD_ROUTES } from './features/dashboard/dashboard.routes';
import { MOVIMENTOS_ROUTES } from './features/movimentos/movimentos.routes';
import { PATIO_ROUTES } from './features/patio/patio.routes';
import {
	PATIO_ENTRADA_SAIDA_PATH,
} from './features/patio/patio-rotas';
import { RELATORIOS_ROUTES } from './features/relatorios/relatorios.routes';
import { FINANCEIRO_APP_ROUTES } from './features/financeiro/financeiro.routes';
import {
	FATURAMENTO_CONFIG_PATH,
	FATURAMENTO_TABS,
	PAGAMENTOS_PATH,
} from './features/financeiro/faturamento-rotas';
import { CADASTRO_ROUTES } from './features/cadastro/cadastro.routes';
import { CadastroLayoutComponent } from './features/cadastro/cadastro-layout.component';
import { AGENDAMENTO_ROUTES } from './features/agendamento/agendamento.routes';
import { ADMINISTRACAO_ROUTES } from './features/administracao/administracao.routes';
import { authGuard } from './core/guards/auth.guard';
import { redirectAuthenticatedToAppGuard } from './core/guards/redirect-authenticated.guard';
import { routeAccessGuard } from './core/guards/route-access.guard';
import { MainLayoutComponent } from './core/layout/main-layout.component';

export const routes: Routes = [
	// 1. ROTA RAIZ: se autenticado → /app/dashboard; senão → login
	{
		path: '',
		canActivate: [redirectAuthenticatedToAppGuard],
		children: LOGIN_ROUTES,
	},

	// LAYOUT PRINCIPAL (Dashboard, Entrada e Saída, Relatórios, Financeiro, Configurações)
	// Layout Component renderiza sidebar + router-outlet
	{
		path: 'app',
		component: MainLayoutComponent,
		canActivate: [authGuard],
		canActivateChild: [routeAccessGuard],
		children: [
			// DASHBOARD
			{
				path: 'dashboard',
				children: DASHBOARD_ROUTES
			},
			// Legado: aliases antigos → módulo Pátio
			{
				path: 'movimento',
				redirectTo: `patio/${PATIO_ENTRADA_SAIDA_PATH}`,
				pathMatch: 'full',
			},
			{
				path: 'entrada-saida',
				redirectTo: `patio/${PATIO_ENTRADA_SAIDA_PATH}`,
				pathMatch: 'full',
			},
			{
				path: 'relatorio',
				redirectTo: 'relatorios',
				pathMatch: 'full',
			},
			// 3. PÁTIO (`/app/patio/movimentacoes` e `/app/patio/entrada-saida`)
			{
				path: 'patio',
				children: PATIO_ROUTES,
			},
			// Legado: `/app/movimentos/*` → `/app/patio/*`
			{
				path: 'movimentos',
				children: MOVIMENTOS_ROUTES,
			},
			// 4. RELATÓRIOS
			{
				path: 'relatorios',
				children: RELATORIOS_ROUTES
			},
			// 5. FINANCEIRO (`/app/financeiro/faturamento/{aba}` e `/app/financeiro/pagamentos`)
			{
				path: 'financeiro',
				children: FINANCEIRO_APP_ROUTES
			},
			// 5b. AGENDAMENTO
			{
				path: 'agendamento',
				children: AGENDAMENTO_ROUTES,
			},
			// 5c. ADMINISTRAÇÃO
			{
				path: 'administracao',
				children: ADMINISTRACAO_ROUTES,
			},
			// Legado: /app/faturamento → /app/financeiro/faturamento
			{
				path: 'faturamento',
				pathMatch: 'full',
				redirectTo: 'financeiro/faturamento',
			},
			...FATURAMENTO_TABS.map((t) => ({
				path: `faturamento/${t.path}`,
				pathMatch: 'full' as const,
				redirectTo: `financeiro/faturamento/${t.path}`,
			})),
			{
				path: 'faturamento/recebimentos',
				pathMatch: 'full',
				redirectTo: `financeiro/${PAGAMENTOS_PATH}`,
			},
			{
				path: 'faturamento/config-cobranca',
				pathMatch: 'full',
				redirectTo: `financeiro/faturamento/${FATURAMENTO_CONFIG_PATH}`,
			},
			{
				path: 'faturamento/configuracao-cobranca',
				pathMatch: 'full',
				redirectTo: `financeiro/faturamento/${FATURAMENTO_CONFIG_PATH}`,
			},
			{
				path: `faturamento/${FATURAMENTO_CONFIG_PATH}`,
				pathMatch: 'full',
				redirectTo: `financeiro/faturamento/${FATURAMENTO_CONFIG_PATH}`,
			},
			{
				path: 'financeiro/faturamento/recebimentos',
				pathMatch: 'full',
				redirectTo: `financeiro/${PAGAMENTOS_PATH}`,
			},
			{
				path: 'financeiro/recebimentos',
				pathMatch: 'full',
				redirectTo: `financeiro/${PAGAMENTOS_PATH}`,
			},
			{
				path: 'financeiro/pagamentos',
				pathMatch: 'full',
				redirectTo: `financeiro/${PAGAMENTOS_PATH}`,
			},
			// 6. CONFIGURAÇÕES
			{
				path: 'configuracoes',
				children: CONFIGURACOES_ROUTES
			},
			// Legado / bookmark: /app/usuarios → Administração
			{
				path: 'usuarios',
				redirectTo: 'administracao/usuario',
				pathMatch: 'full',
			},
			// 7. GERENCIAMENTO
			{
				path: 'gerenciamento',
				children: GERENCIAMENTO_ROUTES
			},
			// 8. CADASTRO
			{
				path: 'cadastro',
				component: CadastroLayoutComponent,
				children: CADASTRO_ROUTES
			},
			// Redirecionar /app para /app/dashboard
			{
				path: '',
				redirectTo: 'dashboard',
				pathMatch: 'full'
			}
		]
	},

	// future routes can be added here
];
