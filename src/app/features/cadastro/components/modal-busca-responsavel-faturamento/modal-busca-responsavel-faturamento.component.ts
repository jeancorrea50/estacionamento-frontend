import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
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

  /** Signals: app zoneless não re-renderiza com campo mutável puro após HTTP. */
  readonly termo = signal('');
  readonly loading = signal(false);
  readonly erro = signal<string | null>(null);
  readonly itens = signal<ResponsavelFaturamentoListItemDTO[]>([]);

  ngOnInit(): void {
    this.termo.set(String(this.data.termoInicial ?? '').trim());
    this.buscar();
  }

  formatCnpj(v: string): string {
    return formatCnpj(v || '');
  }

  buscar(): void {
    this.loading.set(true);
    this.erro.set(null);
    const t = this.termo().trim();
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
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (paged) => {
          this.itens.set(paged.items ?? []);
        },
        error: () => {
          this.itens.set([]);
          this.erro.set('Falha ao buscar responsáveis.');
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
