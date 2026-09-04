import { Routes } from '@angular/router';
import { FaturamentoPageComponent } from './pages/faturamento-page/faturamento-page.component';
import {
  FATURAMENTO_CONFIG_PATH,
  PAGAMENTOS_PATH,
} from './faturamento-rotas';

/** Abas e configuração em `/app/financeiro/faturamento/...`. */
export const FATURAMENTO_ROUTES: Routes = [
  {
    path: FATURAMENTO_CONFIG_PATH,
    loadComponent: () =>
      import('./pages/faturamento-page/config-cobranca/faturamento-config-cobranca.component').then(
        (m) => m.FaturamentoConfigCobrancaComponent
      ),
  },
  {
    path: 'configuracao-cobranca',
    pathMatch: 'full',
    redirectTo: FATURAMENTO_CONFIG_PATH,
  },
  {
    path: 'config-cobranca',
    pathMatch: 'full',
    redirectTo: FATURAMENTO_CONFIG_PATH,
  },
  {
    path: 'configuracao',
    pathMatch: 'full',
    redirectTo: FATURAMENTO_CONFIG_PATH,
  },
  {
    path: 'recebimentos',
    pathMatch: 'full',
    redirectTo: `/app/financeiro/${PAGAMENTOS_PATH}`,
  },
  {
    path: '',
    component: FaturamentoPageComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'visao-geral',
      },
      {
        path: 'visao-geral',
        loadComponent: () =>
          import('./pages/faturamento-page/visao-geral/faturamento-visao-geral.component').then(
            (m) => m.FaturamentoVisaoGeralComponent
          ),
      },
      {
        path: 'fechamentos',
        loadComponent: () =>
          import('./pages/faturamento-page/fechamentos/faturamento-fechamentos.component').then(
            (m) => m.FaturamentoFechamentosComponent
          ),
      },
      {
        path: 'faturas',
        loadComponent: () =>
          import('./pages/faturamento-page/faturas/faturamento-faturas.component').then(
            (m) => m.FaturamentoFaturasComponent
          ),
      },
      {
        path: 'inadimplencia',
        loadComponent: () =>
          import('./pages/faturamento-page/inadimplencia/faturamento-inadimplencia.component').then(
            (m) => m.FaturamentoInadimplenciaComponent
          ),
      },
    ],
  },
];

/** Rotas do módulo Financeiro em `/app/financeiro/...`. */
export const FINANCEIRO_APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'faturamento',
  },
  {
    path: 'faturamento',
    children: FATURAMENTO_ROUTES,
  },
  {
    path: PAGAMENTOS_PATH,
    loadComponent: () =>
      import('./pages/faturamento-page/recebimentos/faturamento-recebimentos.component').then(
        (m) => m.FaturamentoRecebimentosComponent
      ),
  },
  {
    path: 'pagamentos',
    pathMatch: 'full',
    redirectTo: PAGAMENTOS_PATH,
  },
];

/** @deprecated Use {@link FATURAMENTO_ROUTES}. */
export const FINANCEIRO_ROUTES = FATURAMENTO_ROUTES;
