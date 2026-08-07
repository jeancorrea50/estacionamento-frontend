import { Routes } from '@angular/router';
import { FaturamentoPageComponent } from './pages/faturamento-page/faturamento-page.component';

export const FINANCEIRO_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'faturamento'
  },
  {
    path: 'faturamento',
    component: FaturamentoPageComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'visao-geral'
      },
      {
        path: 'visao-geral',
        loadComponent: () =>
          import('./pages/faturamento-page/visao-geral/faturamento-visao-geral.component').then(
            m => m.FaturamentoVisaoGeralComponent
          )
      },
      {
        path: 'fechamentos',
        loadComponent: () =>
          import('./pages/faturamento-page/fechamentos/faturamento-fechamentos.component').then(
            m => m.FaturamentoFechamentosComponent
          )
      },
      {
        path: 'faturas',
        loadComponent: () =>
          import('./pages/faturamento-page/faturas/faturamento-faturas.component').then(
            m => m.FaturamentoFaturasComponent
          )
      },
      {
        path: 'recebimentos',
        loadComponent: () =>
          import('./pages/faturamento-page/recebimentos/faturamento-recebimentos.component').then(
            m => m.FaturamentoRecebimentosComponent
          )
      },
      {
        path: 'inadimplencia',
        loadComponent: () =>
          import('./pages/faturamento-page/inadimplencia/faturamento-inadimplencia.component').then(
            m => m.FaturamentoInadimplenciaComponent
          )
      },
      {
        path: 'faturas',
        loadComponent: () =>
          import('./pages/faturamento-page/faturas/faturamento-faturas.component').then(
            m => m.FaturamentoFaturasComponent
          )
      },
      {
        path: 'config-cobranca',
        loadComponent: () =>
          import('./pages/faturamento-page/config-cobranca/faturamento-config-cobranca.component').then(
            m => m.FaturamentoConfigCobrancaComponent
          )
      }
    ]
  }
];
