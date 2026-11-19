import { Component, input, output } from '@angular/core';
import { PaginatedSearchItem } from '../../../../../shared/models/paginated-search.models';
import { PaginatedEntitySearchHostComponent } from '../paginated-entity-search-host/paginated-entity-search-host.component';

@Component({
  selector: 'app-modal-busca-veiculo',
  standalone: true,
  imports: [PaginatedEntitySearchHostComponent],
  template: `
    <app-paginated-entity-search-host
      kind="veiculo"
      [aberto]="aberto()"
      [termoAoAbrir]="termoCampo()"
      [transportadoraId]="transportadoraId()"
      [selecaoMultipla]="selecaoMultipla()"
      [idsJaSelecionados]="idsJaSelecionados()"
      (fechar)="fechar.emit()"
      (selecionar)="itemSelecionado.emit($event)"
      (selecionarVarios)="itensSelecionados.emit($event)"
    />
  `
})
export class ModalBuscaVeiculoComponent {
  aberto = input(false);
  termoCampo = input('');
  /** Filtra frota pela transportadora (obrigatório para listar placas no backend). */
  transportadoraId = input<number | undefined>(undefined);
  /** Agendar: marcar várias placas e confirmar em lote. */
  selecaoMultipla = input(false);
  idsJaSelecionados = input<Array<string | number>>([]);
  fechar = output<void>();
  itemSelecionado = output<PaginatedSearchItem>();
  itensSelecionados = output<PaginatedSearchItem[]>();
}
