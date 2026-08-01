import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { DIA_SEMANA_OPCOES, type DiaSemanaCobranca } from '../faturamento-config-cobranca.helpers';

export interface ConfigCobrancaWeekdayDialogData {
  diaSelecionado: DiaSemanaCobranca | null;
}

@Component({
  selector: 'app-config-cobranca-weekday-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Dia da cobrança semanal</h2>
    <mat-dialog-content class="cfg-weekday__body">
      <p class="cfg-weekday__hint">Selecione o dia da semana em que a cobrança será gerada.</p>
      <div class="cfg-weekday__list" role="radiogroup" aria-label="Dia da semana">
        @for (d of opcoes; track d.value) {
          <button
            type="button"
            role="radio"
            class="cfg-weekday__option"
            [class.cfg-weekday__option--active]="selecionado === d.value"
            [attr.aria-checked]="selecionado === d.value"
            (click)="selecionado = d.value"
          >
            <span class="cfg-weekday__dot" aria-hidden="true"></span>
            <span>{{ d.label }}</span>
          </button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close()">Cancelar</button>
      <button
        type="button"
        mat-flat-button
        color="primary"
        [disabled]="selecionado == null"
        (click)="confirmar()"
      >
        Confirmar
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .cfg-weekday__body {
        min-width: min(100vw - 48px, 380px);
        padding-top: 4px !important;
      }
      .cfg-weekday__hint {
        margin: 0 0 12px;
        font-size: 13px;
        color: var(--muted, #94a3b8);
      }
      .cfg-weekday__list {
        display: grid;
        gap: 8px;
      }
      .cfg-weekday__option {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--border-subtle, #334155) 90%, transparent);
        background: color-mix(in srgb, var(--surface-2, #1e293b) 70%, transparent);
        color: var(--text, #e2e8f0);
        font: inherit;
        font-size: 14px;
        cursor: pointer;
        text-align: left;
      }
      .cfg-weekday__option:hover {
        border-color: color-mix(in srgb, var(--primary, #3b82f6) 40%, transparent);
      }
      .cfg-weekday__option--active {
        border-color: var(--primary, #3b82f6);
        background: color-mix(in srgb, var(--primary, #3b82f6) 14%, transparent);
      }
      .cfg-weekday__dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 2px solid color-mix(in srgb, var(--muted, #94a3b8) 80%, transparent);
        flex-shrink: 0;
      }
      .cfg-weekday__option--active .cfg-weekday__dot {
        border-color: var(--primary, #3b82f6);
        background: var(--primary, #3b82f6);
      }
    `
  ]
})
export class ConfigCobrancaWeekdayDialogComponent {
  readonly ref = inject(MatDialogRef<ConfigCobrancaWeekdayDialogComponent, DiaSemanaCobranca | undefined>);
  readonly data = inject<ConfigCobrancaWeekdayDialogData>(MAT_DIALOG_DATA);
  readonly opcoes = DIA_SEMANA_OPCOES;

  selecionado: DiaSemanaCobranca | null = this.data.diaSelecionado;

  confirmar(): void {
    if (this.selecionado == null) return;
    this.ref.close(this.selecionado);
  }
}
