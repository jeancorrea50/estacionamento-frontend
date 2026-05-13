import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

import type { FaturamentoTabId } from './faturamento-visao.types';
import { FaturamentoFaturasComponent } from './faturas/faturamento-faturas.component';
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
    FaturamentoFaturasComponent
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

  readonly mockFechamentos = [
    { periodo: 'Fev/2026', faturas: 38, total: 112_300, situacao: 'Consolidado' },
    { periodo: 'Jan/2026', faturas: 41, total: 119_800, situacao: 'Consolidado' }
  ];

  readonly mockRecebimentos = [
    { data: '05/05/2026', origem: 'PIX', valor: 1250, fatura: 'FT-2388' },
    { data: '04/05/2026', origem: 'Boleto', valor: 3400, fatura: 'FT-2381' },
    { data: '02/05/2026', origem: 'TED', valor: 890, fatura: 'FT-2375' }
  ];

  readonly mockInadimplencia = [
    { cliente: 'Garagem Sul', dias: 12, valor: 3150.5, ultimaCobranca: '28/04/2026' },
    { cliente: 'Parking Express', dias: 8, valor: 980, ultimaCobranca: '30/04/2026' }
  ];

  readonly mockConfigCobranca = [
    { nome: 'Boleto registrado', canal: 'E-mail + PDF', ativo: true },
    { nome: 'PIX copia e cola', canal: 'E-mail', ativo: true },
    { nome: 'Lembrete D+3', canal: 'E-mail automático', ativo: false }
  ];

  setTab(id: FaturamentoTabId): void {
    this.activeTab.set(id);
  }

  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
