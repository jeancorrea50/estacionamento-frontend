import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface FaturaConfirmDialogData {
  titulo: string;
  mensagem: string;
  confirmLabel?: string;
}

@Component({
  selector: 'app-fatura-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content class="fat-confirm__body">
      <p>{{ data.mensagem }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close(false)">Cancelar</button>
      <button type="button" mat-flat-button color="warn" (click)="ref.close(true)">
        {{ data.confirmLabel || 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .fat-confirm__body {
        min-width: min(100vw - 48px, 400px);
        padding-top: 4px !important;
        font-size: 14px;
        line-height: 1.45;
        color: var(--text);
      }
    `
  ]
})
export class FaturaConfirmDialogComponent {
  readonly ref = inject(MatDialogRef<FaturaConfirmDialogComponent, boolean>);
  readonly data = inject<FaturaConfirmDialogData>(MAT_DIALOG_DATA);
}
