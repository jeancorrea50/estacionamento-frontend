import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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

import type { FaturaStatusVisao, PeriodoFiltroId } from '../faturamento-visao.types';

interface PeriodoOpcao {
  id: PeriodoFiltroId;
  label: string;
}

interface BarraMes {
  mes: string;
  valor: number;
}

interface StatusContagem {
  status: FaturaStatusVisao;
  quantidade: number;
}

interface ModalidadeValor {
  modalidade: string;
  valor: number;
}

interface AlertaResumo {
  id: string;
  titulo: string;
  quantidade: number;
  detalhe: string;
  icon: string;
}

interface ProximoVencimento {
  transportadora: string;
  valor: number;
  vencimento: string;
  status: FaturaStatusVisao;
}

@Component({
  selector: 'app-faturamento-visao-geral',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    NgApexchartsModule
  ],
  templateUrl: './faturamento-visao-geral.component.html',
  styleUrls: ['./faturamento-visao-geral.component.scss']
})
export class FaturamentoVisaoGeralComponent {
  readonly periodoOpcoes: PeriodoOpcao[] = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'semana', label: 'Esta semana' },
    { id: 'mes', label: 'Este mês' },
    { id: 'personalizado', label: 'Personalizado' }
  ];

  readonly periodoFiltro = signal<PeriodoFiltroId>('semana');
  dataInicioPersonalizado = '';
  dataFimPersonalizado = '';

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
    {
      id: 'fat',
      titulo: 'Faturas vencidas',
      quantidade: 7,
      detalhe: 'Requer atenção imediata',
      icon: 'gpp_bad'
    },
    {
      id: 'cob',
      titulo: 'Cobranças pendentes',
      quantidade: 11,
      detalhe: 'Envio ou confirmação pendente',
      icon: 'mark_email_unread'
    },
    {
      id: 'fech',
      titulo: 'Fechamentos pendentes',
      quantidade: 2,
      detalhe: 'Períodos aguardando conferência',
      icon: 'fact_check'
    },
    {
      id: 'env',
      titulo: 'Faturas aguardando envio',
      quantidade: 3,
      detalhe: 'Ainda não disparadas ao cliente',
      icon: 'schedule_send'
    }
  ];

  /** Ordem fixa conforme especificação (mock). */
  readonly proximosVencimentos: ProximoVencimento[] = [
    {
      transportadora: 'Transp. Horizonte Ltda',
      valor: 4_200,
      vencimento: '14/05/2026',
      status: 'Em aberto'
    },
    {
      transportadora: 'Logística Sul ME',
      valor: 2_890.5,
      vencimento: '15/05/2026',
      status: 'Aguardando envio'
    },
    {
      transportadora: 'Cargo Prime Transportes',
      valor: 6_150,
      vencimento: '16/05/2026',
      status: 'Parcial'
    },
    {
      transportadora: 'Rota Azul Logística',
      valor: 1_980,
      vencimento: '18/05/2026',
      status: 'Em aberto'
    },
    {
      transportadora: 'Expresso Centro Oeste',
      valor: 3_310,
      vencimento: '08/05/2026',
      status: 'Vencido'
    }
  ];

  readonly evolutionChart: ApexChart = {
    type: 'area',
    height: 252,
    width: '100%',
    fontFamily: 'inherit',
    foreColor: '#8ea0b8',
    background: 'transparent',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, speed: 400 },
    redrawOnParentResize: true,
    offsetX: 0,
    offsetY: 0
  };

  readonly evolutionSeries: ApexAxisChartSeries = [
    {
      name: 'Faturamento',
      data: this.visaoEvolucaoMensal.map((b) => b.valor)
    }
  ];

  readonly evolutionXaxis: ApexXAxis = {
    categories: this.visaoEvolucaoMensal.map((b) => b.mes),
    labels: {
      style: { colors: '#8ea0b8', fontSize: '10px', fontWeight: 600 },
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
  };

  /** Eixo Y à esquerda: rótulos curtos; não usar minWidth 0 (colapsa a faixa e o gráfico sobrepõe os números). */
  readonly evolutionYaxis: ApexYAxis = {
    labels: {
      align: 'right',
      offsetX: 2,
      style: { fontSize: '10px', colors: '#8ea0b8' },
      formatter: (val: string | number) => {
        const n = Number(val);
        if (!Number.isFinite(n)) return '';
        if (Math.abs(n) >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
        if (Math.abs(n) >= 1_000) return `${Math.round(n / 100) / 10}k`;
        return String(Math.round(n));
      }
    }
  };

  readonly evolutionStroke: ApexStroke = {
    curve: 'smooth',
    width: 2
  };

  readonly evolutionFill: ApexFill = {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.42,
      opacityTo: 0.03,
      stops: [0, 100]
    }
  };

  readonly evolutionGrid: ApexGrid = {
    borderColor: 'rgba(148, 163, 184, 0.22)',
    strokeDashArray: 4,
    padding: { top: 6, right: 4, bottom: 40, left: 48 },
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } }
  };

  /** Tooltip só com mês + valor (sem coluna lateral de marcador/nome da série). */
  readonly evolutionTooltip: ApexTooltip = {
    theme: 'dark',
    custom: (opts: { dataPointIndex?: number }) => {
      const idx = opts.dataPointIndex ?? -1;
      const row = idx >= 0 ? this.visaoEvolucaoMensal[idx] : undefined;
      if (!row) {
        return '<div class="visao-evolucao-tooltip"></div>';
      }
      const mes = row.mes;
      const val = row.valor;
      return (
        '<div class="visao-evolucao-tooltip">' +
        '<div class="visao-evolucao-tooltip__mes">' +
        this.escapeHtml(mes) +
        '</div>' +
        '<div class="visao-evolucao-tooltip__valor">' +
        this.escapeHtml(this.formatCurrency(val)) +
        '</div>' +
        '</div>'
      );
    }
  };

  readonly evolutionDataLabels: ApexDataLabels = { enabled: false };

  readonly statusChart: ApexChart = {
    type: 'bar',
    height: 252,
    fontFamily: 'inherit',
    foreColor: '#8ea0b8',
    background: 'transparent',
    toolbar: { show: false }
  };

  readonly statusSeries: ApexAxisChartSeries = [
    {
      name: 'Quantidade',
      data: this.visaoPorStatus.map((s) => s.quantidade)
    }
  ];

  readonly statusPlotOptions: ApexPlotOptions = {
    bar: {
      horizontal: true,
      borderRadius: 4,
      barHeight: '68%',
      distributed: false,
      dataLabels: { position: 'top' }
    }
  };

  readonly statusXaxis: ApexXAxis = {
    categories: this.visaoPorStatus.map((s) => s.status),
    labels: { style: { colors: '#8ea0b8', fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false }
  };

  readonly statusDataLabels: ApexDataLabels = {
    enabled: true,
    formatter: (val: number, opts: { dataPointIndex?: number }) => {
      const idx = opts?.dataPointIndex ?? 0;
      const q = this.visaoPorStatus[idx]?.quantidade ?? Number(val);
      const pct = this.pctStatus(q);
      return `${q} (${pct}%)`;
    },
    offsetX: 6,
    style: { colors: ['#f8fafc'], fontSize: '11px', fontWeight: 600 }
  };

  readonly statusGrid: ApexGrid = {
    borderColor: 'rgba(148, 163, 184, 0.2)',
    padding: { top: 0, right: 12, bottom: 0, left: 0 },
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: false } }
  };

  readonly modalChart: ApexChart = {
    type: 'bar',
    height: 252,
    fontFamily: 'inherit',
    foreColor: '#8ea0b8',
    background: 'transparent',
    toolbar: { show: false }
  };

  readonly modalSeries: ApexAxisChartSeries = [
    {
      name: 'Valor',
      data: this.visaoPorModalidade.map((m) => m.valor)
    }
  ];

  readonly modalPlotOptions: ApexPlotOptions = {
    bar: {
      horizontal: true,
      borderRadius: 4,
      barHeight: '70%',
      dataLabels: { position: 'end' }
    }
  };

  readonly modalXaxis: ApexXAxis = {
    categories: this.visaoPorModalidade.map((m) => m.modalidade),
    labels: { style: { colors: '#8ea0b8', fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false }
  };

  readonly modalDataLabels: ApexDataLabels = {
    enabled: true,
    formatter: (val: number) => this.formatCurrency(Number(val)),
    offsetX: 4,
    style: { colors: ['#f8fafc'], fontSize: '11px', fontWeight: 600 }
  };

  readonly modalGrid: ApexGrid = {
    borderColor: 'rgba(148, 163, 184, 0.2)',
    padding: { top: 0, right: 8, bottom: 0, left: 0 },
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: false } }
  };

  readonly statusTooltip: ApexTooltip = {
    theme: 'dark',
    y: {
      formatter: (val: number) => String(val)
    }
  };

  readonly modalTooltip: ApexTooltip = {
    theme: 'dark',
    y: {
      formatter: (val: number) => this.formatCurrency(val)
    }
  };

  readonly chartColors = ['#3b82f6'];

  readonly chartTheme: ApexTheme = {
    mode: 'dark',
    monochrome: { enabled: false }
  };

  setPeriodo(id: PeriodoFiltroId): void {
    this.periodoFiltro.set(id);
  }

  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
}
