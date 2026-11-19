import { Routes } from '@angular/router';
import { RedeCredenciadaPageComponent } from './pages/rede-credenciada-page/rede-credenciada-page.component';

/**
 * Import estático (não lazy): evita falha "Failed to fetch dynamically imported module"
 * ao abrir o menu após deploy, quando o chunk antigo some do gateway.
 */
export const REDE_CREDENCIADA_ROUTES: Routes = [
  {
    path: '',
    component: RedeCredenciadaPageComponent,
    title: 'Rede credenciada',
  },
];
