import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { formatCnpj } from '../../directives/cnpj-format.directive';
import { formatTelefone } from '../../directives/telefone-format.directive';
import type { TransportadoraListItemDTO } from '../../models/transportadora.dto';

export interface TransportadoraViewDialogData {
  item: TransportadoraListItemDTO;
}

@Component({
  selector: 'app-transportadora-view-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Visualizar transportadora</h2>
    <mat-dialog-content class="trn-view__body">
      <dl class="trn-view__dl">
        <div><dt>ID</dt><dd>{{ data.item.id }}</dd></div>
        <div><dt>Razão social</dt><dd>{{ data.item.razaoSocial || '—' }}</dd></div>
        <div><dt>Nome fantasia</dt><dd>{{ data.item.nomeFantasia || '—' }}</dd></div>
        <div><dt>CNPJ</dt><dd>{{ formatCnpjValor(data.item.cnpj) }}</dd></div>
        <div><dt>E-mail</dt><dd>{{ emailExibicao }}</dd></div>
        <div><dt>Telefone</dt><dd>{{ formatTelefoneValor(data.item.telefone) }}</dd></div>
        <div><dt>Atualização</dt><dd>{{ formatDataAtualizacao(data.item.dataAtualizacao) }}</dd></div>
        <div><dt>Frota</dt><dd>{{ frotaExibicao }}</dd></div>
        <div><dt>Status</dt><dd>{{ data.item.ativo ? 'Ativa' : 'Inativa' }}</dd></div>
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close()">Fechar</button>
      <button type="button" mat-flat-button color="primary" (click)="ref.close('edit')">
        Editar Cadastro
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .trn-view__body {
        min-width: min(100vw - 48px, 440px);
        padding-top: 4px !important;
      }
      .trn-view__dl {
        display: grid;
        gap: 8px 12px;
        margin: 0;
        font-size: 13px;
      }
      .trn-view__dl > div {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 8px;
        align-items: start;
      }
      .trn-view__dl dt {
        margin: 0;
        color: var(--muted, #94a3b8);
        font-weight: 600;
      }
      .trn-view__dl dd {
        margin: 0;
        color: var(--text, #e2e8f0);
        word-break: break-word;
      }
    `
  ]
})
export class TransportadoraViewDialogComponent {
  readonly ref = inject(MatDialogRef<TransportadoraViewDialogComponent, void | 'edit'>);
  readonly data = inject<TransportadoraViewDialogData>(MAT_DIALOG_DATA);

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
