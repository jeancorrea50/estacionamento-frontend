import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, model } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EntityLookupFieldComponent } from '../../../../shared/components/entity-lookup-field/entity-lookup-field.component';
import {
  ModalBuscaResponsavelFaturamentoComponent,
  type ModalBuscaResponsavelFaturamentoResult,
} from '../modal-busca-responsavel-faturamento/modal-busca-responsavel-faturamento.component';

/**
 * Campo de seleção de responsável de faturamento via modal de busca.
 * Reutilizar em formulários (ex.: config-cobranca).
 */
@Component({
  selector: 'app-responsavel-faturamento-lookup-field',
  standalone: true,
  imports: [CommonModule, EntityLookupFieldComponent],
  templateUrl: './responsavel-faturamento-lookup-field.component.html',
  styleUrls: ['./responsavel-faturamento-lookup-field.component.scss'],
})
export class ResponsavelFaturamentoLookupFieldComponent {
  private readonly dialog = inject(MatDialog);

  readonly responsavelId = model<number | null>(null);
  readonly responsavelNome = model('');
  readonly disabled = input(false);
  readonly placeholder = input('Buscar responsável de faturamento…');
  readonly showClear = input(true);
  readonly ariaLabel = input('Buscar responsável de faturamento');
  /**
   * Valor vindo de uma regra (destinação/cobrança): mostra o cadeado e não abre a busca,
   * mas o X ainda limpa — depois de limpar, a busca volta a abrir para escolher outro.
   */
  readonly locked = input(false);

  readonly searchIcon = computed(() => (this.locked() && this.responsavelId() ? 'lock' : 'search'));
  readonly searchDisabled = computed(() => this.locked() && !!this.responsavelId());

  abrir(): void {
    if (this.disabled() || this.searchDisabled()) return;
    const ref = this.dialog.open(ModalBuscaResponsavelFaturamentoComponent, {
      width: '540px',
      maxWidth: '95vw',
      data: { termoInicial: this.responsavelNome() },
    });
    ref.afterClosed().subscribe((result: ModalBuscaResponsavelFaturamentoResult | undefined) => {
      if (!result?.item) return;
      const item = result.item;
      const id = Number(item.id);
      if (!Number.isFinite(id) || id <= 0) return;
      const nome = (item.nomeFantasia || item.razaoSocial || '').trim() || `Responsável #${id}`;
      this.responsavelId.set(id);
      this.responsavelNome.set(nome);
    });
  }

  limpar(): void {
    if (this.disabled()) return;
    this.responsavelId.set(null);
    this.responsavelNome.set('');
  }
}
