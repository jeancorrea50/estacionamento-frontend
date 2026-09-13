import { Routes } from '@angular/router';
import { EntradaSaidaShellComponent } from '../movimentos/entrada-saida/entrada-saida-shell.component';
import { EntradaSaidaFormComponent } from '../movimentos/entrada-saida/entrada-saida-form.component';
import { MovimentosPageComponent } from '../movimentos/pages/movimentos-page/movimentos-page.component';
import {
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
    title: 'Relatório de Movimentações',
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
  {
    path: '**',
    redirectTo: PATIO_MOVIMENTACOES_PATH,
    pathMatch: 'full',
  },
];
