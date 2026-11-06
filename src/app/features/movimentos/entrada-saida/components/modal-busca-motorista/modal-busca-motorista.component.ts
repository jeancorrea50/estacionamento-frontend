import { Component, input, output } from '@angular/core';
import { PaginatedSearchItem } from '../../../../../shared/models/paginated-search.models';
import { PaginatedEntitySearchHostComponent } from '../paginated-entity-search-host/paginated-entity-search-host.component';

@Component({
  selector: 'app-modal-busca-motorista',
  standalone: true,
  imports: [PaginatedEntitySearchHostComponent],
  template: `
    <app-paginated-entity-search-host
      kind="motorista"
      [aberto]="aberto()"
      [termoAoAbrir]="termoCampo()"
      [transportadoraId]="transportadoraId()"
      (fechar)="fechar.emit()"
      (selecionar)="itemSelecionado.emit($event)"
    />
  `
})
export class ModalBuscaMotoristaComponent {
  aberto = input(false);
  /** Texto atual do campo motorista na tela principal. */
  termoCampo = input('');
  /** Filtro opcional na listagem paginada (ex.: motoristas da transportadora em edição). */
  transportadoraId = input<number | undefined>(undefined);
  fechar = output<void>();
  itemSelecionado = output<PaginatedSearchItem>();
}
