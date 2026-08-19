import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import { finalize } from 'rxjs/operators';
import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexPlotOptions,
  ApexStroke,
  ApexTheme,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis
} from 'ng-apexcharts';

import type { ApiError } from '../../../../../core/api/models';
import { ThemeService } from '../../../../../core/services/theme.service';
import { EstacionamentoLookupService } from '../../../../cadastro/services/estacionamento-lookup.service';
import { TransportadoraLookupService } from '../../../../cadastro/services/transportadora-lookup.service';
import { ModalidadeRecebimento } from '../../../models/fatura.models';
import { emptyVisaoGeral, statusFaturaFromLabel } from '../../../mappers/fatura.mapper';
import { FaturaService } from '../../../services/fatura.service';
import { FaturamentoNavService } from '../../../services/faturamento-nav.service';
import type { FaturaStatusVisao } from '../faturamento-visao.types';
import {
  VISAO_ALERTAS,
  type AlertaResumo,
  type ProximoVencimento
} from './faturamento-visao-alertas';
import {
  mapVisaoAlertas,
  mapVisaoCards,
  mapVisaoEvolucao,
  mapVisaoIndicadores,
  mapVisaoPorModalidade,
  mapVisaoPorStatus
} from './faturamento-visao-geral.mapper';

type VisaoPeriodoGranularidade = 'dia' | 'mes' | 'ano';

interface VisaoCalendarioCelula {
  iso: string;
  day: number;
  inMonth: boolean;
  date: Date;
}

interface LookupFiltro {
  id: number;
  label: string;
}

