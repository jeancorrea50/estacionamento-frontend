import { Routes } from '@angular/router';
import { GerenciamentoLayoutComponent } from './gerenciamento-layout/gerenciamento-layout.component';
import { adminRoleGuard } from '../../core/guards/admin-role.guard';
import { CADASTRO_ESTACIONAMENTOS_PATH } from '../cadastro/cadastro-rotas';

export const GERENCIAMENTO_ROUTES: Routes = [
  /** Legado: `/app/gerenciamento/estacionamento` → lista em Cadastro. */
  {
    path: 'estacionamento',
    pathMatch: 'full',
    redirectTo: `/app/cadastro/${CADASTRO_ESTACIONAMENTOS_PATH}`,
  },
  {
    path: '',
    component: GerenciamentoLayoutComponent,
    canActivate: [adminRoleGuard],
    canActivateChild: [adminRoleGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'menu',
      },
      { path: 'permissoes', redirectTo: 'menu', pathMatch: 'full' },
      { path: 'admin', redirectTo: 'menu', pathMatch: 'full' },
      {
        path: 'menu',
        loadComponent: () =>
          import('./pages/menu-admin-page/menu-admin-page.component').then(
            (m) => m.MenuAdminPageComponent
          ),
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('../cadastro/pages/acessos-perfis-page/acessos-perfis-page.component').then(
            (m) => m.AcessosPerfisPageComponent
          ),
      },
      {
        path: 'bancoDados',
        loadComponent: () =>
          import('./pages/banco-dados-page/banco-dados-page.component').then(
            (m) => m.BancoDadosPageComponent
          ),
      },
      {
        path: 'banco-dados',
        redirectTo: 'bancoDados',
        pathMatch: 'full',
      },
    ],
  },
];
