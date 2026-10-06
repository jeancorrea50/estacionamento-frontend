import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { formatCnpj } from '../../directives/cnpj-format.directive';
import { formatTelefone } from '../../directives/telefone-format.directive';
import type { TransportadoraListItemDTO } from '../../models/transportadora.dto';
import {
  isStatusConvitePendente,
  STATUS_CADASTRO_TRANSPORTADORA_LABEL,
} from '../../models/convite-transportadora.models';

export interface TransportadoraViewDialogData {
  item: TransportadoraListItemDTO;
}

@Component({
  selector: 'app-transportadora-view-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="trn-view">
      <header class="trn-view__header">
        <h2 class="trn-view__title" mat-dialog-title>Visualizar transportadora</h2>
      </header>

      <mat-dialog-content class="trn-view__body">
        <dl class="trn-view__dl">
          <div class="trn-view__row">
            <dt>ID</dt>
            <dd>{{ data.item.id }}</dd>
          </div>
          <div class="trn-view__row">
            <dt>Razão social</dt>
            <dd>{{ data.item.razaoSocial || '—' }}</dd>
          </div>
          <div class="trn-view__row">
            <dt>Nome fantasia</dt>
            <dd>{{ data.item.nomeFantasia || '—' }}</dd>
          </div>
          <div class="trn-view__row">
            <dt>CNPJ</dt>
            <dd>{{ formatCnpjValor(data.item.cnpj) }}</dd>
          </div>
          <div class="trn-view__row">
            <dt>E-mail</dt>
            <dd>{{ emailExibicao }}</dd>
          </div>
          <div class="trn-view__row">
            <dt>Telefone</dt>
            <dd>{{ formatTelefoneValor(data.item.telefone) }}</dd>
          </div>
          <div class="trn-view__row">
            <dt>Atualização</dt>
            <dd>{{ formatDataAtualizacao(data.item.dataAtualizacao) }}</dd>
          </div>
          <div class="trn-view__row">
            <dt>Frota</dt>
            <dd>{{ frotaExibicao }}</dd>
          </div>
          <div class="trn-view__row">
            <dt>Responsável</dt>
            <dd>{{ data.item.responsavelNome?.trim() ? data.item.responsavelNome : '—' }}</dd>
          </div>
          <div class="trn-view__row">
            <dt>Status</dt>
            <dd>{{ statusLabel }}</dd>
          </div>
        </dl>
      </mat-dialog-content>

      <footer class="trn-view__footer" mat-dialog-actions align="end">
        <button type="button" class="trn-view__btn trn-view__btn--secondary" (click)="ref.close()">
          Fechar
        </button>
        @if (podeEditar) {
          <button type="button" class="trn-view__btn trn-view__btn--primary" (click)="ref.close('edit')">
            Editar Cadastro
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

      :host-context(html.theme-light) {
        --trn-view-surface: var(--color-bg-card, #ffffff);
        --trn-view-border: var(--color-border, #e5e7eb);
        --trn-view-text: var(--color-text-primary, #111827);
        --trn-view-label: var(--color-text-secondary, #6b7280);
        --trn-view-value: var(--color-text-primary, #111827);
        --trn-view-primary: var(--color-primary, #2563eb);
        --trn-view-primary-hover: var(--color-primary-hover, #1d4ed8);
        --trn-view-secondary-bg: var(--color-bg-section, #f3f4f6);
        --trn-view-secondary-text: var(--color-text-primary, #111827);
      }

      .trn-view {
        display: flex;
        flex-direction: column;
        min-width: 0;
        background: var(--trn-view-surface);
      }

      .trn-view__header {
        flex: 0 0 auto;
        padding: 18px 20px 12px;
        border-bottom: 1px solid var(--trn-view-border);
        background: var(--trn-view-surface);
      }

      .trn-view__title.mat-mdc-dialog-title,
      .trn-view__title {
        margin: 0;
        padding: 0;
        font-size: 1.0625rem;
        font-weight: 600;
        line-height: 1.3;
        color: var(--trn-view-text);
        letter-spacing: -0.01em;
      }

      .trn-view__title::before {
        display: none;
      }

      .trn-view__body.mat-mdc-dialog-content {
        flex: 1 1 auto;
        min-width: min(100vw - 48px, 440px);
        margin: 0;
        padding: 16px 20px !important;
        max-height: min(60vh, 480px);
        overflow-y: auto;
        color: var(--trn-view-text);
        background: var(--trn-view-surface);
      }

      .trn-view__dl {
        display: flex;
        flex-direction: column;
        gap: 0;
        margin: 0;
      }

      .trn-view__row {
        display: grid;
        grid-template-columns: 148px 1fr;
        gap: 12px 16px;
        align-items: start;
        padding: 10px 0;
        border-bottom: 1px solid var(--trn-view-border);
      }

      .trn-view__row:first-child {
        padding-top: 0;
      }

      .trn-view__row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .trn-view__dl dt {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--trn-view-label);
        line-height: 1.4;
      }

      .trn-view__dl dd {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--trn-view-value);
        line-height: 1.45;
        word-break: break-word;
      }

      .trn-view__footer.mat-mdc-dialog-actions {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0;
        padding: 14px 20px !important;
        min-height: 0;
        border-top: 1px solid var(--trn-view-border);
        background: var(--trn-view-surface);
      }

      .trn-view__btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 36px;
        padding: 0 16px;
        border-radius: 8px;
        border: 1px solid transparent;
        font: inherit;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        box-shadow: none;
        transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      }

      .trn-view__btn--secondary {
        background: var(--trn-view-secondary-bg);
        border-color: var(--trn-view-border);
        color: var(--trn-view-secondary-text);
      }

      .trn-view__btn--secondary:hover {
        filter: brightness(1.06);
      }

      .trn-view__btn--primary {
        background: var(--trn-view-primary);
        border-color: var(--trn-view-primary);
        color: #ffffff;
      }

      .trn-view__btn--primary:hover {
        background: var(--trn-view-primary-hover);
        border-color: var(--trn-view-primary-hover);
      }

      @media (max-width: 480px) {
        .trn-view__row {
          grid-template-columns: 1fr;
          gap: 4px;
        }
      }
    `
  ]
})
export class TransportadoraViewDialogComponent {
  readonly ref = inject(MatDialogRef<TransportadoraViewDialogComponent, void | 'edit'>);
  readonly data = inject<TransportadoraViewDialogData>(MAT_DIALOG_DATA);

  get statusLabel(): string {
    const st = this.data.item.statusCadastro ?? (this.data.item.ativo ? 'Ativa' : 'Inativa');
    return STATUS_CADASTRO_TRANSPORTADORA_LABEL[st] ?? st;
  }

  get podeEditar(): boolean {
    const st = this.data.item.statusCadastro ?? (this.data.item.ativo ? 'Ativa' : 'Inativa');
    return !isStatusConvitePendente(st);
  }

  get emailExibicao(): string {
    const email = String(this.data.item.email ?? '').trim();
    return email || '—';
  }

  get frotaExibicao(): string {
    const q = this.data.item.quantidadeVeiculos;
    if (q == null || q < 0) return '—';
    return String(q);
  }

  formatCnpjValor(doc: string | null | undefined): string {
    const d = String(doc ?? '').replace(/\D/g, '');
    if (d.length === 14) return formatCnpj(d);
    const raw = String(doc ?? '').trim();
    return raw || '—';
  }

  formatTelefoneValor(raw: string | null | undefined): string {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) return '—';
    return formatTelefone(digits);
  }

  formatDataAtualizacao(raw: string | null | undefined): string {
    if (raw == null || String(raw).trim() === '') return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }
}
