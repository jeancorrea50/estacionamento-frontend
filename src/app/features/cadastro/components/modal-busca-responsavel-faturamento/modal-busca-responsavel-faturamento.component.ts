import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { formatCnpj } from '../../directives/cnpj-format.directive';
import type { ResponsavelFaturamentoListItemDTO } from '../../models/responsavel-faturamento.dto';
import { ResponsavelFaturamentoService } from '../../services/responsavel-faturamento.service';

export interface ModalBuscaResponsavelFaturamentoData {
  termoInicial?: string;
}

export interface ModalBuscaResponsavelFaturamentoResult {
  item: ResponsavelFaturamentoListItemDTO;
}

@Component({
  selector: 'app-modal-busca-responsavel-faturamento',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  templateUrl: './modal-busca-responsavel-faturamento.component.html',
  styleUrl: './modal-busca-responsavel-faturamento.component.scss',
})
export class ModalBuscaResponsavelFaturamentoComponent implements OnInit {
  readonly ref = inject(
    MatDialogRef<ModalBuscaResponsavelFaturamentoComponent, ModalBuscaResponsavelFaturamentoResult | undefined>
  );
  readonly data = inject<ModalBuscaResponsavelFaturamentoData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly service = inject(ResponsavelFaturamentoService);

  termo = '';
  loading = false;
  erro: string | null = null;
  itens: ResponsavelFaturamentoListItemDTO[] = [];

  ngOnInit(): void {
    this.termo = String(this.data.termoInicial ?? '').trim();
    this.buscar();
  }

  formatCnpj(v: string): string {
    return formatCnpj(v || '');
  }

  buscar(): void {
    this.loading = true;
    this.erro = null;
    const t = this.termo.trim();
    const digits = t.replace(/\D/g, '');
    const pareceCnpj = digits.length >= 8 && /^\d[\d.\-/]*$/.test(t);

    this.service
      .buscar({
        Descricao: pareceCnpj ? undefined : t || undefined,
        Cnpj: pareceCnpj ? digits : undefined,
        Ativo: true,
        NumeroPagina: 1,
        TamanhoPagina: 30,
      })
      .subscribe({
        next: (paged) => {
          this.itens = paged.items;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.erro = 'Falha ao buscar responsáveis.';
        },
      });
  }

  selecionar(item: ResponsavelFaturamentoListItemDTO): void {
    this.ref.close({ item });
  }

  fechar(): void {
    this.ref.close(undefined);
  }
}
