import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import type { ConfigCobrancaListaItem, ConfigCobrancaLookupOption } from '../faturamento-config-cobranca.types';

export interface ConfigCobrancaApplyRuleDialogData {
  row: ConfigCobrancaListaItem;
  transportadoras: ConfigCobrancaLookupOption[];
}

export interface ConfigCobrancaApplyRuleDialogResult {
  selecionadas: number[];
}

@Component({
  selector: 'app-config-cobranca-apply-rule-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatCheckboxModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Aplicar regra para outras transportadoras</h2>
    <mat-dialog-content class="cfg-app__body">
      <p class="cfg-app__hint">Base: {{ data.row.transportadora }} — {{ data.row.estacionamento }}</p>
      <div class="cfg-app__list">
        @for (t of data.transportadoras; track t.id) {
          <label class="cfg-app__row">
            <mat-checkbox [(ngModel)]="mapa[t.id]" />
            <span>{{ t.label }}</span>
          </label>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close()">Cancelar</button>
      <button type="button" mat-flat-button color="primary" (click)="aplicar()">Aplicar Regra</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .cfg-app__body {
        min-width: min(100vw - 48px, 420px);
        padding-top: 4px !important;
      }
      .cfg-app__hint {
        margin: 0 0 10px;
        font-size: 12px;
        color: var(--muted, #94a3b8);
      }
      .cfg-app__list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 48vh;
        overflow: auto;
      }
      .cfg-app__row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: var(--text, #e2e8f0);
      }
    `
  ]
})
export class ConfigCobrancaApplyRuleDialogComponent {
  readonly ref = inject(
    MatDialogRef<ConfigCobrancaApplyRuleDialogComponent, ConfigCobrancaApplyRuleDialogResult | undefined>
  );
  readonly data = inject<ConfigCobrancaApplyRuleDialogData>(MAT_DIALOG_DATA);

  mapa: Record<number, boolean> = {};

  constructor() {
    for (const t of this.data.transportadoras) {
      this.mapa[t.id] = true;
    }
  }

  aplicar(): void {
    const selecionadas = this.data.transportadoras.filter((t) => this.mapa[t.id]).map((t) => t.id);
    this.ref.close({ selecionadas });
  }
}
