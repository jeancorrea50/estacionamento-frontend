import { Routes } from '@angular/router';
import { EstacionamentoLayoutComponent } from './estacionamento-layout.component';
import {
  CADASTRO_ESTACIONAMENTO_PATH,
  CADASTRO_MOTORISTAS_PATH,
  CADASTRO_TRANSPORTADORAS_PATH,
  CADASTRO_VEICULOS_PATH,
} from './cadastro-rotas';

const transportadoraPage = () =>
  import('./pages/cadastro-transportadora-page/cadastro-transportadora-page.component').then(
    (m) => m.CadastroTransportadoraPageComponent
  );

export const CADASTRO_ROUTES: Routes = [
  {
    path: '',
    redirectTo: CADASTRO_ESTACIONAMENTO_PATH,
    pathMatch: 'full',
  },
  {
    path: CADASTRO_ESTACIONAMENTO_PATH,
    component: EstacionamentoLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/estacionamento-list/estacionamento-list.component').then(
            (m) => m.EstacionamentoListComponent
          ),
      },
      {
        path: 'novo',
        loadComponent: () =>
          import('./pages/estacionamento-form/estacionamento-form.component').then(
            (m) => m.EstacionamentoFormComponent
          ),
      },
      {
        path: 'editar/:id',
        loadComponent: () =>
          import('./pages/estacionamento-form/estacionamento-form.component').then(
            (m) => m.EstacionamentoFormComponent
          ),
      },
    ],
  },
  {
    path: `${CADASTRO_TRANSPORTADORAS_PATH}/editar/:id`,
    loadComponent: transportadoraPage,
  },
  {
    path: CADASTRO_TRANSPORTADORAS_PATH,
    loadComponent: transportadoraPage,
  },
  {
    path: CADASTRO_VEICULOS_PATH,
    loadComponent: transportadoraPage,
    data: { forceTab: 'frota' },
  },
  {
    path: CADASTRO_MOTORISTAS_PATH,
    loadComponent: transportadoraPage,
    data: { forceTab: 'motoristas' },
  },
  // Legado: rotas singulares → canônico plural
  {
    path: 'transportadora/editar/:id',
    redirectTo: `${CADASTRO_TRANSPORTADORAS_PATH}/editar/:id`,
  },
  {
    path: 'transportadora',
    pathMatch: 'full',
    redirectTo: CADASTRO_TRANSPORTADORAS_PATH,
  },
  {
    path: 'motorista',
    pathMatch: 'full',
    redirectTo: CADASTRO_MOTORISTAS_PATH,
  },
  {
    path: 'veiculo',
    pathMatch: 'full',
    redirectTo: CADASTRO_VEICULOS_PATH,
  },
  { path: 'acessos', redirectTo: '/app/configuracoes/usuarios', pathMatch: 'full' },
  { path: 'acessos/usuarios', redirectTo: '/app/configuracoes/usuarios', pathMatch: 'full' },
  { path: 'acessos/perfis', redirectTo: '/app/gerenciamento/perfil', pathMatch: 'full' },
  { path: 'acessos/permissoes', redirectTo: '/app/gerenciamento/menu', pathMatch: 'full' },
];
