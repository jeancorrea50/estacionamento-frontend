import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-parametros-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="parametros-page" aria-labelledby="parametros-title">
      <div class="parametros-card">
        <h2 id="parametros-title" class="parametros-card__title">Parâmetros</h2>
        <p class="parametros-card__subtitle">
          Ainda não há parâmetros configurados nesta tela. Em breve você poderá ajustar as opções gerais do sistema por aqui.
        </p>
      </div>
    </section>
  `,
  styles: [
    `
      .parametros-page {
        padding: 0.25rem 0;
      }
      .parametros-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1.5rem;
        max-width: 40rem;
      }
      .parametros-card__title {
        margin: 0 0 0.5rem;
        font-size: 1.25rem;
      }
      .parametros-card__subtitle {
        margin: 0;
        color: #64748b;
        line-height: 1.5;
      }
    `,
  ],
})
export class ParametrosPageComponent {}
