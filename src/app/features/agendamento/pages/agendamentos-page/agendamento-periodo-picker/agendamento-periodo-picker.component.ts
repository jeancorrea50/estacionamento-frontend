import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  inject,
  output,
  signal
} from '@angular/core';
import { ThemeService } from '../../../../../core/services/theme.service';
import { FaturamentoDataPickerPanelDirective } from '../../../../financeiro/pages/faturamento-page/shared/faturamento-data-picker-panel.directive';
import {
  MovimentosPeriodoCelula,
  MovimentosPeriodoGranularidade,
  aplicarGranularidadeAno,
  aplicarGranularidadeAoSelecionarDia,
  aplicarGranularidadeMes,
  criarDataHoje,
  formatarPeriodoLabel,
  montarGradeCalendario,
  toIsoDate
} from '../../../../movimentos/pages/movimentos-page/movimentos-filtros.util';

export interface AgendamentoPeriodoSelecionado {
  ativo: boolean;
  dataInicial: string;
  dataFinal: string;
}

@Component({
  selector: 'app-agendamento-periodo-picker',
  standalone: true,
  imports: [CommonModule, FaturamentoDataPickerPanelDirective],
  templateUrl: './agendamento-periodo-picker.component.html',
  styleUrls: ['./agendamento-periodo-picker.component.scss']
})
export class AgendamentoPeriodoPickerComponent {
  private readonly themeService = inject(ThemeService);

  readonly periodoChange = output<AgendamentoPeriodoSelecionado>();

  readonly panelAberto = signal(false);
  readonly periodoAtivo = signal(false);
  readonly dataInicio = signal(criarDataHoje());
  readonly dataFim = signal(criarDataHoje());
  readonly granularidade = signal<MovimentosPeriodoGranularidade>('dia');

  readonly calendarioAno = signal(new Date().getFullYear());
  readonly calendarioMes = signal(new Date().getMonth());
  readonly arrastandoPeriodo = signal(false);
  private arrasteAnchor: Date | null = null;

  readonly periodoGranularidadeOpcoes: { id: MovimentosPeriodoGranularidade; label: string }[] = [
    { id: 'dia', label: 'Dia' },
    { id: 'semana', label: 'Semana' },
    { id: 'mes', label: 'Mês' },
    { id: 'ano', label: 'Ano' }
  ];

  readonly diasSemanaLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  readonly mesesLabels = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  isDarkTheme(): boolean {
    return this.themeService.getCurrentTheme().mode !== 'light';
  }

  periodoLabel(): string {
    if (!this.periodoAtivo()) return 'Qualquer período';
    return formatarPeriodoLabel(this.dataInicio(), this.dataFim(), this.granularidade());
  }

  togglePanel(event: MouseEvent): void {
    event.stopPropagation();
    this.panelAberto.update((v) => !v);
  }

  limparPeriodo(event?: MouseEvent): void {
    event?.stopPropagation();
    this.periodoAtivo.set(false);
    this.panelAberto.set(false);
    this.emitPeriodo();
  }

  setPeriodoGranularidade(id: MovimentosPeriodoGranularidade): void {
    this.granularidade.set(id);
    this.calendarioAno.set(this.dataInicio().getFullYear());
    this.calendarioMes.set(this.dataInicio().getMonth());
  }

  calendarioTituloMes(): string {
    const ref = new Date(this.calendarioAno(), this.calendarioMes(), 1);
    return ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  calendarioGrade(): MovimentosPeriodoCelula[] {
    return montarGradeCalendario(this.calendarioAno(), this.calendarioMes());
  }

  calendarioAnosOpcoes(): number[] {
    const base = this.calendarioAno();
    const start = base - 6;
    return Array.from({ length: 12 }, (_, i) => start + i);
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

  onDiaCalendarioPointerDown(cell: MovimentosPeriodoCelula, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.navegarParaMesDoDia(cell);
    const g = this.granularidade();
    if (g === 'dia') {
      this.arrastandoPeriodo.set(true);
      this.arrasteAnchor = cell.date;
      this.definirIntervaloDias(cell.date, cell.date);
    } else {
      const range = aplicarGranularidadeAoSelecionarDia(g, cell.date);
      this.aplicarRange(range.inicio, range.fim);
    }
  }

  onDiaCalendarioPointerEnter(cell: MovimentosPeriodoCelula): void {
    if (!this.arrastandoPeriodo() || this.granularidade() !== 'dia') return;
    const anchor = this.arrasteAnchor;
    if (!anchor) return;
    this.navegarParaMesDoDia(cell);
    this.definirIntervaloDias(anchor, cell.date);
  }

  selecionarMesCalendario(mesIndex: number): void {
    const ano = this.calendarioAno();
    const range = aplicarGranularidadeMes(ano, mesIndex);
    this.calendarioMes.set(mesIndex);
    this.granularidade.set('mes');
    this.aplicarRange(range.inicio, range.fim);
  }

  selecionarAnoCalendario(ano: number): void {
    const range = aplicarGranularidadeAno(ano);
    this.calendarioAno.set(ano);
    this.granularidade.set('ano');
    this.aplicarRange(range.inicio, range.fim);
  }

  diaCalendarioModificadores(cell: MovimentosPeriodoCelula): Record<string, boolean> {
    if (!this.periodoAtivo()) {
      return { 'rec-cal__dia--fora': !cell.inMonth };
    }
    const iso = cell.iso;
    const ini = toIsoDate(this.dataInicio());
    const fim = toIsoDate(this.dataFim());
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
    const ativo =
      this.periodoAtivo() &&
      this.granularidade() === 'mes' &&
      this.dataInicio().getFullYear() === this.calendarioAno() &&
      this.dataInicio().getMonth() === mesIndex;
    return { 'rec-cal__mes--ativo': ativo };
  }

  anoCalendarioModificadores(ano: number): Record<string, boolean> {
    const ativo =
      this.periodoAtivo() &&
      this.granularidade() === 'ano' &&
      this.dataInicio().getFullYear() === ano;
    return { 'rec-cal__ano--ativo': ativo };
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.panelAberto()) this.panelAberto.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.ag-periodo-picker')) {
      this.panelAberto.set(false);
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.arrastandoPeriodo.set(false);
    this.arrasteAnchor = null;
  }

  private aplicarRange(inicio: Date, fim: Date): void {
    this.periodoAtivo.set(true);
    this.dataInicio.set(inicio);
    this.dataFim.set(fim);
    this.emitPeriodo();
  }

  private definirIntervaloDias(a: Date, b: Date): void {
    const aT = a.getTime();
    const bT = b.getTime();
    const inicio = new Date(Math.min(aT, bT));
    const fim = new Date(Math.max(aT, bT));
    this.aplicarRange(
      new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()),
      new Date(fim.getFullYear(), fim.getMonth(), fim.getDate())
    );
  }

  private navegarParaMesDoDia(cell: MovimentosPeriodoCelula): void {
    this.calendarioAno.set(cell.date.getFullYear());
    this.calendarioMes.set(cell.date.getMonth());
  }

  private emitPeriodo(): void {
    if (!this.periodoAtivo()) {
      this.periodoChange.emit({ ativo: false, dataInicial: '', dataFinal: '' });
      return;
    }
    this.periodoChange.emit({
      ativo: true,
      dataInicial: toIsoDate(this.dataInicio()),
      dataFinal: toIsoDate(this.dataFim())
    });
  }
}
