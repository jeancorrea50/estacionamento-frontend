import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import type { InadimplenciaAcordoDialogData } from './faturamento-inadimplencia.types';

@Component({
  selector: 'app-faturamento-inadimplencia-acordo-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Registrar acordo</h2>
    <mat-dialog-content class="inad-acordo__body">
      <p class="inad-acordo__hint">Estrutura visual mockada — sem integração.</p>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Fatura</mat-label>
        <input matInput [value]="data.faturaId" readonly />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Transportadora</mat-label>
        <input matInput [value]="data.transportadora" readonly />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Valor original</mat-label>
        <input matInput [value]="fmt(data.valorOriginal)" readonly />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Valor negociado</mat-label>
        <input matInput type="number" [(ngModel)]="valorNegociado" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Desconto aplicado</mat-label>
        <input matInput type="number" [(ngModel)]="desconto" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Novo vencimento</mat-label>
        <input matInput type="date" [(ngModel)]="novoVenc" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Forma de pagamento acordada</mat-label>
        <mat-select [(ngModel)]="forma">
          <mat-option value="PIX">PIX</mat-option>
          <mat-option value="Boleto">Boleto</mat-option>
          <mat-option value="Transferência">Transferência</mat-option>
          <mat-option value="Parcelado">Parcelado</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field inad-acordo__field--full">
        <mat-label>Observação</mat-label>
        <textarea matInput rows="2" [(ngModel)]="obs"></textarea>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Responsável pelo acordo</mat-label>
        <input matInput [(ngModel)]="responsavel" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close()">Cancelar</button>
      <button type="button" mat-flat-button color="primary" (click)="ref.close()">Salvar mock</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .inad-acordo__body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: min(100vw - 48px, 480px);
        padding-top: 4px !important;
      }
      .inad-acordo__hint {
        margin: 0 0 4px;
        font-size: 12px;
        color: var(--muted, #64748b);
      }
      .inad-acordo__field {
        width: 100%;
      }
    `
  ]
})
export class FaturamentoInadimplenciaAcordoDialogComponent {
  readonly ref = inject(MatDialogRef<FaturamentoInadimplenciaAcordoDialogComponent>);
  readonly data = inject<InadimplenciaAcordoDialogData>(MAT_DIALOG_DATA);

  valorNegociado = 0;
  desconto = 0;
  novoVenc = '2026-06-15';
  forma = 'PIX';
  obs = '';
  responsavel = 'Financeiro (mock)';

  fmt(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
