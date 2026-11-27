import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';

// ICellRendererAngularComp vem do pacote Angular do AG Grid.

export interface AgendarGridActionsContext {
  podeCriar: boolean;
  podeCancelar: boolean;
  formatPlaca: (placa: string) => string;
  agendarDeNovo: (row: AgendarGridRowData) => void;
  cancelar: (row: AgendarGridRowData) => void;
}

export interface AgendarGridRowData {
  id: number;
  placa: string;
  situacao: string;
  __grupo?: boolean;
}

@Component({
  selector: 'app-agendar-grid-actions',
  standalone: true,
  imports: [MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!grupo && (ctx.podeCriar || (ctx.podeCancelar && row.situacao === 'agendado'))) {
      <button
        type="button"
        class="icon-btn"
        [attr.aria-label]="'Ações da placa ' + ctx.formatPlaca(row.placa)"
        [matMenuTriggerFor]="rowMenu"
      >
        <span class="material-symbols-outlined" aria-hidden="true">more_vert</span>
      </button>
      <mat-menu #rowMenu="matMenu" xPosition="before" yPosition="below">
        @if (ctx.podeCriar) {
          <button mat-menu-item (click)="ctx.agendarDeNovo(row)">
            <span class="material-symbols-outlined ma-menu-ico" aria-hidden="true"
              >event_repeat</span
            >Agendar de novo esta placa
          </button>
        }
        @if (ctx.podeCancelar && row.situacao === 'agendado') {
          <button mat-menu-item class="ma-menu-danger" (click)="ctx.cancelar(row)">
            <span class="material-symbols-outlined ma-menu-ico" aria-hidden="true">event_busy</span
            >Cancelar agendamento
          </button>
        }
      </mat-menu>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
      }
    `,
  ],
})
export class AgendarGridActionsRenderer implements ICellRendererAngularComp {
  row!: AgendarGridRowData;
  ctx!: AgendarGridActionsContext;
  grupo = false;

  agInit(params: ICellRendererParams<AgendarGridRowData>): void {
    this.refresh(params);
  }

  refresh(params: ICellRendererParams<AgendarGridRowData>): boolean {
    this.row = (params.data ?? { id: 0, placa: '', situacao: '' }) as AgendarGridRowData;
    this.grupo = !!this.row.__grupo;
    this.ctx = (params.context ?? {}) as AgendarGridActionsContext;
    return true;
  }
}
