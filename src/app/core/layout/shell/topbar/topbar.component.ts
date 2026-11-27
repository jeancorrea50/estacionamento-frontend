import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CdkMenu,
  CdkMenuGroup,
  CdkMenuItem,
  CdkMenuItemRadio,
  CdkMenuTrigger,
} from '@angular/cdk/menu';
import { MatTooltip } from '@angular/material/tooltip';

import { ThemeMode, ThemeService } from '../../../services/theme.service';
import { NotificationBellComponent } from '../../notification-bell/notification-bell.component';
import { NavService } from '../nav.service';

export interface TopbarPatio {
  nome: string;
  cnpj: string;
}

export interface TopbarContexto {
  key: string;
  label: string;
}

/**
 * Barra superior: [menu] · pátio atual (troca) · onde estou (trilha) ··· buscar · tema ·
 * avisos · usuário. "Sair" fica no menu do usuário.
 */
@Component({
  selector: 'app-shell-topbar',
  standalone: true,
  imports: [
    CdkMenu,
    CdkMenuItem,
    CdkMenuItemRadio,
    CdkMenuGroup,
    CdkMenuTrigger,
    MatTooltip,
    NotificationBellComponent,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellTopbarComponent {
  readonly nav = inject(NavService);
  private readonly tema = inject(ThemeService);

  /** Pátio da sessão (null = nenhum selecionado). */
  readonly patio = input<TopbarPatio | null>(null);
  /** Usuário pode trocar de pátio (Admin/Transportadora com mais de um). */
  readonly podeTrocarPatio = input(false);
  readonly usuario = input('Usuário');
  readonly perfil = input('');
  readonly admin = input(false);
  readonly contextos = input<TopbarContexto[]>([]);
  readonly contextoAtual = input<string | null>(null);

  readonly abrirBusca = output<void>();
  readonly trocarPatio = output<void>();
  readonly trocarContexto = output<string>();
  readonly sair = output<void>();

  private readonly temaAtual = toSignal(this.tema.theme$, {
    initialValue: this.tema.getCurrentTheme(),
  });
  readonly modo = computed<ThemeMode>(() => this.temaAtual().mode);
  readonly claro = computed(() => {
    const m = this.modo();
    if (m === 'auto') {
      return (
        typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
      );
    }
    return m === 'light';
  });

  readonly modos: ReadonlyArray<{ id: ThemeMode; label: string; icon: string }> = [
    { id: 'dark', label: 'Escuro', icon: 'dark_mode' },
    { id: 'light', label: 'Claro', icon: 'light_mode' },
    { id: 'auto', label: 'Igual ao sistema', icon: 'contrast' },
  ];

  readonly iniciais = computed(() => {
    const partes = this.usuario()
      .replace(/[._-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return (
      partes.length > 1 ? partes[0][0] + partes[1][0] : (partes[0] ?? 'U').slice(0, 2)
    ).toUpperCase();
  });

  /** Trilha a partir do menu (não da URL): Grupo › Seção › Tela. */
  readonly trilha = computed(() => {
    const a = this.nav.ativo();
    if (!a) return [];
    return [a.group.label, a.parent?.label, a.item.label].filter((x): x is string => !!x);
  });

  alternarTema(): void {
    this.tema.setThemeMode(this.claro() ? 'dark' : 'light');
  }

  definirTema(m: ThemeMode): void {
    this.tema.setThemeMode(m);
  }
}
