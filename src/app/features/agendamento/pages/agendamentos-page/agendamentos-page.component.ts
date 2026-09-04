import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-agendamentos-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page" aria-labelledby="agendamentos-title">
      <header class="page-header">
        <h1 id="agendamentos-title">Agendamentos</h1>
        <p class="page-subtitle">Módulo em preparação. Em breve você poderá gerenciar os agendamentos por aqui.</p>
      </header>
    </section>
  `,
  styles: [
    `
      .page {
        padding: 1.5rem;
      }
      .page-header h1 {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
      }
      .page-subtitle {
        margin: 0;
        color: var(--text-muted, #64748b);
      }
    `,
  ],
})
export class AgendamentosPageComponent {}
