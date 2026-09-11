import { Routes } from '@angular/router';
import { AGENDAMENTOS_PATH } from './agendamento-rotas';

export const AGENDAMENTO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/agendamentos-page/agendamentos-page.component').then(
        (m) => m.AgendamentosPageComponent
      ),
    title: 'Agendamentos',
  },
  /** Legado: `/app/agendamento/agendamentos` → `/app/agendamento`. */
  { path: AGENDAMENTOS_PATH, pathMatch: 'full', redirectTo: '' },
];
