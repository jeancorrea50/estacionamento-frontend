import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import type { ApiError } from '../../../../../core/api/models';
import { EstacionamentoLookupService } from '../../../../cadastro/services/estacionamento-lookup.service';
import { TransportadoraLookupService } from '../../../../cadastro/services/transportadora-lookup.service';
import {
  mapListaItemToPostInput,
  modalidadeBadgeLabel
} from '../../../mappers/configuracao-cobranca.mapper';
import { StatusConfiguracaoCobranca } from '../../../models/configuracao-cobranca.models';
import { ConfiguracaoCobrancaService } from '../../../services/configuracao-cobranca.service';
import type {
  ConfigCobrancaEnvioFiltroId,
  ConfigCobrancaListaItem,
  ConfigCobrancaLookupOption,
  ConfigCobrancaModalidade,
  ConfigCobrancaStatus
} from './faturamento-config-cobranca.types';
import { ConfigCobrancaApplyRuleDialogComponent } from './dialogs/config-cobranca-apply-rule-dialog.component';
import { ConfigCobrancaConfirmDialogComponent } from './dialogs/config-cobranca-confirm-dialog.component';
import {
  ConfigCobrancaFormDialogComponent,
  type ConfigCobrancaFormDialogResult
} from './dialogs/config-cobranca-form-dialog.component';
import { ConfigCobrancaHistoryDialogComponent } from './dialogs/config-cobranca-history-dialog.component';
import { ConfigCobrancaSimulateDialogComponent } from './dialogs/config-cobranca-simulate-dialog.component';
import { ConfigCobrancaViewRuleDialogComponent } from './dialogs/config-cobranca-view-rule-dialog.component';

