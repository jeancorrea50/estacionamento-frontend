import { Routes } from '@angular/router';
import { AGENDAMENTOS_PATH } from './agendamento-rotas';

export const AGENDAMENTO_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: AGENDAMENTOS_PATH },
  {
    path: AGENDAMENTOS_PATH,
    loadComponent: () =>
      import('./pages/agendamentos-page/agendamentos-page.component').then(
        (m) => m.AgendamentosPageComponent
      ),
  },
];
