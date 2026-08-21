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
    <div class="cfg-weekday">
      <h2 mat-dialog-title class="cfg-weekday__title">Dia da cobrança semanal</h2>
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
              <span class="cfg-weekday__ico" aria-hidden="true">{{ d.label.slice(0, 3) }}</span>
              <span class="cfg-weekday__label">{{ d.label }}</span>
            </button>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions class="cfg-weekday__actions" align="end">
        <button type="button" class="cfg-weekday__btn cfg-weekday__btn--ghost" (click)="ref.close()">
          Cancelar
        </button>
        <button
          type="button"
          class="cfg-weekday__btn cfg-weekday__btn--primary"
          [disabled]="selecionado == null"
          (click)="confirmar()"
        >
          Confirmar
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--cfg-form-text, var(--text));
        background: var(--cfg-form-surface, var(--surface, #fff));
      }

      .cfg-weekday {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .cfg-weekday__title.mat-mdc-dialog-title,
      .cfg-weekday__title {
        margin: 0;
        padding: 20px 20px 0;
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--cfg-form-text, var(--text));
      }

      .cfg-weekday__title::before {
        display: none;
      }

      .cfg-weekday__body {
        min-width: min(100vw - 48px, 380px);
        padding: 12px 20px 8px !important;
        color: inherit;
      }

      .cfg-weekday__hint {
        margin: 0 0 14px;
        font-size: 0.8125rem;
        line-height: 1.45;
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
        min-height: 44px;
        padding: 8px 12px 8px 8px;
        border-radius: var(--radius-lg, 12px);
        border: 1px solid var(--cfg-form-border, var(--border-subtle, #334155));
        background: color-mix(in srgb, var(--cfg-form-input-bg, var(--surface-2, #1e293b)) 88%, transparent);
        color: var(--cfg-form-text, var(--text));
        font: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition:
          background 0.22s ease,
          color 0.22s ease,
          border-color 0.22s ease,
          box-shadow 0.22s ease;
      }

      .cfg-weekday__option:hover:not(.cfg-weekday__option--active) {
        border-color: transparent;
        background: var(--sidebar-item-hover, color-mix(in srgb, var(--surface-2) 90%, transparent));
      }

      .cfg-weekday__option--active {
        border-color: transparent;
        color: var(--btn-primary-text, #ffffff);
        background: var(--sidebar-active-bg, var(--primary, #3b82f6));
        box-shadow: 0 6px 16px color-mix(in srgb, var(--sidebar-active-bg, var(--primary, #3b82f6)) 28%, transparent);
        font-weight: 600;
      }

      .cfg-weekday__ico {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 9px;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--muted, #94a3b8);
        background: color-mix(in srgb, var(--cfg-form-text, var(--text)) 6%, transparent);
      }

      .cfg-weekday__option--active .cfg-weekday__ico {
        background: var(--btn-primary-text, #ffffff);
        color: var(--sidebar-active-bg, var(--primary, #3b82f6));
      }

      .cfg-weekday__label {
        flex: 1 1 auto;
      }

      .cfg-weekday__actions.mat-mdc-dialog-actions {
        margin: 0;
        padding: 12px 20px 18px;
        gap: 8px;
        border-top: 1px solid var(--cfg-form-border, var(--border-subtle, transparent));
      }

      .cfg-weekday__btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 0 16px;
        border-radius: 10px;
        border: 1px solid transparent;
        font: inherit;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
      }

      .cfg-weekday__btn--ghost {
        background: transparent;
        color: var(--muted, #94a3b8);
      }

      .cfg-weekday__btn--ghost:hover {
        color: var(--cfg-form-text, var(--text));
        background: color-mix(in srgb, var(--cfg-form-text, var(--text)) 6%, transparent);
      }

      .cfg-weekday__btn--primary {
        background: var(--sidebar-active-bg, var(--primary, #3b82f6));
        color: var(--btn-primary-text, #ffffff);
      }

      .cfg-weekday__btn--primary:hover:not(:disabled) {
        filter: brightness(1.05);
      }

      .cfg-weekday__btn--primary:disabled {
        opacity: 0.45;
        cursor: not-allowed;
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
