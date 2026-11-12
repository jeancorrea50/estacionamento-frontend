import { CommonModule } from '@angular/common';
import { Component, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaginatedSearchItem } from '../../models/paginated-search.models';

@Component({
  selector: 'app-paginated-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paginated-search-modal.component.html',
  styleUrl: './paginated-search-modal.component.scss'
})
export class PaginatedSearchModalComponent {
  aberto = input(false);
  titulo = input('Buscar');
  placeholder = input('Buscar por descrição...');
  coluna1Label = input('Descrição');
  coluna2Label = input('Detalhe');
  coluna3Label = input('Extra');
  coluna4Label = input('');
  coluna5Label = input('');
  /** Valor inicial ao abrir o modal (digitação é local até clicar em Pesquisar). */
  termo = input('');
  loading = input(false);
  itens = input<PaginatedSearchItem[]>([]);
  totalCount = input(0);
  numeroPagina = input(1);
  tamanhoPagina = input(10);

  fechar = output<void>();
  /** Emitido ao clicar em Pesquisar com o termo atual do campo. */
  pesquisar = output<string>();
  selecionar = output<PaginatedSearchItem>();
  mudarPagina = output<number>();

  readonly termoLocal = signal('');

  constructor() {
    effect(() => {
      const open = this.aberto();
      const inicial = this.termo();
      if (open) {
        untracked(() => this.termoLocal.set(inicial));
      }
    });
  }

  onPesquisar(): void {
    this.pesquisar.emit(this.termoLocal());
  }

  onSelecionar(item: PaginatedSearchItem): void {
    this.selecionar.emit(item);
  }

  mostrarColuna4(): boolean {
    return !!this.coluna4Label().trim();
  }

  mostrarColuna5(): boolean {
    return !!this.coluna5Label().trim();
  }

  gridCols(): string {
    if (this.mostrarColuna5()) {
      return 'minmax(140px, 1.2fr) minmax(180px, 1.8fr) minmax(90px, 0.8fr) minmax(100px, 1fr) minmax(90px, 0.8fr)';
    }
    if (this.mostrarColuna4()) {
      return 'minmax(200px, 2fr) minmax(130px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr)';
    }
    return 'minmax(220px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr)';
  }

  paginaTotal(): number {
    return Math.max(1, Math.ceil(this.totalCount() / this.tamanhoPagina()));
  }
}
