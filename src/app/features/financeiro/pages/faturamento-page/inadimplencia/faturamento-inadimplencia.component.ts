import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, HostListener, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';

import type { ApiError } from '../../../../../core/api/models';
import { ThemeService } from '../../../../../core/services/theme.service';
import { FaturaService } from '../../../services/fatura.service';
import { FaturamentoDataPickerPanelDirective } from '../shared/faturamento-data-picker-panel.directive';
import { FaturamentoInadimplenciaAcordoDialogComponent } from './faturamento-inadimplencia-acordo-dialog.component';
import type {
  InadimplenciaDiasFiltroId,
  InadimplenciaFiltroRapidoId,
  InadimplenciaListaItem,
  InadimplenciaResumo,
  InadimplenciaStatusCobranca
} from './faturamento-inadimplencia.types';

type InadimplenciaPeriodoGranularidade = 'dia' | 'mes' | 'ano';

interface PeriodoGranularidadeOpcao {
  id: InadimplenciaPeriodoGranularidade;
  label: string;
}

interface InadCalendarioCelula {
  iso: string;
  day: number;
  inMonth: boolean;
  date: Date;
}

@Component({
  selector: 'app-faturamento-inadimplencia',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    FaturamentoDataPickerPanelDirective
  ],
  templateUrl: './faturamento-inadimplencia.component.html',
  styleUrls: ['./faturamento-inadimplencia.component.scss']
})
export class FaturamentoInadimplenciaComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly themeService = inject(ThemeService);
  private readonly api = inject(FaturaService);
  private readonly snack = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<InadimplenciaListaItem[]>([]);
  readonly resumo = signal<InadimplenciaResumo>({
    totalVencido: 0,
    faturasVencidas: 0,
    transportadorasInadimplentes: 0,
    acordosRealizados: 0
  });
  readonly loading = signal(false);
  readonly totalCountApi = signal(0);

  private readonly filtrosRapidosValidos = new Set<InadimplenciaFiltroRapidoId>([
    'todas',
    'd1_7',
    'd8_15',
    'mais15',
    'mais30',
    'semCobranca',
    'emNegociacao'
  ]);

  private readonly themeConfig = toSignal(this.themeService.theme$, {
    initialValue: this.themeService.getCurrentTheme()
  });

  readonly isDarkTheme = computed(() => {
    const mode = this.themeConfig().mode;
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  readonly diasAtrasoOpcoes: { id: InadimplenciaDiasFiltroId; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: '1-7', label: '1 a 7 dias' },
    { id: '8-15', label: '8 a 15 dias' },
    { id: 'mais15', label: 'Mais de 15 dias' },
    { id: 'mais30', label: 'Mais de 30 dias' }
  ];

  readonly statusCobrancaOpcoes: InadimplenciaStatusCobranca[] = [
    'Não enviada',
    'Enviada',
    'Reenviada',
    'Em negociação',
    'Acordo realizado',
    'Sem retorno'
  ];

  readonly periodoGranularidadeOpcoes: PeriodoGranularidadeOpcao[] = [
    { id: 'dia', label: 'Dia' },
    { id: 'mes', label: 'Mês' },
    { id: 'ano', label: 'Ano' }
  ];

  readonly periodoGranularidade = signal<InadimplenciaPeriodoGranularidade>('dia');
  readonly periodoDataInicio = signal<Date>(this.criarDataHoje());
  readonly periodoDataFim = signal<Date>(this.criarDataHoje());
  readonly calendarioAno = signal(new Date().getFullYear());
  readonly calendarioMes = signal(new Date().getMonth());
  readonly panelDataAberto = signal(false);
  readonly panelFiltrosAberto = signal(false);
  readonly searchText = signal<string>('');
  private readonly arrastandoPeriodo = signal(false);
  private readonly arrasteAnchor = signal<Date | null>(null);

  readonly diasSemanaLabels = ['Do.', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sa.'] as const;
  readonly mesesLabels = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ] as const;

  readonly calendarioTituloMes = computed(() => {
    const d = new Date(this.calendarioAno(), this.calendarioMes(), 1);
    const titulo = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return titulo.charAt(0).toUpperCase() + titulo.slice(1);
  });

  readonly calendarioGrade = computed(() => this.montarGradeCalendario());
  readonly calendarioAnosOpcoes = computed(() => {
    const centro = this.calendarioAno();
    return Array.from({ length: 12 }, (_, i) => centro - 5 + i);
  });

  readonly transportadoraFiltro = signal<string>('all');
  readonly estacionamentoFiltro = signal<string>('all');
  readonly diasFiltro = signal<InadimplenciaDiasFiltroId>('all');
  readonly statusCobrancaFiltro = signal<string>('all');
  readonly filtroRapido = signal<InadimplenciaFiltroRapidoId | null>(null);

  readonly selection = new SelectionModel<InadimplenciaListaItem>(true, []);
  readonly paginaAtual = signal(0);
  readonly itensPorPagina = 20;

  readonly displayedColumns: string[] = [
    'select',
    'fatura',
    'tipoFatura',
    'transportadora',
    'valor',
    'vencimento',
    'diasAtraso',
    'ultimaCobranca',
    'statusCobranca',
    'acoes'
  ];

  readonly transportadorasOpcoes = computed(() => {
    const u = new Set(this.items().map((r) => r.transportadora));
    return [...u].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly estacionamentosOpcoes = computed(() => {
    const u = new Set(this.items().map((r) => r.estacionamento));
    return [...u].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly contagensChips = computed(() => {
    const rows = this.items();
    const d1_7 = (d: number) => d >= 1 && d <= 7;
    const d8_15 = (d: number) => d >= 8 && d <= 15;
    const m15 = (d: number) => d > 15;
    const m30 = (d: number) => d > 30;
    const semCob = (r: InadimplenciaListaItem) => r.statusCobranca === 'Não enviada';
    return {
      todas: rows.length,
      d1_7: rows.filter((r) => d1_7(r.diasAtraso)).length,
      d8_15: rows.filter((r) => d8_15(r.diasAtraso)).length,
      mais15: rows.filter((r) => m15(r.diasAtraso)).length,
      mais30: rows.filter((r) => m30(r.diasAtraso)).length,
      semCobranca: rows.filter(semCob).length,
      emNegociacao: rows.filter((r) => r.statusCobranca === 'Em negociação').length
    };
  });

  readonly linhasFiltradas = computed(() => this.aplicarFiltros());
  readonly linhasPaginadas = computed(() => {
    const rows = this.linhasFiltradas();
    const start = this.paginaAtual() * this.itensPorPagina;
    return rows.slice(start, start + this.itensPorPagina);
  });

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.linhasFiltradas().length / this.itensPorPagina)));
  readonly paginasVisiveis = computed(() => {
    const total = this.totalPaginas();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const atual = this.paginaAtual() + 1;
    const s = new Set<number>([1, total]);
    for (let i = Math.max(1, atual - 2); i <= Math.min(total, atual + 2); i++) s.add(i);
    return [...s].sort((a, b) => a - b);
  });
  readonly paginaInfo = computed(() => {
    const total = this.linhasFiltradas().length;
    if (total === 0) return '0 a 0';
    const start = this.paginaAtual() * this.itensPorPagina + 1;
    const end = Math.min(start + this.itensPorPagina - 1, total);
    return `${start} a ${end}`;
  });

  readonly resumoLinha = computed(() => {
    const s = this.selection.selected;
    return s.length ? s[0] : null;
  });

  readonly filtrosAtivosCount = computed(() => {
    let c = 0;
    if (this.transportadoraFiltro() !== 'all') c++;
    if (this.estacionamentoFiltro() !== 'all') c++;
    if (this.diasFiltro() !== 'all') c++;
    if (this.statusCobrancaFiltro() !== 'all') c++;
    return c;
  });

  readonly totalVencidoFormatado = computed(() => this.formatCurrency(this.resumo().totalVencido));
  readonly faturasVencidasResumo = computed(() => this.resumo().faturasVencidas);
  readonly transportadorasInadimplentesResumo = computed(
    () => this.resumo().transportadorasInadimplentes
  );
  readonly contagemAcordos = computed(() => this.resumo().acordosRealizados);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const filtro = params.get('filtro');
      if (filtro && this.filtrosRapidosValidos.has(filtro as InadimplenciaFiltroRapidoId)) {
        this.filtroRapido.set(filtro as InadimplenciaFiltroRapidoId);
      }
    });

    effect(() => {
      const vis = this.linhasFiltradas();
      for (const r of [...this.selection.selected]) {
        if (!vis.includes(r)) this.selection.deselect(r);
      }
      untracked(() => this.paginaAtual.set(0));
    });
  }

  ngOnInit(): void {
    this.carregarLista();
  }

  carregarLista(): void {
    if (this.loading()) return;
    this.loading.set(true);
    const q = this.searchText().trim();
    const looksLikeNumero = /^[A-Za-z0-9._\-\/]+$/.test(q) && /\d/.test(q) && !/\s/.test(q);

    this.api
      .listarInadimplentes({
        numeroPagina: 1,
        tamanhoPagina: 200,
        numero: looksLikeNumero ? q : undefined,
        descricao: q && !looksLikeNumero ? q : undefined
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.selection.clear();
          this.items.set(page.items);
          this.resumo.set(page.resumo);
          this.totalCountApi.set(page.totalCount);
          this.paginaAtual.set(0);
        },
        error: (err) => {
          this.items.set([]);
          this.resumo.set({
            totalVencido: 0,
            faturasVencidas: 0,
            transportadorasInadimplentes: 0,
            acordosRealizados: 0
          });
          this.totalCountApi.set(0);
          this.snack.open(this.mensagemErro(err, 'Falha ao carregar inadimplentes.'), 'Fechar', {
            duration: 5500
          });
        }
      });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (!target.closest('.rec-filter-bar')) {
      this.panelFiltrosAberto.set(false);
    }
    if (!target.closest('.rec-data-picker')) {
      this.panelDataAberto.set(false);
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.arrastandoPeriodo.set(false);
    this.arrasteAnchor.set(null);
  }

  togglePanelFiltros(event: MouseEvent): void {
    event.stopPropagation();
    this.panelFiltrosAberto.update((v) => !v);
  }

  togglePanelData(event: MouseEvent): void {
    event.stopPropagation();
    this.panelDataAberto.update((v) => {
      const abrindo = !v;
      if (abrindo) {
        const ref = this.periodoDataInicio();
        this.calendarioAno.set(ref.getFullYear());
        this.calendarioMes.set(ref.getMonth());
      }
      return abrindo;
    });
  }

  setPeriodoGranularidade(id: InadimplenciaPeriodoGranularidade): void {
    this.periodoGranularidade.set(id);
    const ini = this.periodoDataInicio();
    this.calendarioAno.set(ini.getFullYear());
    this.calendarioMes.set(ini.getMonth());
  }

  isFiltroRapidoAtivo(id: InadimplenciaFiltroRapidoId): boolean {
    const cur = this.filtroRapido();
    if (id === 'todas') return cur === null || cur === 'todas';
    return cur === id;
  }

  alternarFiltroRapido(id: InadimplenciaFiltroRapidoId): void {
    if (id === 'todas') {
      this.filtroRapido.set(null);
      return;
    }
    this.filtroRapido.update((cur) => (cur === id ? null : id));
  }

  limparFiltros(): void {
    this.transportadoraFiltro.set('all');
    this.estacionamentoFiltro.set('all');
    this.diasFiltro.set('all');
    this.statusCobrancaFiltro.set('all');
    this.searchText.set('');
    this.carregarLista();
  }

  irParaPagina(p: number): void {
    this.paginaAtual.set(Math.max(0, Math.min(p, this.totalPaginas() - 1)));
  }

  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  textoCelula(v: string | null): string {
    return v && String(v).trim() ? v : '—';
  }

  statusCobrancaClass(s: InadimplenciaStatusCobranca): string {
    const map: Record<InadimplenciaStatusCobranca, string> = {
      'Não enviada': 'inad-chip inad-chip--nao-enviada',
      Enviada: 'inad-chip inad-chip--enviada',
      Reenviada: 'inad-chip inad-chip--reenviada',
      'Em negociação': 'inad-chip inad-chip--negociacao',
      'Acordo realizado': 'inad-chip inad-chip--acordo',
      'Sem retorno': 'inad-chip inad-chip--sem-retorno'
    };
    return map[s] ?? 'inad-chip';
  }

  diasAtrasoBadgeClass(d: number): string {
    if (d > 30) return 'inad-chip inad-chip--dias-30';
    if (d > 15) return 'inad-chip inad-chip--dias-16';
    if (d >= 8) return 'inad-chip inad-chip--dias-8';
    return 'inad-chip inad-chip--dias-1';
  }

  bloquearReenviar(row: InadimplenciaListaItem): boolean {
    return row.statusCobranca === 'Acordo realizado';
  }

  onMasterToggle(ev: MatCheckboxChange): void {
    if (ev.checked) {
      for (const r of this.linhasFiltradas()) this.selection.select(r);
    } else {
      this.selection.clear();
    }
  }

  onRowToggle(row: InadimplenciaListaItem, ev: MatCheckboxChange): void {
    if (ev.checked) this.selection.select(row);
    else this.selection.deselect(row);
  }

  isAllSelected(): boolean {
    const v = this.linhasFiltradas();
    return v.length > 0 && this.selection.selected.length === v.length;
  }

  checkboxLabel(row?: InadimplenciaListaItem): string {
    if (!row) return 'Selecionar todos';
    return `${this.selection.isSelected(row) ? 'Desmarcar' : 'Selecionar'} ${row.id}`;
  }

  acaoMock(_acao: string, _row?: InadimplenciaListaItem): void {}

  abrirAcordo(row?: InadimplenciaListaItem): void {
    const alvo = row ?? this.selection.selected[0];
    this.dialog.open(FaturamentoInadimplenciaAcordoDialogComponent, {
      width: '520px',
      maxWidth: '96vw',
      panelClass: 'cfg-form-dialog-panel',
      data: {
        faturaId: alvo?.id ?? '—',
        transportadora: alvo?.transportadora ?? '—',
        valorOriginal: alvo?.valor ?? 0
      }
    });
  }

  setDiasFiltro(ev: MatSelectChange): void {
    this.diasFiltro.set(ev.value as InadimplenciaDiasFiltroId);
  }

  setStatusCobrancaFiltro(ev: MatSelectChange): void {
    this.statusCobrancaFiltro.set(ev.value as string);
  }

  mesCalendarioAnterior(): void {
    const m = this.calendarioMes();
    const a = this.calendarioAno();
    if (m === 0) {
      this.calendarioMes.set(11);
      this.calendarioAno.set(a - 1);
    } else {
      this.calendarioMes.set(m - 1);
    }
  }

  mesCalendarioProximo(): void {
    const m = this.calendarioMes();
    const a = this.calendarioAno();
    if (m === 11) {
      this.calendarioMes.set(0);
      this.calendarioAno.set(a + 1);
    } else {
      this.calendarioMes.set(m + 1);
    }
  }

  anoCalendarioAnterior(): void {
    this.calendarioAno.update((a) => a - 1);
  }

  anoCalendarioProximo(): void {
    this.calendarioAno.update((a) => a + 1);
  }

  onDiaCalendarioPointerDown(cell: InadCalendarioCelula, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.navegarParaMesDoDia(cell);
    this.arrastandoPeriodo.set(true);
    this.arrasteAnchor.set(cell.date);
    this.definirIntervaloDias(cell.date, cell.date);
  }

  onDiaCalendarioPointerEnter(cell: InadCalendarioCelula): void {
    if (!this.arrastandoPeriodo()) return;
    const anchor = this.arrasteAnchor();
    if (!anchor) return;
    this.navegarParaMesDoDia(cell);
    this.definirIntervaloDias(anchor, cell.date);
  }

  selecionarMesCalendario(mesIndex: number): void {
    this.calendarioMes.set(mesIndex);
    this.periodoGranularidade.set('dia');
  }

  selecionarAnoCalendario(ano: number): void {
    this.calendarioAno.set(ano);
    this.periodoGranularidade.set('mes');
  }

  diaCalendarioModificadores(cell: InadCalendarioCelula): Record<string, boolean> {
    const iso = cell.iso;
    const ini = this.toIsoDate(this.periodoDataInicio());
    const fim = this.toIsoDate(this.periodoDataFim());
    const noIntervalo = iso >= ini && iso <= fim;
    const unico = ini === fim;
    return {
      'rec-cal__dia--fora': !cell.inMonth,
      'rec-cal__dia--selecionado': unico && iso === ini,
      'rec-cal__dia--range': !unico && noIntervalo,
      'rec-cal__dia--range-start': !unico && iso === ini,
      'rec-cal__dia--range-end': !unico && iso === fim
    };
  }

  mesCalendarioModificadores(mesIndex: number): Record<string, boolean> {
    const ini = this.periodoDataInicio();
    const ativo =
      this.periodoGranularidade() === 'mes' &&
      ini.getFullYear() === this.calendarioAno() &&
      ini.getMonth() === mesIndex;
    return { 'rec-cal__mes--ativo': ativo };
  }

  anoCalendarioModificadores(ano: number): Record<string, boolean> {
    const ini = this.periodoDataInicio();
    const ativo = this.periodoGranularidade() === 'ano' && ini.getFullYear() === ano;
    return { 'rec-cal__ano--ativo': ativo };
  }

  private aplicarFiltros(): InadimplenciaListaItem[] {
    let rows = [...this.items()];
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const di = this.diasFiltro();
    const st = this.statusCobrancaFiltro();
    const q = this.filtroRapido();
    const s = this.searchText().trim().toLowerCase();

    if (tr !== 'all') rows = rows.filter((r) => r.transportadora === tr);
    if (es !== 'all') rows = rows.filter((r) => r.estacionamento === es);
    if (st !== 'all') rows = rows.filter((r) => r.statusCobranca === st);

    if (di === '1-7') rows = rows.filter((r) => r.diasAtraso >= 1 && r.diasAtraso <= 7);
    else if (di === '8-15') rows = rows.filter((r) => r.diasAtraso >= 8 && r.diasAtraso <= 15);
    else if (di === 'mais15') rows = rows.filter((r) => r.diasAtraso > 15);
    else if (di === 'mais30') rows = rows.filter((r) => r.diasAtraso > 30);

    if (q === 'd1_7') rows = rows.filter((r) => r.diasAtraso >= 1 && r.diasAtraso <= 7);
    else if (q === 'd8_15') rows = rows.filter((r) => r.diasAtraso >= 8 && r.diasAtraso <= 15);
    else if (q === 'mais15') rows = rows.filter((r) => r.diasAtraso > 15);
    else if (q === 'mais30') rows = rows.filter((r) => r.diasAtraso > 30);
    else if (q === 'semCobranca') rows = rows.filter((r) => r.statusCobranca === 'Não enviada');
    else if (q === 'emNegociacao') rows = rows.filter((r) => r.statusCobranca === 'Em negociação');

    if (s) {
      rows = rows.filter((r) =>
        r.id.toLowerCase().includes(s) ||
        r.transportadora.toLowerCase().includes(s) ||
        r.estacionamento.toLowerCase().includes(s)
      );
    }

    return rows;
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

  private criarDataHoje(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private montarGradeCalendario(): InadCalendarioCelula[] {
    const ano = this.calendarioAno();
    const mes = this.calendarioMes();
    const primeiro = new Date(ano, mes, 1);
    const grade: InadCalendarioCelula[] = [];
    const inicioGrade = new Date(primeiro);
    inicioGrade.setDate(primeiro.getDate() - primeiro.getDay());

    for (let i = 0; i < 42; i++) {
      const date = new Date(inicioGrade);
      date.setDate(inicioGrade.getDate() + i);
      grade.push({
        iso: this.toIsoDate(date),
        day: date.getDate(),
        inMonth: date.getMonth() === mes,
        date
      });
    }

    return grade;
  }

  private navegarParaMesDoDia(cell: InadCalendarioCelula): void {
    if (!cell.inMonth) {
      this.calendarioAno.set(cell.date.getFullYear());
      this.calendarioMes.set(cell.date.getMonth());
    }
  }

  private definirIntervaloDias(inicio: Date, fim: Date): void {
    const a = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const b = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
    if (this.toIsoDate(a) <= this.toIsoDate(b)) {
      this.periodoDataInicio.set(a);
      this.periodoDataFim.set(b);
    } else {
      this.periodoDataInicio.set(b);
      this.periodoDataFim.set(a);
    }
  }
}
