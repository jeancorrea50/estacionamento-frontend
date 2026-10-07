import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard para a rota raiz (path: '').
 * Se o usuário estiver autenticado com sessão válida, redireciona para a primeira rota autorizada.
 * Token expirado → limpa sessão e permanece no login.
 */
export const redirectAuthenticatedToAppGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return true;
  }

  if (!auth.hasValidSession()) {
    auth.clearLocalSessionForLogin();
    return true;
  }

  return router.createUrlTree([auth.getDefaultAuthorizedRoute()]);
};
