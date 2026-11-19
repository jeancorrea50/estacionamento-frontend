import { Component } from '@angular/core';

/**
 * Tela inicial padrão pós-login: vazia, sem abrir menu/submenu.
 * Rota: `/app/inicio`.
 */
@Component({
  selector: 'app-home-blank-page',
  standalone: true,
  template: `
    <section class="home-blank" aria-label="Início">
      <p class="home-blank__hint">Selecione um menu para começar.</p>
    </section>
  `,
  styles: [
    `
      .home-blank {
        min-height: 40vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      .home-blank__hint {
        margin: 0;
        opacity: 0.65;
        font-size: 0.95rem;
      }
    `,
  ],
})
export class HomeBlankPageComponent {}
