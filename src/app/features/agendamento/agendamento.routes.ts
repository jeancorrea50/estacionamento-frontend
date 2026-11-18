import { Routes } from '@angular/router';
import { AGENDAMENTOS_PATH, AGENDAMENTO_PAINEL_ROUTE } from './agendamento-rotas';

/**
 * Legado sob `/app/agendamento/*` — redireciona para as rotas canônicas.
 * Painel do pátio: `/app/patio/agendamentos/painel`
 * Agendar: `/app/agendar`
 */
export const AGENDAMENTO_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: AGENDAMENTO_PAINEL_ROUTE },
  { path: AGENDAMENTOS_PATH, pathMatch: 'full', redirectTo: AGENDAMENTO_PAINEL_ROUTE },
  { path: 'agendar', pathMatch: 'full', redirectTo: '/app/agendar' },
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
