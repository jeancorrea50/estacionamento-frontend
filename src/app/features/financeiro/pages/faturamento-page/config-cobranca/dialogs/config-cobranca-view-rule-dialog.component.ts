import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { SERVICO_KEYS, SERVICO_VALOR_LABELS } from '../faturamento-config-cobranca.helpers';
import { formatarPeriodoAcordo, resumoListagemAcordo, tipoCobrancaExcedenteLabel } from '../config-cobranca-acordo.util';
import type { ConfigCobrancaAcordoListagem, ConfigCobrancaListaItem } from '../faturamento-config-cobranca.types';

export interface ConfigCobrancaViewRuleDialogData {
  row: ConfigCobrancaListaItem;
}

@Component({
  selector: 'app-config-cobranca-view-rule-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <div class="fat-dlg">
      <header class="fat-dlg__header">
        <div class="fat-dlg__header-main">
          <div class="fat-dlg__icon" aria-hidden="true">
            <span class="material-symbols-outlined">visibility</span>
          </div>
          <div class="fat-dlg__titles">
            <h2 class="fat-dlg__title" mat-dialog-title>Visualizar regra</h2>
            <p class="fat-dlg__subtitle">Detalhes da configuração de cobrança selecionada.</p>
          </div>
        </div>
        <button type="button" class="fat-dlg__close" aria-label="Fechar" (click)="ref.close()">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>

      <mat-dialog-content class="fat-dlg__body">
        <section class="fat-dlg__card">
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
            @if (data.row.modalidade === 'Acordo') {
              <div><dt>Período do acordo</dt><dd>{{ periodoAcordo() }}</dd></div>
              @for (l of data.row.acordo.listagens; track l.id) {
                <div><dt>Listagem de vagas</dt><dd>{{ resumoListagem(l) }}</dd></div>
              }
              <div><dt>Custo do excedente</dt><dd>{{ formatarValorEstacionamento(data.row.acordo.custoExcedente) }}</dd></div>
              <div><dt>Tipo do excedente</dt><dd>{{ tipoExcedente() }}</dd></div>
            }
            @if (data.row.modalidade !== 'Diária') {
              <div><dt>Regra de fechamento</dt><dd>{{ data.row.fechamento }}</dd></div>
              <div><dt>Prazo de vencimento</dt><dd>{{ data.row.prazoVencimento }}</dd></div>
            }
            <div><dt>Valor do estacionamento</dt><dd>{{ formatarValorEstacionamento(data.row.valorEstacionamento) }}</dd></div>
            <div>
              <dt>Envio automático</dt>
              <dd>{{ data.row.gerarFaturaAutomaticamente ? 'Sim' : 'Não' }}</dd>
            </div>
            <div>
              <dt>E-mails financeiros</dt>
              <dd>{{ emailsFinanceirosLabel() }}</dd>
            </div>
            <div><dt>Multa</dt><dd>{{ data.row.multaAplicar ? data.row.multaPercentual + '%' : 'Não' }}</dd></div>
            <div><dt>Juros</dt><dd>{{ data.row.jurosAplicar ? data.row.jurosPercentual + '%' : 'Não' }}</dd></div>
            <div><dt>Serviços adicionais</dt><dd>{{ data.row.servicosCobrados }}</dd></div>
            @for (s of servicosHabilitados(); track s.label) {
              <div><dt>{{ s.label }}</dt><dd>{{ formatarValorEstacionamento(s.valor) }}</dd></div>
            }
            <div><dt>Status</dt><dd>{{ data.row.status }}</dd></div>
          </dl>
        </section>
      </mat-dialog-content>

      <footer class="fat-dlg__footer">
        <button type="button" mat-button (click)="ref.close()">Fechar</button>
        <button type="button" mat-flat-button color="primary" (click)="ref.close('edit')">Editar Configuração</button>
      </footer>
    </div>
  `,
  styleUrl: './config-cobranca-view-rule-dialog.component.scss'
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

  periodoAcordo(): string {
    return formatarPeriodoAcordo(this.data.row.acordo.dataInicio, this.data.row.acordo.dataFim);
  }

  resumoListagem(listagem: ConfigCobrancaAcordoListagem): string {
    return resumoListagemAcordo(listagem);
  }

  tipoExcedente(): string {
    return tipoCobrancaExcedenteLabel(this.data.row.acordo.tipoCobrancaExcedente);
  }

  emailsFinanceirosLabel(): string {
    const raw = String(this.data.row.emailFinanceiro ?? '').trim();
    if (!raw) return '—';
    const emails = raw
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    return emails.length ? emails.join(', ') : '—';
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
