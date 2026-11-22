import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts';
import type {
  ApexAnnotations,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';
import { ThemeService } from '../../../../../core/services/theme.service';
import type { AgendamentoTimelineSlot } from '../agendamento-dashboard.util';
import {
  donutConicGradient,
  flexBar,
  segmentosBarraSlot,
  somarOcupacaoDia,
  toIsoDateLocal,
} from '../agendamento-dashboard.util';

export type AgendamentoDiaVista = 'timeline' | 'grafico';

@Component({
  selector: 'app-agendamento-dia-timeline',
  standalone: true,
  imports: [CommonModule, RouterLink, NgApexchartsModule],
  templateUrl: './agendamento-dia-timeline.component.html',
  styleUrl: './agendamento-dia-timeline.component.scss',
})
export class AgendamentoDiaTimelineComponent {
  private readonly themeService = inject(ThemeService);
  private readonly themeConfig = toSignal(this.themeService.theme$, {
    initialValue: this.themeService.getCurrentTheme(),
  });

  readonly dataLabel = input.required<string>();
  /** ISO `yyyy-MM-dd` do dia exibido — usado na linha “Horário Atual”. */
  readonly dataIso = input<string | null>(null);
  readonly slots = input.required<AgendamentoTimelineSlot[]>();
  readonly loading = input(false);
  readonly erro = input<string | null>(null);
  readonly janelasRoute = input<string | null>(null);
  readonly podeVerJanelas = input(false);

  readonly vista = signal<AgendamentoDiaVista>('timeline');
  readonly flexBar = flexBar;

  readonly isDarkTheme = computed(() => {
    const mode = this.themeConfig().mode;
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  private readonly chartAxisColor = computed(() => (this.isDarkTheme() ? '#8ea0b8' : '#4870a0'));
  private readonly chartGridColor = computed(() =>
    this.isDarkTheme() ? 'rgba(148, 163, 184, 0.22)' : 'rgba(72, 112, 160, 0.22)'
  );
  private readonly chartCrosshair = computed(() =>
    this.isDarkTheme() ? 'rgba(241, 241, 245, 0.55)' : 'rgba(15, 23, 42, 0.35)'
  );

  readonly ocupacaoDia = computed(() => somarOcupacaoDia(this.slots()));
  readonly donutBackground = computed(() => donutConicGradient(this.ocupacaoDia()));
  readonly donutTemDados = computed(() => {
    const d = this.ocupacaoDia();
    return d.disponiveis + d.agendado + d.ocupado + d.capacidade > 0;
  });

  readonly maxEixo = computed(() => {
    const vals = this.slots().map((s) => Math.max(s.cadastrado, s.agendado, s.ocupado, 1));
    const max = vals.length ? Math.max(...vals) : 1;
    return Math.max(1, Math.ceil(max));
  });

  readonly chartCategories = computed(() => this.slots().map((s) => this.rotuloCurto(s)));

  readonly chartSeries = computed<ApexAxisChartSeries>(() => {
    const slots = this.slots();
    return [
      {
        name: 'Disponível',
        type: 'area',
        data: slots.map((s) => s.cadastrado),
      },
      {
        name: 'Agendado',
        type: 'line',
        data: slots.map((s) => s.agendado),
      },
    ];
  });

  readonly chartOptions = computed<ApexChart>(() => ({
    type: 'area',
    height: 280,
    width: '100%',
    fontFamily: 'inherit',
    foreColor: this.chartAxisColor(),
    background: 'transparent',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, speed: 450 },
    redrawOnParentResize: true,
  }));

  readonly chartColors = computed(() =>
    this.isDarkTheme() ? ['#36c98f', '#e8a23a'] : ['#4ade80', '#f59e0b']
  );

  readonly chartStroke: ApexStroke = {
    curve: 'smooth',
    width: [3, 3],
  };

  readonly chartFill = computed<ApexFill>(() => ({
    type: ['gradient', 'solid'],
    gradient: {
      shadeIntensity: 1,
      type: 'vertical',
      opacityFrom: this.isDarkTheme() ? 0.55 : 0.42,
      opacityTo: this.isDarkTheme() ? 0.04 : 0.06,
      stops: [0, 90, 100],
    },
  }));

  readonly chartMarkers = computed<ApexMarkers>(() => ({
    size: [5, 5],
    strokeColors: this.isDarkTheme() ? '#1d1d27' : '#ffffff',
    strokeWidth: 2,
    hover: { sizeOffset: 2 },
  }));

  readonly chartDataLabels: ApexDataLabels = { enabled: false };

  readonly chartLegend: ApexLegend = { show: false };

  readonly chartGrid = computed<ApexGrid>(() => ({
    borderColor: this.chartGridColor(),
    strokeDashArray: 4,
    padding: { top: 8, right: 12, bottom: 4, left: 8 },
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
  }));

  readonly chartXaxis = computed<ApexXAxis>(() => ({
    categories: this.chartCategories(),
    labels: {
      style: { colors: this.chartAxisColor(), fontSize: '11px', fontWeight: 600 },
      rotate: 0,
      hideOverlappingLabels: true,
      trim: false,
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
    tooltip: { enabled: false },
    crosshairs: {
      show: true,
      position: 'front',
      stroke: {
        color: this.chartCrosshair(),
        width: 1,
        dashArray: 4,
      },
    },
  }));

  readonly chartYaxis = computed<ApexYAxis>(() => {
    const max = this.maxEixo();
    return {
      min: 0,
      max,
      tickAmount: Math.min(4, max),
      forceNiceScale: true,
      labels: {
        style: { colors: this.chartAxisColor(), fontSize: '11px' },
        formatter: (val: string | number) => {
          const n = Number(val);
          if (!Number.isFinite(n)) return '';
          return String(Math.round(n));
        },
      },
    };
  });

  readonly chartTooltip = computed<ApexTooltip>(() => {
    const dark = this.isDarkTheme();
    const bg = dark ? '#1d1d27' : '#ffffff';
    const border = dark ? '#363642' : '#e2e8f0';
    const muted = dark ? '#92929f' : '#64748b';
    const text = dark ? '#f1f1f5' : '#1f2937';
    const row = (label: string, value: number, first = false) =>
      `<div style="display:flex;justify-content:space-between;gap:14px;${first ? '' : 'margin-top:4px;'}">` +
      `<span style="color:${muted}">${label}</span>` +
      `<strong style="color:${text};font-variant-numeric:tabular-nums">${value}</strong></div>`;

    return {
      shared: true,
      intersect: false,
      theme: dark ? 'dark' : 'light',
      custom: (opts: { dataPointIndex?: number }) => {
        const idx = opts.dataPointIndex ?? -1;
        const slot = idx >= 0 ? this.slots()[idx] : undefined;
        if (!slot) return '';
        return (
          `<div style="min-width:136px;padding:10px 12px;border-radius:8px;background:${bg};border:1px solid ${border};box-shadow:0 8px 20px rgba(0,0,0,.35);font-size:12px;line-height:1.35">` +
          row('Vagas', slot.cadastrado, true) +
          row('Agendados', slot.agendado) +
          row('Ocupados', slot.ocupado) +
          `</div>`
        );
      },
    };
  });

  readonly chartAnnotations = computed<ApexAnnotations>(() => {
    const label = this.horarioAtualCategory();
    if (!label) return {};
    const fg = this.isDarkTheme() ? '#f1f1f5' : '#1f2937';
    return {
      xaxis: [
        {
          x: label,
          borderColor: fg,
          strokeDashArray: 5,
          borderWidth: 1,
          label: {
            text: 'Horário Atual',
            orientation: 'horizontal',
            position: 'top',
            offsetY: 0,
            borderWidth: 0,
            style: {
              color: fg,
              background: 'transparent',
              fontSize: '11px',
              fontWeight: 600,
            },
          },
        },
      ],
    };
  });

  definirVista(v: AgendamentoDiaVista): void {
    this.vista.set(v);
  }

  segmentos(s: AgendamentoTimelineSlot) {
    return segmentosBarraSlot(s);
  }

  rotuloCurto(s: AgendamentoTimelineSlot): string {
    const hi = (s.horaInicio || '').slice(0, 5);
    return hi || s.label;
  }

  /** Evita rótulo % em fatias estreitas demais. */
  mostrarPct(pct: number): boolean {
    return pct >= 12;
  }

  /**
   * Categoria (rótulo do eixo X) do slot que contém o horário atual,
   * somente quando o dia exibido é hoje.
   */
  private horarioAtualCategory(): string | null {
    const iso = (this.dataIso() || '').trim() || null;
    const hoje = toIsoDateLocal(new Date());
    if (!iso || iso !== hoje) return null;

    const slots = this.slots();
    if (!slots.length) return null;

    const now = new Date();
    const minutosAgora = now.getHours() * 60 + now.getMinutes();

    let match: AgendamentoTimelineSlot | null = null;
    for (const s of slots) {
      const ini = this.parseHoraMinutos(s.horaInicio);
      const fim = this.parseHoraMinutos(s.horaFim);
      if (ini == null) continue;
      if (fim != null && minutosAgora >= ini && minutosAgora < fim) {
        match = s;
        break;
      }
      if (minutosAgora >= ini) match = s;
    }
    return match ? this.rotuloCurto(match) : null;
  }

  private parseHoraMinutos(raw: string | null | undefined): number | null {
    const m = String(raw ?? '')
      .trim()
      .match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    return h * 60 + min;
  }
}
