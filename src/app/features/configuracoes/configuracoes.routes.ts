import { Routes } from '@angular/router';
import { ConfiguracoesLayoutComponent } from './configuracoes-layout/configuracoes-layout.component';

export const CONFIGURACOES_ROUTES: Routes = [
  {
    path: '',
    component: ConfiguracoesLayoutComponent,
    children: [
      { path: '', redirectTo: 'horario', pathMatch: 'full' },
      {
        path: 'usuarios',
        redirectTo: '/app/administracao/usuario',
        pathMatch: 'full',
      },
      {
        path: 'horario',
        loadComponent: () =>
          import('./pages/horario-page/horario-page.component').then((m) => m.HorarioPageComponent),
      },
      {
        path: 'perfis',
        redirectTo: '/app/administracao/permissao',
        pathMatch: 'full',
      },
    ],
  },
];
