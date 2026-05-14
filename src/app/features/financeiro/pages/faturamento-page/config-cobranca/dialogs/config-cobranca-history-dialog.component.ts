import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import type { ConfigCobrancaListaItem } from '../faturamento-config-cobranca.types';

export interface ConfigCobrancaHistoryDialogData {
  row: ConfigCobrancaListaItem;
}

@Component({
  selector: 'app-config-cobranca-history-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Histórico — {{ data.row.transportadora }}</h2>
    <mat-dialog-content class="cfg-hist__body">
      <ul class="cfg-hist__list">
        <li><span class="cfg-hist__dt">10/05/2026</span> Configuração criada <span class="cfg-hist__who">alex.penna</span></li>
        <li><span class="cfg-hist__dt">12/05/2026</span> E-mail financeiro alterado <span class="cfg-hist__who">alex.penna</span></li>
        <li><span class="cfg-hist__dt">15/05/2026</span> Envio automático ativado <span class="cfg-hist__who">alex.penna</span></li>
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-flat-button color="primary" (click)="ref.close()">Fechar</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .cfg-hist__body {
        min-width: min(100vw - 48px, 420px);
        padding-top: 4px !important;
      }
      .cfg-hist__list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: 13px;
        color: var(--text, #e2e8f0);
      }
      .cfg-hist__dt {
        display: inline-block;
        min-width: 92px;
        color: var(--muted, #94a3b8);
        font-weight: 600;
      }
      .cfg-hist__who {
        color: var(--muted, #94a3b8);
        font-size: 12px;
      }
    `
  ]
})
export class ConfigCobrancaHistoryDialogComponent {
  readonly ref = inject(MatDialogRef<ConfigCobrancaHistoryDialogComponent>);
  readonly data = inject<ConfigCobrancaHistoryDialogData>(MAT_DIALOG_DATA);
}
