import { Routes } from '@angular/router';
import { EntradaSaidaShellComponent } from './entrada-saida/entrada-saida-shell.component';
import { EntradaSaidaFormComponent } from './entrada-saida/entrada-saida-form.component';
import { MovimentosPageComponent } from './pages/movimentos-page/movimentos-page.component';

export const MOVIMENTOS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'entrada-saida',
    pathMatch: 'full'
  },
  {
    path: 'entrada-saida',
    component: EntradaSaidaShellComponent,
    children: [
      {
        path: '',
        component: MovimentosPageComponent
      },
      {
        path: ':id',
        component: EntradaSaidaFormComponent
      }
    ]
  },
  {
    path: 'operacao',
    redirectTo: 'entrada-saida',
    pathMatch: 'full',
  },
  {
    path: 'historico',
    redirectTo: 'entrada-saida',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'entrada-saida',
    pathMatch: 'full',
  },
];
