import { CanActivateChildFn } from '@angular/router';

/**
 * O bloqueio por menu da sessão é feito nas páginas (`SessionAccessService.canAccessRoute`),
 * exibindo mensagem de sem acesso quando o usuário navega para rota fora do payload `menus` do login.
 * O guard mantém apenas autenticação (pai `authGuard`).
 */
export const routeAccessGuard: CanActivateChildFn = () => true;
