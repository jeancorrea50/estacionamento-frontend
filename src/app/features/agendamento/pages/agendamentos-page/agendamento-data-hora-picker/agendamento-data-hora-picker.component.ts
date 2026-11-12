import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../../../../core/services/theme.service';
import { FaturamentoDataPickerPanelDirective } from '../../../../financeiro/pages/faturamento-page/shared/faturamento-data-picker-panel.directive';
import {
  MovimentosPeriodoCelula,
  MovimentosPeriodoGranularidade,
  criarDataHoje,
  montarGradeCalendario,
  toIsoDate,
} from '../../../../movimentos/pages/movimentos-page/movimentos-filtros.util';

/** Valor no formato `YYYY-MM-DDTHH:mm` (datetime-local). */
export type AgendamentoDataHoraValue = string;

function parseDateTimeLocal(value: string | null | undefined): {
  date: Date;
  hour: number;
  minute: number;
} | null {
  const raw = String(value ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  return { date, hour, minute };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateTimeLocal(date: Date, hour: number, minute: number): string {
  return `${toIsoDate(date)}T${pad2(hour)}:${pad2(minute)}`;
}

@Component({
  selector: 'app-agendamento-data-hora-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, FaturamentoDataPickerPanelDirective],
  templateUrl: './agendamento-data-hora-picker.component.html',
  styleUrls: ['./agendamento-data-hora-picker.component.scss'],
})
export class AgendamentoDataHoraPickerComponent {
  private readonly themeService = inject(ThemeService);

  /** Valor controlado pelo formulário (`YYYY-MM-DDTHH:mm`). */
  readonly value = input<AgendamentoDataHoraValue>('');
  readonly ariaLabel = input('Selecionar data e hora');

  readonly valueChange = output<AgendamentoDataHoraValue>();

  readonly panelAberto = signal(false);
  readonly dataSelecionada = signal(criarDataHoje());
  readonly hora = signal(0);
  readonly minuto = signal(0);
  readonly granularidade = signal<MovimentosPeriodoGranularidade>('dia');
  readonly calendarioAno = signal(new Date().getFullYear());
  readonly calendarioMes = signal(new Date().getMonth());

  readonly periodoGranularidadeOpcoes: { id: MovimentosPeriodoGranularidade; label: string }[] = [
    { id: 'dia', label: 'Dia' },
    { id: 'mes', label: 'Mês' },
    { id: 'ano', label: 'Ano' },
  ];

  readonly diasSemanaLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  readonly mesesLabels = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  readonly horasOpcoes = Array.from({ length: 24 }, (_, i) => i);
  readonly minutosOpcoes = Array.from({ length: 60 }, (_, i) => i);

  constructor() {
    effect(() => {
      const parsed = parseDateTimeLocal(this.value());
      if (!parsed) return;
      this.dataSelecionada.set(parsed.date);
      this.hora.set(parsed.hour);
      this.minuto.set(parsed.minute);
      this.calendarioAno.set(parsed.date.getFullYear());
      this.calendarioMes.set(parsed.date.getMonth());
    });
  }

  isDarkTheme(): boolean {
    return this.themeService.getCurrentTheme().mode !== 'light';
  }

  labelTrigger(): string {
    const d = this.dataSelecionada();
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy} ${pad2(this.hora())}:${pad2(this.minuto())}`;
  }

  togglePanel(event: MouseEvent): void {
    event.stopPropagation();
    this.panelAberto.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.panelAberto()) this.panelAberto.set(false);
  }

  setGranularidade(g: MovimentosPeriodoGranularidade): void {
    this.granularidade.set(g);
  }

  calendarioTituloMes(): string {
    const nomes = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
    ];
    return `${nomes[this.calendarioMes()]} de ${this.calendarioAno()}`;
  }

  calendarioGrade(): MovimentosPeriodoCelula[] {
    return montarGradeCalendario(this.calendarioAno(), this.calendarioMes());
  }

  calendarioAnosOpcoes(): number[] {
    const base = this.calendarioAno();
    const start = base - 5;
    return Array.from({ length: 12 }, (_, i) => start + i);
  }

  mesCalendarioAnterior(): void {
    const m = this.calendarioMes() - 1;
    if (m < 0) {
      this.calendarioMes.set(11);
      this.calendarioAno.update((y) => y - 1);
    } else {
      this.calendarioMes.set(m);
    }
  }

  mesCalendarioProximo(): void {
    const m = this.calendarioMes() + 1;
    if (m > 11) {
      this.calendarioMes.set(0);
      this.calendarioAno.update((y) => y + 1);
    } else {
      this.calendarioMes.set(m);
    }
  }

  anoCalendarioAnterior(): void {
    this.calendarioAno.update((y) => y - 1);
  }

  anoCalendarioProximo(): void {
    this.calendarioAno.update((y) => y + 1);
  }

  diaCalendarioModificadores(cell: MovimentosPeriodoCelula): Record<string, boolean> {
    const sel = this.dataSelecionada();
    const mesmoDia =
      cell.date.getFullYear() === sel.getFullYear() &&
      cell.date.getMonth() === sel.getMonth() &&
      cell.date.getDate() === sel.getDate();
    return {
      'rec-cal__dia--fora': !cell.inMonth,
      'rec-cal__dia--selecionado': mesmoDia,
    };
  }

  mesCalendarioModificadores(mes: number): Record<string, boolean> {
    const sel = this.dataSelecionada();
    return {
      'rec-cal__mes--ativo':
        sel.getFullYear() === this.calendarioAno() && sel.getMonth() === mes,
    };
  }

  anoCalendarioModificadores(ano: number): Record<string, boolean> {
    return {
      'rec-cal__ano--ativo': this.dataSelecionada().getFullYear() === ano,
    };
  }

  onDiaClick(cell: MovimentosPeriodoCelula, event: MouseEvent): void {
    event.stopPropagation();
    if (!cell.inMonth) {
      this.calendarioAno.set(cell.date.getFullYear());
      this.calendarioMes.set(cell.date.getMonth());
    }
    this.dataSelecionada.set(new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate()));
    this.emitir();
  }

  onMesClick(mes: number, event: MouseEvent): void {
    event.stopPropagation();
    const ano = this.calendarioAno();
    const diaAtual = this.dataSelecionada().getDate();
    const ultimo = new Date(ano, mes + 1, 0).getDate();
    const dia = Math.min(diaAtual, ultimo);
    this.calendarioMes.set(mes);
    this.dataSelecionada.set(new Date(ano, mes, dia));
    this.granularidade.set('dia');
    this.emitir();
  }

  onAnoClick(ano: number, event: MouseEvent): void {
    event.stopPropagation();
    const mes = this.dataSelecionada().getMonth();
    const diaAtual = this.dataSelecionada().getDate();
    const ultimo = new Date(ano, mes + 1, 0).getDate();
    const dia = Math.min(diaAtual, ultimo);
    this.calendarioAno.set(ano);
    this.dataSelecionada.set(new Date(ano, mes, dia));
    this.granularidade.set('mes');
    this.emitir();
  }

  onHoraChange(hora: number): void {
    this.hora.set(hora);
    this.emitir();
  }

  onMinutoChange(minuto: number): void {
    this.minuto.set(minuto);
    this.emitir();
  }

  private emitir(): void {
    this.valueChange.emit(toDateTimeLocal(this.dataSelecionada(), this.hora(), this.minuto()));
  }
}
