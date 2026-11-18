import { Routes } from '@angular/router';
import { EntradaSaidaShellComponent } from '../movimentos/entrada-saida/entrada-saida-shell.component';
import { EntradaSaidaFormComponent } from '../movimentos/entrada-saida/entrada-saida-form.component';
import { MovimentosPageComponent } from '../movimentos/pages/movimentos-page/movimentos-page.component';
import {
  PATIO_AGENDAMENTOS_JANELAS_PATH,
  PATIO_AGENDAMENTOS_PATH,
  PATIO_ENTRADA_SAIDA_PATH,
  PATIO_MOVIMENTACOES_PATH,
  PATIO_MOVIMENTACOES_RELATORIO_PATH,
} from './patio-rotas';

export const PATIO_ROUTES: Routes = [
  {
    path: '',
    redirectTo: PATIO_MOVIMENTACOES_PATH,
    pathMatch: 'full',
  },
  {
    path: PATIO_MOVIMENTACOES_RELATORIO_PATH,
    loadComponent: () =>
      import('./pages/movimentacao-relatorio/movimentacao-relatorio.component').then(
        (m) => m.MovimentacaoRelatorioComponent
      ),
    title: 'Relatório',
  },
  {
    path: PATIO_MOVIMENTACOES_PATH,
    component: MovimentosPageComponent,
    title: 'Movimentações',
    data: { movimentosView: 'operacao' },
  },
  {
    path: PATIO_ENTRADA_SAIDA_PATH,
    component: EntradaSaidaShellComponent,
    title: 'Entrada e Saída',
    children: [
      {
        path: '',
        component: MovimentosPageComponent,
        title: 'Entrada e Saída',
        data: { movimentosView: 'portaria' },
      },
      {
        path: ':id',
        component: EntradaSaidaFormComponent,
        title: 'Entrada e Saída',
      },
    ],
  },
  // Janelas ANTES de `agendamentos` (ordem importa: path mais específico primeiro).
  {
    path: PATIO_AGENDAMENTOS_JANELAS_PATH,
    loadComponent: () =>
      import('../agendamento/pages/janelas-page/janelas-page.component').then(
        (m) => m.JanelasPageComponent
      ),
    title: 'Janelas de agendamento',
  },
  {
    path: PATIO_AGENDAMENTOS_PATH,
    loadComponent: () =>
      import('../agendamento/pages/agendamentos-page/agendamentos-page.component').then(
        (m) => m.AgendamentosPageComponent
      ),
    title: 'Agendamentos',
  },
  {
    path: '**',
    redirectTo: PATIO_MOVIMENTACOES_PATH,
    pathMatch: 'full',
  },
];
