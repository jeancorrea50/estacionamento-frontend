import { Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import type {
  FaturaItemLista,
  FaturaListaItem,
  FaturaLookupOption,
  FaturaStatusLabel,
  ModalidadeRecebimentoLabel
} from '../faturamento-faturas.types';

export type FaturaFormMode = 'create' | 'view';

export interface FaturaFormDialogData {
  mode: FaturaFormMode;
  item?: FaturaListaItem;
  transportadoras: FaturaLookupOption[];
  estacionamentos: FaturaLookupOption[];
}

export interface FaturaFormDialogResult {
  mode: FaturaFormMode;
  /** Payload POST (create). */
  create?: { transportadoraId: number; estacionamentoId: number | null };
}

@Component({
  selector: 'app-fatura-form-dialog',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  templateUrl: './fatura-form-dialog.component.html',
  styleUrl: './fatura-form-dialog.component.scss'
})
export class FaturaFormDialogComponent {
  readonly ref = inject(MatDialogRef<FaturaFormDialogComponent, FaturaFormDialogResult | undefined>);
  readonly data = inject<FaturaFormDialogData>(MAT_DIALOG_DATA);
  private readonly snack = inject(MatSnackBar);

  readonly isCreate = this.data.mode === 'create';
  readonly isView = this.data.mode === 'view';
  readonly readOnly = this.isView;

  readonly statusOpcoes: FaturaStatusLabel[] = [
    'Aguardando envio',
    'Em aberto',
    'Parcial',
    'Pago',
    'Vencido',
    'Cancelada'
  ];

  readonly modalidadeOpcoes: ModalidadeRecebimentoLabel[] = [
    'Pix',
    'Boleto',
    'Transferência',
    'Cartão'
  ];

  transportadoraId: number | null = this.data.item?.transportadoraId ?? null;
  estacionamentoId: number | null = this.data.item?.estacionamentoId ?? null;
  numero = this.data.item?.numero ?? '';
  status: FaturaStatusLabel = this.data.item?.status ?? 'Aguardando envio';
  modalidadeRecebimento: ModalidadeRecebimentoLabel | '' =
    this.data.item?.modalidadeRecebimento && this.data.item.modalidadeRecebimento !== '—'
      ? this.data.item.modalidadeRecebimento
      : '';
  valorTotal = this.data.item?.valorTotal ?? 0;
  valorRecebido = this.data.item?.valorRecebido ?? 0;
  valorDesconto = this.data.item?.valorDesconto ?? 0;
  valorAcrescimo = this.data.item?.valorAcrescimo ?? 0;
  valorJuros = this.data.item?.valorJuros ?? 0;
  valorMulta = this.data.item?.valorMulta ?? 0;
  dataEmissao = this.data.item?.dataEmissao ?? '';
  vencimento = this.data.item?.vencimento ?? '';
  dataPagamento = this.data.item?.dataPagamento ?? '';
  periodoInicio = this.data.item?.periodoInicio ?? '';
  periodoFim = this.data.item?.periodoFim ?? '';
  emailEnvio = this.data.item?.emailEnvio ?? '';
  observacao = this.data.item?.observacao ?? '';
  readonly itens: FaturaItemLista[] = this.data.item?.itens ?? [];
  readonly valorTotalExcedente = Number(this.data.item?.valorTotalExcedente) || 0;

  get itensNormais(): FaturaItemLista[] {
    return this.itens.filter((i) => !i.ehExcedente);
  }

  get itensExcedentes(): FaturaItemLista[] {
    return this.itens.filter((i) => i.ehExcedente);
  }

  get titulo(): string {
    if (this.isCreate) return 'Nova fatura';
    return `Fatura ${this.numero || this.data.item?.id || ''}`.trim();
  }

  fechar(): void {
    this.ref.close(undefined);
  }

  salvar(): void {
    if (!this.isCreate) return;

    if (!this.transportadoraId || this.transportadoraId <= 0) {
      this.snack.open('Selecione a transportadora.', 'Fechar', { duration: 3500 });
      return;
    }

    this.ref.close({
      mode: 'create',
      create: {
        transportadoraId: this.transportadoraId,
        estacionamentoId:
          this.estacionamentoId && this.estacionamentoId > 0 ? this.estacionamentoId : null
      }
    });
  }
}
