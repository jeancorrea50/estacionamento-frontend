import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { DESTINACAO_ROUTE } from '../../agendamento-rotas';

/**
 * Placeholder da Destinação por acordo (wizard).
 * Garante rota registrada e item visível na sidebar; conteúdo completo na entrega 2A.
 */
@Component({
  selector: 'app-destinacao-page',
  standalone: true,
  template: `
    <section class="page-stub" aria-labelledby="destinacao-title">
      <header class="page-stub__head">
        <h1 id="destinacao-title">Destinação</h1>
        <p>
          Destinar vagas do acordo por transportadora, horário e CIF/FOB. Em breve: wizard
          dedicado (substitui o modal legado do Painel).
        </p>
      </header>
    </section>
  `,
  styles: [
    `
      .page-stub {
        padding: 1.25rem 1.5rem;
      }
      .page-stub__head h1 {
        margin: 0 0 0.35rem;
        font-size: 1.35rem;
        font-weight: 750;
      }
      .page-stub__head p {
        margin: 0;
        color: var(--muted, #94a3b8);
        max-width: 42rem;
        line-height: 1.45;
      }
    `,
  ],
})
export class DestinacaoPageComponent implements OnInit {
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (!this.sessionAccess.canAccessRoute(DESTINACAO_ROUTE)) {
      void this.router.navigateByUrl('/app');
    }
  }
}
