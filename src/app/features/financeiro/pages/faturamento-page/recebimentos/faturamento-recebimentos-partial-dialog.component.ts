import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';

import type { RecebimentoPartialDialogData } from './faturamento-recebimentos.types';

@Component({
  selector: 'app-faturamento-recebimentos-partial-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Pagamento parcial</h2>
    <mat-dialog-content class="rec-partial__body">
      <p class="rec-partial__hint">Estrutura visual mockada — sem integração.</p>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rec-partial__field">
        <mat-label>Fatura</mat-label>
        <input matInput [value]="data.faturaId" readonly />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rec-partial__field">
        <mat-label>Valor total</mat-label>
        <input matInput [value]="fmt(data.valorTotal)" readonly />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rec-partial__field">
        <mat-label>Valor já recebido</mat-label>
        <input matInput [value]="fmt(data.valorJaRecebido)" readonly />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rec-partial__field">
        <mat-label>Saldo restante</mat-label>
        <input matInput [value]="fmt(data.saldoRestante)" readonly />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rec-partial__field">
        <mat-label>Novo valor recebido</mat-label>
        <input matInput type="number" [(ngModel)]="novoValor" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rec-partial__field">
        <mat-label>Data do pagamento</mat-label>
        <input matInput type="date" [(ngModel)]="dataPagamento" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rec-partial__field">
        <mat-label>Forma de pagamento</mat-label>
        <mat-select [(ngModel)]="forma">
          <mat-option value="PIX">PIX</mat-option>
          <mat-option value="Boleto">Boleto</mat-option>
          <mat-option value="Transferência">Transferência</mat-option>
          <mat-option value="Cartão">Cartão</mat-option>
          <mat-option value="Dinheiro">Dinheiro</mat-option>
          <mat-option value="Outros">Outros</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="rec-partial__field rec-partial__field--full">
        <mat-label>Observação</mat-label>
        <textarea matInput rows="2" [(ngModel)]="obs"></textarea>
      </mat-form-field>
      <div class="rec-partial__upload">
        <span class="material-symbols-outlined" aria-hidden="true">upload_file</span>
        <span>Anexar comprovante (mock)</span>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close()">Cancelar</button>
      <button type="button" mat-flat-button color="primary" (click)="ref.close()">Salvar mock</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .rec-partial__body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: min(100vw - 48px, 440px);
        padding-top: 4px !important;
      }
      .rec-partial__hint {
        margin: 0 0 4px;
        font-size: 12px;
        color: var(--muted, #64748b);
      }
      .rec-partial__field {
        width: 100%;
      }
      .rec-partial__upload {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px dashed rgba(148, 163, 184, 0.45);
        font-size: 13px;
        color: var(--muted, #64748b);
      }
      .rec-partial__upload .material-symbols-outlined {
        font-size: 20px;
        opacity: 0.85;
      }
    `
  ]
})
export class FaturamentoRecebimentosPartialDialogComponent {
  readonly ref = inject(MatDialogRef<FaturamentoRecebimentosPartialDialogComponent>);
  readonly data = inject<RecebimentoPartialDialogData>(MAT_DIALOG_DATA);

  novoValor = 0;
  dataPagamento = '2026-05-20';
  forma = 'PIX';
  obs = '';

  fmt(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
