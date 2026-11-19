import { CommonModule } from '@angular/common';
import { Component, computed, input, model, signal } from '@angular/core';
import { EntityLookupFieldComponent } from '../../../../../shared/components/entity-lookup-field/entity-lookup-field.component';
import { PaginatedSearchItem } from '../../../../../shared/models/paginated-search.models';
import { ModalBuscaMotoristaComponent } from '../modal-busca-motorista/modal-busca-motorista.component';

/**
 * Campo padrão de seleção de motorista via modal paginado.
 * Opcionalmente filtra pela transportadora e permite estado “bloqueado”
 * (não abre busca, mas o X ainda limpa — vínculo do veículo).
 */
@Component({
  selector: 'app-motorista-lookup-field',
  standalone: true,
  imports: [CommonModule, EntityLookupFieldComponent, ModalBuscaMotoristaComponent],
  templateUrl: './motorista-lookup-field.component.html',
  styleUrls: ['./motorista-lookup-field.component.scss'],
})
export class MotoristaLookupFieldComponent {
  readonly motoristaId = model<number | null>(null);
  readonly motoristaNome = model('');
  readonly transportadoraId = input<number | null>(null);
  readonly disabled = input(false);
  /** Quando true, não abre a busca (ícone lock), mas ainda permite limpar. */
  readonly locked = input(false);
  readonly placeholder = input('Buscar motorista…');
  readonly showClear = input(true);
  readonly ariaLabel = input('Buscar motorista');

  readonly buscaAberta = signal(false);

  readonly searchIcon = computed(() => (this.locked() && this.motoristaId() ? 'lock' : 'search'));
  readonly searchDisabled = computed(() => this.locked() && !!this.motoristaId());

  abrir(): void {
    if (this.disabled() || this.searchDisabled()) return;
    this.buscaAberta.set(true);
  }

  fechar(): void {
    this.buscaAberta.set(false);
  }

  limpar(): void {
    if (this.disabled()) return;
    this.motoristaId.set(null);
    this.motoristaNome.set('');
  }

  onSelecionado(item: PaginatedSearchItem): void {
    const id = Number(item.id);
    if (!Number.isFinite(id) || id <= 0) return;
    const nome = (item.titulo || item.campo3 || '').trim() || `Motorista #${id}`;
    this.motoristaId.set(id);
    this.motoristaNome.set(nome);
    this.buscaAberta.set(false);
  }
}
