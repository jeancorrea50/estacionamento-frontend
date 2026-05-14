import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

import type { FaturamentoTabId } from './faturamento-visao.types';
import { FaturamentoFechamentosComponent } from './fechamentos/faturamento-fechamentos.component';
import { FaturamentoInadimplenciaComponent } from './inadimplencia/faturamento-inadimplencia.component';
import { FaturamentoRecebimentosComponent } from './recebimentos/faturamento-recebimentos.component';
import { FaturamentoFaturasComponent } from './faturas/faturamento-faturas.component';
import { FaturamentoConfigCobrancaComponent } from './config-cobranca/faturamento-config-cobranca.component';
import { FaturamentoVisaoGeralComponent } from './visao-geral/faturamento-visao-geral.component';

export type { FaturamentoTabId, FaturaStatusVisao, PeriodoFiltroId } from './faturamento-visao.types';

interface FaturamentoTab {
  id: FaturamentoTabId;
  label: string;
}

@Component({
  selector: 'app-faturamento-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    FaturamentoVisaoGeralComponent,
    FaturamentoFaturasComponent,
    FaturamentoFechamentosComponent,
    FaturamentoRecebimentosComponent,
    FaturamentoInadimplenciaComponent,
    FaturamentoConfigCobrancaComponent
  ],
  templateUrl: './faturamento-page.component.html',
  styleUrls: ['./faturamento-page.component.scss']
})
export class FaturamentoPageComponent {
  readonly tabs: FaturamentoTab[] = [
    { id: 'visao-geral', label: 'Visão Geral' },
    { id: 'faturas', label: 'Faturas' },
    { id: 'fechamentos', label: 'Fechamentos' },
    { id: 'recebimentos', label: 'Recebimentos' },
    { id: 'inadimplencia', label: 'Inadimplência' },
    { id: 'config-cobranca', label: 'Configurações de Cobrança' }
  ];

  readonly activeTab = signal<FaturamentoTabId>('visao-geral');

  setTab(id: FaturamentoTabId): void {
    this.activeTab.set(id);
  }

  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
