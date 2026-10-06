import { Routes } from '@angular/router';

export const REDE_CREDENCIADA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/rede-credenciada-page/rede-credenciada-page.component').then(
        (m) => m.RedeCredenciadaPageComponent
      ),
    title: 'Rede credenciada',
  },
];
