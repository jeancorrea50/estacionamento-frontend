import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import type { ConfigCobrancaListaItem } from '../faturamento-config-cobranca.types';

export interface ConfigCobrancaViewRuleDialogData {
  row: ConfigCobrancaListaItem;
}

@Component({
  selector: 'app-config-cobranca-view-rule-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Visualizar regra</h2>
    <mat-dialog-content class="cfg-view__body">
      <dl class="cfg-view__dl">
        <div><dt>Transportadora</dt><dd>{{ data.row.transportadora }}</dd></div>
        <div><dt>Estacionamento</dt><dd>{{ data.row.estacionamento }}</dd></div>
        <div><dt>Modalidade</dt><dd>{{ data.row.modalidade }}</dd></div>
        <div><dt>Regra de fechamento</dt><dd>{{ data.row.fechamento }}</dd></div>
        <div><dt>Prazo de vencimento</dt><dd>{{ data.row.prazoVencimento }}</dd></div>
        <div><dt>Valor da estadia</dt><dd>{{ formatarValorEstadia(data.row.valorEstadia) }}</dd></div>
        <div><dt>Envio automático</dt><dd>{{ data.row.envioAutomatico ? 'Sim' : 'Não' }}</dd></div>
        <div><dt>E-mail financeiro</dt><dd>{{ data.row.emailFinanceiro ?? '—' }}</dd></div>
        <div><dt>Permite pagamento parcial</dt><dd>{{ data.row.pagamentoParcial ? 'Sim' : 'Não' }}</dd></div>
        <div><dt>Multa</dt><dd>{{ data.row.multaAplicar ? data.row.multaPercentual + '%' : 'Não' }}</dd></div>
        <div><dt>Juros</dt><dd>{{ data.row.jurosAplicar ? data.row.jurosPercentual + '%' : 'Não' }}</dd></div>
        <div><dt>Serviços cobrados</dt><dd>{{ data.row.servicosCobrados }}</dd></div>
        <div><dt>Agrupamento da fatura</dt><dd>{{ data.row.agrupamentoFatura }}</dd></div>
        <div><dt>Status</dt><dd>{{ data.row.status }}</dd></div>
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="ref.close()">Fechar</button>
      <button type="button" mat-flat-button color="primary" (click)="ref.close('edit')">Editar Configuração</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .cfg-view__body {
        min-width: min(100vw - 48px, 440px);
        padding-top: 4px !important;
      }
      .cfg-view__dl {
        display: grid;
        gap: 8px 12px;
        margin: 0;
        font-size: 13px;
      }
      .cfg-view__dl > div {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 8px;
        align-items: start;
      }
      .cfg-view__dl dt {
        margin: 0;
        color: var(--muted, #94a3b8);
        font-weight: 600;
      }
      .cfg-view__dl dd {
        margin: 0;
        color: var(--text, #e2e8f0);
      }
    `
  ]
})
export class ConfigCobrancaViewRuleDialogComponent {
  readonly ref = inject(MatDialogRef<ConfigCobrancaViewRuleDialogComponent, void | 'edit'>);
  readonly data = inject<ConfigCobrancaViewRuleDialogData>(MAT_DIALOG_DATA);

  formatarValorEstadia(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(Number(valor))) return '—';
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
