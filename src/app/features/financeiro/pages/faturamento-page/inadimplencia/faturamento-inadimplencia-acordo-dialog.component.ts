import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
  templateUrl: './faturamento-inadimplencia-acordo-dialog.component.html',
  styleUrl: './faturamento-inadimplencia-acordo-dialog.component.scss'
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
