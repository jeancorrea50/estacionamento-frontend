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
  /**
   * Quando true, permite marcar várias linhas e confirmar em lote.
   * Usado em Agendar; entrada/saída permanece em seleção única.
   */
  selecaoMultipla = input(false);
  /** IDs já presentes no formulário (exibidos marcados/desabilitados). */
  idsJaSelecionados = input<Array<string | number>>([]);

  fechar = output<void>();
  /** Emitido ao clicar em Pesquisar com o termo atual do campo. */
  pesquisar = output<string>();
  selecionar = output<PaginatedSearchItem>();
  selecionarVarios = output<PaginatedSearchItem[]>();
  mudarPagina = output<number>();

  readonly termoLocal = signal('');
  /** Seleção acumulada entre páginas/pesquisas (chave = String(id)). */
  readonly selecionadosMap = signal<Record<string, PaginatedSearchItem>>({});
  private estavaAberto = false;

  constructor() {
    // Texto inicial: sincroniza com o input `termo` enquanto aberto.
    effect(() => {
      const open = this.aberto();
      const inicial = this.termo();
      if (open) {
        untracked(() => this.termoLocal.set(inicial));
      }
    });

    // Seleção multi: limpa só na abertura (fechado → aberto), não ao pesquisar.
    effect(() => {
      const open = this.aberto();
      untracked(() => {
        if (open && !this.estavaAberto) {
          this.selecionadosMap.set({});
        }
        this.estavaAberto = open;
      });
    });
  }

  onPesquisar(): void {
    this.pesquisar.emit(this.termoLocal());
  }

  onSelecionar(item: PaginatedSearchItem): void {
    if (this.selecaoMultipla()) {
      this.toggleItem(item);
      return;
    }
    this.selecionar.emit(item);
  }

  toggleItem(item: PaginatedSearchItem, event?: Event): void {
    event?.stopPropagation();
    if (this.isJaSelecionado(item)) return;
    const key = this.itemKey(item);
    this.selecionadosMap.update((map) => {
      const next = { ...map };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = item;
      }
      return next;
    });
  }

  isChecked(item: PaginatedSearchItem): boolean {
    return this.isJaSelecionado(item) || !!this.selecionadosMap()[this.itemKey(item)];
  }

  isJaSelecionado(item: PaginatedSearchItem): boolean {
    const id = item.id;
    return this.idsJaSelecionados().some((x) => String(x) === String(id));
  }

  quantidadeNovasSelecoes(): number {
    return Object.keys(this.selecionadosMap()).length;
  }

  confirmarSelecaoMultipla(): void {
    const itens = Object.values(this.selecionadosMap());
    if (!itens.length) return;
    this.selecionarVarios.emit(itens);
  }

  mostrarColuna4(): boolean {
    return !!this.coluna4Label().trim();
  }

  mostrarColuna5(): boolean {
    return !!this.coluna5Label().trim();
  }

  gridCols(): string {
    const check = this.selecaoMultipla() ? '40px ' : '';
    if (this.mostrarColuna5()) {
      return `${check}minmax(140px, 1.2fr) minmax(180px, 1.8fr) minmax(90px, 0.8fr) minmax(100px, 1fr) minmax(90px, 0.8fr)`;
    }
    if (this.mostrarColuna4()) {
      return `${check}minmax(200px, 2fr) minmax(130px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr)`;
    }
    return `${check}minmax(220px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr)`;
  }

  paginaTotal(): number {
    return Math.max(1, Math.ceil(this.totalCount() / this.tamanhoPagina()));
  }

  private itemKey(item: PaginatedSearchItem): string {
    return String(item.id);
  }
}
