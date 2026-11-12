import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Exige Role Admin (GtCentral.Role.Name = "Admin") no JWT / sessão.
 * Usar em todas as rotas de `/app/gerenciamento/*`.
 */
export const adminRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.parseUrl('/');
  }

  if (auth.isAdmin()) {
    return true;
  }

  return router.parseUrl(auth.getDefaultAuthorizedRoute());
};
