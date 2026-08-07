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
    title: 'Entrada e Saída',
    children: [
      {
        path: '',
        component: MovimentosPageComponent,
        title: 'Entrada e Saída'
      },
      {
        path: ':id',
        component: EntradaSaidaFormComponent,
        title: 'Entrada e Saída'
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
