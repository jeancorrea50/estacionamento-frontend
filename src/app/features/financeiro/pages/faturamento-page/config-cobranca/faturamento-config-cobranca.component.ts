import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import type { ApiError } from '../../../../../core/api/models';
import { EstStatusPillEstacionamentoComponent } from '../../../../cadastro/components/est-status-pill-estacionamento/est-status-pill-estacionamento.component';
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
import { ConfigCobrancaConfirmDialogComponent } from './dialogs/config-cobranca-confirm-dialog.component';
import {
  ConfigCobrancaFormDialogComponent,
  type ConfigCobrancaFormDialogResult
} from './dialogs/config-cobranca-form-dialog.component';
import { ConfigCobrancaViewRuleDialogComponent } from './dialogs/config-cobranca-view-rule-dialog.component';

@Component({
  selector: 'app-faturamento-config-cobranca',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatSnackBarModule,
    EstStatusPillEstacionamentoComponent
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

  readonly pageSizeOpcoes = [10, 25, 50, 100] as const;

  readonly transportadoraFiltro = signal<number | 'all'>('all');
  readonly estacionamentoFiltro = signal<number | 'all'>('all');
  readonly modalidadeFiltro = signal<string>('all');
  readonly statusFiltro = signal<string>('all');
  readonly envioFiltro = signal<ConfigCobrancaEnvioFiltroId>('all');
  readonly searchText = signal<string>('');
  readonly campoBusca = signal<'geral' | 'transportadora' | 'estacionamento' | 'email'>('geral');

  readonly paginaAtual = signal(0);
  readonly itensPorPagina = signal(25);

  readonly listaTransportadorasForm = computed(() => this.transportadorasLookup());
  readonly listaEstacionamentosForm = computed(() => this.estacionamentosLookup());

  readonly linhasFiltradas = computed(() => this.aplicarFiltros());

  readonly linhasPaginadas = computed(() => {
    const rows = this.linhasFiltradas();
    const start = this.paginaAtual() * this.itensPorPagina();
    return rows.slice(start, start + this.itensPorPagina());
  });

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.linhasFiltradas().length / this.itensPorPagina()))
  );

  get searchPlaceholder(): string {
    switch (this.campoBusca()) {
      case 'transportadora':
        return 'Pesquisar por transportadora...';
      case 'estacionamento':
        return 'Pesquisar por estacionamento...';
      case 'email':
        return 'Pesquisar por e-mail financeiro...';
      default:
        return 'Pesquisar por transportadora, estacionamento ou e-mail financeiro...';
    }
  }

  get intervaloLista(): { de: number; ate: number } {
    const total = this.linhasFiltradas().length;
    if (total === 0) return { de: 0, ate: 0 };
    const de = this.paginaAtual() * this.itensPorPagina() + 1;
    const ate = Math.min(de + this.itensPorPagina() - 1, total);
    return { de, ate };
  }

  constructor() {
    effect(() => {
      this.linhasFiltradas();
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
          if (page.totalCount > page.items.length) {
            this.snack.open(
              `Exibindo ${page.items.length} de ${page.totalCount} registros. Refine a busca para ver os demais.`,
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

  onTamanhoPaginaChange(size: number | string): void {
    const n = Number(size);
    if (!Number.isFinite(n) || n <= 0) return;
    this.itensPorPagina.set(n);
    this.paginaAtual.set(0);
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

  envioClass(ativo: boolean): string {
    return ativo ? 'cfg-chip cfg-chip--envio-sim' : 'cfg-chip cfg-chip--envio-nao';
  }

  fechamentoTexto(row: ConfigCobrancaListaItem): string {
    const t = row.fechamento?.trim();
    if (!t || t === '—' || t.toUpperCase() === 'NULL') return '—';
    return t;
  }

  abrirNovaConfiguracao(): void {
    this.abrirFormularioDialog('create');
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
        if (v === 'edit') this.abrirFormularioDialog('edit', full);
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

  private obterDetalhe(id: number, onOk: (row: ConfigCobrancaListaItem) => void): void {
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

  private mensagemErro(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ApiError | string | Record<string, unknown> | null;
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
