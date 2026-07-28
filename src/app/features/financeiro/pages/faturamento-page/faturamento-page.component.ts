import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

export type { FaturamentoTabId, FaturaStatusVisao, PeriodoFiltroId } from './faturamento-visao.types';

@Component({
  selector: 'app-faturamento-page',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './faturamento-page.component.html',
  styleUrls: ['./faturamento-page.component.scss']
})
export class FaturamentoPageComponent {
  readonly tabs = [
    { path: 'visao-geral',     label: 'Visão Geral' },
    { path: 'fechamentos',     label: 'Fechamentos' },
    { path: 'faturas',         label: 'Faturas' },
    { path: 'recebimentos',    label: 'Recebimentos' },
    { path: 'inadimplencia',   label: 'Inadimplência' },
    { path: 'config-cobranca', label: 'Configurações de Cobrança' }
  ];
}
