import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { MenuAdminService } from '../../../features/gerenciamento/services/menu-admin.service';
import { SessionAccessService } from '../../../core/services/session-access.service';

interface MenuSubItem {
  label: string;
  route: string;
  icon?: string;
  children?: MenuSubItem[];
}

interface MenuItem {
  label: string;
  route: string;
  icon: string;
  children?: MenuSubItem[];
}

interface RailFlyoutState {
  item: MenuItem;
  top: number;
  pinned: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly menuAdmin = inject(MenuAdminService);
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly destroyRef = inject(DestroyRef);

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
  /** Flyout lateral quando a sidebar está recolhida (desktop). */
  readonly railFlyout = signal<RailFlyoutState | null>(null);

  private railCloseTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Itens da sidebar: árvore fixa filtrada pelo acesso do login (`menus`).
   */
  menuItems = computed<MenuItem[]>(() => {
    return this.sessionAccess.filterSidebarItems(
      this.menuAdmin.sidebarMenuItems() as MenuItem[]
    );
  });

  constructor() {
    effect(() => {
      if (!this.isCollapsed() || this.isMobile()) {
        untracked(() => this.closeRailFlyout());
      }
    });

    this.destroyRef.onDestroy(() => this.clearRailCloseTimer());
  }

  ngOnInit(): void {
    this.currentRoute = this.router.url;
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.currentRoute = this.router.url;
        this.autoExpandFromRoute();
        this.closeRailFlyout();
      });
    this.autoExpandFromRoute();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.railFlyout()) return;
    const target = event.target as Element | null;
    if (!target) return;
    if (target.closest('.rail-flyout') || target.closest('.menu-li')) return;
    this.closeRailFlyout();
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

  isParentExpanded(item: MenuItem): boolean {
    if (this.canShowRailFlyout()) {
      return this.railFlyout()?.item.route === item.route;
    }
    return this.isMenuExpanded(item.route);
  }

  canShowRailFlyout(): boolean {
    return this.isCollapsed() && !this.isMobile();
  }

  onRailItemEnter(item: MenuItem, event: MouseEvent): void {
    if (!this.canShowRailFlyout()) return;
    const current = this.railFlyout();
    if (current?.pinned && current.item.route === item.route) {
      this.clearRailCloseTimer();
      return;
    }
    if (current?.pinned && current.item.route !== item.route) {
      // Troca o item pinado ao passar em outro ícone.
    }
    this.clearRailCloseTimer();
    this.openRailFlyout(item, event.currentTarget as HTMLElement, current?.pinned ?? false);
  }

  onRailItemLeave(): void {
    if (!this.canShowRailFlyout()) return;
    const current = this.railFlyout();
    if (current?.pinned) return;
    this.scheduleRailClose();
  }

  onParentClick(item: MenuItem, event: MouseEvent): void {
    if (!this.canShowRailFlyout()) {
      this.toggleMenu(item.route);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const current = this.railFlyout();
    if (current?.item.route === item.route && current.pinned) {
      this.closeRailFlyout();
      return;
    }

    const anchor =
      (event.currentTarget as HTMLElement)?.closest('.menu-li') ??
      (event.currentTarget as HTMLElement);
    this.openRailFlyout(item, anchor as HTMLElement, true);
  }

  onFlyoutEnter(): void {
    this.clearRailCloseTimer();
  }

  onFlyoutLeave(): void {
    const current = this.railFlyout();
    if (current?.pinned) return;
    this.scheduleRailClose();
  }

  onFlyoutNavigate(): void {
    this.closeRailFlyout();
  }

  onToggleClick(): void {
    if (this.isMobile()) {
      if (this.mobileOpen()) {
        this.closeMobile.emit();
      }
    } else {
      this.closeRailFlyout();
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

  private toggleMenu(route: string): void {
    this.expandedMenuRoute.set(this.expandedMenuRoute() === route ? null : route);
  }

  private openRailFlyout(item: MenuItem, anchor: HTMLElement, pinned: boolean): void {
    const rect = anchor.getBoundingClientRect();
    const childCount = this.countFlyoutRows(item);
    const estimatedHeight = 48 + Math.max(childCount, 0) * 36;
    const maxTop = Math.max(8, window.innerHeight - estimatedHeight - 8);
    const top = Math.max(8, Math.min(rect.top, maxTop));
    this.railFlyout.set({ item, top, pinned });
  }

  private normalizeRoute(route: string): string {
    const noHash = route.split('#')[0] ?? '';
    const noQuery = noHash.split('?')[0] ?? '';
    const trimmed = noQuery.trim();
    if (!trimmed) return '';
    if (trimmed === '/app/') return '/app';
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  private countFlyoutRows(item: MenuItem): number {
    if (!item.children?.length) return 0;
    let n = 0;
    for (const sub of item.children) {
      n += 1;
      n += sub.children?.length ?? 0;
    }
    return n;
  }

  private scheduleRailClose(): void {
    this.clearRailCloseTimer();
    this.railCloseTimer = setTimeout(() => {
      const current = this.railFlyout();
      if (current?.pinned) return;
      this.railFlyout.set(null);
    }, 220);
  }

  private clearRailCloseTimer(): void {
    if (this.railCloseTimer !== null) {
      clearTimeout(this.railCloseTimer);
      this.railCloseTimer = null;
    }
  }

  private closeRailFlyout(): void {
    this.clearRailCloseTimer();
    this.railFlyout.set(null);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
