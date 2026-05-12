import { Routes } from '@angular/router';
import { FaturamentoPageComponent } from './pages/faturamento-page/faturamento-page.component';

export const FINANCEIRO_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'faturamento'
  },
  {
    path: 'faturamento',
    component: FaturamentoPageComponent
  }
];