@Component({
  selector: 'app-faturamento-visao-geral',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule,
    NgApexchartsModule,
    RouterLink
  ],
  templateUrl: './faturamento-visao-geral.component.html',
  styleUrls: ['./faturamento-visao-geral.component.scss']
})
export class FaturamentoVisaoGeralComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly nav = inject(FaturamentoNavService);
  private readonly api = inject(FaturaService);
  private readonly snack = inject(MatSnackBar);
  private readonly transportadoraLookup = inject(TransportadoraLookupService);
  private readonly estacionamentoLookup = inject(EstacionamentoLookupService);
  private readonly themeConfig = toSignal(this.themeService.theme$, {
    initialValue: this.themeService.getCurrentTheme()
  });

  readonly isDarkTheme = computed(() => {
    const mode = this.themeConfig().mode;
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  /* ── Filtros ──────────────────────────────────────────────────────── */
  readonly transportadoraFiltro = signal<number | 'all'>('all');
  readonly estacionamentoFiltro = signal<number | 'all'>('all');
  readonly modalidadeFiltro = signal<string>('all');
  readonly statusFiltro = signal<string>('all');
  readonly panelFiltrosAberto = signal(false);
  readonly loading = signal(false);

  readonly transportadorasOpcoes = signal<LookupFiltro[]>([]);
  readonly estacionamentosOpcoes = signal<LookupFiltro[]>([]);

  readonly modalidadesOpcoes = ['PIX', 'Boleto', 'Transferência', 'Cartão'];

  readonly statusOpcoes: FaturaStatusVisao[] = ['Pago', 'Em aberto', 'Vencido', 'Parcial', 'Aguardando envio', 'Cancelada'];

  readonly filtrosAtivosCount = computed(() => {
    let c = 0;
    if (this.transportadoraFiltro() !== 'all') c++;
    if (this.estacionamentoFiltro() !== 'all') c++;
    if (this.modalidadeFiltro() !== 'all') c++;
    if (this.statusFiltro() !== 'all') c++;
    return c;
  });

  limparFiltros(): void {
    this.transportadoraFiltro.set('all');
    this.estacionamentoFiltro.set('all');
    this.modalidadeFiltro.set('all');
    this.statusFiltro.set('all');
    this.carregarDashboard();
  }

  onFiltroChange(): void {
    this.carregarDashboard();
  }

  ngOnInit(): void {
    this.carregarLookups();
    this.carregarDashboard();
  }

  /* ── Data picker ──────────────────────────────────────────────────── */
  readonly periodoGranularidadeOpcoes: { id: VisaoPeriodoGranularidade; label: string }[] = [
    { id: 'dia', label: 'Dia' },
    { id: 'mes', label: 'Mês' },
    { id: 'ano', label: 'Ano' }
  ];

  readonly panelDataAberto = signal(false);
  readonly periodoGranularidade = signal<VisaoPeriodoGranularidade>('dia');
  readonly periodoDataInicio = signal<Date>(this.criarDataHoje());
  readonly periodoDataFim = signal<Date>(this.criarDataHoje());
  readonly calendarioAno = signal(new Date().getFullYear());
  readonly calendarioMes = signal(new Date().getMonth());
  private readonly arrastandoPeriodo = signal(false);
  private readonly arrasteAnchor = signal<Date | null>(null);

  readonly diasSemanaLabels = ['Do.', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sa.'] as const;
  readonly mesesLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

  readonly calendarioTituloMes = computed(() => {
    const d = new Date(this.calendarioAno(), this.calendarioMes(), 1);
    const t = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  });

  readonly calendarioGrade = computed(() => this.montarGradeCalendario());

  readonly calendarioAnosOpcoes = computed(() => {
    const centro = this.calendarioAno();
    return Array.from({ length: 12 }, (_, i) => centro - 5 + i);
  });

  /** Só envia DataInicial/DataFinal depois que o usuário escolhe um período. */
  private readonly periodoFiltroAtivo = signal(false);

  /* ── Dados da API ─────────────────────────────────────────────────── */
  private loadSeq = 0;
  readonly dashboard = signal(emptyVisaoGeral());
  readonly visaoCards = computed(() => mapVisaoCards(this.dashboard()));
  readonly visaoIndicadores = computed(() => mapVisaoIndicadores(this.dashboard()));
  readonly visaoEvolucaoMensal = computed(() => mapVisaoEvolucao(this.dashboard()));
  readonly visaoPorStatus = computed(() => mapVisaoPorStatus(this.dashboard()));
  readonly visaoPorModalidade = computed(() => mapVisaoPorModalidade(this.dashboard()));

  /** Alertas com a rota da aba conforme cadastro em Gerenciamento > Menu. */
  readonly visaoAlertas = computed<AlertaResumo[]>(() =>
    mapVisaoAlertas(this.dashboard(), VISAO_ALERTAS).map((a) => ({
      ...a,
      route: this.nav.resolveTabRoute(a.tab)
    }))
  );

  readonly proximosVencimentos = computed<ProximoVencimento[]>(() => []);

  readonly faturasRoute = computed(() => this.nav.resolveTabRoute('faturas'));

  /* ── ApexCharts (eixos/tooltips white/dark; rótulo em barra azul = texto claro) ── */
  private readonly chartAxisColor = computed(() => (this.isDarkTheme() ? '#8ea0b8' : '#4870a0'));
  /** Rótulos sobre o fill azul da série — contraste com a cor da barra, não com o tema. */
  private readonly chartOnBarLabel = '#f8fafc';
  private readonly chartGridColor = computed(() =>
    this.isDarkTheme() ? 'rgba(148, 163, 184, 0.22)' : 'rgba(72, 112, 160, 0.22)'
  );

  readonly evolutionChart = computed<ApexChart>(() => ({
    type: 'area',
    height: 252,
    width: '100%',
    fontFamily: 'inherit',
    foreColor: this.chartAxisColor(),
    background: 'transparent',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, speed: 400 },
    redrawOnParentResize: true,
    offsetX: 0,
    offsetY: 0
  }));
  readonly evolutionSeries = computed<ApexAxisChartSeries>(() => [
    { name: 'Faturamento', data: this.visaoEvolucaoMensal().map((b) => b.valor) }
  ]);
  readonly evolutionXaxis = computed<ApexXAxis>(() => ({
    categories: this.visaoEvolucaoMensal().map((b) => b.mes),
    labels: {
      style: { colors: this.chartAxisColor(), fontSize: '10px', fontWeight: 600 },
      rotate: -38,
      rotateAlways: true,
      hideOverlappingLabels: true,
      trim: true,
      maxHeight: 64
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
    crosshairs: { show: false },
    tooltip: { enabled: false }
  }));
  readonly evolutionYaxis = computed<ApexYAxis>(() => ({
    labels: {
      align: 'right',
      offsetX: 2,
      style: { fontSize: '10px', colors: this.chartAxisColor() },
      formatter: (val: string | number) => {
        const n = Number(val);
        if (!Number.isFinite(n)) return '';
        if (Math.abs(n) >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
        if (Math.abs(n) >= 1_000) return `${Math.round(n / 100) / 10}k`;
        return String(Math.round(n));
      }
    }
  }));
  readonly evolutionStroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly evolutionFill: ApexFill = {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.42, opacityTo: 0.03, stops: [0, 100] }
  };
  readonly evolutionGrid = computed<ApexGrid>(() => ({
    borderColor: this.chartGridColor(),
    strokeDashArray: 4,
    padding: { top: 12, right: 8, bottom: 40, left: 48 },
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } }
  }));
  readonly evolutionTooltip = computed<ApexTooltip>(() => ({
    theme: this.isDarkTheme() ? 'dark' : 'light',
    custom: (opts: { dataPointIndex?: number }) => {
      const idx = opts.dataPointIndex ?? -1;
      const row = idx >= 0 ? this.visaoEvolucaoMensal()[idx] : undefined;
      if (!row) return '<div class="visao-evolucao-tooltip"></div>';
      return (
        '<div class="visao-evolucao-tooltip"><div class="visao-evolucao-tooltip__mes">' +
        this.escapeHtml(row.mes) +
        '</div><div class="visao-evolucao-tooltip__valor">' +
        this.escapeHtml(this.formatCurrency(row.valor)) +
        '</div></div>'
      );
    }
  }));
  readonly evolutionDataLabels: ApexDataLabels = { enabled: false };

  readonly statusChart = computed<ApexChart>(() => ({
    type: 'bar',
    height: 252,
    fontFamily: 'inherit',
    foreColor: this.chartAxisColor(),
    background: 'transparent',
    toolbar: { show: false },
    parentHeightOffset: 0,
    redrawOnParentResize: true
  }));
  readonly statusSeries = computed<ApexAxisChartSeries>(() => [
    { name: 'Quantidade', data: this.visaoPorStatus().map((s) => s.quantidade) }
  ]);
  readonly statusPlotOptions: ApexPlotOptions = {
    bar: { horizontal: true, borderRadius: 4, barHeight: '68%', distributed: false, dataLabels: { position: 'center' } }
  };
  readonly statusXaxis = computed<ApexXAxis>(() => ({
    categories: this.visaoPorStatus().map((s) => s.status),
    min: 0,
    max: Math.ceil(Math.max(...this.visaoPorStatus().map((s) => s.quantidade), 1) * 1.15),
    tickAmount: 4,
    decimalsInFloat: 0,
    labels: {
      style: { colors: this.chartAxisColor(), fontSize: '11px' },
      formatter: (val: string) => {
        const n = Number(val);
        return Number.isFinite(n) && n >= 0 ? String(Math.round(n)) : '';
      }
    },
    axisBorder: { show: false },
    axisTicks: { show: false }
  }));
  readonly statusDataLabels = computed<ApexDataLabels>(() => ({
    enabled: true,
    formatter: (val: number, opts: { dataPointIndex?: number }) => {
      const idx = opts?.dataPointIndex ?? 0;
      const q = this.visaoPorStatus()[idx]?.quantidade ?? Number(val);
      return `${q} (${this.pctStatus(q)}%)`;
    },
    offsetX: 0,
    style: { colors: [this.chartOnBarLabel], fontSize: '11px', fontWeight: 600 }
  }));
  readonly statusGrid = computed<ApexGrid>(() => ({
    borderColor: this.chartGridColor(),
    padding: { top: 12, right: 12, bottom: 4, left: 4 },
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: false } }
  }));

  readonly modalChart = computed<ApexChart>(() => ({
    type: 'bar',
    height: 252,
    fontFamily: 'inherit',
    foreColor: this.chartAxisColor(),
    background: 'transparent',
    toolbar: { show: false },
    parentHeightOffset: 0,
    redrawOnParentResize: true
  }));
  readonly modalSeries = computed<ApexAxisChartSeries>(() => [
    { name: 'Valor', data: this.visaoPorModalidade().map((m) => m.valor) }
  ]);
  readonly modalPlotOptions: ApexPlotOptions = {
    bar: { horizontal: true, borderRadius: 4, barHeight: '70%', dataLabels: { position: 'center' } }
  };
  readonly modalXaxis = computed<ApexXAxis>(() => ({
    categories: this.visaoPorModalidade().map((m) => m.modalidade),
    min: 0,
    max: Math.ceil(Math.max(...this.visaoPorModalidade().map((m) => m.valor), 1) * 1.12 / 1000) * 1000,
    tickAmount: 4,
    decimalsInFloat: 0,
    labels: {
      style: { colors: this.chartAxisColor(), fontSize: '10px' },
      formatter: (val: string) => {
        const n = Number(val);
        if (!Number.isFinite(n) || n < 0) return '';
        if (n >= 1000) return `${Math.round(n / 1000)}k`;
        return String(Math.round(n));
      }
    },
    axisBorder: { show: false },
    axisTicks: { show: false }
  }));
  readonly modalDataLabels = computed<ApexDataLabels>(() => ({
    enabled: true,
    formatter: (val: number) => this.formatCurrency(Number(val)),
    offsetX: 0,
    style: { colors: [this.chartOnBarLabel], fontSize: '11px', fontWeight: 600 }
  }));
  readonly modalGrid = computed<ApexGrid>(() => ({
    borderColor: this.chartGridColor(),
    padding: { top: 16, right: 12, bottom: 4, left: 4 },
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: false } }
  }));

  readonly statusTooltip = computed<ApexTooltip>(() => ({
    theme: this.isDarkTheme() ? 'dark' : 'light',
    y: { formatter: (val: number) => String(val) },
    style: { fontSize: '12px', fontFamily: 'inherit' }
  }));
  readonly modalTooltip = computed<ApexTooltip>(() => ({
    theme: this.isDarkTheme() ? 'dark' : 'light',
    y: { formatter: (val: number) => this.formatCurrency(val) },
    style: { fontSize: '12px', fontFamily: 'inherit' }
  }));
  readonly chartColors = computed(() => [this.isDarkTheme() ? '#3b82f6' : '#5088d0']);
  readonly chartTheme = computed<ApexTheme>(() => ({
    mode: this.isDarkTheme() ? 'dark' : 'light',
    monochrome: { enabled: false }
  }));

  /* ── Host listeners ───────────────────────────────────────────────── */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (!target.closest('.rec-data-picker')) {
      this.panelDataAberto.set(false);
    }
    if (!target.closest('.rec-filter-bar')) {
      this.panelFiltrosAberto.set(false);
    }
  }

  togglePanelFiltros(event: MouseEvent): void {
    event.stopPropagation();
    this.panelFiltrosAberto.update((v) => !v);
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    const estavaArrastando = this.arrastandoPeriodo();
    this.arrastandoPeriodo.set(false);
    this.arrasteAnchor.set(null);
    if (estavaArrastando) {
      this.periodoFiltroAtivo.set(true);
      this.carregarDashboard();
    }
  }

  /* ── Data picker methods ──────────────────────────────────────────── */
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

  setPeriodoGranularidade(id: VisaoPeriodoGranularidade): void {
    this.periodoGranularidade.set(id);
    const ini = this.periodoDataInicio();
    this.calendarioAno.set(ini.getFullYear());
    if (id === 'mes' || id === 'dia') this.calendarioMes.set(ini.getMonth());
  }

  mesCalendarioAnterior(): void {
    const m = this.calendarioMes();
    const a = this.calendarioAno();
    if (m === 0) { this.calendarioMes.set(11); this.calendarioAno.set(a - 1); }
    else this.calendarioMes.set(m - 1);
  }

  mesCalendarioProximo(): void {
    const m = this.calendarioMes();
    const a = this.calendarioAno();
    if (m === 11) { this.calendarioMes.set(0); this.calendarioAno.set(a + 1); }
    else this.calendarioMes.set(m + 1);
  }

  anoCalendarioAnterior(): void { this.calendarioAno.update((a) => a - 1); }
  anoCalendarioProximo(): void { this.calendarioAno.update((a) => a + 1); }

  onDiaCalendarioPointerDown(cell: VisaoCalendarioCelula, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.navegarParaMesDoDia(cell);
    this.arrastandoPeriodo.set(true);
    this.arrasteAnchor.set(cell.date);
    this.definirIntervaloDias(cell.date, cell.date);
  }

  onDiaCalendarioPointerEnter(cell: VisaoCalendarioCelula): void {
    if (!this.arrastandoPeriodo()) return;
    const anchor = this.arrasteAnchor();
    if (!anchor) return;
    this.navegarParaMesDoDia(cell);
    this.definirIntervaloDias(anchor, cell.date);
  }

  selecionarMesCalendario(mesIndex: number): void {
    this.calendarioMes.set(mesIndex);
    const ano = this.calendarioAno();
    const inicio = new Date(ano, mesIndex, 1);
    const fim = new Date(ano, mesIndex + 1, 0);
    this.periodoGranularidade.set('mes');
    this.definirIntervaloDias(inicio, fim);
    this.periodoFiltroAtivo.set(true);
    this.carregarDashboard();
  }

  selecionarAnoCalendario(ano: number): void {
    this.calendarioAno.set(ano);
    const inicio = new Date(ano, 0, 1);
    const fim = new Date(ano, 11, 31);
    this.periodoGranularidade.set('ano');
    this.definirIntervaloDias(inicio, fim);
    this.periodoFiltroAtivo.set(true);
    this.carregarDashboard();
  }

  diaCalendarioModificadores(cell: VisaoCalendarioCelula): Record<string, boolean> {
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
    const ativo = this.periodoGranularidade() === 'mes' && ini.getFullYear() === this.calendarioAno() && ini.getMonth() === mesIndex;
    return { 'rec-cal__mes--ativo': ativo };
  }

  anoCalendarioModificadores(ano: number): Record<string, boolean> {
    const ini = this.periodoDataInicio();
    const ativo = this.periodoGranularidade() === 'ano' && ini.getFullYear() === ano;
    return { 'rec-cal__ano--ativo': ativo };
  }

  /* ── Navegação (Alertas / Próximos vencimentos) ───────────────────── */
  /** Fallback programático (ex.: testes); o template usa routerLink. */
  abrirAlerta(a: AlertaResumo, event?: Event): void {
    event?.preventDefault();
    void this.router.navigateByUrl(this.montarUrl(a.route, a.queryParams));
  }

  abrirProximoVencimento(row: ProximoVencimento, event?: Event): void {
    event?.preventDefault();
    void this.router.navigateByUrl(this.montarUrl(row.route, row.queryParams));
  }

  private montarUrl(route: string, queryParams?: Record<string, string>): string {
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return route;
    }
    const qs = new URLSearchParams(queryParams).toString();
    return `${route}?${qs}`;
  }

  /* ── Utilities ────────────────────────────────────────────────────── */
  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  carregarDashboard(): void {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    const transp = this.transportadoraFiltro();
    const estac = this.estacionamentoFiltro();
    const status = this.statusFiltro();
    const modalidade = this.modalidadeFiltro();

    this.api
      .obterVisaoGeral({
        transportadoraId: typeof transp === 'number' ? transp : undefined,
        estacionamentoId: typeof estac === 'number' ? estac : undefined,
        status: status === 'all' ? undefined : statusFaturaFromLabel(status),
        modalidadeRecebimento: this.modalidadeCodigoFromFiltro(modalidade),
        dataInicial: this.periodoFiltroAtivo() ? this.toIsoDate(this.periodoDataInicio()) : undefined,
        dataFinal: this.periodoFiltroAtivo() ? this.toIsoDate(this.periodoDataFim()) : undefined
      })
      .pipe(finalize(() => {
        if (seq === this.loadSeq) this.loading.set(false);
      }))
      .subscribe({
        next: (dto) => {
          if (seq !== this.loadSeq) return;
          this.dashboard.set(dto);
        },
        error: (err) => {
          if (seq !== this.loadSeq) return;
          this.dashboard.set(emptyVisaoGeral());
          this.snack.open(this.mensagemErro(err, 'Falha ao carregar a visão geral.'), 'Fechar', {
            duration: 5500
          });
        }
      });
  }

  private carregarLookups(): void {
    this.transportadoraLookup.list().subscribe({
      next: (rows) => this.transportadorasOpcoes.set(rows.map((r) => ({ id: r.id, label: r.label }))),
      error: () => this.transportadorasOpcoes.set([])
    });
    this.estacionamentoLookup.list().subscribe({
      next: (rows) => this.estacionamentosOpcoes.set(rows.map((r) => ({ id: r.id, label: r.label }))),
      error: () => this.estacionamentosOpcoes.set([])
    });
  }

  private modalidadeCodigoFromFiltro(label: string): ModalidadeRecebimento | undefined {
    switch (label) {
      case 'PIX':
      case 'Pix':
        return ModalidadeRecebimento.Pix;
      case 'Boleto':
        return ModalidadeRecebimento.Boleto;
      case 'Transferência':
        return ModalidadeRecebimento.Transferencia;
      case 'Cartão':
        return ModalidadeRecebimento.Cartao;
      default:
        return undefined;
    }
  }

  private mensagemErro(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ApiError | { message?: string; mensagem?: string } | null;
      const msg = body && typeof body === 'object'
        ? String((body as ApiError).message ?? (body as { mensagem?: string }).mensagem ?? '')
        : '';
      if (msg) return msg;
    }
    return fallback;
  }

  totalQuantidadeStatus(): number {
    return this.visaoPorStatus().reduce((a, s) => a + s.quantidade, 0) || 1;
  }

  pctStatus(q: number): number {
    return Math.round((q / this.totalQuantidadeStatus()) * 100);
  }

  statusChipClass(status: FaturaStatusVisao): string {
    const map: Record<FaturaStatusVisao, string> = {
      Pago: 'visao-chip visao-chip--pago',
      'Em aberto': 'visao-chip visao-chip--aberto',
      Vencido: 'visao-chip visao-chip--vencido',
      Parcial: 'visao-chip visao-chip--parcial',
      'Aguardando envio': 'visao-chip visao-chip--aguardando',
      Cancelada: 'visao-chip visao-chip--cancelada'
    };
    return map[status] ?? 'visao-chip';
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  private montarGradeCalendario(): VisaoCalendarioCelula[] {
    const ano = this.calendarioAno();
    const mes = this.calendarioMes();
    const primeiro = new Date(ano, mes, 1);
    const grade: VisaoCalendarioCelula[] = [];
    const inicioGrade = new Date(primeiro);
    inicioGrade.setDate(primeiro.getDate() - primeiro.getDay());
    for (let i = 0; i < 42; i++) {
      const date = new Date(inicioGrade);
      date.setDate(inicioGrade.getDate() + i);
      grade.push({ iso: this.toIsoDate(date), day: date.getDate(), inMonth: date.getMonth() === mes, date });
    }
    return grade;
  }

  private navegarParaMesDoDia(cell: VisaoCalendarioCelula): void {
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
