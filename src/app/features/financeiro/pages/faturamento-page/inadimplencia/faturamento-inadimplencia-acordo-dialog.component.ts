import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';

import { FaturaService } from '../../../services/fatura.service';
import type { InadimplenciaAcordoDialogData } from './faturamento-inadimplencia.types';
import { ModalidadeRecebimento } from '../../../models/fatura.models';

@Component({
  selector: 'app-faturamento-inadimplencia-acordo-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Registrar acordo</h2>
    <mat-dialog-content class="inad-acordo__body">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Fatura</mat-label>
        <input matInput [value]="data.faturaNumero" readonly />
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
        <input matInput type="number" min="0" step="0.01" [(ngModel)]="valorNegociado" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Desconto aplicado</mat-label>
        <input matInput type="number" min="0" step="0.01" [(ngModel)]="desconto" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Novo vencimento</mat-label>
        <input matInput type="date" [(ngModel)]="novoVenc" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="inad-acordo__field">
        <mat-label>Forma de pagamento acordada</mat-label>
        <mat-select [(ngModel)]="forma">
          <mat-option [value]="1">PIX</mat-option>
          <mat-option [value]="2">Boleto</mat-option>
          <mat-option [value]="3">Transferência</mat-option>
          <mat-option [value]="4">Cartão</mat-option>
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
      <button type="button" mat-button [disabled]="salvando()" (click)="ref.close()">Cancelar</button>
      <button type="button" mat-flat-button color="primary" [disabled]="salvando()" (click)="salvar()">
        {{ salvando() ? 'Salvando...' : 'Salvar acordo' }}
      </button>
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
      .inad-acordo__field {
        width: 100%;
      }
    `
  ]
})
export class FaturamentoInadimplenciaAcordoDialogComponent {
  readonly ref = inject(MatDialogRef<FaturamentoInadimplenciaAcordoDialogComponent, boolean>);
  readonly data = inject<InadimplenciaAcordoDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(FaturaService);
  private readonly snack = inject(MatSnackBar);

  readonly salvando = signal(false);
  valorNegociado = this.data.valorOriginal;
  desconto = this.data.valorDesconto ?? 0;
  novoVenc = (this.data.vencimento || '').slice(0, 10);
  forma: ModalidadeRecebimento | number = ModalidadeRecebimento.Pix;
  obs = '';
  responsavel = '';

  fmt(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  salvar(): void {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.api
      .registrarAcordo(this.data.faturaId, {
        valorNegociado: this.valorNegociado,
        valorDesconto: this.desconto,
        novoVencimento: this.novoVenc || null,
        modalidadeRecebimento: this.forma,
        observacao: this.obs?.trim() || null,
        responsavel: this.responsavel?.trim() || null
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: () => this.ref.close(true),
        error: (err: unknown) => {
          const msg =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Falha ao registrar acordo.';
          this.snack.open(msg || 'Falha ao registrar acordo.', 'Fechar', { duration: 5000 });
        }
      });
  }
}
