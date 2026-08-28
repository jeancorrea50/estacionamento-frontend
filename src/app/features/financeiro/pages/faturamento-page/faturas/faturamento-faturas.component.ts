import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import type { ApiError } from '../../../../../core/api/models';
import { EstacionamentoLookupService } from '../../../../cadastro/services/estacionamento-lookup.service';
import { TransportadoraLookupService } from '../../../../cadastro/services/transportadora-lookup.service';
import { StatusFatura } from '../../../models/fatura.models';
import { FaturaService } from '../../../services/fatura.service';
import type { PeriodoFiltroId } from '../faturamento-visao.types';
import {
  FaturaConfirmDialogComponent
} from './dialogs/fatura-confirm-dialog.component';
import {
  FaturaFormDialogComponent,
  type FaturaFormDialogResult
} from './dialogs/fatura-form-dialog.component';
import type {
  FaturaListaItem,
  FaturaLookupOption,
  FaturaStatusLabel,
  FiltroRapidoFaturas
} from './faturamento-faturas.types';

type CampoBuscaFaturas = 'geral' | 'numero' | 'transportadora' | 'descricao';

interface PeriodoOpcao {
  id: PeriodoFiltroId;
  label: string;
}

@Component({
  selector: 'app-faturamento-faturas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatDividerModule,
    MatMenuModule,
    MatSnackBarModule
  ],
  templateUrl: './faturamento-faturas.component.html',
  styleUrl: './faturamento-faturas.component.scss'
})
export class FaturamentoFaturasComponent implements OnInit {
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly api = inject(FaturaService);
  private readonly transportadoraLookup = inject(TransportadoraLookupService);
  private readonly estacionamentoLookup = inject(EstacionamentoLookupService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<FaturaListaItem[]>([]);
  readonly loading = signal(false);
  readonly jaBuscou = signal(false);
  readonly salvando = signal(false);
  private readonly transportadorasLookup = signal<FaturaLookupOption[]>([]);
  private readonly estacionamentosLookup = signal<FaturaLookupOption[]>([]);

  private readonly filtrosRapidosValidos = new Set<FiltroRapidoFaturas>([
    'vencidas',
    'a-vencer',
    'dentro-prazo',
    'pagas',
    'aguardando-envio'
  ]);

  readonly periodoOpcoes: PeriodoOpcao[] = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'semana', label: 'Esta semana' },
    { id: 'mes', label: 'Este mês' },
    { id: 'personalizado', label: 'Personalizado' }
  ];

  readonly statusOpcoes: FaturaStatusLabel[] = [
    'Pago',
    'Em aberto',
    'Vencido',
    'Parcial',
    'Aguardando envio',
    'Cancelada'
  ];

  readonly filtroRapidoOpcoes: { id: FiltroRapidoFaturas; label: string }[] = [
    { id: 'vencidas', label: 'Vencidas' },
    { id: 'a-vencer', label: 'A vencer' },
    { id: 'dentro-prazo', label: 'Dentro do prazo' },
    { id: 'pagas', label: 'Pagas' },
    { id: 'aguardando-envio', label: 'Aguardando envio' }
  ];

  readonly periodoFiltro = signal<PeriodoFiltroId>('mes');
  dataInicioPersonalizado = '';
  dataFimPersonalizado = '';

  readonly statusFiltro = signal<string>('all');
  readonly filtroRapido = signal<FiltroRapidoFaturas | null>(null);
  readonly searchText = signal('');
  readonly campoBusca = signal<CampoBuscaFaturas>('geral');

  readonly paginaAtual = signal(0);
  readonly itensPorPagina = signal(25);
  readonly pageSizeOpcoes = [10, 25, 50, 100] as const;
  readonly totalCount = signal(0);

  readonly selection = new SelectionModel<FaturaListaItem>(true, []);

  readonly linhasFiltradas = computed(() => this.aplicarFiltrosCliente(this.items()));

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
      case 'numero':
        return 'Pesquisar por número da fatura...';
      case 'transportadora':
        return 'Pesquisar por transportadora...';
      case 'descricao':
        return 'Pesquisar por descrição...';
      default:
        return 'Pesquisar por número, transportadora ou descrição...';
    }
  }

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const filtro = params.get('filtro');
      const status = params.get('status');
      const transportadora = params.get('transportadora');
      const temDeepLink = !!(filtro || status || transportadora);

      if (filtro && this.filtrosRapidosValidos.has(filtro as FiltroRapidoFaturas)) {
        this.filtroRapido.set(filtro as FiltroRapidoFaturas);
      }

      if (status && this.statusOpcoes.includes(status as FaturaStatusLabel)) {
        this.statusFiltro.set(status);
      }

      if (transportadora) {
        this.campoBusca.set('transportadora');
        this.searchText.set(transportadora);
      }

      // Deep-link dos Alertas: não restringir ao mês atual.
      if (temDeepLink) {
        this.periodoFiltro.set('personalizado');
        this.dataInicioPersonalizado = '';
        this.dataFimPersonalizado = '';
      }
    });

    effect(() => {
      this.linhasFiltradas();
      untracked(() => this.paginaAtual.set(0));
    });

    effect(() => {
      const vis = this.linhasFiltradas();
      const ids = new Set(vis.map((r) => r.id));
      for (const r of [...this.selection.selected]) {
        if (!ids.has(r.id)) {
          this.selection.deselect(r);
        }
      }
    });
  }

  ngOnInit(): void {
    this.carregarLookups();
  }

  setPeriodo(id: PeriodoFiltroId): void {
    this.periodoFiltro.set(id);
  }

  alternarFiltroRapido(id: FiltroRapidoFaturas): void {
    this.filtroRapido.update((cur) => (cur === id ? null : id));
  }

  isFiltroRapidoAtivo(id: FiltroRapidoFaturas): boolean {
    return this.filtroRapido() === id;
  }

  buscar(): void {
    if (this.loading()) return;
    this.paginaAtual.set(0);
    this.carregarLista();
  }

  carregarLista(): void {
    this.jaBuscou.set(true);
    this.loading.set(true);
    const range = this.periodoRangeAtual();
    const st = this.statusFiltro();
    const q = this.searchText().trim();

    this.api
      .listar({
        numeroPagina: 1,
        tamanhoPagina: 200,
        ...this.termoBuscaParams(q),
        dataInicial: range ? this.toApiDate(range.inicio, false) : undefined,
        dataFinal: range ? this.toApiDate(range.fim, true) : undefined,
        status: this.statusCodigoFromFiltro(st)
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.selection.clear();
          this.items.set(page.items);
          this.totalCount.set(page.totalCount);
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
          this.totalCount.set(0);
          this.snack.open(this.mensagemErro(err, 'Falha ao carregar faturas.'), 'Fechar', {
            duration: 5500
          });
        }
      });
  }

  abrirNova(): void {
    const ref = this.dialog.open(FaturaFormDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      panelClass: 'cfg-form-dialog-panel',
      data: {
        mode: 'create',
        transportadoras: this.transportadorasLookup(),
        estacionamentos: this.estacionamentosLookup()
      }
    });
    ref.afterClosed().subscribe((result: FaturaFormDialogResult | undefined) => {
      if (!result?.create) return;
      this.salvando.set(true);
      this.api
        .gravar(result.create)
        .pipe(finalize(() => this.salvando.set(false)))
        .subscribe({
          next: () => {
            this.snack.open('Fatura gerada com sucesso.', 'Fechar', { duration: 3500 });
            this.carregarLista();
          },
          error: (err) => {
            this.snack.open(this.mensagemErro(err, 'Falha ao gerar fatura.'), 'Fechar', {
              duration: 5500
            });
          }
        });
    });
  }

  visualizar(row: FaturaListaItem): void {
    this.loading.set(true);
    this.api
      .obterListaItemPorId(row.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (item) => {
          if (!item) {
            this.snack.open('Não foi possível carregar os detalhes da fatura.', 'Fechar', {
              duration: 4500
            });
            return;
          }
          this.dialog.open(FaturaFormDialogComponent, {
            width: '720px',
            maxWidth: '95vw',
            panelClass: 'cfg-form-dialog-panel',
            data: {
              mode: 'view',
              item,
              transportadoras: this.transportadorasLookup(),
              estacionamentos: this.estacionamentosLookup()
            }
          });
        },
        error: (err) => {
          this.snack.open(this.mensagemErro(err, 'Falha ao carregar fatura.'), 'Fechar', {
            duration: 5500
          });
        }
      });
  }

  excluir(row: FaturaListaItem): void {
    const ref = this.dialog.open(FaturaConfirmDialogComponent, {
      width: '420px',
      panelClass: 'cfg-form-dialog-panel',
      data: {
        titulo: 'Excluir fatura',
        mensagem: `Deseja excluir a fatura ${row.numero || row.id}?`,
        confirmLabel: 'Excluir'
      }
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.salvando.set(true);
      this.api
        .excluir(row.id)
        .pipe(finalize(() => this.salvando.set(false)))
        .subscribe({
          next: () => {
            this.snack.open('Fatura excluída.', 'Fechar', { duration: 3000 });
            this.carregarLista();
          },
          error: (err) => {
            this.snack.open(this.mensagemErro(err, 'Falha ao excluir fatura.'), 'Fechar', {
              duration: 5500
            });
          }
        });
    });
  }

  baixarPdf(row: FaturaListaItem): void {
    this.api.baixarPdf(row.id).subscribe({
      next: (blob) =>
        this.downloadBlob(blob, `fatura-${row.numero || row.id}.pdf`, 'application/pdf'),
      error: (err) => {
        this.snack.open(this.mensagemErro(err, 'Falha ao baixar PDF.'), 'Fechar', { duration: 5500 });
      }
    });
  }

  baixarExcel(row: FaturaListaItem): void {
    this.api.baixarExcel(row.id).subscribe({
      next: (blob) =>
        this.downloadBlob(
          blob,
          `fatura-${row.numero || row.id}.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ),
      error: (err) => {
        this.snack.open(this.mensagemErro(err, 'Falha ao baixar Excel.'), 'Fechar', {
          duration: 5500
        });
      }
    });
  }

  lotePdf(): void {
    const rows = this.selecionadasVisiveis();
    for (const row of rows) {
      this.baixarPdf(row);
    }
  }

  selecionadasVisiveis(): FaturaListaItem[] {
    const ids = new Set(this.linhasFiltradas().map((r) => r.id));
    return this.selection.selected.filter((r) => ids.has(r.id));
  }

  isAllSelected(): boolean {
    const rows = this.linhasPaginadas();
    return rows.length > 0 && rows.every((r) => this.selection.isSelected(r));
  }

  onMasterChange(ev: MatCheckboxChange): void {
    const rows = this.linhasPaginadas();
    if (ev.checked) {
      for (const r of rows) this.selection.select(r);
    } else {
      for (const r of rows) this.selection.deselect(r);
    }
  }

  checkboxLabel(row?: FaturaListaItem): string {
    if (!row) {
      return `${this.isAllSelected() ? 'Desmarcar' : 'Marcar'} todas as faturas visíveis`;
    }
    return `${this.selection.isSelected(row) ? 'Desmarcar' : 'Marcar'} fatura ${row.numero || row.id}`;
  }

  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatData(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatPeriodo(inicioIso: string, fimIso: string): string {
    if (!inicioIso || !fimIso) return '—';
    return `${this.formatData(inicioIso)} – ${this.formatData(fimIso)}`;
  }

  statusChipClass(status: FaturaStatusLabel): string {
    const map: Record<FaturaStatusLabel, string> = {
      Pago: 'fat-faturas-chip fat-faturas-chip--pago',
      'Em aberto': 'fat-faturas-chip fat-faturas-chip--aberto',
      Vencido: 'fat-faturas-chip fat-faturas-chip--vencido',
      Parcial: 'fat-faturas-chip fat-faturas-chip--parcial',
      'Aguardando envio': 'fat-faturas-chip fat-faturas-chip--aguardando',
      Cancelada: 'fat-faturas-chip fat-faturas-chip--cancelada'
    };
    return map[status] ?? 'fat-faturas-chip';
  }

  irParaPagina(p: number): void {
    this.paginaAtual.set(Math.max(0, Math.min(p, this.totalPaginas() - 1)));
  }

  onTamanhoPaginaChange(size: number | string): void {
    const n = Number(size);
    if (!Number.isFinite(n) || n <= 0) return;
    this.itensPorPagina.set(n);
    this.paginaAtual.set(0);
  }

  get intervaloLista(): { de: number; ate: number } {
    const total = this.linhasFiltradas().length;
    if (total === 0) return { de: 0, ate: 0 };
    const de = this.paginaAtual() * this.itensPorPagina() + 1;
    const ate = Math.min(de + this.itensPorPagina() - 1, total);
    return { de, ate };
  }

  private carregarLookups(): void {
    this.transportadoraLookup
      .list()
      .pipe(catchError(() => of([])))
      .subscribe((list) => {
        this.transportadorasLookup.set(
          list.map((t) => ({ id: t.id, label: t.label.split(' — ')[0] || t.label }))
        );
      });
    this.estacionamentoLookup
      .list()
      .pipe(catchError(() => of([])))
      .subscribe((list) => {
        this.estacionamentosLookup.set(
          list.map((e) => ({ id: e.id, label: e.label.split(' — ')[0] || e.label }))
        );
      });
  }

  private aplicarFiltrosCliente(rows: FaturaListaItem[]): FaturaListaItem[] {
    let out = rows;
    const q = this.filtroRapido();
    if (q) {
      out = out.filter((r) => this.passFiltroRapido(r, q));
    }

    const text = this.searchText().trim().toLowerCase();
    if (text && this.campoBusca() === 'transportadora') {
      out = out.filter((r) => (r.transportadora || '').toLowerCase().includes(text));
    }

    return out;
  }

  private passFiltroRapido(row: FaturaListaItem, q: FiltroRapidoFaturas): boolean {
    const hoje = this.startOfDay(new Date());
    const venc = this.parseIsoDate(row.vencimento);

    switch (q) {
      case 'vencidas':
        return row.status === 'Vencido' || (row.status === 'Em aberto' && !!venc && venc < hoje);
      case 'a-vencer': {
        if (!venc) return false;
        const limite = this.addDays(hoje, 14);
        return row.status === 'Em aberto' && venc > hoje && venc <= limite;
      }
      case 'dentro-prazo':
        return row.status === 'Em aberto' && !!venc && venc >= hoje;
      case 'pagas':
        return row.status === 'Pago';
      case 'aguardando-envio':
        return row.status === 'Aguardando envio';
      default:
        return true;
    }
  }

  private periodoRangeAtual(): { inicio: Date; fim: Date } | null {
    const id = this.periodoFiltro();
    const hoje = this.startOfDay(new Date());

    if (id === 'personalizado') {
      if (!this.dataInicioPersonalizado || !this.dataFimPersonalizado) return null;
      const i = this.parseIsoDate(this.dataInicioPersonalizado);
      const fimRaw = this.parseIsoDate(this.dataFimPersonalizado);
      if (!i || !fimRaw) return null;
      const f = this.endOfDay(fimRaw);
      if (f < i) return null;
      return { inicio: i, fim: f };
    }
    if (id === 'hoje') return { inicio: hoje, fim: this.endOfDay(hoje) };
    if (id === 'semana') {
      const start = this.startOfWeekMonday(hoje);
      return { inicio: start, fim: this.endOfDay(this.addDays(start, 6)) };
    }
    if (id === 'mes') {
      return {
        inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
        fim: this.endOfDay(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))
      };
    }
    return null;
  }

  private statusCodigoFromFiltro(st: string): StatusFatura | undefined {
    switch (st) {
      case 'Aguardando envio':
        return StatusFatura.AguardandoEnvio;
      case 'Em aberto':
        return StatusFatura.EmAberto;
      case 'Parcial':
        return StatusFatura.Parcial;
      case 'Pago':
        return StatusFatura.Pago;
      case 'Vencido':
        return StatusFatura.Vencido;
      case 'Cancelada':
        return StatusFatura.Cancelada;
      default:
        return undefined;
    }
  }

  private downloadBlob(blob: Blob, fileName: string, mimeType: string): void {
    if (!blob || blob.size === 0) {
      this.snack.open('Arquivo vazio ou inválido.', 'Fechar', { duration: 4500 });
      return;
    }

    const safeName = (fileName || 'download').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
    const typedBlob = blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: mimeType });

    const url = URL.createObjectURL(typedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Revogar só depois do navegador iniciar o download.
    window.setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  private termoBuscaParams(q: string): { numero?: string; descricao?: string } {
    if (!q) return {};
    switch (this.campoBusca()) {
      case 'numero':
        return { numero: q };
      case 'descricao':
        return { descricao: q };
      case 'transportadora':
        return {};
      default:
        if (/^[A-Za-z0-9._\-\/]+$/.test(q) && /\d/.test(q) && !/\s/.test(q)) {
          return { numero: q };
        }
        return { descricao: q };
    }
  }

  private mensagemErro(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'message' in err) {
      const msg = (err as ApiError).message;
      if (typeof msg === 'string' && msg.trim()) return msg;
    }
    if (err instanceof HttpErrorResponse) {
      return err.message || fallback;
    }
    return fallback;
  }

  private toApiDate(d: Date, endOfDay: boolean): string {
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return endOfDay
      ? `${d.getFullYear()}-${mes}-${dia}T23:59:59`
      : `${d.getFullYear()}-${mes}-${dia}T00:00:00`;
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private endOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }

  private addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return this.startOfDay(x);
  }

  private startOfWeekMonday(ref: Date): Date {
    const d = this.startOfDay(ref);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d;
  }

  private parseIsoDate(ymd: string): Date | null {
    if (!ymd) return null;
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
}
