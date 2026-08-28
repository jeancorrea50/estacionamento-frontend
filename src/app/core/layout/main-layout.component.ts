import { Component, signal, computed, OnInit, OnDestroy, HostListener, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, Router, RouterModule, NavigationEnd } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { ThemeService, ThemeMode } from '../services/theme.service';
import { filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { SignalrNotificationService } from '../services/signalr-notification.service';
import { NotificationBellComponent } from './notification-bell/notification-bell.component';
import { decodeJwtPayload } from '../auth/jwt.util';

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';
const ACTIVE_ACCESS_CONTEXT_KEY = 'activeAccessContext';

interface AccessContext {
  contextKey: string;
  tipoAcesso: string;
  cnpj: string | null;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterModule, SidebarComponent, NotificationBellComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private notificationHub = inject(SignalrNotificationService);

  sidebarCollapsed = false;
  private persistSidebarCollapsed(): void {
    if (isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined') {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(this.sidebarCollapsed));
    }
  }
  private loadSidebarCollapsed(): void {
    if (isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      this.sidebarCollapsed = v === 'true';
    }
  }
  private themeMode = signal<ThemeMode>('dark');
  isMobile = signal(false);
  mobileMenuOpen = signal(false);

  currentMode = computed(() => this.themeMode());
  isFullWidthContent = signal(false);
  /** Rotas de Movimentos mantêm o cromado “card sobre card”; demais telas usam UI plana (styles.css). */
  readonly isMovimentosRoute = signal(false);
  private routerSub?: { unsubscribe: () => void };
  readonly loggedUsername = signal<string>('Usuário');
  readonly loggedTipoAcesso = signal<string>('Acesso não identificado');
  readonly accessContexts = signal<AccessContext[]>([]);
  readonly selectedContextKey = signal<string | null>(null);
  readonly selectedContext = computed(
    () => this.accessContexts().find((ctx) => ctx.contextKey === this.selectedContextKey()) ?? null
  );
  readonly selectedContextLabel = computed(() => {
    const selected = this.selectedContext();
    if (!selected) return this.loggedTipoAcesso();
    return selected.cnpj
      ? `${selected.tipoAcesso} - ${this.formatCnpj(selected.cnpj)}`
      : selected.tipoAcesso;
  });
  readonly hasMultipleContexts = computed(() => this.accessContexts().length > 1);

  constructor() {
    this.themeMode.set(this.themeService.getCurrentTheme().mode);
    this.themeService.theme$.subscribe((t) => this.themeMode.set(t.mode));
  }

  ngOnInit(): void {
    this.loadLoggedUserContext();
    this.loadSidebarCollapsed();
    this.checkMobile();
    this.updateFullWidthContent(this.router.url);
    if (this.authService.isAdmin()) {
      void this.notificationHub.connect();
    }
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e) => {
      this.mobileMenuOpen.set(false);
      this.updateFullWidthContent(e.urlAfterRedirects ?? e.url);
    });
  }

  private updateFullWidthContent(url: string): void {
    const movimentos = url.includes('/movimentos') || url.includes('/patio');
    this.isMovimentosRoute.set(movimentos);
    const estacionamento = url.includes('/cadastro/estacionamento');
    const transportadora = url.includes('/cadastro/transportadora');
    const financeiro = url.includes('/financeiro') || url.includes('/faturamento');
    const acessos = url.includes('/configuracoes/');
    const gerenciamento = url.includes('/gerenciamento');
    this.isFullWidthContent.set(
      movimentos || estacionamento || transportadora || financeiro || acessos || gerenciamento
    );
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    void this.notificationHub.disconnect();
  }

  @HostListener('window:resize')
  checkMobile(): void {
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
      this.isMobile.set(window.innerWidth <= MOBILE_BREAKPOINT);
      if (window.innerWidth > MOBILE_BREAKPOINT) {
        this.mobileMenuOpen.set(false);
      }
    }
  }

  onSidebarCollapsed(collapsed: boolean): void {
    this.sidebarCollapsed = collapsed;
    this.persistSidebarCollapsed();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleTheme(): void {
    const next = this.currentMode() === 'dark' ? 'light' : 'dark';
    this.themeService.setThemeMode(next);
  }

  onAccessContextChange(rawValue: string): void {
    const contextKey = rawValue?.trim();
    if (!contextKey) return;
    this.selectedContextKey.set(contextKey);
    if (isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTIVE_ACCESS_CONTEXT_KEY, contextKey);
    }
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('app:access-context-changed', {
          detail: { contextKey }
        })
      );
    }
  }

  private loadLoggedUserContext(): void {
    const loggedUser = this.authService.getLoggedUser();
    if (loggedUser?.username?.trim()) {
      this.loggedUsername.set(loggedUser.username.trim());
    }

    const token = this.authService.getAccessToken();
    const payload = token ? decodeJwtPayload(token) : null;
    const defaultTipo = this.resolveTipoAcesso(
      loggedUser?.perfil ?? null,
      Array.isArray(loggedUser?.permissionKeys) ? loggedUser!.permissionKeys : []
    );

    this.loggedTipoAcesso.set(defaultTipo);
    const contexts = this.extractAccessContexts(payload, loggedUser as unknown as Record<string, unknown> | null, defaultTipo);
    this.accessContexts.set(contexts);

    const preferred = this.loadPreferredContextKey();
    const selected = preferred && contexts.some((c) => c.contextKey === preferred)
      ? preferred
      : contexts[0]?.contextKey ?? null;

    this.selectedContextKey.set(selected);
    if (selected && isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTIVE_ACCESS_CONTEXT_KEY, selected);
    }
  }

  private loadPreferredContextKey(): string | null {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return null;
    const saved = localStorage.getItem(ACTIVE_ACCESS_CONTEXT_KEY);
    return saved?.trim() ? saved.trim() : null;
  }

  private resolveTipoAcesso(perfil: string | null, permissionKeys: string[]): string {
    const role = (perfil ?? '').trim().toLowerCase();
    if (role === 'admin' || role === 'administrator') return 'Admin';
    if (role.includes('transportadora')) return 'Transportadora';
    if (role.includes('estacionamento')) return 'Estacionamento';

    const keys = permissionKeys.map((k) => k.toLowerCase());
    if (keys.some((k) => k.includes('transportadora'))) return 'Transportadora';
    if (keys.some((k) => k.includes('estacionamento'))) return 'Estacionamento';
    return perfil?.trim() || 'Operacional';
  }

  private extractAccessContexts(
    payload: Record<string, unknown> | null,
    loggedUser: Record<string, unknown> | null,
    fallbackTipo: string
  ): AccessContext[] {
    const seen = new Set<string>();
    const contexts: AccessContext[] = [];
    const sourceCandidates = [
      this.readCandidates(payload),
      this.readCandidates(loggedUser),
    ];

    for (const candidates of sourceCandidates) {
      for (const candidate of candidates) {
        const parsed = this.parseContextCandidate(candidate, fallbackTipo);
        for (const ctx of parsed) {
          if (seen.has(ctx.contextKey)) continue;
          seen.add(ctx.contextKey);
          contexts.push(ctx);
        }
      }
    }

    if (contexts.length === 0) {
      contexts.push({
        contextKey: this.buildContextKey(fallbackTipo, null),
        tipoAcesso: fallbackTipo,
        cnpj: null
      });
    }
    return contexts;
  }

  private readCandidates(source: Record<string, unknown> | null): unknown[] {
    if (!source) return [];
    const keys = ['acessos', 'vinculos', 'empresas', 'cnpjs', 'accesses', 'contexts', 'tenants', 'companies'];
    const out: unknown[] = [];
    for (const k of keys) {
      const value = source[k];
      if (Array.isArray(value)) out.push(...value);
      else if (value != null) out.push(value);
    }
    return out;
  }

  private parseContextCandidate(candidate: unknown, fallbackTipo: string): AccessContext[] {
    if (typeof candidate === 'string') {
      const cnpj = this.normalizeCnpj(candidate);
      if (!cnpj) return [];
      return [{
        contextKey: this.buildContextKey(fallbackTipo, cnpj),
        tipoAcesso: fallbackTipo,
        cnpj
      }];
    }

    if (!candidate || typeof candidate !== 'object') return [];
    const rec = candidate as Record<string, unknown>;

    if (Array.isArray(rec['cnpjs'])) {
      const nested = rec['cnpjs']
        .map((value) => this.normalizeCnpj(value))
        .filter((value): value is string => Boolean(value));
      if (nested.length > 0) {
        const tipo = this.normalizeTipoFromRecord(rec, fallbackTipo);
        return nested.map((cnpj) => ({
          contextKey: this.buildContextKey(tipo, cnpj),
          tipoAcesso: tipo,
          cnpj
        }));
      }
    }

    const tipo = this.normalizeTipoFromRecord(rec, fallbackTipo);
    const cnpjRaw =
      rec['cnpj'] ??
      rec['Cnpj'] ??
      rec['documento'] ??
      rec['Documento'] ??
      rec['cpfCnpj'] ??
      rec['doc'];
    const cnpj = this.normalizeCnpj(cnpjRaw);
    return [{
      contextKey: this.buildContextKey(tipo, cnpj),
      tipoAcesso: tipo,
      cnpj
    }];
  }

  private normalizeTipoFromRecord(rec: Record<string, unknown>, fallback: string): string {
    const rawTipo =
      rec['tipoAcesso'] ??
      rec['tipo'] ??
      rec['perfil'] ??
      rec['role'] ??
      rec['TipoAcesso'] ??
      rec['Perfil'] ??
      rec['Role'];
    if (typeof rawTipo !== 'string' || !rawTipo.trim()) return fallback;
    return this.resolveTipoAcesso(rawTipo.trim(), []);
  }

  private normalizeCnpj(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const digits = String(value).replace(/\D/g, '');
    return digits.length === 14 ? digits : null;
  }

  private formatCnpj(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 14) return value;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  private buildContextKey(tipoAcesso: string, cnpj: string | null): string {
    return `${tipoAcesso.toLowerCase()}::${cnpj ?? 'sem-cnpj'}`;
  }
}
