import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface CadastroConfirmDialogData {
  titulo: string;
  mensagem: string;
  cancelLabel?: string;
  confirmLabel?: string;
  /** warn = exclusão/destrutivo; primary = ação padrão */
  confirmColor?: 'warn' | 'primary';
}

/** Use `panelClass: 'cad-confirm-dialog-panel'` ao abrir (tema light/dark). */
@Component({
  selector: 'app-cadastro-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <div class="cad-confirm">
      <h2 mat-dialog-title class="cad-confirm__title">{{ data.titulo }}</h2>
      <mat-dialog-content class="cad-confirm__body">
        <p>{{ data.mensagem }}</p>
      </mat-dialog-content>
      <mat-dialog-actions class="cad-confirm__actions" align="end">
        <button type="button" mat-button class="cad-confirm__btn-cancel" (click)="ref.close(false)">
          {{ data.cancelLabel || 'Cancelar' }}
        </button>
        <button
          type="button"
          mat-flat-button
          class="cad-confirm__btn-ok"
          [class.cad-confirm__btn-ok--warn]="(data.confirmColor || 'warn') === 'warn'"
          [class.cad-confirm__btn-ok--primary]="data.confirmColor === 'primary'"
          (click)="ref.close(true)"
        >
          {{ data.confirmLabel || 'Confirmar' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--cad-confirm-text, var(--text, #f1f1f5));
        background: var(--cad-confirm-surface, transparent);
      }

      .cad-confirm {
        display: flex;
        flex-direction: column;
        min-width: 0;
        background: var(--cad-confirm-surface, transparent);
        color: var(--cad-confirm-text, var(--text, #f1f1f5));
      }

      .cad-confirm__title.mat-mdc-dialog-title,
      .cad-confirm__title {
        margin: 0;
        padding: 18px 20px 8px;
        font-size: 1.0625rem;
        font-weight: 600;
        line-height: 1.3;
        color: var(--cad-confirm-text, var(--text, #f1f1f5));
      }

      .cad-confirm__title::before {
        display: none;
      }

      .cad-confirm__body.mat-mdc-dialog-content,
      .cad-confirm__body {
        min-width: min(100vw - 48px, 420px);
        margin: 0;
        padding: 4px 20px 8px !important;
        font-size: 14px;
        line-height: 1.45;
        white-space: pre-line;
        color: var(--cad-confirm-muted, var(--cad-confirm-text, #d4d4d8));
        background: transparent;
      }

      .cad-confirm__body p {
        margin: 0;
        color: inherit;
      }

      .cad-confirm__actions.mat-mdc-dialog-actions,
      .cad-confirm__actions {
        margin: 0;
        padding: 12px 16px 16px;
        gap: 8px;
        border-top: 1px solid var(--cad-confirm-border, rgba(255, 255, 255, 0.08));
      }

      .cad-confirm__btn-cancel {
        color: var(--cad-confirm-muted, #a1a1aa) !important;
      }

      .cad-confirm__btn-ok--primary {
        --mdc-filled-button-container-color: var(--color-primary, #2563eb);
        --mdc-filled-button-label-text-color: #fff;
        background: var(--color-primary, #2563eb) !important;
        color: #fff !important;
      }

      .cad-confirm__btn-ok--warn {
        --mdc-filled-button-container-color: #dc2626;
        --mdc-filled-button-label-text-color: #fff;
        background: #dc2626 !important;
        color: #fff !important;
      }
    `
  ]
})
export class CadastroConfirmDialogComponent {
  readonly ref = inject(MatDialogRef<CadastroConfirmDialogComponent, boolean>);
  readonly data = inject<CadastroConfirmDialogData>(MAT_DIALOG_DATA);
}
