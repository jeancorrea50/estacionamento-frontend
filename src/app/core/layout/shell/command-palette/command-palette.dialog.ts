import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';

import { NavService } from '../nav.service';

export const COMMAND_PALETTE_CONFIG = {
  panelClass: 'gts-dialog-form',
  ariaLabel: 'Buscar tela',
  // Busca não é formulário: Esc e clique fora fecham (o app usa disableClose: true por padrão).
  disableClose: false,
  width: '600px',
  maxWidth: 'calc(100vw - 32px)',
  position: { top: '12vh' },
  autoFocus: '#cp-busca',
  restoreFocus: true,
} as const;

export type AcaoPalette = 'trocar-patio' | 'alternar-tema' | 'novo-agendamento';

interface Resultado {
  id: string;
  label: string;
  icon: string;
  onde: string; // "Gestão › Cadastro"
  rota?: string;
  acao?: AcaoPalette;
}

/**
 * Busca rápida (Ctrl+K): digita "veic" e vai direto para Cadastro › Veículos.
 * Só lista telas liberadas para o usuário no login.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  templateUrl: './command-palette.dialog.html',
  styleUrl: './command-palette.dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandPaletteDialog {
  private readonly ref =
    inject<MatDialogRef<CommandPaletteDialog, AcaoPalette | undefined>>(MatDialogRef);
  private readonly router = inject(Router);
  private readonly nav = inject(NavService);
  /** Ações extras (o layout informa o que o usuário pode fazer). */
  private readonly acoesPermitidas = signal<AcaoPalette[]>(['alternar-tema']);

  readonly busca = signal('');
  readonly ativoIdx = signal(0);

  private readonly norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  private readonly acoes = computed<Resultado[]>(() => {
    const todas: Resultado[] = [
      {
        id: 'a-novo',
        label: 'Novo agendamento',
        icon: 'add_circle',
        onde: 'Ação',
        acao: 'novo-agendamento',
      },
      {
        id: 'a-patio',
        label: 'Trocar de pátio',
        icon: 'warehouse',
        onde: 'Ação',
        acao: 'trocar-patio',
      },
      {
        id: 'a-tema',
        label: 'Alternar tema claro/escuro',
        icon: 'contrast',
        onde: 'Ação',
        acao: 'alternar-tema',
      },
    ];
    return todas.filter((a) => this.acoesPermitidas().includes(a.acao!));
  });

  private readonly todos = computed<(Resultado & { texto: string })[]>(() => [
    ...this.nav.destinos().map((d) => ({
      id: d.item.id,
      label: d.item.label,
      icon: d.item.icon,
      onde: [d.group.label, d.parent?.label].filter(Boolean).join(' › '),
      rota: d.item.route,
      texto: this.norm(
        [d.item.label, d.parent?.label, d.group.label, ...(d.item.keywords ?? [])].join(' '),
      ),
    })),
    ...this.acoes().map((a) => ({ ...a, texto: this.norm(a.label) })),
  ]);

  readonly resultados = computed(() => {
    const termos = this.norm(this.busca().trim()).split(/\s+/).filter(Boolean);
    if (!termos.length) return this.todos().slice(0, 9);
    return (
      this.todos()
        .filter((r) => termos.every((t) => r.texto.includes(t)))
        // Quem começa com o termo vem primeiro.
        .sort(
          (a, b) =>
            Number(!this.norm(a.label).startsWith(termos[0])) -
            Number(!this.norm(b.label).startsWith(termos[0])),
        )
        .slice(0, 12)
    );
  });

  readonly ativo = computed<Resultado | null>(() => this.resultados()[this.ativoIdx()] ?? null);

  /** Chamado pelo layout ao abrir. */
  permitirAcoes(acoes: AcaoPalette[]): void {
    this.acoesPermitidas.set(acoes);
  }

  onBusca(v: string): void {
    this.busca.set(v);
    this.ativoIdx.set(0);
  }

  onKeydown(e: KeyboardEvent): void {
    const n = this.resultados().length;
    if (!n) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.ativoIdx.update((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
      queueMicrotask(() =>
        document.getElementById(`cp-opt-${this.ativo()?.id}`)?.scrollIntoView({ block: 'nearest' }),
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = this.ativo();
      if (r) this.ir(r);
    }
  }

  ir(r: Resultado): void {
    if (r.rota) {
      void this.router.navigateByUrl(r.rota);
      this.ref.close();
    } else {
      this.ref.close(r.acao);
    }
  }
}