@Component({
  selector: 'app-faturamento-config-cobranca',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './faturamento-config-cobranca.component.html',
  styleUrls: ['./faturamento-config-cobranca.component.scss']
})
export class FaturamentoConfigCobrancaComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly api = inject(ConfiguracaoCobrancaService);
  private readonly transportadoraLookup = inject(TransportadoraLookupService);
  private readonly estacionamentoLookup = inject(EstacionamentoLookupService);

  readonly items = signal<ConfigCobrancaListaItem[]>([]);
  readonly loading = signal(false);
  readonly jaBuscou = signal(false);
  private readonly transportadorasLookup = signal<ConfigCobrancaLookupOption[]>([]);
  private readonly estacionamentosLookup = signal<ConfigCobrancaLookupOption[]>([]);

  /** Modalidades oferecidas no filtro da listagem (rótulo amigável para personalizada). */
  readonly modalidadesFiltro: { value: ConfigCobrancaModalidade; label: string }[] = [
    { value: 'Diária', label: 'Diária' },
    { value: 'Mensal', label: 'Mensal' },
    { value: 'Quinzenal', label: 'Quinzenal' },
    { value: 'Personalizada', label: 'Data personalizada' }
  ];

  readonly statusFiltroOpcoes: { value: string; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'Ativa', label: 'Ativos' },
    { value: 'Inativa', label: 'Inativos' }
  ];

  readonly pageSizeOpcoes = [10, 25, 50, 100] as const;

  readonly transportadoraFiltro = signal<number | 'all'>('all');
  readonly estacionamentoFiltro = signal<number | 'all'>('all');
  readonly modalidadeFiltro = signal<string>('all');
  readonly statusFiltro = signal<string>('all');
  readonly envioFiltro = signal<ConfigCobrancaEnvioFiltroId>('all');
  readonly searchText = signal<string>('');

  readonly panelFiltrosAberto = signal(false);

  readonly paginaAtual = signal(0);
  readonly itensPorPagina = signal(25);

  readonly selection = new SelectionModel<ConfigCobrancaListaItem>(true, []);
  private readonly selectionTick = signal(0);

  readonly displayedColumns: string[] = [
    'select',
    'transportadora',
    'modalidade',
    'fechamento',
    'prazoVencimento',
    'envioAutomatico',
    'emailFinanceiro',
    'status',
    'acoes'
  ];

  readonly listaTransportadorasForm = computed(() => this.transportadorasLookup());
  readonly listaEstacionamentosForm = computed(() => this.estacionamentosLookup());
  readonly transportadorasOpcoes = computed(() => this.transportadorasLookup());
  readonly estacionamentosOpcoes = computed(() => this.estacionamentosLookup());

  readonly linhasFiltradas = computed(() => this.aplicarFiltros());

  readonly linhasPaginadas = computed(() => {
    const rows = this.linhasFiltradas();
    const start = this.paginaAtual() * this.itensPorPagina();
    return rows.slice(start, start + this.itensPorPagina());
  });

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.linhasFiltradas().length / this.itensPorPagina()))
  );

  readonly paginasVisiveis = computed(() => {
    const total = this.totalPaginas();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const atual = this.paginaAtual() + 1;
    const s = new Set<number>([1, total]);
    for (let i = Math.max(1, atual - 2); i <= Math.min(total, atual + 2); i++) s.add(i);
    return [...s].sort((a, b) => a - b);
  });

  readonly totalEncontradasLabel = computed(() => {
    const n = this.linhasFiltradas().length;
    return n === 1 ? '1 configuração encontrada' : `${n} configurações encontradas`;
  });

  readonly filtrosAtivosCount = computed(() => {
    let c = 0;
    if (this.transportadoraFiltro() !== 'all') c++;
    if (this.estacionamentoFiltro() !== 'all') c++;
    if (this.modalidadeFiltro() !== 'all') c++;
    if (this.statusFiltro() !== 'all') c++;
    if (this.envioFiltro() !== 'all') c++;
    return c;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (!target.closest('.rec-filter-bar')) {
      this.panelFiltrosAberto.set(false);
    }
  }

  constructor() {
    effect(() => {
      const vis = this.linhasFiltradas();
      let changed = false;
      for (const r of [...this.selection.selected]) {
        if (!vis.includes(r)) {
          this.selection.deselect(r);
          changed = true;
        }
      }
      if (changed) this.selectionTick.update((n) => n + 1);
      untracked(() => this.paginaAtual.set(0));
    });
  }

  ngOnInit(): void {
    this.carregarLookups();
  }

  carregarLista(): void {
    this.jaBuscou.set(true);
    this.loading.set(true);
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const st = this.statusFiltro();
    const q = this.searchText().trim();
    const transportadoraId = tr !== 'all' && Number(tr) > 0 ? Number(tr) : undefined;
    const estacionamentoId = es !== 'all' && Number(es) > 0 ? Number(es) : undefined;
    const status =
      st === 'Ativa'
        ? StatusConfiguracaoCobranca.Ativa
        : st === 'Inativa'
          ? StatusConfiguracaoCobranca.Inativa
          : undefined;

    this.api
      .listar({
        numeroPagina: 1,
        tamanhoPagina: 200,
        descricao: q || undefined,
        transportadoraId,
        estacionamentoId,
        status
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.items.set(page.items);
          this.syncSelectionWithItems();
          if (page.totalCount > page.items.length) {
            this.snack.open(
              `Exibindo ${page.items.length} de ${page.totalCount} registros. Refine os filtros para ver os demais.`,
              'Fechar',
              { duration: 5000 }
            );
          }
        },
        error: (err) => {
          this.items.set([]);
          this.snack.open(this.mensagemErro(err, 'Falha ao carregar configurações de cobrança.'), 'Fechar', {
            duration: 5500
          });
        }
      });
  }

  private carregarLookups(): void {
    forkJoin({
      transportadoras: this.transportadoraLookup.list().pipe(catchError(() => of([]))),
      estacionamentos: this.estacionamentoLookup.list().pipe(catchError(() => of([])))
    }).subscribe(({ transportadoras, estacionamentos }) => {
      this.transportadorasLookup.set(
        transportadoras.map((t) => ({ id: t.id, label: t.label.split(' — ')[0] || t.label }))
      );
      this.estacionamentosLookup.set(
        estacionamentos.map((e) => ({ id: e.id, label: e.label.split(' — ')[0] || e.label }))
      );
    });
  }

  setEnvioFiltro(ev: MatSelectChange): void {
    this.envioFiltro.set(ev.value as ConfigCobrancaEnvioFiltroId);
  }

  setItensPorPagina(ev: MatSelectChange): void {
    const size = Number(ev.value);
    if (!Number.isFinite(size) || size <= 0) return;
    this.itensPorPagina.set(size);
    this.paginaAtual.set(0);
  }

  togglePanelFiltros(event: MouseEvent): void {
    event.stopPropagation();
    this.panelFiltrosAberto.update((v) => !v);
  }

  limparFiltros(): void {
    this.transportadoraFiltro.set('all');
    this.estacionamentoFiltro.set('all');
    this.modalidadeFiltro.set('all');
    this.statusFiltro.set('all');
    this.envioFiltro.set('all');
    this.searchText.set('');
    this.carregarLista();
  }

  buscar(): void {
    if (this.loading()) return;
    this.paginaAtual.set(0);
    this.carregarLista();
  }

  irParaPagina(p: number): void {
    this.paginaAtual.set(Math.max(0, Math.min(p, this.totalPaginas() - 1)));
  }

  textoEmail(v: string | null): string {
    return v && v.trim() ? v : '—';
  }

  modalidadeClass(m: ConfigCobrancaModalidade): string {
    const map: Partial<Record<ConfigCobrancaModalidade, string>> = {
      Diária: 'cfg-chip cfg-chip--mod-diaria',
      Semanal: 'cfg-chip cfg-chip--mod-semanal',
      Quinzenal: 'cfg-chip cfg-chip--mod-quinzenal',
      Mensal: 'cfg-chip cfg-chip--mod-mensal',
      Personalizada: 'cfg-chip cfg-chip--mod-personal'
    };
    return map[m] ?? 'cfg-chip';
  }

  modalidadeLabel(m: ConfigCobrancaModalidade): string {
    return modalidadeBadgeLabel(m);
  }

  statusClass(s: ConfigCobrancaStatus): string {
    const map: Record<ConfigCobrancaStatus, string> = {
      Ativa: 'cfg-chip cfg-chip--ativa',
      Inativa: 'cfg-chip cfg-chip--inativa',
      'Pendente de dados': 'cfg-chip cfg-chip--pendente',
      'Sem e-mail financeiro': 'cfg-chip cfg-chip--sem-email'
    };
    return map[s] ?? 'cfg-chip';
  }

  statusLabel(s: ConfigCobrancaStatus): string {
    if (s === 'Ativa') return 'Ativa';
    if (s === 'Inativa') return 'Inativa';
    return s;
  }

  envioClass(ativo: boolean): string {
    return ativo ? 'cfg-chip cfg-chip--envio-sim' : 'cfg-chip cfg-chip--envio-nao';
  }

  fechamentoTexto(row: ConfigCobrancaListaItem): string {
    const t = row.fechamento?.trim();
    if (!t || t === '—' || t.toUpperCase() === 'NULL') return '—';
    return t;
  }

  semEmailFinanceiro(row: ConfigCobrancaListaItem): boolean {
    return !row.emailFinanceiro?.trim();
  }

  onRowToggle(row: ConfigCobrancaListaItem, ev: MatCheckboxChange): void {
    if (ev.checked) this.selection.select(row);
    else this.selection.deselect(row);
    this.selectionTick.update((n) => n + 1);
  }

  /** Seleção é apenas visual: o detalhe é sempre carregado pelo endpoint na ação escolhida. */
  onRowClick(row: ConfigCobrancaListaItem): void {
    this.selection.clear();
    this.selection.select(row);
    this.selectionTick.update((n) => n + 1);
  }

  checkboxLabel(row: ConfigCobrancaListaItem): string {
    return `${this.selection.isSelected(row) ? 'Desmarcar' : 'Selecionar'} ${row.id}`;
  }

  abrirNovaConfiguracao(): void {
    this.abrirFormularioDialog('create');
  }

  duplicarRegraToolbar(): void {
    const row = this.primeiraSelecao();
    if (!row) {
      this.snack.open('Selecione uma configuração para duplicar.', 'Fechar', { duration: 4000 });
      return;
    }
    this.obterDetalhe(row.id, (full) => this.abrirFormularioDialog('duplicate', full));
  }

  testarEnvioToolbar(): void {
    const row = this.primeiraSelecao();
    if (!row) {
      this.snack.open('Selecione uma configuração para testar o envio.', 'Fechar', { duration: 4000 });
      return;
    }
    if (!row.emailFinanceiro?.trim()) {
      this.snack.open('Não é possível testar envio sem e-mail financeiro.', 'Fechar', { duration: 4500 });
      return;
    }
    this.snack.open(`E-mail de teste enviado para ${row.emailFinanceiro}.`, 'Fechar', { duration: 4500 });
  }

  exportar(): void {
    const rows = this.linhasFiltradas();
    const header = [
      'id',
      'transportadora',
      'modalidade',
      'fechamento',
      'prazoVencimento',
      'envioAutomatico',
      'emailFinanceiro',
      'status'
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      header.join(';'),
      ...rows.map((r) =>
        [
          r.id,
          r.transportadora,
          this.modalidadeLabel(r.modalidade),
          this.fechamentoTexto(r),
          r.prazoVencimento,
          r.gerarFaturaAutomaticamente ? 'Sim' : 'Não',
          r.emailFinanceiro ?? '',
          r.status
        ]
          .map(esc)
          .join(';')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-cobranca-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.snack.open('Exportação gerada com sucesso.', 'Fechar', { duration: 3500 });
  }

  editarLinha(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (full) => this.abrirFormularioDialog('edit', full));
  }

  visualizarRegra(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (full) => {
      const ref = this.dialog.open(ConfigCobrancaViewRuleDialogComponent, {
        width: '480px',
        maxWidth: '96vw',
        data: { row: full }
      });
      ref.afterClosed().subscribe((v) => {
        // Reaproveita o detalhe já carregado para não repetir o GET.
        if (v === 'edit') this.abrirFormularioDialog('edit', full);
      });
    });
  }

  testarEnvioLinha(row: ConfigCobrancaListaItem): void {
    if (!row.emailFinanceiro?.trim()) {
      this.snack.open('Configuração sem e-mail financeiro cadastrado.', 'Fechar', { duration: 4000 });
      return;
    }
    this.snack.open(`E-mail de teste enviado para ${row.emailFinanceiro}.`, 'Fechar', { duration: 4500 });
  }

  alternarAtivaLinha(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (full) => {
      const novo: ConfigCobrancaStatus = full.status === 'Ativa' ? 'Inativa' : 'Ativa';
      const payload = mapListaItemToPostInput({ ...full, status: novo });
      this.api.alterar({ ...payload, id: full.id }).subscribe({
        next: () => {
          this.snack.open(
            novo === 'Ativa' ? 'Configuração ativada.' : 'Configuração inativada.',
            'Fechar',
            { duration: 3500 }
          );
          this.carregarLista();
        },
        error: (err) =>
          this.snack.open(this.mensagemErro(err, 'Falha ao alterar status.'), 'Fechar', { duration: 5500 })
      });
    });
  }

  duplicarConfiguracaoMenu(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (full) => this.abrirFormularioDialog('duplicate', full));
  }

  verHistorico(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (full) => {
      this.dialog.open(ConfigCobrancaHistoryDialogComponent, {
        width: '440px',
        maxWidth: '96vw',
        data: { row: full }
      });
    });
  }

  simularFaturamento(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (full) => {
      this.dialog.open(ConfigCobrancaSimulateDialogComponent, {
        width: '480px',
        maxWidth: '96vw',
        data: { row: full }
      });
    });
  }

  aplicarRegraOutras(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (base) => {
      const ref = this.dialog.open(ConfigCobrancaApplyRuleDialogComponent, {
        width: '440px',
        maxWidth: '96vw',
        data: {
          row: base,
          transportadoras: this.listaTransportadorasForm().filter((t) => t.id !== base.transportadoraId)
        }
      });
      ref.afterClosed().subscribe((res) => {
        if (!res?.selecionadas?.length) return;
        const ids = res.selecionadas as number[];
        const toCreate = ids.filter(
          (tid) =>
            !this.items().some((x) => x.transportadoraId === tid && x.estacionamentoId === base.estacionamentoId)
        );
        if (!toCreate.length) {
          this.snack.open('Nenhuma configuração nova (combinações já existentes).', 'Fechar', { duration: 4500 });
          return;
        }
        const requests = toCreate.map((tid) => {
          const nome = this.listaTransportadorasForm().find((t) => t.id === tid)?.label ?? base.transportadora;
          return this.api.gravar(
            mapListaItemToPostInput({
              ...base,
              id: 0,
              transportadoraId: tid,
              transportadora: nome
            })
          );
        });
        forkJoin(requests).subscribe({
          next: () => {
            this.snack.open(`Regra aplicada para ${toCreate.length} transportadora(s).`, 'Fechar', {
              duration: 4500
            });
            this.carregarLista();
          },
          error: (err) =>
            this.snack.open(this.mensagemErro(err, 'Falha ao aplicar regra.'), 'Fechar', { duration: 5500 })
        });
      });
    });
  }

  removerLinha(row: ConfigCobrancaListaItem): void {
    const r = row;
    const ref = this.dialog.open(ConfigCobrancaConfirmDialogComponent, {
      width: '420px',
      maxWidth: '96vw',
      data: {
        titulo: 'Remover configuração?',
        mensagem: 'Essa ação removerá a configuração de cobrança selecionada.'
      }
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.excluir(r.id).subscribe({
        next: () => {
          this.selection.deselect(r);
          this.snack.open('Configuração removida.', 'Fechar', { duration: 3500 });
          this.carregarLista();
        },
        error: (err) =>
          this.snack.open(this.mensagemErro(err, 'Falha ao remover configuração.'), 'Fechar', { duration: 5500 })
      });
    });
  }

  private abrirFormularioDialog(mode: 'create' | 'edit' | 'duplicate', item?: ConfigCobrancaListaItem): void {
    const ref = this.dialog.open(ConfigCobrancaFormDialogComponent, {
      width: '920px',
      maxWidth: '96vw',
      panelClass: 'cfg-form-dialog-panel',
      data: {
        mode,
        item,
        transportadoras: this.listaTransportadorasForm(),
        estacionamentos: this.listaEstacionamentosForm(),
        statusOpcoes: ['Ativa', 'Inativa'] as ConfigCobrancaStatus[]
      }
    });
    ref.afterClosed().subscribe((res: ConfigCobrancaFormDialogResult | undefined) => {
      if (!res?.record) return;
      const payload = mapListaItemToPostInput(res.record);
      const req$ =
        mode === 'edit' && item
          ? this.api.alterar({ ...payload, id: item.id })
          : this.api.gravar({ ...payload, id: 0 });

      req$.subscribe({
        next: () => {
          this.snack.open(
            mode === 'edit'
              ? 'Configuração atualizada com sucesso.'
              : mode === 'duplicate'
                ? 'Configuração duplicada com sucesso.'
                : 'Configuração criada com sucesso.',
            'Fechar',
            { duration: 3500 }
          );
          this.carregarLista();
        },
        error: (err) =>
          this.snack.open(this.mensagemErro(err, 'Falha ao salvar configuração.'), 'Fechar', { duration: 5500 })
      });
    });
  }

  private obterDetalhe(id: number, onOk: (item: ConfigCobrancaListaItem) => void): void {
    this.api.obterListaItemPorId(id).subscribe({
      next: (full) => {
        if (!full) {
          this.snack.open('Configuração não encontrada.', 'Fechar', { duration: 4000 });
          return;
        }
        onOk(full);
      },
      error: (err) =>
        this.snack.open(this.mensagemErro(err, 'Falha ao carregar detalhe.'), 'Fechar', { duration: 5500 })
    });
  }

  private primeiraSelecao(): ConfigCobrancaListaItem | null {
    this.selectionTick();
    return this.selection.selected[0] ?? null;
  }

  private syncSelectionWithItems(): void {
    const ids = new Set(this.selection.selected.map((r) => r.id));
    this.selection.clear();
    for (const r of this.items()) {
      if (ids.has(r.id)) this.selection.select(r);
    }
    this.selectionTick.update((n) => n + 1);
  }

  private mensagemErro(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const api = err as ApiError;
      if (typeof api.message === 'string' && api.message.trim()) return api.message.trim();
    }
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object') {
        const notes =
          (body as { notifications?: unknown }).notifications ??
          (body as { Notifications?: unknown }).Notifications;
        if (Array.isArray(notes) && notes.length) {
          return notes.filter((n): n is string => typeof n === 'string').join(' ') || fallback;
        }
        const msg =
          (body as { message?: string }).message ?? (body as { Message?: string }).Message;
        if (typeof msg === 'string' && msg.trim()) return msg.trim();
      }
      if (typeof body === 'string' && body.trim()) return body.trim();
    }
    return fallback;
  }

  private aplicarFiltros(): ConfigCobrancaListaItem[] {
    let rows = [...this.items()];
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const mo = this.modalidadeFiltro();
    const st = this.statusFiltro();
    const env = this.envioFiltro();

    if (tr !== 'all') {
      rows = rows.filter((r) => r.transportadoraId === tr);
    }
    if (es !== 'all') {
      rows = rows.filter((r) => r.estacionamentoId === es);
    }
    if (mo !== 'all') rows = rows.filter((r) => r.modalidade === mo);
    if (st !== 'all') rows = rows.filter((r) => r.status === st);
    if (env === 'ativo') rows = rows.filter((r) => r.gerarFaturaAutomaticamente);
    if (env === 'inativo') rows = rows.filter((r) => !r.gerarFaturaAutomaticamente);

    return rows;
  }
}
