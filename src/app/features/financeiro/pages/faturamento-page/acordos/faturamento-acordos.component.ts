import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionAccessService } from '../../../../../core/services/session-access.service';
import { FATURAMENTO_ACORDOS_ROUTE } from '../../../faturamento-rotas';

/**
 * Placeholder da tela Acordos (período + vagas + CIF/FOB).
 * Garante rota registrada e item visível na sidebar; conteúdo completo na entrega 1A.
 */
@Component({
  selector: 'app-faturamento-acordos',
  standalone: true,
  template: `
    <section class="page-stub" aria-labelledby="acordos-title">
      <header class="page-stub__head">
        <h1 id="acordos-title">Acordos</h1>
        <p>
          Gestão de período, vagas contratadas e split CIF/FOB. Em breve: formulário dedicado
          (sem misturar com a configuração completa de cobrança).
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
export class FaturamentoAcordosComponent implements OnInit {
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (!this.sessionAccess.canAccessRoute(FATURAMENTO_ACORDOS_ROUTE)) {
      void this.router.navigateByUrl('/app');
    }
  }
}
