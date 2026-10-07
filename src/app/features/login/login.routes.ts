import { Routes } from '@angular/router';

export const LOGIN_ROUTES: Routes = [
  {
    path: 'auth/confirmar-email',
    loadComponent: () =>
      import('./pages/confirmar-email-page/confirmar-email-page.component').then(
        (m) => m.ConfirmarEmailPageComponent
      ),
  },
  {
    path: 'auth/esqueci-senha',
    loadComponent: () =>
      import('./pages/esqueci-senha-page/esqueci-senha-page.component').then(
        (m) => m.EsqueciSenhaPageComponent
      ),
  },
  {
    path: 'auth/redefinir-senha',
    loadComponent: () =>
      import('./pages/redefinir-senha-page/redefinir-senha-page.component').then(
        (m) => m.RedefinirSenhaPageComponent
      ),
  },
  { path: 'forgot', redirectTo: 'auth/esqueci-senha', pathMatch: 'full' },
  {
    path: '',
    loadComponent: () =>
      import('./pages/login-page/login-page.component').then(
        (m) => m.LoginPageComponent
      ),
  },
];
