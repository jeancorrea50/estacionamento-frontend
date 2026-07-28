import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Router, ActivatedRoute } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
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

import { ThemeService } from '../../../../../core/services/theme.service';
import type { FaturaStatusVisao } from '../faturamento-visao.types';

interface AlertaNavegacao {
  path: string;
  queryParams?: Record<string, string>;
}

type VisaoPeriodoGranularidade = 'dia' | 'mes' | 'ano';

interface VisaoCalendarioCelula {
  iso: string;
  day: number;
  inMonth: boolean;
  date: Date;
}

interface BarraMes { mes: string; valor: number; }
interface StatusContagem { status: FaturaStatusVisao; quantidade: number; }
interface ModalidadeValor { modalidade: string; valor: number; }
interface AlertaResumo { id: string; titulo: string; quantidade: number; detalhe: string; icon: string; }
interface ProximoVencimento { transportadora: string; valor: number; vencimento: string; status: FaturaStatusVisao; }

@Component({
  selector: 'app-faturamento-visao-geral',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatSelectModule, NgApexchartsModule],
  templateUrl: './faturamento-visao-geral.component.html',
  styleUrls: ['./faturamento-visao-geral.component.scss']
})
export class FaturamentoVisaoGeralComponent {
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly themeConfig = toSignal(this.themeService.theme$, {
    initialValue: this.themeService.getCurrentTheme()
  });

  private readonly alertaDestinos: Record<string, AlertaNavegacao> = {
    fat: { path: '../faturas', queryParams: { filtro: 'vencidas' } },
    cob: { path: '../inadimplencia', queryParams: { filtro: 'semCobranca' } },
    fech: { path: '../fechamentos', queryParams: { filtro: 'andamento' } },
    env: { path: '../faturas', queryParams: { filtro: 'aguardando-envio' } }
  };

