import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { MatTooltip } from '@angular/material/tooltip';

import { NavService } from '../nav.service';
import { NavItem } from '../nav.config';

/**
 * Menu lateral: grupos com título (Operação / Planejamento / Gestão), no máximo 2 níveis,
 * acordeão (uma seção aberta por vez) e modo recolhido com ícones + tooltip + submenu
 * flutuante (CDK Menu, acessível por teclado).
 */
@Component({
  selector: 'app-shell-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CdkMenu, CdkMenuItem, CdkMenuTrigger, MatTooltip],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellSidebarComponent {
  readonly nav = inject(NavService);
  readonly abrirBusca = output<void>();
  readonly versao = 'v1.0.0';

  /** Algum filho está ativo? (o pai ganha um ponto, não o destaque cheio). */
  temAtivo(item: NavItem): boolean {
    return this.nav.ativo()?.parent?.id === item.id;
  }
}
