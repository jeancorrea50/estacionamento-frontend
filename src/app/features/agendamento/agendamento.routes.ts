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
  /** Legado transportadora: `/app/agendamento/agendamentos` → `/app/agendar`. */
  { path: AGENDAMENTOS_PATH, pathMatch: 'full', redirectTo: '../agendar' },
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