  readonly isDarkTheme = computed(() => {
    const mode = this.themeConfig().mode;
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  /* ── Filtros ──────────────────────────────────────────────────────── */
  readonly transportadoraFiltro = signal<string>('all');
  readonly estacionamentoFiltro = signal<string>('all');
  readonly modalidadeFiltro = signal<string>('all');
  readonly statusFiltro = signal<string>('all');
  readonly panelFiltrosAberto = signal(false);

  readonly transportadorasOpcoes = [
    'Transp. Horizonte Ltda', 'Logística Sul ME', 'Cargo Prime Transportes',
    'Rota Azul Logística', 'Expresso Centro Oeste'
  ];

  readonly estacionamentosOpcoes = [
    'Estac. Central', 'Estac. Norte', 'Estac. Sul', 'Estac. Leste', 'Estac. Oeste', 'Estac. Aeroporto'
  ];

  readonly modalidadesOpcoes = ['Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Por data personalizada'];

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

  /* ── Mock data ────────────────────────────────────────────────────── */
  readonly visaoCards = {
    totalReceber: 186_420.5,
    recebido: 124_800.0,
    emAberto: 48_320.75,
    vencido: 9_450.0,
    aVencer: 13_849.75
  };

  readonly visaoIndicadores = {
    faturasEmitidas: 56,
    faturasVencidas: 7,
    transportadorasFaturadas: 14,
    cobrancasPendentes: 11
  };

  readonly visaoEvolucaoMensal: BarraMes[] = [
    { mes: 'DEZ', valor: 38_000 },
    { mes: 'JAN', valor: 45_000 },
    { mes: 'FEV', valor: 62_000 },
    { mes: 'MAR', valor: 55_000 },
    { mes: 'ABR', valor: 74_000 },
    { mes: 'MAI', valor: 88_000 }
  ];

  readonly visaoPorStatus: StatusContagem[] = [
    { status: 'Pago', quantidade: 28 },
    { status: 'Em aberto', quantidade: 12 },
    { status: 'Vencido', quantidade: 5 },
    { status: 'Parcial', quantidade: 4 },
    { status: 'Aguardando envio', quantidade: 3 },
    { status: 'Cancelada', quantidade: 1 }
  ];

  readonly visaoPorModalidade: ModalidadeValor[] = [
    { modalidade: 'PIX', valor: 52_100 },
    { modalidade: 'Boleto', valor: 48_200 },
    { modalidade: 'Transferência', valor: 18_500 },
    { modalidade: 'Cartão', valor: 6_000 }
  ];

  readonly visaoAlertas: AlertaResumo[] = [
    { id: 'fat', titulo: 'Faturas vencidas', quantidade: 7, detalhe: 'Requer atenção imediata', icon: 'gpp_bad' },
    { id: 'cob', titulo: 'Cobranças pendentes', quantidade: 11, detalhe: 'Envio ou confirmação pendente', icon: 'mark_email_unread' },
    { id: 'fech', titulo: 'Fechamentos pendentes', quantidade: 2, detalhe: 'Períodos aguardando conferência', icon: 'fact_check' },
    { id: 'env', titulo: 'Faturas aguardando envio', quantidade: 3, detalhe: 'Ainda não disparadas ao cliente', icon: 'schedule_send' }
  ];

  readonly proximosVencimentos: ProximoVencimento[] = [
    { transportadora: 'Transp. Horizonte Ltda', valor: 4_200, vencimento: '14/05/2026', status: 'Em aberto' },
    { transportadora: 'Logística Sul ME', valor: 2_890.5, vencimento: '15/05/2026', status: 'Aguardando envio' },
    { transportadora: 'Cargo Prime Transportes', valor: 6_150, vencimento: '16/05/2026', status: 'Parcial' },
    { transportadora: 'Rota Azul Logística', valor: 1_980, vencimento: '18/05/2026', status: 'Em aberto' },
    { transportadora: 'Expresso Centro Oeste', valor: 3_310, vencimento: '08/05/2026', status: 'Vencido' }
  ];

  /* ── ApexCharts ───────────────────────────────────────────────────── */
  readonly evolutionChart: ApexChart = { type: 'area', height: 252, width: '100%', fontFamily: 'inherit', foreColor: '#8ea0b8', background: 'transparent', toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true, speed: 400 }, redrawOnParentResize: true, offsetX: 0, offsetY: 0 };
  readonly evolutionSeries: ApexAxisChartSeries = [{ name: 'Faturamento', data: this.visaoEvolucaoMensal.map((b) => b.valor) }];
  readonly evolutionXaxis: ApexXAxis = { categories: this.visaoEvolucaoMensal.map((b) => b.mes), labels: { style: { colors: '#8ea0b8', fontSize: '10px', fontWeight: 600 }, rotate: -38, rotateAlways: true, hideOverlappingLabels: true, trim: true, maxHeight: 64 }, axisBorder: { show: false }, axisTicks: { show: false }, crosshairs: { show: false }, tooltip: { enabled: false } };
  readonly evolutionYaxis: ApexYAxis = { labels: { align: 'right', offsetX: 2, style: { fontSize: '10px', colors: '#8ea0b8' }, formatter: (val: string | number) => { const n = Number(val); if (!Number.isFinite(n)) return ''; if (Math.abs(n) >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`; if (Math.abs(n) >= 1_000) return `${Math.round(n / 100) / 10}k`; return String(Math.round(n)); } } };
  readonly evolutionStroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly evolutionFill: ApexFill = { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.42, opacityTo: 0.03, stops: [0, 100] } };
  readonly evolutionGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.22)', strokeDashArray: 4, padding: { top: 6, right: 4, bottom: 40, left: 48 }, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } };
  readonly evolutionTooltip: ApexTooltip = { theme: 'dark', custom: (opts: { dataPointIndex?: number }) => { const idx = opts.dataPointIndex ?? -1; const row = idx >= 0 ? this.visaoEvolucaoMensal[idx] : undefined; if (!row) return '<div class="visao-evolucao-tooltip"></div>'; return '<div class="visao-evolucao-tooltip"><div class="visao-evolucao-tooltip__mes">' + this.escapeHtml(row.mes) + '</div><div class="visao-evolucao-tooltip__valor">' + this.escapeHtml(this.formatCurrency(row.valor)) + '</div></div>'; } };
  readonly evolutionDataLabels: ApexDataLabels = { enabled: false };

  readonly statusChart: ApexChart = { type: 'bar', height: 252, fontFamily: 'inherit', foreColor: '#8ea0b8', background: 'transparent', toolbar: { show: false } };
  readonly statusSeries: ApexAxisChartSeries = [{ name: 'Quantidade', data: this.visaoPorStatus.map((s) => s.quantidade) }];
  readonly statusPlotOptions: ApexPlotOptions = { bar: { horizontal: true, borderRadius: 4, barHeight: '68%', distributed: false, dataLabels: { position: 'top' } } };
  readonly statusXaxis: ApexXAxis = { categories: this.visaoPorStatus.map((s) => s.status), labels: { style: { colors: '#8ea0b8', fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } };
  readonly statusDataLabels: ApexDataLabels = { enabled: true, formatter: (val: number, opts: { dataPointIndex?: number }) => { const idx = opts?.dataPointIndex ?? 0; const q = this.visaoPorStatus[idx]?.quantidade ?? Number(val); return `${q} (${this.pctStatus(q)}%)`; }, offsetX: 6, style: { colors: ['#f8fafc'], fontSize: '11px', fontWeight: 600 } };
  readonly statusGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.2)', padding: { top: 0, right: 12, bottom: 0, left: 0 }, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } };

  readonly modalChart: ApexChart = { type: 'bar', height: 252, fontFamily: 'inherit', foreColor: '#8ea0b8', background: 'transparent', toolbar: { show: false } };
  readonly modalSeries: ApexAxisChartSeries = [{ name: 'Valor', data: this.visaoPorModalidade.map((m) => m.valor) }];
  readonly modalPlotOptions: ApexPlotOptions = { bar: { horizontal: true, borderRadius: 4, barHeight: '70%', dataLabels: { position: 'end' } } };
  readonly modalXaxis: ApexXAxis = { categories: this.visaoPorModalidade.map((m) => m.modalidade), labels: { style: { colors: '#8ea0b8', fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } };
  readonly modalDataLabels: ApexDataLabels = { enabled: true, formatter: (val: number) => this.formatCurrency(Number(val)), offsetX: 4, style: { colors: ['#f8fafc'], fontSize: '11px', fontWeight: 600 } };
  readonly modalGrid: ApexGrid = { borderColor: 'rgba(148, 163, 184, 0.2)', padding: { top: 0, right: 8, bottom: 0, left: 0 }, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } };

  readonly statusTooltip: ApexTooltip = { theme: 'dark', y: { formatter: (val: number) => String(val) } };
  readonly modalTooltip: ApexTooltip = { theme: 'dark', y: { formatter: (val: number) => this.formatCurrency(val) } };
  readonly chartColors = ['#3b82f6'];
  readonly chartTheme: ApexTheme = { mode: 'dark', monochrome: { enabled: false } };

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
    this.arrastandoPeriodo.set(false);
    this.arrasteAnchor.set(null);
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
    this.periodoGranularidade.set('dia');
  }

  selecionarAnoCalendario(ano: number): void {
    this.calendarioAno.set(ano);
    this.periodoGranularidade.set('mes');
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
  abrirAlerta(id: string): void {
    const dest = this.alertaDestinos[id];
    if (!dest) return;
    void this.router.navigate([dest.path], {
      relativeTo: this.route,
      queryParams: dest.queryParams
    });
  }

  abrirProximoVencimento(row: ProximoVencimento): void {
    const queryParams: Record<string, string> = {
      transportadora: row.transportadora
    };

    if (row.status === 'Vencido') {
      queryParams['filtro'] = 'vencidas';
    } else if (row.status === 'Aguardando envio') {
      queryParams['filtro'] = 'aguardando-envio';
    } else if (row.status === 'Pago') {
      queryParams['filtro'] = 'pagas';
    } else {
      queryParams['status'] = row.status;
    }

    void this.router.navigate(['../faturas'], {
      relativeTo: this.route,
      queryParams
    });
  }

  /* ── Utilities ────────────────────────────────────────────────────── */
  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  totalQuantidadeStatus(): number {
    return this.visaoPorStatus.reduce((a, s) => a + s.quantidade, 0) || 1;
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
