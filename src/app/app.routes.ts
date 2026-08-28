import { Routes } from '@angular/router';
import { LOGIN_ROUTES } from './features/login/login.routes';
import { CONFIGURACOES_ROUTES } from './features/configuracoes/configuracoes.routes';
import { GERENCIAMENTO_ROUTES } from './features/gerenciamento/gerenciamento.routes';
import { DASHBOARD_ROUTES } from './features/dashboard/dashboard.routes';
import { MOVIMENTOS_ROUTES } from './features/movimentos/movimentos.routes';
import { RELATORIOS_ROUTES } from './features/relatorios/relatorios.routes';
import { FINANCEIRO_APP_ROUTES } from './features/financeiro/financeiro.routes';
import {
	FATURAMENTO_CONFIG_PATH,
	FATURAMENTO_TABS,
	PAGAMENTOS_PATH,
} from './features/financeiro/faturamento-rotas';
import { CADASTRO_ROUTES } from './features/cadastro/cadastro.routes';
import { CadastroLayoutComponent } from './features/cadastro/cadastro-layout.component';
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
			// Nome singular / legado da API → rota real do SPA (módulo Entrada e Saída)
			{
				path: 'movimento',
				redirectTo: 'movimentos',
				pathMatch: 'full',
			},
			{
				path: 'entrada-saida',
				redirectTo: 'movimentos/entrada-saida',
				pathMatch: 'full',
			},
			{
				path: 'relatorio',
				redirectTo: 'relatorios',
				pathMatch: 'full',
			},
			// 3. ENTRADA E SAÍDA (path técnico: movimentos/*)
			{
				path: 'movimentos',
				children: MOVIMENTOS_ROUTES
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
			// 6. CONFIGURAÇÕES
			{
				path: 'configuracoes',
				children: CONFIGURACOES_ROUTES
			},
			// Legado / bookmark: /app/usuarios → gestão em Configurações
			{
				path: 'usuarios',
				redirectTo: 'configuracoes/usuarios',
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
