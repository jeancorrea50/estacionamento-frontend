import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfigCobrancaConfirmDialogData {
  titulo: string;
  mensagem: string;
}

@Component({
  selector: 'app-config-cobranca-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content class="cfg-confirm__body">
      <p>{{ data.mensagem }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close(false)">Cancelar</button>
      <button type="button" mat-flat-button color="warn" (click)="ref.close(true)">Remover</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .cfg-confirm__body {
        min-width: min(100vw - 48px, 400px);
        padding-top: 4px !important;
        font-size: 14px;
        line-height: 1.45;
        color: var(--text);
      }
    `
  ]
})
export class ConfigCobrancaConfirmDialogComponent {
  readonly ref = inject(MatDialogRef<ConfigCobrancaConfirmDialogComponent, boolean>);
  readonly data = inject<ConfigCobrancaConfirmDialogData>(MAT_DIALOG_DATA);
}
