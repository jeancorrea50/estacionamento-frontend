import { Routes } from '@angular/router';
import { ConfiguracoesLayoutComponent } from './configuracoes-layout/configuracoes-layout.component';

export const CONFIGURACOES_ROUTES: Routes = [
  {
    path: '',
    component: ConfiguracoesLayoutComponent,
    children: [
      { path: '', redirectTo: 'parametros', pathMatch: 'full' },
      {
        path: 'parametros',
        loadComponent: () =>
          import('./pages/parametros-page/parametros-page.component').then(
            (m) => m.ParametrosPageComponent
          ),
      },
      {
        path: 'horario',
        redirectTo: '/app/gerenciamento/horario',
        pathMatch: 'full',
      },
      {
        path: 'usuarios',
        redirectTo: '/app/administracao/usuario',
        pathMatch: 'full',
      },
      {
        path: 'perfis',
        redirectTo: '/app/administracao/permissao',
        pathMatch: 'full',
      },
    ],
  },
];
