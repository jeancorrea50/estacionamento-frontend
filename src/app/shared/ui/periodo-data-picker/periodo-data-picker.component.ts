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
import { ThemeService } from '../../../core/services/theme.service';
import { FaturamentoDataPickerPanelDirective } from '../../../features/financeiro/pages/faturamento-page/shared/faturamento-data-picker-panel.directive';
import {
  MovimentosPeriodoCelula,
  MovimentosPeriodoGranularidade,
  aplicarGranularidadeAno,
  aplicarGranularidadeMes,
  criarDataHoje,
  formatarPeriodoLabel,
  montarGradeCalendario,
  toIsoDate,
} from '../../../features/movimentos/pages/movimentos-page/movimentos-filtros.util';

export interface PeriodoDataSelecionado {
  ativo: boolean;
  dataInicial: string;
  dataFinal: string;
}

function parseIsoLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function cloneDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

@Component({
  selector: 'app-periodo-data-picker',
  standalone: true,
  imports: [CommonModule, FaturamentoDataPickerPanelDirective],
  templateUrl: './periodo-data-picker.component.html',
  styleUrls: ['./periodo-data-picker.component.scss'],
})
export class PeriodoDataPickerComponent {
  private readonly themeService = inject(ThemeService);
  private syncingFromParent = false;

  /** Texto do botão quando não há período. */
  readonly emptyLabel = input('Data');
  /** aria-label do trigger. */
  readonly ariaLabel = input('Selecionar período');
  /** ISO yyyy-MM-dd — sincroniza o estado interno (ex.: limpar filtros). */
  readonly dataInicial = input<string>('');
  readonly dataFinal = input<string>('');

  readonly periodoChange = output<PeriodoDataSelecionado>();

  readonly panelAberto = signal(false);
  readonly periodoAtivo = signal(false);
  readonly dataInicio = signal(criarDataHoje());
  readonly dataFim = signal(criarDataHoje());
  readonly granularidade = signal<MovimentosPeriodoGranularidade>('dia');

  readonly calendarioAno = signal(new Date().getFullYear());
  readonly calendarioMes = signal(new Date().getMonth());

  /**
   * Seleção obrigatória em 2 cliques:
   * 1º = início, 2º = fim (pode ser o mesmo dia/mês/ano).
   */
  readonly pendenteInicio = signal<Date | null>(null);
  readonly pendenteMes = signal<{ ano: number; mes: number } | null>(null);
  readonly pendenteAno = signal<number | null>(null);

  readonly periodoGranularidadeOpcoes: { id: MovimentosPeriodoGranularidade; label: string }[] = [
    { id: 'dia', label: 'Dia' },
    { id: 'mes', label: 'Mês' },
    { id: 'ano', label: 'Ano' },
  ];

