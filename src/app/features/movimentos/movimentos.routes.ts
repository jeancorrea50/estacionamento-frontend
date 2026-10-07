import { Routes } from '@angular/router';
import {
  PATIO_ENTRADA_SAIDA_ROUTE,
  PATIO_MOVIMENTACOES_ROUTE,
} from '../patio/patio-rotas';

/** Redirects legados: `/app/movimentos/*` → `/app/patio/*`. */
export const MOVIMENTOS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: PATIO_ENTRADA_SAIDA_ROUTE,
    pathMatch: 'full',
  },
  {
    path: 'lista',
    redirectTo: PATIO_MOVIMENTACOES_ROUTE,
    pathMatch: 'full',
  },
  {
    path: 'operacao',
    redirectTo: PATIO_MOVIMENTACOES_ROUTE,
    pathMatch: 'full',
  },
  {
    path: 'entrada-saida',
    redirectTo: PATIO_ENTRADA_SAIDA_ROUTE,
    pathMatch: 'full',
  },
  {
    path: 'entrada-saida/:id',
    redirectTo: `${PATIO_ENTRADA_SAIDA_ROUTE}/:id`,
  },
  {
    path: 'historico',
    redirectTo: PATIO_ENTRADA_SAIDA_ROUTE,
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: PATIO_ENTRADA_SAIDA_ROUTE,
    pathMatch: 'full',
  },
];
