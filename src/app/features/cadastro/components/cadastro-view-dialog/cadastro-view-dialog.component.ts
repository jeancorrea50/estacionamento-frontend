import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface CadastroViewLinha {
  label: string;
  valor: string;
}

export interface CadastroViewDialogData {
  titulo: string;
  linhas: CadastroViewLinha[];
  /** Abre o cadastro completo. A tela de destino esconde gravar/alterar/excluir. */
  mostrarMaisInformacoes?: boolean;
}

@Component({
  selector: 'app-cadastro-view-dialog',
  standalone: true,
  imports: [MatDialogModule],
  template: `
    <div class="trn-view">
      <header class="trn-view__header">
        <h2 class="trn-view__title" mat-dialog-title>{{ data.titulo }}</h2>
      </header>
      <mat-dialog-content class="trn-view__body">
        <dl class="trn-view__dl">
          @for (linha of data.linhas; track linha.label) {
            <div class="trn-view__row">
              <dt>{{ linha.label }}</dt>
              <dd>{{ linha.valor || '—' }}</dd>
            </div>
          }
        </dl>
      </mat-dialog-content>
      <footer class="trn-view__footer" mat-dialog-actions align="end">
        <button type="button" class="trn-view__btn trn-view__btn--secondary" (click)="ref.close()">
          Fechar
        </button>
        @if (data.mostrarMaisInformacoes !== false) {
          <button type="button" class="trn-view__btn trn-view__btn--primary" (click)="ref.close('edit')">
            Mais informações
          </button>
        }
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        --trn-view-surface: #252530;
        --trn-view-border: #363642;
        --trn-view-text: #f1f1f5;
        --trn-view-label: #92929f;
        --trn-view-value: #dadae2;
        --trn-view-primary: #3d8bff;
        --trn-view-primary-hover: #4a7dff;
        --trn-view-secondary-bg: #2f2f3a;
        --trn-view-secondary-text: #dadae2;
        display: block;
        color: var(--trn-view-text);
        background: var(--trn-view-surface);
      }
      .trn-view__header { padding: 18px 20px 0; }
      .trn-view__title { margin: 0; font-size: 1.05rem; font-weight: 650; }
      .trn-view__body { padding: 12px 20px 8px !important; max-height: 70vh; }
      .trn-view__dl { margin: 0; }
      .trn-view__row {
        display: grid;
        grid-template-columns: 148px 1fr;
        gap: 8px 16px;
        padding: 10px 0;
        border-bottom: 1px solid var(--trn-view-border);
      }
      .trn-view__row:last-child { border-bottom: none; }
      .trn-view__dl dt { margin: 0; font-size: 0.8125rem; color: var(--trn-view-label); }
      .trn-view__dl dd { margin: 0; font-size: 0.875rem; color: var(--trn-view-value); word-break: break-word; }
      .trn-view__footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin: 0;
        padding: 14px 20px !important;
        border-top: 1px solid var(--trn-view-border);
      }
      .trn-view__btn {
        min-height: 36px;
        padding: 0 16px;
        border-radius: 8px;
        border: 1px solid transparent;
        font: inherit;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
      }
      .trn-view__btn--secondary {
        background: var(--trn-view-secondary-bg);
        border-color: var(--trn-view-border);
        color: var(--trn-view-secondary-text);
      }
      .trn-view__btn--primary { background: var(--trn-view-primary); color: #fff; }
      .trn-view__btn--primary:hover { background: var(--trn-view-primary-hover); }
    `
  ]
})
export class CadastroViewDialogComponent {
  readonly ref = inject(MatDialogRef<CadastroViewDialogComponent, void | 'edit'>);
  readonly data = inject<CadastroViewDialogData>(MAT_DIALOG_DATA);
}
