import { Routes } from '@angular/router';
import { AGENDAMENTOS_PATH } from './agendamento-rotas';

/** Painel operacional: `/app/agendamento` (submenu do Pátio). */
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

/** Menu Agendar: `/app/agendar`. */
export const AGENDAR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/agendar-page/agendar-page.component').then((m) => m.AgendarPageComponent),
    title: 'Agendar',
  },
];
