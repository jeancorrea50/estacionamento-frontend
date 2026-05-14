import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import type { ConfigCobrancaListaItem } from '../faturamento-config-cobranca.types';

export interface ConfigCobrancaSimulateDialogData {
  row: ConfigCobrancaListaItem;
}

@Component({
  selector: 'app-config-cobranca-simulate-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatSnackBarModule],
  template: `
    <h2 mat-dialog-title>Simulação de Faturamento</h2>
    <mat-dialog-content class="cfg-sim__body">
      <p class="cfg-sim__lead">
        {{ data.row.transportadora }} · {{ data.row.modalidade }} · Período simulado: 01/05/2026 a 31/05/2026
      </p>
      <dl class="cfg-sim__dl">
        <div><dt>Movimentações previstas</dt><dd>38</dd></div>
        <div><dt>Diárias</dt><dd>R$ 7.200,00</dd></div>
        <div><dt>Lavagens</dt><dd>R$ 850,00</dd></div>
        <div><dt>Serviços extras</dt><dd>R$ 600,00</dd></div>
        <div><dt>Descontos</dt><dd>−R$ 300,00</dd></div>
        <div><dt>Acréscimos</dt><dd>R$ 0,00</dd></div>
        <div class="cfg-sim__total"><dt>Total estimado</dt><dd>R$ 8.350,00</dd></div>
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close()">Fechar</button>
      <button type="button" mat-flat-button color="primary" (click)="gerar()">Gerar Fatura Mockada</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .cfg-sim__body {
        min-width: min(100vw - 48px, 440px);
        padding-top: 4px !important;
      }
      .cfg-sim__lead {
        margin: 0 0 12px;
        font-size: 13px;
        color: var(--muted, #94a3b8);
        line-height: 1.45;
      }
      .cfg-sim__dl {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 13px;
      }
      .cfg-sim__dl > div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .cfg-sim__dl dt {
        margin: 0;
        color: var(--muted, #94a3b8);
        font-weight: 600;
      }
      .cfg-sim__dl dd {
        margin: 0;
        color: var(--text, #e2e8f0);
        font-weight: 600;
      }
      .cfg-sim__total {
        padding-top: 8px;
        margin-top: 4px;
        border-top: 1px solid rgba(148, 163, 184, 0.25);
      }
    `
  ]
})
export class ConfigCobrancaSimulateDialogComponent {
  readonly ref = inject(MatDialogRef<ConfigCobrancaSimulateDialogComponent>);
  readonly data = inject<ConfigCobrancaSimulateDialogData>(MAT_DIALOG_DATA);
  private readonly snack = inject(MatSnackBar);

  gerar(): void {
    this.snack.open('Fatura simulada gerada com sucesso.', 'Fechar', { duration: 4000 });
    this.ref.close();
  }
}
