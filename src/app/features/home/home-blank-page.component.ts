import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NavService } from '../../core/layout/shell/nav.service';

/**
 * Tela inicial pós-login (`/app/inicio`): leva à primeira tela liberada no menu do usuário
 * (ordem do menu: Operação › Planejamento › Gestão). Sem nenhuma liberada, mostra o aviso.
 */
@Component({
  selector: 'app-home-blank-page',
  standalone: true,
  template: `
    @if (!nav.primeiraRota()) {
      <section class="home-blank" aria-label="Início">
        <span class="material-symbols-outlined home-blank__ico" aria-hidden="true"
          >lock_person</span
        >
        <p class="home-blank__hint">
          Nenhuma tela liberada para o seu perfil. Fale com o administrador do sistema.
        </p>
      </section>
    }
  `,
  styles: [
    `
      .home-blank {
        min-height: 40vh;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        text-align: center;
      }
      .home-blank__ico {
        font-size: 36px;
        opacity: 0.5;
      }
      .home-blank__hint {
        margin: 0;
        opacity: 0.7;
        font-size: 0.95rem;
      }
    `,
  ],
})
export class HomeBlankPageComponent implements OnInit {
  readonly nav = inject(NavService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const rota = this.nav.primeiraRota();
    if (rota) void this.router.navigateByUrl(rota, { replaceUrl: true });
  }
}
