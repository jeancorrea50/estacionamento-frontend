import { Routes } from '@angular/router';
import { ConfiguracoesLayoutComponent } from './configuracoes-layout/configuracoes-layout.component';
import { permissionGuard } from '../../core/guards/permission.guard';

export const CONFIGURACOES_ROUTES: Routes = [
  {
    path: '',
    component: ConfiguracoesLayoutComponent,
    children: [
      { path: '', redirectTo: 'usuarios', pathMatch: 'full' },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('../gerenciamento/pages/gerenciamento-page/gerenciamento-page.component').then(
            (m) => m.GerenciamentoPageComponent
          ),
        canActivate: [permissionGuard],
        data: { permissions: ['usuario.visualizar'] },
      },
      {
        path: 'horario',
        loadComponent: () =>
          import('./pages/horario-page/horario-page.component').then((m) => m.HorarioPageComponent),
      },
      {
        path: 'perfis',
        redirectTo: '/app/gerenciamento/perfil',
        pathMatch: 'full',
      },
    ],
  },
];
