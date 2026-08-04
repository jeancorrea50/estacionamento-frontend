import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

import { FATURAMENTO_TABS } from '../../faturamento-rotas';

export type { FaturamentoTabId, FaturaStatusVisao, PeriodoFiltroId } from './faturamento-visao.types';

@Component({
  selector: 'app-faturamento-page',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './faturamento-page.component.html',
  styleUrls: ['./faturamento-page.component.scss']
})
export class FaturamentoPageComponent {
  readonly tabs = FATURAMENTO_TABS;
}
