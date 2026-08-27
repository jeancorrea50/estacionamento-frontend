import { Routes } from '@angular/router';
import { GerenciamentoLayoutComponent } from './gerenciamento-layout/gerenciamento-layout.component';
import { adminRoleGuard } from '../../core/guards/admin-role.guard';

export const GERENCIAMENTO_ROUTES: Routes = [
  /**
   * Fora do adminRoleGuard: o perfil Estacionamento tem este item no menu de login.
   * Novo/Editar continuam em `/app/cadastro/estacionamento/...`.
   */
  {
    path: 'estacionamento',
    loadComponent: () =>
      import('../cadastro/estacionamento-layout.component').then(
        (m) => m.EstacionamentoLayoutComponent
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('../cadastro/pages/estacionamento-list/estacionamento-list.component').then(
            (m) => m.EstacionamentoListComponent
          ),
      },
    ],
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
