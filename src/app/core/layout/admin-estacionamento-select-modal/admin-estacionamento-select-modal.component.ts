import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  OnInit,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EstacionamentoLookupService,
  LookupOption,
} from '../../../features/cadastro/services/estacionamento-lookup.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../api/services/toast.service';

/**
 * Modal obrigatório: Admin escolhe o estacionamento operacional da sessão.
 * Busca por nome, CNPJ, id e principalmente código de exportação.
 */
@Component({
  selector: 'app-admin-estacionamento-select-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-estacionamento-select-modal.component.html',
  styleUrls: ['./admin-estacionamento-select-modal.component.scss'],
})
export class AdminEstacionamentoSelectModalComponent implements OnInit {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  private readonly lookup = inject(EstacionamentoLookupService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  @Output() readonly selected = new EventEmitter<number>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly erro = signal<string | null>(null);
  readonly opcoes = signal<LookupOption[]>([]);
  readonly filtro = signal('');
  readonly selectedId = signal<number | null>(null);
  readonly highlightIndex = signal(0);

  readonly opcoesFiltradas = computed(() => {
    const list = this.opcoes();
    const q = this.filtro().trim();
    if (!q) return list;

    const qLower = q.toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const qCompact = qLower.replace(/[\s\-]/g, '');

    return list.filter((o) => {
      const fantasia = (o.fantasia ?? '').toLowerCase();
      const razao = (o.razaoSocial ?? '').toLowerCase();
      const nome = (o.nome ?? o.label ?? '').toLowerCase();
      const label = (o.label ?? '').toLowerCase();
      const cnpj = (o.cnpj ?? '').replace(/\D/g, '');
      const cod = (o.codExportacao ?? '').toLowerCase();
      const codCompact = cod.replace(/[\s\-]/g, '');
      const idStr = String(o.id);

      if (fantasia.includes(qLower) || razao.includes(qLower)) return true;
      if (nome.includes(qLower) || label.includes(qLower)) return true;
      if (idStr === q || idStr.includes(q)) return true;
      if (qDigits.length >= 3 && cnpj.includes(qDigits)) return true;
      if (cod.includes(qLower) || codCompact.includes(qCompact)) return true;
      return false;
    });
  });

  readonly selectedOption = computed(() => {
    const id = this.selectedId();
    if (id == null) return null;
    return this.opcoes().find((o) => o.id === id) ?? null;
  });

  constructor() {
    afterNextRender(() => this.searchInput?.nativeElement?.focus());
  }

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.erro.set(null);
    this.lookup.list({ forceApi: true }).subscribe({
      next: (rows) => {
        this.opcoes.set(rows);
        this.loading.set(false);
        this.highlightIndex.set(0);
        if (!rows.length) {
          this.erro.set('Nenhum estacionamento disponível. Cadastre um pátio antes de continuar.');
        }
      },
      error: () => {
        this.loading.set(false);
        this.erro.set('Não foi possível carregar os estacionamentos.');
      },
    });
  }

  onFiltroChange(value: string): void {
    this.filtro.set(value);
    this.highlightIndex.set(0);
  }

  limparFiltro(): void {
    this.filtro.set('');
    this.highlightIndex.set(0);
    this.searchInput?.nativeElement?.focus();
  }

  selecionar(opt: LookupOption): void {
    this.selectedId.set(opt.id);
  }

  selecionarEConfirmar(opt: LookupOption): void {
    this.selectedId.set(opt.id);
    this.confirmar();
  }

  onListaKeydown(event: KeyboardEvent): void {
    const rows = this.opcoesFiltradas();
    if (!rows.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightIndex.update((i) => Math.min(i + 1, rows.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightIndex.update((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.highlightIndex();
      const opt = rows[idx];
      if (opt) this.selecionarEConfirmar(opt);
    }
  }

  confirmar(): void {
    const id = Number(this.selectedId());
    if (!id || id <= 0) {
      this.toast.error('Selecione um estacionamento para continuar.');
      return;
    }
    const opt = this.opcoes().find((o) => o.id === id);
    this.saving.set(true);
    this.auth
      .selecionarEstacionamentoSessao({
        estacionamentoId: id,
        codExportacao: opt?.codExportacao?.trim() || null,
        nome: opt?.fantasia ?? opt?.nome ?? null,
        razaoSocial: opt?.razaoSocial ?? null,
        cnpj: opt?.cnpj ?? null,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          if (!res.success) {
            this.toast.error(res.message || 'Não foi possível aplicar o estacionamento no backend.');
            return;
          }
          this.selected.emit(id);
        },
        error: () => {
          this.saving.set(false);
          this.toast.error('Não foi possível aplicar o estacionamento no backend.');
        },
      });
  }

  trackById(_: number, opt: LookupOption): number {
    return opt.id;
  }

  formatCnpj(value: string | null | undefined): string {
    const d = String(value ?? '').replace(/\D/g, '');
    if (d.length !== 14) return value?.trim() || '—';
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  displayText(value: string | null | undefined): string {
    const v = String(value ?? '').trim();
    return v || '—';
  }

  /** Últimos 10 caracteres do código de exportação. */
  lastCodDigits(cod: string | null | undefined): string {
    const c = String(cod ?? '').trim();
    if (!c) return '—';
    return c.length <= 10 ? c : c.slice(-10);
  }
}
