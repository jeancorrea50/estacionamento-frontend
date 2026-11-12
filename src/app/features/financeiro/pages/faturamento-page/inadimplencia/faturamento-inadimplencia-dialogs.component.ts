import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
    <div class="fat-dlg">
      <header class="fat-dlg__header">
        <div class="fat-dlg__header-main">
          <div class="fat-dlg__icon" aria-hidden="true">
            <span class="material-symbols-outlined">event</span>
          </div>
          <div class="fat-dlg__titles">
            <h2 class="fat-dlg__title" mat-dialog-title>Editar vencimento</h2>
            <p class="fat-dlg__subtitle">Fatura {{ data.faturaNumero }}</p>
          </div>
        </div>
        <button type="button" class="fat-dlg__close" aria-label="Fechar" (click)="ref.close()">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>
      <mat-dialog-content class="fat-dlg__body">
        <section class="fat-dlg__card">
          <mat-form-field appearance="outline" class="fat-dlg__field" subscriptSizing="dynamic">
            <mat-label>Novo vencimento</mat-label>
            <input matInput type="date" [(ngModel)]="dataVencimento" />
          </mat-form-field>
        </section>
      </mat-dialog-content>
      <footer class="fat-dlg__footer">
        <button type="button" mat-button (click)="ref.close()">Cancelar</button>
        <button type="button" mat-flat-button color="primary" [disabled]="!dataVencimento || salvando()" (click)="salvar()">
          Salvar
        </button>
      </footer>
    </div>
  `,
  styleUrl: './faturamento-inadimplencia-dialogs.component.scss'
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
    <div class="fat-dlg">
      <header class="fat-dlg__header">
        <div class="fat-dlg__header-main">
          <div class="fat-dlg__icon" aria-hidden="true">
            <span class="material-symbols-outlined">{{ data.modo === 'acrescimo' ? 'add_card' : 'sell' }}</span>
          </div>
          <div class="fat-dlg__titles">
            <h2 class="fat-dlg__title" mat-dialog-title>{{ data.titulo }}</h2>
            <p class="fat-dlg__subtitle">Fatura {{ data.faturaNumero }}</p>
          </div>
        </div>
        <button type="button" class="fat-dlg__close" aria-label="Fechar" (click)="ref.close()">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>
      <mat-dialog-content class="fat-dlg__body">
        <section class="fat-dlg__card">
          <mat-form-field appearance="outline" class="fat-dlg__field" subscriptSizing="dynamic">
            <mat-label>{{ data.label }}</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="valor" />
          </mat-form-field>
        </section>
      </mat-dialog-content>
      <footer class="fat-dlg__footer">
        <button type="button" mat-button (click)="ref.close()">Cancelar</button>
        <button type="button" mat-flat-button color="primary" [disabled]="valor < 0 || salvando()" (click)="salvar()">
          Salvar
        </button>
      </footer>
    </div>
  `,
  styleUrl: './faturamento-inadimplencia-dialogs.component.scss'
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
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="fat-dlg">
      <header class="fat-dlg__header">
        <div class="fat-dlg__header-main">
          <div class="fat-dlg__icon" aria-hidden="true">
            <span class="material-symbols-outlined">history</span>
          </div>
          <div class="fat-dlg__titles">
            <h2 class="fat-dlg__title" mat-dialog-title>Histórico de cobranças</h2>
            <p class="fat-dlg__subtitle">Fatura {{ data.id }}</p>
          </div>
        </div>
        <button type="button" class="fat-dlg__close" aria-label="Fechar" mat-dialog-close>
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>
      <mat-dialog-content class="fat-dlg__body">
        <section class="fat-dlg__card">
          @if (loading()) {
            <div class="inad-hist__loading"><mat-spinner diameter="28" /></div>
          } @else if (itens().length === 0) {
            <p class="fat-dlg__hint">Nenhum envio registrado para esta fatura.</p>
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
        </section>
      </mat-dialog-content>
      <footer class="fat-dlg__footer">
        <button type="button" mat-flat-button color="primary" mat-dialog-close>Fechar</button>
      </footer>
    </div>
  `,
  styleUrl: './faturamento-inadimplencia-dialogs.component.scss'
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
