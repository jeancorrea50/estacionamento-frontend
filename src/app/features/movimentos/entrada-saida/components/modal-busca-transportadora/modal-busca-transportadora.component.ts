import { Component, input, output } from '@angular/core';
import { PaginatedSearchItem } from '../../../../../shared/models/paginated-search.models';
import { PaginatedEntitySearchHostComponent } from '../paginated-entity-search-host/paginated-entity-search-host.component';

@Component({
  selector: 'app-modal-busca-transportadora',
  standalone: true,
  imports: [PaginatedEntitySearchHostComponent],
  template: `
    <app-paginated-entity-search-host
      kind="transportadora"
      [aberto]="aberto()"
      [termoAoAbrir]="termoCampo()"
      (fechar)="fechar.emit()"
      (selecionar)="itemSelecionado.emit($event)"
    />
  `
})
export class ModalBuscaTransportadoraComponent {
  aberto = input(false);
  termoCampo = input('');
  fechar = output<void>();
  itemSelecionado = output<PaginatedSearchItem>();
}
