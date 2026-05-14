import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output, untracked } from '@angular/core';
import { ToastService } from '../../../../../core/api/services/toast.service';
import { ApiError } from '../../../../../core/api/models';
import { PaginatedSearchItem } from '../../../../../shared/models/paginated-search.models';
import { PaginatedSearchModalComponent } from '../../../../../shared/components/paginated-search-modal/paginated-search-modal.component';
import { EntradaSaidaLookupService } from '../../../services/entrada-saida-lookup.service';

export type EntradaSaidaLookupEntityKind = 'motorista' | 'transportadora' | 'veiculo';

@Component({
  selector: 'app-paginated-entity-search-host',
  standalone: true,
  imports: [CommonModule, PaginatedSearchModalComponent],
  templateUrl: './paginated-entity-search-host.component.html'
})
export class PaginatedEntitySearchHostComponent {
  private readonly lookup = inject(EntradaSaidaLookupService);
  private readonly toast = inject(ToastService);

  kind = input.required<EntradaSaidaLookupEntityKind>();
  aberto = input(false);
  /** Texto digitado no campo da tela principal ao abrir a busca (pré-preenche o modal e a 1ª pesquisa). */
  termoAoAbrir = input('');
  /** Quando informado, GET /Motorista filtra por transportadora (cadastro transportadora / frota). */
  transportadoraId = input<number | undefined>(undefined);

  fechar = output<void>();
  selecionar = output<PaginatedSearchItem>();

  loading = false;
  itens: PaginatedSearchItem[] = [];
  totalCount = 0;
  numeroPagina = 1;
  tamanhoPagina = 10;
  termoSincronizado = '';

  constructor() {
    effect(() => {
      const open = this.aberto();
      if (!open) return;
      untracked(() => {
        const inicial = (this.termoAoAbrir() ?? '').trim();
        this.numeroPagina = 1;
        this.termoSincronizado = inicial;
        this.carregar(inicial);
      });
    });
  }

  titulo(): string {
    switch (this.kind()) {
      case 'motorista':
        return 'Buscar motorista';
      case 'transportadora':
        return 'Buscar transportadora';
      case 'veiculo':
        return 'Buscar veículo';
      default:
        return 'Buscar';
    }
  }

  placeholder(): string {
    switch (this.kind()) {
      case 'motorista':
        return 'Nome do motorista...';
      case 'transportadora':
        return 'Nome fantasia ou razão social...';
      case 'veiculo':
        return 'Placa ou modelo...';
      default:
        return 'Buscar...';
    }
  }

  coluna1Label(): string {
    switch (this.kind()) {
      case 'veiculo':
        return 'Placa';
      default:
        return 'Descrição';
    }
  }

  coluna2Label(): string {
    switch (this.kind()) {
      case 'motorista':
        return 'CPF';
      case 'transportadora':
        return 'CNPJ';
      case 'veiculo':
        return 'Modelo';
      default:
        return 'Detalhe';
    }
  }

  coluna3Label(): string {
    switch (this.kind()) {
      case 'motorista':
        return 'CNH';
      case 'transportadora':
        return 'Extra';
      case 'veiculo':
        return 'Ano';
      default:
        return 'Extra';
    }
  }

  coluna4Label(): string {
    switch (this.kind()) {
      case 'veiculo':
        return 'Cor';
      default:
        return '';
    }
  }

  coluna5Label(): string {
    switch (this.kind()) {
      case 'veiculo':
        return 'Ativo';
      default:
        return '';
    }
  }

  onPesquisar(termo: string): void {
    this.termoSincronizado = termo;
    this.numeroPagina = 1;
    this.carregar(termo);
  }

  onMudarPagina(p: number): void {
    this.numeroPagina = p;
    this.carregar(this.termoSincronizado);
  }

  onSelecionar(item: PaginatedSearchItem): void {
    this.selecionar.emit(item);
  }

  private carregar(termo: string): void {
    this.loading = true;
    const req$ = this.requestForKind(termo);
    req$.subscribe({
      next: (paged) => {
        this.loading = false;
        this.itens = paged.items;
        this.totalCount = paged.totalCount;
        this.numeroPagina = paged.numeroPagina;
        this.tamanhoPagina = paged.tamanhoPagina;
      },
      error: (err: ApiError) => {
        this.loading = false;
        this.toast.error(err?.message ?? 'Erro ao buscar dados.');
      }
    });
  }

  private requestForKind(termo: string) {
    const p = this.numeroPagina;
    const s = this.tamanhoPagina;
    switch (this.kind()) {
      case 'motorista':
        return this.lookup.buscarMotoristas(termo, p, s, this.transportadoraId());
      case 'transportadora':
        return this.lookup.buscarTransportadoras(termo, p, s);
      case 'veiculo':
        return this.lookup.buscarVeiculos(termo, p, s);
    }
  }
}
