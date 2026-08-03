import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs/operators';

import type { ApiError } from '../../../../../core/api/models';
import { ThemeService } from '../../../../../core/services/theme.service';
import { FaturaService } from '../../../services/fatura.service';
import { FaturamentoRecebimentosPartialDialogComponent } from './faturamento-recebimentos-partial-dialog.component';
import type {
  RecebimentoComprovanteEstado,
  RecebimentoFiltroRapidoId,
  RecebimentoListaItem,
  RecebimentoPagamentoStatus,
  RecebimentoPartialDialogData,
  RecebimentoPeriodoGranularidade,
  RecebimentoResumo
} from './faturamento-recebimentos.types';

interface PeriodoGranularidadeOpcao {
  id: RecebimentoPeriodoGranularidade;
  label: string;
}

interface RecCalendarioCelula {
  iso: string;
  day: number;
  inMonth: boolean;
  date: Date;
}

@Component({
  selector: 'app-faturamento-recebimentos',
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
    MatTooltipModule
  ],
  templateUrl: './faturamento-recebimentos.component.html',
  styleUrls: ['./faturamento-recebimentos.component.scss']
})
export class FaturamentoRecebimentosComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly themeService = inject(ThemeService);
  private readonly api = inject(FaturaService);
  private readonly snack = inject(MatSnackBar);

  readonly items = signal<RecebimentoListaItem[]>([]);
  readonly resumo = signal<RecebimentoResumo>({
    totalRecebidoPeriodo: 0,
    pagamentosParciais: 0,
    quantidadePagamentosParciais: 0,
    valorPendente: 0,
    quantidadePendentes: 0,
    recebimentosDoDia: 0
  });
  readonly loading = signal(false);
  readonly totalCountApi = signal(0);

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

  readonly statusPagamentoOpcoes: RecebimentoPagamentoStatus[] = [
    'Pago',
    'Parcial',
    'Em aberto',
    'Vencido',
    'Cancelada'
  ];

  readonly formasPagamento = ['PIX', 'Boleto', 'Transferência', 'Cartão', 'Dinheiro', 'Outros'] as const;

  readonly periodoGranularidade = signal<RecebimentoPeriodoGranularidade>('dia');
  readonly periodoDataInicio = signal<Date>(this.criarDataHoje());
  readonly periodoDataFim = signal<Date>(this.criarDataHoje());
  readonly calendarioAno = signal(new Date().getFullYear());
  readonly calendarioMes = signal(new Date().getMonth());
  readonly panelDataAberto = signal(false);
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
  readonly statusFiltro = signal<string>('all');
  readonly formaFiltro = signal<string>('all');
  readonly filtroRapido = signal<RecebimentoFiltroRapidoId | null>(null);
  readonly searchText = signal<string>('');

  readonly paginaAtual = signal(0);
  readonly itensPorPagina = 20;

  readonly selection = new SelectionModel<RecebimentoListaItem>(true, []);

  readonly displayedColumns: string[] = [
    'select',
    'fatura',
    'tipoFatura',
    'transportadora',
    'valorFatura',
    'valorRecebido',
    'saldoRestante',
    'dataPagamento',
    'formaPagamento',
    'comprovante',
    'status',
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
    const comArquivo = (r: RecebimentoListaItem) =>
      r.comprovante === 'Anexado' || r.comprovante === 'Aguardando conferência';
    return {
      todos: rows.length,
      pagos: rows.filter((r) => r.status === 'Pago').length,
      parciais: rows.filter((r) => r.status === 'Parcial').length,
      pendentes: rows.filter((r) => r.status === 'Em aberto').length,
      vencidos: rows.filter((r) => r.status === 'Vencido').length,
      comComprovante: rows.filter(comArquivo).length,
      semComprovante: rows.filter((r) => r.comprovante === 'Sem comprovante').length
    };
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

  readonly resumoLinha = computed(() => {
    const s = this.selection.selected;
    if (s.length === 0) return null;
    return s[0];
  });

  readonly variosSelecionados = computed(() => this.selection.selected.length > 1);

  readonly filtrosAtivosCount = computed(() => {
    let c = 0;
    if (this.transportadoraFiltro() !== 'all') c++;
    if (this.estacionamentoFiltro() !== 'all') c++;
    if (this.statusFiltro() !== 'all') c++;
    if (this.formaFiltro() !== 'all') c++;
    return c;
  });

  readonly totalRecebidoFormatado = computed(() =>
    this.formatCurrency(this.resumo().totalRecebidoPeriodo)
  );
  readonly pagamentosParciaisFormatado = computed(() =>
    this.formatCurrency(this.resumo().pagamentosParciais)
  );
  readonly quantidadePagamentosParciais = computed(
    () => this.resumo().quantidadePagamentosParciais
  );
  readonly valorPendenteFormatado = computed(() => this.formatCurrency(this.resumo().valorPendente));
  readonly quantidadePendentes = computed(() => this.resumo().quantidadePendentes);
  readonly recebimentosDoDiaFormatado = computed(() =>
    this.formatCurrency(this.resumo().recebimentosDoDia)
  );

  readonly panelFiltrosAberto = signal(false);

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

  togglePanelFiltros(event: MouseEvent): void {
    event.stopPropagation();
    this.panelFiltrosAberto.update((v) => !v);
  }

  constructor() {
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
      .listarRecebimentos({
        numeroPagina: 1,
        tamanhoPagina: 200,
        dataInicial: this.toIsoDate(this.periodoDataInicio()),
        dataFinal: this.toIsoDate(this.periodoDataFim()),
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
            totalRecebidoPeriodo: 0,
            pagamentosParciais: 0,
            quantidadePagamentosParciais: 0,
            valorPendente: 0,
            quantidadePendentes: 0,
            recebimentosDoDia: 0
          });
          this.totalCountApi.set(0);
          this.snack.open(this.mensagemErro(err, 'Falha ao carregar recebimentos.'), 'Fechar', {
            duration: 5500
          });
        }
      });
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

  setPeriodoGranularidade(id: RecebimentoPeriodoGranularidade): void {
    this.periodoGranularidade.set(id);
    const ini = this.periodoDataInicio();
    this.calendarioAno.set(ini.getFullYear());
    if (id === 'mes') {
      this.calendarioMes.set(ini.getMonth());
    } else if (id === 'dia') {
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

  onDiaCalendarioPointerDown(cell: RecCalendarioCelula, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.navegarParaMesDoDia(cell);
    this.arrastandoPeriodo.set(true);
    this.arrasteAnchor.set(cell.date);
    this.definirIntervaloDias(cell.date, cell.date);
  }

  onDiaCalendarioPointerEnter(cell: RecCalendarioCelula): void {
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

  diaCalendarioModificadores(cell: RecCalendarioCelula): Record<string, boolean> {
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

  isFiltroRapidoAtivo(id: RecebimentoFiltroRapidoId): boolean {
    const cur = this.filtroRapido();
    if (id === 'todos') return cur === null || cur === 'todos';
    return cur === id;
  }

  alternarFiltroRapido(id: RecebimentoFiltroRapidoId): void {
    if (id === 'todos') {
      this.filtroRapido.set(null);
      return;
    }
    this.filtroRapido.update((cur) => (cur === id ? null : id));
  }

  limparFiltros(): void {
    this.transportadoraFiltro.set('all');
    this.estacionamentoFiltro.set('all');
    this.statusFiltro.set('all');
    this.formaFiltro.set('all');
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

  statusChipClass(status: RecebimentoPagamentoStatus): string {
    const map: Record<RecebimentoPagamentoStatus, string> = {
      Pago: 'visao-chip visao-chip--pago',
      Parcial: 'visao-chip visao-chip--parcial',
      'Em aberto': 'visao-chip visao-chip--aberto',
      Vencido: 'visao-chip visao-chip--vencido',
      Cancelada: 'visao-chip visao-chip--cancelada'
    };
    return map[status] ?? 'visao-chip';
  }

  comprovanteChipClass(c: RecebimentoComprovanteEstado): string {
    if (c === 'Anexado') return 'visao-chip visao-chip--pago';
    if (c === 'Aguardando conferência') return 'visao-chip visao-chip--parcial';
    if (c === 'Sem comprovante') return 'visao-chip visao-chip--aguardando';
    return 'visao-chip visao-chip--cancelada';
  }

  bloquearPagamentoPrincipal(row: RecebimentoListaItem): boolean {
    return row.status === 'Pago' || row.status === 'Cancelada';
  }

  onMasterToggle(ev: MatCheckboxChange): void {
    if (ev.checked) {
      for (const r of this.linhasFiltradas()) this.selection.select(r);
    } else {
      this.selection.clear();
    }
  }

  onRowToggle(row: RecebimentoListaItem, ev: MatCheckboxChange): void {
    if (ev.checked) this.selection.select(row);
    else this.selection.deselect(row);
  }

  isAllSelected(): boolean {
    const v = this.linhasFiltradas();
    return v.length > 0 && this.selection.selected.length === v.length;
  }

  checkboxLabel(row?: RecebimentoListaItem): string {
    if (!row) return 'Selecionar todos';
    return `${this.selection.isSelected(row) ? 'Desmarcar' : 'Selecionar'} ${row.id}`;
  }

  acaoMock(acao: string, row?: RecebimentoListaItem): void {
    void acao;
    void row;
  }

  abrirPagamentoParcial(row?: RecebimentoListaItem): void {
    const alvo = row ?? this.resumoLinha();
    const data: RecebimentoPartialDialogData = {
      faturaId: alvo?.id ?? '—',
      valorTotal: alvo?.valorFatura ?? 0,
      valorJaRecebido: alvo?.valorRecebido ?? 0,
      saldoRestante: alvo?.saldoRestante ?? 0
    };
    this.dialog.open(FaturamentoRecebimentosPartialDialogComponent, {
      width: '520px',
      maxWidth: '96vw',
      data
    });
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

  private montarGradeCalendario(): RecCalendarioCelula[] {
    const ano = this.calendarioAno();
    const mes = this.calendarioMes();
    const primeiro = new Date(ano, mes, 1);
    const grade: RecCalendarioCelula[] = [];
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

  private navegarParaMesDoDia(cell: RecCalendarioCelula): void {
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

  private aplicarFiltros(): RecebimentoListaItem[] {
    let rows = [...this.items()];
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const st = this.statusFiltro();
    const fo = this.formaFiltro();
    const q = this.filtroRapido();
    const s = this.searchText().trim().toLowerCase();

    if (tr !== 'all') rows = rows.filter((r) => r.transportadora === tr);
    if (es !== 'all') rows = rows.filter((r) => r.estacionamento === es);
    if (st !== 'all') rows = rows.filter((r) => r.status === st);
    if (fo !== 'all') rows = rows.filter((r) => r.formaPagamento === fo);

    if (q === 'pagos') rows = rows.filter((r) => r.status === 'Pago');
    else if (q === 'parciais') rows = rows.filter((r) => r.status === 'Parcial');
    else if (q === 'pendentes') rows = rows.filter((r) => r.status === 'Em aberto');
    else if (q === 'vencidos') rows = rows.filter((r) => r.status === 'Vencido');
    else if (q === 'comComprovante') {
      rows = rows.filter((r) => r.comprovante === 'Anexado' || r.comprovante === 'Aguardando conferência');
    } else if (q === 'semComprovante') rows = rows.filter((r) => r.comprovante === 'Sem comprovante');

    if (s) {
      rows = rows.filter(
        (r) => r.id.toLowerCase().includes(s) || r.transportadora.toLowerCase().includes(s)
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
}
