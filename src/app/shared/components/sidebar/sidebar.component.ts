import { Component, OnInit, output, input, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MenuAdminService } from '../../../features/gerenciamento/services/menu-admin.service';
import { SessionAccessService } from '../../../core/services/session-access.service';

interface MenuSubItem {
  label: string;
  route: string;
  children?: MenuSubItem[];
}

interface MenuItem {
  label: string;
  route: string;
  icon: string;
  children?: MenuSubItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly menuAdmin = inject(MenuAdminService);
  private readonly sessionAccess = inject(SessionAccessService);

  /** Controlado pelo MainLayout (hamburger na topbar). */
  collapsed = input<boolean>(false);
  mobileOpen = input<boolean>(false);
  isMobile = input<boolean>(false);
  closeMobile = output<void>();
  collapsedChange = output<boolean>();

  isCollapsed = computed(() => this.collapsed());
  currentRoute = '';
  /** Rota do menu com subitens que está expandido. */
  expandedMenuRoute = signal<string | null>(null);

  /**
   * Itens da sidebar: menus da sessão + filtro Admin.
   * Gerenciamento exige Role JWT `"Admin"` (mesmo critério de `[RoleAuthorize(SystemRoles.Admin)]` / `adminRoleGuard`).
   */
  menuItems = computed<MenuItem[]>(() => {
    const items = this.sessionAccess.filterSidebarItems(
      this.menuAdmin.sidebarMenuItems() as MenuItem[]
    );
    if (this.authService.isAdmin()) {
      return items;
    }
    return items.filter((item) => !this.isGerenciamentoMenuItem(item));
  });

  ngOnInit(): void {
    this.currentRoute = this.router.url;
    this.router.events.subscribe(() => {
      this.currentRoute = this.router.url;
      this.autoExpandFromRoute();
    });
    this.autoExpandFromRoute();
  }

  private autoExpandFromRoute(): void {
    const url = this.currentRoute;
    for (const item of this.menuItems()) {
      if (item.children?.length) {
        const hit = item.children.some((c) => {
          if (url.startsWith(c.route)) return true;
          return c.children?.some((n) => url.startsWith(n.route)) ?? false;
        });
        if (hit) {
          this.expandedMenuRoute.set(item.route);
          return;
        }
      }
    }
  }

  isMenuExpanded(route: string): boolean {
    return this.expandedMenuRoute() === route;
  }

  toggleMenu(route: string): void {
    this.expandedMenuRoute.set(this.expandedMenuRoute() === route ? null : route);
  }

  onToggleClick(): void {
    if (this.isMobile()) {
      if (this.mobileOpen()) {
        this.closeMobile.emit();
      }
    } else {
      this.collapsedChange.emit(!this.isCollapsed());
    }
  }

  isActive(route: string): boolean {
    const current = this.normalizeRoute(this.currentRoute);
    const target = this.normalizeRoute(route);
    if (!target) return false;
    if (target === '/app') return current === '/app';
    return current === target || current.startsWith(`${target}/`);
  }

  private normalizeRoute(route: string): string {
    const noHash = route.split('#')[0] ?? '';
    const noQuery = noHash.split('?')[0] ?? '';
    const trimmed = noQuery.trim();
    if (!trimmed) return '';
    if (trimmed === '/app/') return '/app';
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  /** Espelha backend `SystemRoles.Admin` — item só para Admin. */
  private isGerenciamentoMenuItem(item: MenuItem): boolean {
    const route = this.normalizeRoute(item.route).toLowerCase();
    if (
      route === '/app/cadastro/estacionamento' ||
      route.startsWith('/app/cadastro/estacionamento/')
    ) {
      return false;
    }
    if (route === '/app/gerenciamento' || route.startsWith('/app/gerenciamento/')) {
      return true;
    }
    return (item.label ?? '').trim().toLowerCase() === 'gerenciamento';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
