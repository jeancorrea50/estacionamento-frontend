import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, HostListener, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';

import type { ApiError } from '../../../../../core/api/models';
import { ThemeService } from '../../../../../core/services/theme.service';
import { FaturaService } from '../../../services/fatura.service';
import type {
  FechamentoDetalheResumo,
  FechamentoFiltroRapidoId,
  FechamentoListaItem,
  FechamentoModalidade,
  FechamentoResumo,
  FechamentoSituacao,
  FechamentoValidacaoAlerta
} from './faturamento-fechamentos.types';

type FechamentoPeriodoGranularidade = 'dia' | 'mes' | 'ano';

interface PeriodoGranularidadeOpcao {
  id: FechamentoPeriodoGranularidade;
  label: string;
}

interface FechCalendarioCelula {
  iso: string;
  day: number;
  inMonth: boolean;
  date: Date;
}

@Component({
  selector: 'app-faturamento-fechamentos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './faturamento-fechamentos.component.html',
  styleUrls: ['./faturamento-fechamentos.component.scss']
})
export class FaturamentoFechamentosComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly api = inject(FaturaService);
  private readonly snack = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<FechamentoListaItem[]>([]);
  readonly resumo = signal<FechamentoResumo>({
    fechamentosDisponiveis: 0,
    prontosParaFaturar: 0,
    valorEstimadoTotal: 0,
    comDivergencia: 0
  });
  readonly loading = signal(false);
  readonly totalCountApi = signal(0);

  private readonly filtrosRapidosValidos = new Set<FechamentoFiltroRapidoId>([
    'todos',
    'prontos',
    'andamento',
    'divergencia',
    'faturados',
    'cancelados'
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

  readonly periodoGranularidadeOpcoes: PeriodoGranularidadeOpcao[] = [
    { id: 'dia', label: 'Dia' },
    { id: 'mes', label: 'Mês' },
    { id: 'ano', label: 'Ano' }
  ];

  readonly modalidades: FechamentoModalidade[] = [
    'Diária',
    'Semanal',
    'Quinzenal',
    'Mensal',
    'Por data personalizada'
  ];

  readonly situacoesFiltro: FechamentoSituacao[] = [
    'Em andamento',
    'Pronto para faturar',
    'Faturado',
    'Com divergência',
    'Cancelado'
  ];

  readonly filtroRapidoOpcoes: { id: FechamentoFiltroRapidoId; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'prontos', label: 'Prontos' },
    { id: 'andamento', label: 'Em andamento' },
    { id: 'divergencia', label: 'Com divergência' },
    { id: 'faturados', label: 'Faturados' },
    { id: 'cancelados', label: 'Cancelados' }
  ];

  readonly validacoes: FechamentoValidacaoAlerta[] = [
    { id: 'v1', texto: '3 movimentações sem transportadora vinculada', severidade: 'atencao' },
    { id: 'v2', texto: '2 placas sem vínculo com cadastro', severidade: 'atencao' },
    { id: 'v3', texto: '1 item com valor zerado', severidade: 'atencao' },
    { id: 'v4', texto: '2 movimentações já faturadas anteriormente', severidade: 'critico' }
  ];

  /* ── Filtros ──────────────────────────────────────────────────────── */
  readonly transportadoraFiltro = signal<string>('all');
  readonly estacionamentoFiltro = signal<string>('all');
  readonly modalidadeFiltro = signal<string>('all');
  readonly situacaoFiltro = signal<string>('all');
  readonly filtroRapido = signal<FechamentoFiltroRapidoId | null>(null);
  readonly searchText = signal<string>('');

  readonly panelFiltrosAberto = signal(false);
  readonly panelDataAberto = signal(false);

  /* ── Calendário (visual, espelha Recebimentos) ────────────────────── */
  readonly periodoGranularidade = signal<FechamentoPeriodoGranularidade>('dia');
  readonly periodoDataInicio = signal<Date>(this.criarDataHoje());
  readonly periodoDataFim = signal<Date>(this.criarDataHoje());
  readonly calendarioAno = signal(new Date().getFullYear());
  readonly calendarioMes = signal(new Date().getMonth());
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

  /* ── Paginação ────────────────────────────────────────────────────── */
  readonly paginaAtual = signal(0);
  readonly itensPorPagina = 20;

  readonly selection = new SelectionModel<FechamentoListaItem>(true, []);

  readonly displayedColumns: string[] = [
    'select',
    'transportadora',
    'estacionamento',
    'modalidade',
    'periodoApurado',
    'movimentacoes',
    'valorEstimado',
    'divergencias',
    'situacao',
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

  readonly contagemPorSituacao = computed(() => {
    const m = new Map<FechamentoSituacao, number>();
    for (const s of this.situacoesFiltro) m.set(s, 0);
    for (const r of this.items()) {
      m.set(r.situacao, (m.get(r.situacao) ?? 0) + 1);
    }
    return m;
  });

  readonly linhasFiltradas = computed(() => this.aplicarFiltros());

  readonly linhasPaginadas = computed(() => {
    const rows = this.linhasFiltradas();
    const start = this.paginaAtual() * this.itensPorPagina;
    return rows.slice(start, start + this.itensPorPagina);
  });

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.linhasFiltradas().length / this.itensPorPagina))
  );

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

  /** KPIs do Resumo retornado por `GET /fechamentos`. */
  readonly kpisGlobais = computed(() => {
    const r = this.resumo();
    return {
      disponiveis: r.fechamentosDisponiveis,
      prontos: r.prontosParaFaturar,
      valorEstimado: r.valorEstimadoTotal,
      divergencias: r.comDivergencia
    };
  });

  readonly filtrosAtivosCount = computed(() => {
    let c = 0;
    if (this.transportadoraFiltro() !== 'all') c++;
    if (this.estacionamentoFiltro() !== 'all') c++;
    if (this.modalidadeFiltro() !== 'all') c++;
    if (this.situacaoFiltro() !== 'all') c++;
    return c;
  });

  readonly resumoSelecionado = computed(() => {
    const sel = this.selection.selected;
    if (sel.length !== 1) return null;
    return sel[0];
  });

  readonly detalheResumo = computed(() => {
    const row = this.resumoSelecionado();
    if (!row) return null;
    return this.buildDetalhe(row);
  });

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
    const estavaArrastando = this.arrastandoPeriodo();
    this.arrastandoPeriodo.set(false);
    this.arrasteAnchor.set(null);
    if (estavaArrastando) this.carregarLista();
  }

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const filtro = params.get('filtro');
      if (filtro && this.filtrosRapidosValidos.has(filtro as FechamentoFiltroRapidoId)) {
        this.filtroRapido.set(filtro as FechamentoFiltroRapidoId);
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

    this.api
      .listarFechamentos({
        numeroPagina: 1,
        tamanhoPagina: 200,
        dataInicial: this.toIsoDate(this.periodoDataInicio()),
        dataFinal: this.toIsoDate(this.periodoDataFim()),
        descricao: q || undefined
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
            fechamentosDisponiveis: 0,
            prontosParaFaturar: 0,
            valorEstimadoTotal: 0,
            comDivergencia: 0
          });
          this.totalCountApi.set(0);
          this.snack.open(this.mensagemErro(err, 'Falha ao carregar fechamentos.'), 'Fechar', {
            duration: 5500
          });
        }
      });
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

  setPeriodoGranularidade(id: FechamentoPeriodoGranularidade): void {
    this.periodoGranularidade.set(id);
    const ini = this.periodoDataInicio();
    this.calendarioAno.set(ini.getFullYear());
    if (id === 'mes' || id === 'dia') {
      this.calendarioMes.set(ini.getMonth());
    }
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

  onDiaCalendarioPointerDown(cell: FechCalendarioCelula, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.navegarParaMesDoDia(cell);
    this.arrastandoPeriodo.set(true);
    this.arrasteAnchor.set(cell.date);
    this.definirIntervaloDias(cell.date, cell.date);
  }

  onDiaCalendarioPointerEnter(cell: FechCalendarioCelula): void {
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

  diaCalendarioModificadores(cell: FechCalendarioCelula): Record<string, boolean> {
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

  isFiltroRapidoAtivo(id: FechamentoFiltroRapidoId): boolean {
    const cur = this.filtroRapido();
    if (id === 'todos') return cur === null || cur === 'todos';
    return cur === id;
  }

  alternarFiltroRapido(id: FechamentoFiltroRapidoId): void {
    if (id === 'todos') {
      this.filtroRapido.set(null);
      return;
    }
    this.filtroRapido.update((cur) => (cur === id ? null : id));
  }

  chipBadge(id: FechamentoFiltroRapidoId): number {
    const c = this.contagemPorSituacao();
    switch (id) {
      case 'todos':
        return this.items().length;
      case 'prontos':
        return c.get('Pronto para faturar') ?? 0;
      case 'andamento':
        return c.get('Em andamento') ?? 0;
      case 'divergencia':
        return c.get('Com divergência') ?? 0;
      case 'faturados':
        return c.get('Faturado') ?? 0;
      case 'cancelados':
        return c.get('Cancelado') ?? 0;
      default:
        return 0;
    }
  }

  limparFiltros(): void {
    this.transportadoraFiltro.set('all');
    this.estacionamentoFiltro.set('all');
    this.modalidadeFiltro.set('all');
    this.situacaoFiltro.set('all');
    this.searchText.set('');
    this.carregarLista();
  }

  irParaPagina(p: number): void {
    this.paginaAtual.set(Math.max(0, Math.min(p, this.totalPaginas() - 1)));
  }

  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  situacaoChipClass(s: FechamentoSituacao): string {
    const map: Record<FechamentoSituacao, string> = {
      'Pronto para faturar': 'visao-chip visao-chip--pago',
      'Em andamento': 'visao-chip visao-chip--aberto',
      Faturado: 'visao-chip visao-chip--aguardando',
      'Com divergência': 'visao-chip visao-chip--parcial',
      Cancelado: 'visao-chip visao-chip--cancelada'
    };
    return map[s] ?? 'visao-chip';
  }

  bloquearGeracao(s: FechamentoSituacao): boolean {
    return s === 'Com divergência' || s === 'Cancelado' || s === 'Faturado';
  }

  onMasterToggle(ev: MatCheckboxChange): void {
    if (ev.checked) {
      for (const r of this.linhasFiltradas()) this.selection.select(r);
    } else {
      this.selection.clear();
    }
  }

  onRowToggle(row: FechamentoListaItem, ev: MatCheckboxChange): void {
    if (ev.checked) this.selection.select(row);
    else this.selection.deselect(row);
  }

  isAllSelected(): boolean {
    const v = this.linhasFiltradas();
    return v.length > 0 && this.selection.selected.length === v.length;
  }

  checkboxLabel(row?: FechamentoListaItem): string {
    if (!row) return 'Selecionar todos os fechamentos visíveis';
    return `${this.selection.isSelected(row) ? 'Desmarcar' : 'Marcar'} fechamento ${row.id}`;
  }

  acaoMock(acao: string, row?: FechamentoListaItem): void {
    void acao;
    void row;
  }

  private aplicarFiltros(): FechamentoListaItem[] {
    let rows = [...this.items()];
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const md = this.modalidadeFiltro();
    const st = this.situacaoFiltro();
    const rap = this.filtroRapido();
    const s = this.searchText().trim().toLowerCase();

    if (tr !== 'all') rows = rows.filter((r) => r.transportadora === tr);
    if (es !== 'all') rows = rows.filter((r) => r.estacionamento === es);
    if (md !== 'all') rows = rows.filter((r) => r.modalidade === md);
    if (st !== 'all') rows = rows.filter((r) => r.situacao === st);

    if (rap === 'prontos') rows = rows.filter((r) => r.situacao === 'Pronto para faturar');
    else if (rap === 'andamento') rows = rows.filter((r) => r.situacao === 'Em andamento');
    else if (rap === 'divergencia') rows = rows.filter((r) => r.situacao === 'Com divergência');
    else if (rap === 'faturados') rows = rows.filter((r) => r.situacao === 'Faturado');
    else if (rap === 'cancelados') rows = rows.filter((r) => r.situacao === 'Cancelado');

    if (s) {
      rows = rows.filter(
        (r) =>
          r.id.toLowerCase().includes(s) ||
          r.transportadora.toLowerCase().includes(s) ||
          r.estacionamento.toLowerCase().includes(s)
      );
    }

    return rows;
  }

  private buildDetalhe(row: FechamentoListaItem): FechamentoDetalheResumo {
    const t = row.valorEstimado;
    if (t <= 0) {
      return {
        diarias: 0,
        mensalistas: 0,
        lavagens: 0,
        servicosExtras: 0,
        descontos: 0,
        acrescimos: 0,
        beneficios: 0,
        totalEstimado: 0
      };
    }
    const diarias = Math.round(t * 0.55);
    const mensalistas = Math.round(t * 0.2);
    const lavagens = Math.round(t * 0.1);
    const servicosExtras = Math.round(t * 0.08);
    const descontos = -Math.round(t * 0.03);
    const acrescimos = Math.round(t * 0.05);
    const beneficios = Math.round(t * 0.02);
    return {
      diarias,
      mensalistas,
      lavagens,
      servicosExtras,
      descontos,
      acrescimos,
      beneficios,
      totalEstimado: diarias + mensalistas + lavagens + servicosExtras + descontos + acrescimos + beneficios
    };
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

  private montarGradeCalendario(): FechCalendarioCelula[] {
    const ano = this.calendarioAno();
    const mes = this.calendarioMes();
    const primeiro = new Date(ano, mes, 1);
    const grade: FechCalendarioCelula[] = [];
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

  private navegarParaMesDoDia(cell: FechCalendarioCelula): void {
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
