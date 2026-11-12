import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ModalidadeRecebimento } from '../../../models/fatura.models';
import type {
  RecebimentoPagamentoDialogData,
  RecebimentoPagamentoDialogResult
} from './faturamento-recebimentos.types';

@Component({
  selector: 'app-faturamento-recebimentos-partial-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, FormsModule],
  templateUrl: './faturamento-recebimentos-partial-dialog.component.html',
  styleUrl: './faturamento-recebimentos-partial-dialog.component.scss'
})
export class FaturamentoRecebimentosPartialDialogComponent {
  readonly ref = inject(
    MatDialogRef<FaturamentoRecebimentosPartialDialogComponent, RecebimentoPagamentoDialogResult>
  );
  readonly data = inject<RecebimentoPagamentoDialogData>(MAT_DIALOG_DATA);
  readonly ModalidadeRecebimento = ModalidadeRecebimento;

  saving = false;
  erroValor = '';
  novoValor =
    this.data.valorRecebidoInicial != null && this.data.valorRecebidoInicial > 0
      ? this.data.valorRecebidoInicial
      : this.data.saldoRestante > 0
        ? this.data.saldoRestante
        : this.data.valorTotal;
  dataPagamento = this.toDateInput(this.data.dataPagamentoInicial) || this.hojeIso();
  forma: ModalidadeRecebimento =
    this.data.formaInicial && this.data.formaInicial > 0
      ? this.data.formaInicial
      : ModalidadeRecebimento.Pix;
  obs = this.data.observacaoInicial?.trim() || '';

  get titulo(): string {
    if (this.data.mode === 'edit') return 'Editar pagamento';
    if (this.novoValor > 0 && this.novoValor < this.data.saldoRestante - 0.0001) {
      return 'Pagamento parcial';
    }
    return 'Registrar pagamento';
  }

  fmt(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  salvar(): void {
    this.erroValor = '';
    const valor = Number(this.novoValor);
    if (!Number.isFinite(valor) || valor <= 0) {
      this.erroValor = 'Informe um valor maior que zero.';
      return;
    }
    const teto =
      this.data.mode === 'edit'
        ? Math.max(this.data.valorTotal, this.data.valorJaRecebido + this.data.saldoRestante)
        : this.data.saldoRestante > 0
          ? this.data.saldoRestante
          : this.data.valorTotal;
    if (valor > teto + 0.009) {
      this.erroValor = `Valor não pode ultrapassar ${this.fmt(teto)}.`;
      return;
    }
    if (!this.dataPagamento?.trim()) {
      this.erroValor = 'Informe a data do pagamento.';
      return;
    }

    const result: RecebimentoPagamentoDialogResult = {
      mode: this.data.mode,
      faturaId: this.data.faturaId,
      pagamentoId: this.data.pagamentoId ?? this.data.faturaId,
      valorRecebido: Math.round(valor * 100) / 100,
      dataPagamento: this.dataPagamento.trim(),
      modalidadeRecebimento: this.forma,
      observacao: this.obs.trim() || null
    };
    this.ref.close(result);
  }

  private hojeIso(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toDateInput(raw: string | null | undefined): string {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    return '';
  }
}