  readonly diasSemanaLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  readonly mesesLabels = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];

  constructor() {
    effect(() => {
      const iniIso = this.dataInicial().trim();
      const fimIso = this.dataFinal().trim();
      if (!iniIso && !fimIso) {
        if (this.periodoAtivo()) {
          this.syncingFromParent = true;
          this.periodoAtivo.set(false);
          this.syncingFromParent = false;
        }
        return;
      }
      const ini = parseIsoLocal(iniIso);
      const fim = parseIsoLocal(fimIso || iniIso);
      if (!ini || !fim) return;
      const curIni = this.periodoAtivo() ? toIsoDate(this.dataInicio()) : '';
      const curFim = this.periodoAtivo() ? toIsoDate(this.dataFim()) : '';
      if (curIni === toIsoDate(ini) && curFim === toIsoDate(fim)) return;
      this.syncingFromParent = true;
      this.periodoAtivo.set(true);
      this.dataInicio.set(ini);
      this.dataFim.set(fim);
      this.calendarioAno.set(ini.getFullYear());
      this.calendarioMes.set(ini.getMonth());
      this.inferirGranularidade(ini, fim);
      this.limparPendencias();
      this.syncingFromParent = false;
    });
  }

  isDarkTheme(): boolean {
    return this.themeService.getCurrentTheme().mode !== 'light';
  }

  periodoLabel(): string {
    if (!this.periodoAtivo()) return this.emptyLabel();
    return formatarPeriodoLabel(this.dataInicio(), this.dataFim(), this.granularidade());
  }

  dicaSelecao(): string {
    const g = this.granularidade();
    if (g === 'dia') {
      return this.pendenteInicio()
        ? 'Agora selecione o dia final (pode ser o mesmo).'
        : 'Selecione o dia inicial e depois o dia final.';
    }
    if (g === 'mes') {
      return this.pendenteMes()
        ? 'Agora selecione o mês final (pode ser o mesmo).'
        : 'Selecione o mês inicial e depois o mês final.';
    }
    return this.pendenteAno()
      ? 'Agora selecione o ano final (pode ser o mesmo).'
      : 'Selecione o ano inicial e depois o ano final.';
  }

  togglePanel(event: MouseEvent): void {
    event.stopPropagation();
    const abrir = !this.panelAberto();
    this.panelAberto.set(abrir);
    if (abrir) this.limparPendencias();
  }

  limparPeriodo(event?: MouseEvent): void {
    event?.stopPropagation();
    this.periodoAtivo.set(false);
    this.panelAberto.set(false);
    this.limparPendencias();
    this.emitPeriodo();
  }

  setPeriodoGranularidade(id: MovimentosPeriodoGranularidade): void {
    this.granularidade.set(id);
    this.calendarioAno.set(this.dataInicio().getFullYear());
    this.calendarioMes.set(this.dataInicio().getMonth());
    this.limparPendencias();
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

  onDiaCalendarioClick(cell: MovimentosPeriodoCelula, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.navegarParaMesDoDia(cell);
    const dia = cloneDia(cell.date);
    const pendente = this.pendenteInicio();

    if (!pendente) {
      this.pendenteInicio.set(dia);
      return;
    }

    this.definirIntervaloDias(pendente, dia);
    this.limparPendencias();
    this.panelAberto.set(false);
  }

  selecionarMesCalendario(mesIndex: number): void {
    const ano = this.calendarioAno();
    const pendente = this.pendenteMes();

    if (!pendente) {
      this.pendenteMes.set({ ano, mes: mesIndex });
      return;
    }

    const a = new Date(pendente.ano, pendente.mes, 1);
    const b = new Date(ano, mesIndex, 1);
    const inicioRef = a.getTime() <= b.getTime() ? a : b;
    const fimRef = a.getTime() <= b.getTime() ? b : a;
    const ini = aplicarGranularidadeMes(inicioRef.getFullYear(), inicioRef.getMonth());
    const fim = aplicarGranularidadeMes(fimRef.getFullYear(), fimRef.getMonth());
    this.granularidade.set('mes');
    this.aplicarRange(ini.inicio, fim.fim);
    this.limparPendencias();
    this.panelAberto.set(false);
  }

  selecionarAnoCalendario(ano: number): void {
    const pendente = this.pendenteAno();

    if (pendente == null) {
      this.pendenteAno.set(ano);
      return;
    }

    const iniAno = Math.min(pendente, ano);
    const fimAno = Math.max(pendente, ano);
    const ini = aplicarGranularidadeAno(iniAno);
    const fim = aplicarGranularidadeAno(fimAno);
    this.granularidade.set('ano');
    this.aplicarRange(ini.inicio, fim.fim);
    this.limparPendencias();
    this.panelAberto.set(false);
  }

  diaCalendarioModificadores(cell: MovimentosPeriodoCelula): Record<string, boolean> {
    const pendente = this.pendenteInicio();
    if (pendente) {
      const isoPend = toIsoDate(pendente);
      return {
        'rec-cal__dia--fora': !cell.inMonth,
        'rec-cal__dia--selecionado': cell.iso === isoPend,
      };
    }

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
      'rec-cal__dia--range-end': !unico && iso === fim,
    };
  }

  mesCalendarioModificadores(mesIndex: number): Record<string, boolean> {
    const pendente = this.pendenteMes();
    if (pendente) {
      return {
        'rec-cal__mes--ativo':
          pendente.ano === this.calendarioAno() && pendente.mes === mesIndex,
      };
    }

    if (!this.periodoAtivo() || this.granularidade() !== 'mes') {
      return { 'rec-cal__mes--ativo': false };
    }

    const ini = this.dataInicio();
    const fim = this.dataFim();
    const atual = new Date(this.calendarioAno(), mesIndex, 1).getTime();
    const iniT = new Date(ini.getFullYear(), ini.getMonth(), 1).getTime();
    const fimT = new Date(fim.getFullYear(), fim.getMonth(), 1).getTime();
    return { 'rec-cal__mes--ativo': atual >= iniT && atual <= fimT };
  }

  anoCalendarioModificadores(ano: number): Record<string, boolean> {
    const pendente = this.pendenteAno();
    if (pendente != null) {
      return { 'rec-cal__ano--ativo': pendente === ano };
    }

    if (!this.periodoAtivo() || this.granularidade() !== 'ano') {
      return { 'rec-cal__ano--ativo': false };
    }

    const ini = this.dataInicio().getFullYear();
    const fim = this.dataFim().getFullYear();
    return { 'rec-cal__ano--ativo': ano >= ini && ano <= fim };
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.panelAberto()) return;
    if (this.pendenteInicio() || this.pendenteMes() || this.pendenteAno() != null) {
      this.limparPendencias();
      return;
    }
    this.panelAberto.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.periodo-data-picker')) {
      this.panelAberto.set(false);
      this.limparPendencias();
    }
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

  private limparPendencias(): void {
    this.pendenteInicio.set(null);
    this.pendenteMes.set(null);
    this.pendenteAno.set(null);
  }

  private emitPeriodo(): void {
    if (this.syncingFromParent) return;
    if (!this.periodoAtivo()) {
      this.periodoChange.emit({ ativo: false, dataInicial: '', dataFinal: '' });
      return;
    }
    this.periodoChange.emit({
      ativo: true,
      dataInicial: toIsoDate(this.dataInicio()),
      dataFinal: toIsoDate(this.dataFim()),
    });
  }

  private inferirGranularidade(inicio: Date, fim: Date): void {
    if (
      inicio.getFullYear() === fim.getFullYear() &&
      inicio.getMonth() === 0 &&
      inicio.getDate() === 1 &&
      fim.getMonth() === 11 &&
      fim.getDate() === 31
    ) {
      this.granularidade.set('ano');
      return;
    }
    if (
      inicio.getFullYear() === fim.getFullYear() &&
      inicio.getMonth() === fim.getMonth() &&
      inicio.getDate() === 1 &&
      fim.getDate() === new Date(fim.getFullYear(), fim.getMonth() + 1, 0).getDate()
    ) {
      this.granularidade.set('mes');
      return;
    }
    this.granularidade.set('dia');
  }
}
