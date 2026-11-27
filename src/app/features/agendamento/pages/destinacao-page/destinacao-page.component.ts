import { Component, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { AGENDAMENTO_PAINEL_ROUTE, DESTINACAO_ROUTE } from '../../agendamento-rotas';
import { DestinacaoCalendarioPanelComponent } from '../destinacao-dashboard-page/destinacao-calendario-panel.component';
import { DestinacaoPainelComponent } from './destinar/destinacao-painel.component';

export type DestinacaoTopbarVisao = 'destinar' | 'calendario';

function visaoFromQuery(view: string | null | undefined): DestinacaoTopbarVisao {
  const v = String(view ?? '').toLowerCase();
  return v === 'calendario' || v === 'dashboard' ? 'calendario' : 'destinar';
}

/**
 * Destinação por acordo — tela canônica (ex-Lab).
 * Topbar: Destinar | Calendário.
 */
@Component({
  selector: 'app-destinacao-page',
  standalone: true,
  imports: [RouterLink, DestinacaoPainelComponent, DestinacaoCalendarioPanelComponent],
  templateUrl: './destinacao-page.component.html',
  styleUrls: ['./destinacao-page.component.scss'],
})
export class DestinacaoPageComponent implements OnInit, OnDestroy {
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly permissions = inject(PermissionCacheService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  readonly painelRoute = AGENDAMENTO_PAINEL_ROUTE;
  readonly visao = signal<DestinacaoTopbarVisao>('destinar');

  readonly podeVisualizar = computed(
    () =>
      this.permissions.allows('destinacao', 'visualizar') ||
      this.permissions.allows('agendamentos', 'visualizar'),
  );

  readonly podeGerenciar = computed(
    () =>
      this.permissions.allows('destinacao', 'gravar') ||
      this.permissions.allows('destinacao', 'alterar') ||
      this.permissions.allows('agendamentos', 'gravar') ||
      this.permissions.allows('agendamentos', 'alterar'),
  );

  ngOnInit(): void {
    if (!this.sessionAccess.canAccessRoute(DESTINACAO_ROUTE)) {
      void this.router.navigateByUrl('/app');
      return;
    }

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.visao.set(visaoFromQuery(params.get('view')));
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private readonly painel = viewChild(DestinacaoPainelComponent);

  /** CTA do cabeçalho: abre o modal de criação na visão Destinar. */
  novaDestinacao(): void {
    this.painel()?.nova();
  }

  setVisao(v: DestinacaoTopbarVisao): void {
    const url = v === 'calendario' ? `${DESTINACAO_ROUTE}?view=calendario` : DESTINACAO_ROUTE;
    void this.router.navigateByUrl(url, { replaceUrl: true });
  }
}
