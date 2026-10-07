import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import {
  ADMINISTRACAO_PERMISSAO_PATH,
  ADMINISTRACAO_USUARIO_PATH,
} from './administracao-rotas';
import { ECOSSISTEMA_PATH } from '../ecossistema/ecossistema-rotas';

export const ADMINISTRACAO_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: ADMINISTRACAO_USUARIO_PATH },
  {
    path: ADMINISTRACAO_USUARIO_PATH,
    loadComponent: () =>
      import('../gerenciamento/pages/gerenciamento-page/gerenciamento-page.component').then(
        (m) => m.GerenciamentoPageComponent
      ),
    canActivate: [permissionGuard],
    data: { permissions: ['usuario.visualizar'] },
  },
  {
    path: ADMINISTRACAO_PERMISSAO_PATH,
    loadComponent: () =>
      import('../cadastro/pages/acessos-perfis-page/acessos-perfis-page.component').then(
        (m) => m.AcessosPerfisPageComponent
      ),
  },
  {
    path: ECOSSISTEMA_PATH,
    loadComponent: () =>
      import('../ecossistema/pages/ecossistema-page/ecossistema-page.component').then(
        (m) => m.EcossistemaPageComponent
      ),
  },
];
