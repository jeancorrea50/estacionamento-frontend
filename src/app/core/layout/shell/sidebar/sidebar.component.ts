import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { MatTooltip } from '@angular/material/tooltip';

import { NavService } from '../nav.service';
import { NavItem } from '../nav.config';

/**
 * Menu lateral: grupos (Operação / Planejamento / Gestão), até 3 níveis
 * (ex.: Cadastro → Transportadoras → Convites), acordeão e modo recolhido
 * com ícones + tooltip + submenu flutuante (CDK Menu).
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

  /** Algum descendente (2º ou 3º nível) está ativo — pai ganha ponto, não o destaque cheio. */
  temAtivo(item: NavItem): boolean {
    return this.nav.temDescendenteAtivo(item);
  }
}
