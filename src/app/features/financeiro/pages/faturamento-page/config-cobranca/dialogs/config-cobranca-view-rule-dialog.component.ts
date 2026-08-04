import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { SERVICO_KEYS, SERVICO_VALOR_LABELS } from '../faturamento-config-cobranca.helpers';
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
        <div><dt>Modalidade</dt><dd>{{ data.row.modalidade }}</dd></div>
        @if (data.row.modalidade === 'Mensal' && data.row.diaFechamento) {
          <div><dt>Dia da cobrança</dt><dd>Todo dia {{ data.row.diaFechamento }}</dd></div>
        }
        @if (data.row.modalidade === 'Semanal') {
          <div><dt>Dia da semana</dt><dd>{{ data.row.fechamento }}</dd></div>
        }
        @if (data.row.dataCobranca) {
          <div><dt>Data da cobrança</dt><dd>{{ formatarData(data.row.dataCobranca) }}</dd></div>
        }
        <div><dt>Regra de fechamento</dt><dd>{{ data.row.fechamento }}</dd></div>
        <div><dt>Prazo de vencimento</dt><dd>{{ data.row.prazoVencimento }}</dd></div>
        <div><dt>Valor do estacionamento</dt><dd>{{ formatarValorEstacionamento(data.row.valorEstacionamento) }}</dd></div>
        <div>
          <dt>Envio automático</dt>
          <dd>{{ data.row.gerarFaturaAutomaticamente ? 'Sim' : 'Não' }}</dd>
        </div>
        <div><dt>E-mail financeiro</dt><dd>{{ data.row.emailFinanceiro ?? '—' }}</dd></div>
        <div><dt>Multa</dt><dd>{{ data.row.multaAplicar ? data.row.multaPercentual + '%' : 'Não' }}</dd></div>
        <div><dt>Juros</dt><dd>{{ data.row.jurosAplicar ? data.row.jurosPercentual + '%' : 'Não' }}</dd></div>
        <div><dt>Serviços adicionais</dt><dd>{{ data.row.servicosCobrados }}</dd></div>
        @for (s of servicosHabilitados(); track s.label) {
          <div><dt>{{ s.label }}</dt><dd>{{ formatarValorEstacionamento(s.valor) }}</dd></div>
        }
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
        color: var(--text);
      }
    `
  ]
})
export class ConfigCobrancaViewRuleDialogComponent {
  readonly ref = inject(MatDialogRef<ConfigCobrancaViewRuleDialogComponent, void | 'edit'>);
  readonly data = inject<ConfigCobrancaViewRuleDialogData>(MAT_DIALOG_DATA);

  formatarValorEstacionamento(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(Number(valor))) return '—';
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(iso: string | null): string {
    if (!iso) return '—';
    const [ano, mes, dia] = iso.split('-');
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
  }

  servicosHabilitados(): { label: string; valor: number | null }[] {
    const servicos = this.data.row.servicos;
    if (!servicos) return [];
    return SERVICO_KEYS.filter((k) => servicos[k]?.habilitado).map((k) => ({
      label: SERVICO_VALOR_LABELS[k],
      valor: servicos[k].valor
    }));
  }
}
