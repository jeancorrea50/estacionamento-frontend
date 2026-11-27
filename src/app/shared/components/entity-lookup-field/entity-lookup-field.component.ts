import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

/**
 * Campo visual padrão de busca/seleção de entidade.
 * X interno (limpar) à esquerda da lupa (abrir busca). Wrappers de domínio
 * (transportadora, motorista, responsável…) só mapeiam id/nome + modal.
 */
@Component({
  selector: 'app-entity-lookup-field',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './entity-lookup-field.component.html',
  styleUrls: ['./entity-lookup-field.component.scss'],
})
export class EntityLookupFieldComponent {
  readonly valueLabel = input('');
  readonly placeholder = input('Buscar…');
  readonly disabled = input(false);
  /** Impede abrir a busca, mas ainda permite limpar (ex.: motorista vinculado). */
  readonly searchDisabled = input(false);
  readonly showClear = input(true);
  readonly ariaLabel = input('Buscar');
  readonly searchIcon = input('search');

  readonly openSearch = output<void>();
  readonly clear = output<void>();

  get temValor(): boolean {
    return !!(this.valueLabel() || '').trim();
  }

  get podeLimpar(): boolean {
    return this.showClear() && this.temValor && !this.disabled();
  }

  get podeAbrir(): boolean {
    return !this.disabled() && !this.searchDisabled();
  }

  onAbrir(event?: Event): void {
    event?.preventDefault();
    if (!this.podeAbrir) return;
    this.openSearch.emit();
  }

  onLimpar(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.podeLimpar) return;
    this.clear.emit();
  }
}
