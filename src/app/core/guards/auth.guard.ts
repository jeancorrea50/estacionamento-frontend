import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protege rotas autenticadas. Se o JWT estiver expirado, encerra a sessão e manda para o login.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    void router.navigate(['/']);
    return false;
  }

  if (!authService.hasValidSession()) {
    authService.logoutDueToExpiry();
    return false;
  }

  return true;
};
