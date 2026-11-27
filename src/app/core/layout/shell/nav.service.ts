import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { filter, map } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { SessionAccessService } from '../../services/session-access.service';
import { NAV, NavEntry, NavGroup, NavItem, flattenNav } from './nav.config';

/** Mesma chave do layout antigo: quem tinha o menu recolhido continua com ele recolhido. */
const CHAVE_RECOLHIDO = 'sidebarCollapsed';

/**
 * Estado do menu: itens liberados pelo login, rota ativa, seção aberta,
 * modo recolhido (desktop) e gaveta (celular).
 */
@Injectable({ providedIn: 'root' })
export class NavService {
  private readonly router = inject(Router);
  private readonly bp = inject(BreakpointObserver);
  private readonly auth = inject(AuthService);
  private readonly sessionAccess = inject(SessionAccessService);

  /**
   * Menu do usuário: estrutura fixa (NAV) filtrada pelas rotas liberadas no login
   * (cadastro Gerenciamento › Menu + perfil). Sem menus na sessão = tudo (mesma regra de antes).
   */
  readonly grupos = computed<NavGroup[]>(() => {
    this.sessionAccess.allowedRoutes();
    const admin = this.auth.isAdmin();
    return NAV.map((g) => {
      const visiveis = g.items.filter((i) => !i.admin || admin);
      // O filtro do login espera { route, children: [{ route }] }.
      type ItemFiltro = { route: string; children?: { route: string }[] };
      const comRota = visiveis.map((i) => ({
        ...i,
        route: i.route ?? '',
      })) as unknown as ItemFiltro[];
      const filtrados = this.sessionAccess.filterSidebarItems(comRota);
      return { ...g, items: filtrados as unknown as NavItem[] };
    }).filter((g) => g.items.length);
  });

  readonly destinos = computed(() => flattenNav(this.grupos()));
  readonly destinosMobile = computed(() => this.destinos().filter((d) => d.item.mobile));
  /** Primeira tela liberada — destino padrão depois do login. */
  readonly primeiraRota = computed(() => this.destinos()[0]?.item.route ?? null);

  readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split(/[?#]/)[0]),
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] },
  );

  /** Item ativo = rota mais específica que casa com a URL. */
  readonly ativo = computed<NavEntry | null>(() => {
    const url = this.url();
    let melhor: NavEntry | null = null;
    let tam = -1;
    for (const d of this.destinos()) {
      for (const r of [d.item.route, ...(d.item.match ?? [])]) {
        if (r && (url === r || url.startsWith(r + '/')) && r.length > tam) {
          melhor = d;
          tam = r.length;
        }
      }
    }
    return melhor;
  });

  /**
   * Seção aberta no acordeão (uma por vez). Segue a rota ativa, mas o usuário pode
   * abrir/fechar à vontade — volta a seguir a rota na próxima navegação.
   */
  readonly aberto = linkedSignal<string | null>(() => this.ativo()?.parent?.id ?? null);

  readonly celular = toSignal(this.bp.observe('(max-width: 768px)').pipe(map((r) => r.matches)), {
    initialValue: typeof window !== 'undefined' && window.innerWidth <= 768,
  });

  readonly recolhido = signal(this.ler());
  /** Recolhido só vale no desktop; no celular o menu é gaveta. */
  readonly rail = computed(() => this.recolhido() && !this.celular());
  readonly gavetaAberta = signal(false);

  alternarSecao(id: string): void {
    this.aberto.update((a) => (a === id ? null : id));
  }

  alternarRecolhido(): void {
    this.recolhido.update((v) => !v);
    try {
      localStorage.setItem(CHAVE_RECOLHIDO, String(this.recolhido()));
    } catch {
      /* sem storage */
    }
  }

  fecharGaveta(): void {
    this.gavetaAberta.set(false);
  }

  private ler(): boolean {
    try {
      return localStorage.getItem(CHAVE_RECOLHIDO) === 'true';
    } catch {
      return false;
    }
  }
}
