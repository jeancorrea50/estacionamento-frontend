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

@Component({
  selector: 'app-cadastro-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content class="cad-confirm__body">
      <p>{{ data.mensagem }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close(false)">
        {{ data.cancelLabel || 'Cancelar' }}
      </button>
      <button
        type="button"
        mat-flat-button
        [color]="data.confirmColor || 'warn'"
        (click)="ref.close(true)"
      >
        {{ data.confirmLabel || 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .cad-confirm__body {
        min-width: min(100vw - 48px, 420px);
        padding-top: 4px !important;
        font-size: 14px;
        line-height: 1.45;
        white-space: pre-line;
        color: var(--text, var(--color-text-primary, #111827));
      }
    `
  ]
})
export class CadastroConfirmDialogComponent {
  readonly ref = inject(MatDialogRef<CadastroConfirmDialogComponent, boolean>);
  readonly data = inject<CadastroConfirmDialogData>(MAT_DIALOG_DATA);
}
