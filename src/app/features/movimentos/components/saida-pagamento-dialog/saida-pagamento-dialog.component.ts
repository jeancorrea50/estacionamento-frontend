import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { EstacionamentoService } from '../../../cadastro/services/estacionamento.service';
import { ModalidadeRecebimento } from '../../../financeiro/models/fatura.models';
import { formatarBrl } from '../../../financeiro/pages/faturamento-page/config-cobranca/config-cobranca-moeda.util';

export interface SaidaPagamentoDialogData {
  placa: string;
  valor: number;
}

export interface SaidaPagamentoDialogResult {
  modalidadeRecebimento: ModalidadeRecebimento;
}

type FormaOpcao = {
  value: ModalidadeRecebimento;
  label: string;
  icon: string;
  hint: string;
};

@Component({
  selector: 'app-saida-pagamento-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './saida-pagamento-dialog.component.html',
  styleUrl: './saida-pagamento-dialog.component.scss'
})
export class SaidaPagamentoDialogComponent implements OnInit {
  private readonly ref = inject(
    MatDialogRef<SaidaPagamentoDialogComponent, SaidaPagamentoDialogResult | undefined>
  );
  readonly data = inject<SaidaPagamentoDialogData>(MAT_DIALOG_DATA);
  private readonly estacionamentoApi = inject(EstacionamentoService);

  readonly ModalidadeRecebimento = ModalidadeRecebimento;
  readonly formas: FormaOpcao[] = [
    {
      value: ModalidadeRecebimento.Dinheiro,
      label: 'Dinheiro',
      icon: 'payments',
      hint: 'Recebimento em espécie'
    },
    {
      value: ModalidadeRecebimento.Cartao,
      label: 'Cartão',
      icon: 'credit_card',
      hint: 'Débito ou crédito'
    },
    {
      value: ModalidadeRecebimento.Pix,
      label: 'Pix',
      icon: 'qr_code_2',
      hint: 'QR Code do estacionamento'
    }
  ];

  readonly formaSelecionada = signal<ModalidadeRecebimento | null>(null);
  readonly pixLoading = signal(false);
  readonly pixErro = signal<string | null>(null);
  readonly pixQrSrc = signal<string | null>(null);
  readonly pixChave = signal<string | null>(null);
  readonly pixTitular = signal<string | null>(null);
  readonly pixPayload = signal<string | null>(null);

  ngOnInit(): void {
    // Pré-seleciona Dinheiro como padrão operacional de portaria.
    this.selecionar(ModalidadeRecebimento.Dinheiro);
  }

  get valorFormatado(): string {
    return formatarBrl(this.data.valor ?? 0);
  }

  selecionar(forma: ModalidadeRecebimento): void {
    this.formaSelecionada.set(forma);
    if (forma === ModalidadeRecebimento.Pix) {
      this.carregarPix();
    }
  }

  confirmar(): void {
    const forma = this.formaSelecionada();
    if (forma == null) return;
    if (forma === ModalidadeRecebimento.Pix && !this.pixChave()) {
      this.pixErro.set(
        'Nenhuma chave Pix cadastrada nos dados bancários deste estacionamento.'
      );
      return;
    }
    this.ref.close({ modalidadeRecebimento: forma });
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  copiarPayload(): void {
    const payload = this.pixPayload();
    if (!payload || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(payload);
  }

  private carregarPix(): void {
    if (this.pixQrSrc() || this.pixLoading()) return;
    this.pixLoading.set(true);
    this.pixErro.set(null);
    this.estacionamentoApi.obterPixQrCodeSessao(this.data.valor).subscribe({
      next: (dto) => {
        this.pixLoading.set(false);
        if (!dto.temChavePix || !dto.chavePix) {
          this.pixErro.set(
            'Cadastre a chave Pix em Estacionamento → Dados bancários para habilitar o QR Code.'
          );
          this.pixQrSrc.set(null);
          this.pixChave.set(null);
          this.pixTitular.set(null);
          this.pixPayload.set(null);
          return;
        }
        this.pixChave.set(dto.chavePix);
        this.pixTitular.set(dto.titular);
        this.pixPayload.set(dto.payload);
        this.pixQrSrc.set(
          dto.qrCodeBase64 ? `data:image/png;base64,${dto.qrCodeBase64}` : null
        );
      },
      error: () => {
        this.pixLoading.set(false);
        this.pixErro.set('Não foi possível carregar o QR Code Pix do estacionamento.');
      }
    });
  }
}
