import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';

import { FaturaService } from '../../../services/fatura.service';
import type { HistoricoCobrancaItemOutput } from '../../../models/fatura.models';
import type { InadimplenciaListaItem } from './faturamento-inadimplencia.types';

export interface InadValorDialogData {
  faturaId: number;
  faturaNumero: string;
  titulo: string;
  label: string;
  valorAtual: number;
  modo: 'acrescimo' | 'desconto';
}

export interface InadVencimentoDialogData {
  faturaId: number;
  faturaNumero: string;
  vencimento: string;
}

@Component({
  selector: 'app-inad-vencimento-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Editar vencimento</h2>
    <mat-dialog-content>
      <p class="inad-dlg__hint">Fatura {{ data.faturaNumero }}</p>
      <mat-form-field appearance="outline" class="inad-dlg__field" subscriptSizing="dynamic">
        <mat-label>Novo vencimento</mat-label>
        <input matInput type="date" [(ngModel)]="dataVencimento" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close()">Cancelar</button>
      <button type="button" mat-flat-button color="primary" [disabled]="!dataVencimento || salvando()" (click)="salvar()">
        Salvar
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .inad-dlg__hint { margin: 0 0 8px; font-size: 13px; color: var(--muted, #64748b); }
      .inad-dlg__field { width: 100%; min-width: 260px; }
    `
  ]
})
export class InadVencimentoDialogComponent {
  readonly ref = inject(MatDialogRef<InadVencimentoDialogComponent, boolean>);
  readonly data = inject<InadVencimentoDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(FaturaService);
  private readonly snack = inject(MatSnackBar);
  readonly salvando = signal(false);
  dataVencimento = (this.data.vencimento || '').slice(0, 10);

  salvar(): void {
    if (!this.dataVencimento || this.salvando()) return;
    this.salvando.set(true);
    this.api
      .alterarVencimento(this.data.faturaId, this.dataVencimento)
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: () => this.ref.close(true),
        error: (err: unknown) => {
          this.snack.open(this.msg(err, 'Falha ao atualizar vencimento.'), 'Fechar', { duration: 5000 });
        }
      });
  }

  private msg(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'message' in err) {
      const m = String((err as { message: unknown }).message || '');
      if (m.trim()) return m;
    }
    return fallback;
  }
}

@Component({
  selector: 'app-inad-valor-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content>
      <p class="inad-dlg__hint">Fatura {{ data.faturaNumero }}</p>
      <mat-form-field appearance="outline" class="inad-dlg__field" subscriptSizing="dynamic">
        <mat-label>{{ data.label }}</mat-label>
        <input matInput type="number" min="0" step="0.01" [(ngModel)]="valor" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close()">Cancelar</button>
      <button type="button" mat-flat-button color="primary" [disabled]="valor < 0 || salvando()" (click)="salvar()">
        Salvar
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .inad-dlg__hint { margin: 0 0 8px; font-size: 13px; color: var(--muted, #64748b); }
      .inad-dlg__field { width: 100%; min-width: 260px; }
    `
  ]
})
export class InadValorDialogComponent {
  readonly ref = inject(MatDialogRef<InadValorDialogComponent, boolean>);
  readonly data = inject<InadValorDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(FaturaService);
  private readonly snack = inject(MatSnackBar);
  readonly salvando = signal(false);
  valor = this.data.valorAtual ?? 0;

  salvar(): void {
    if (this.valor < 0 || this.salvando()) return;
    this.salvando.set(true);
    const req =
      this.data.modo === 'acrescimo'
        ? this.api.aplicarAcrescimo(this.data.faturaId, this.valor)
        : this.api.aplicarDesconto(this.data.faturaId, this.valor);
    req.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: () => this.ref.close(true),
      error: (err: unknown) => {
        const m =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : '';
        this.snack.open(m.trim() || 'Falha ao salvar valor.', 'Fechar', { duration: 5000 });
      }
    });
  }
}

@Component({
  selector: 'app-inad-historico-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>Histórico de cobranças</h2>
    <mat-dialog-content>
      <p class="inad-dlg__hint">Fatura {{ data.id }}</p>
      @if (loading()) {
        <div class="inad-hist__loading"><mat-spinner diameter="28" /></div>
      } @else if (itens().length === 0) {
        <p class="inad-hist__empty">Nenhum envio registrado para esta fatura.</p>
      } @else {
        <ul class="inad-hist__list">
          @for (h of itens(); track h.id) {
            <li class="inad-hist__item">
              <div class="inad-hist__top">
                <strong>{{ h.modalidadeLabel || '—' }}</strong>
                <span>{{ formatData(h.dataEnvio) }}</span>
              </div>
              <div class="inad-hist__meta">{{ h.assunto || h.descricao || '—' }}</div>
              <div class="inad-hist__meta">Destinatário: {{ h.destinatario || '—' }}</div>
              <div [class]="h.sucesso ? 'inad-hist__ok' : 'inad-hist__fail'">{{ h.resultado }}</div>
            </li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button mat-dialog-close>Fechar</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .inad-dlg__hint { margin: 0 0 8px; font-size: 13px; color: var(--muted, #64748b); }
      .inad-hist__loading { display: flex; justify-content: center; padding: 24px; }
      .inad-hist__empty { margin: 12px 0; color: var(--muted, #64748b); }
      .inad-hist__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; max-height: 360px; overflow: auto; }
      .inad-hist__item { border: 1px solid color-mix(in srgb, var(--border, #cbd5e1) 80%, transparent); border-radius: 8px; padding: 10px 12px; }
      .inad-hist__top { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
      .inad-hist__meta { font-size: 12px; color: var(--muted, #64748b); margin-top: 2px; }
      .inad-hist__ok { margin-top: 4px; font-size: 12px; color: #15803d; }
      .inad-hist__fail { margin-top: 4px; font-size: 12px; color: #b91c1c; }
    `
  ]
})
export class InadHistoricoDialogComponent {
  readonly data = inject<InadimplenciaListaItem>(MAT_DIALOG_DATA);
  private readonly api = inject(FaturaService);
  readonly loading = signal(true);
  readonly itens = signal<HistoricoCobrancaItemOutput[]>([]);

  constructor() {
    this.api.listarHistoricoCobranca(this.data.faturaId).subscribe({
      next: (rows) => {
        this.itens.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.itens.set([]);
        this.loading.set(false);
      }
    });
  }

  formatData(v: string): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleString('pt-BR');
  }
}
