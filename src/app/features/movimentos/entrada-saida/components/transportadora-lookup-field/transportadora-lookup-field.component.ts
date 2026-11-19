import { CommonModule } from '@angular/common';
import { Component, input, model, signal } from '@angular/core';
import { EntityLookupFieldComponent } from '../../../../../shared/components/entity-lookup-field/entity-lookup-field.component';
import { PaginatedSearchItem } from '../../../../../shared/models/paginated-search.models';
import { ModalBuscaTransportadoraComponent } from '../modal-busca-transportadora/modal-busca-transportadora.component';

/**
 * Campo padrão de seleção de transportadora via modal paginado
 * (CNPJ, razão social ou fantasia). Reutilizar em formulários e filtros.
 */
@Component({
  selector: 'app-transportadora-lookup-field',
  standalone: true,
  imports: [CommonModule, EntityLookupFieldComponent, ModalBuscaTransportadoraComponent],
  templateUrl: './transportadora-lookup-field.component.html',
  styleUrls: ['./transportadora-lookup-field.component.scss'],
})
export class TransportadoraLookupFieldComponent {
  readonly transportadoraId = model<number | null>(null);
  readonly transportadoraNome = model('');
  readonly disabled = input(false);
  readonly placeholder = input('Buscar transportadora…');
  readonly showClear = input(true);
  readonly ariaLabel = input('Buscar transportadora');

  readonly buscaAberta = signal(false);

  abrir(): void {
    if (this.disabled()) return;
    this.buscaAberta.set(true);
  }

  fechar(): void {
    this.buscaAberta.set(false);
  }

  limpar(): void {
    if (this.disabled()) return;
    this.transportadoraId.set(null);
    this.transportadoraNome.set('');
  }

  onSelecionada(item: PaginatedSearchItem): void {
    const id = Number(item.id);
    if (!Number.isFinite(id) || id <= 0) return;
    const nome = (item.titulo || item.campo3 || '').trim() || `Transportadora #${id}`;
    this.transportadoraId.set(id);
    this.transportadoraNome.set(nome);
    this.buscaAberta.set(false);
  }
}
