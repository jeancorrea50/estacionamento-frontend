import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { ThemeService } from '../../../../../core/services/theme.service';
import { MotoristaService } from '../../../../cadastro/services/motorista.service';
import { TransportadoraService } from '../../../../cadastro/services/transportadora.service';
import { FaturamentoDataPickerPanelDirective } from '../../../../financeiro/pages/faturamento-page/shared/faturamento-data-picker-panel.directive';
import { MovimentosFiltrosDropdownPanelDirective } from './movimentos-filtros-dropdown-panel.directive';
import { MotoristaListItemDTO } from '../../../../cadastro/models/motorista.dto';
import { TransportadoraListItemDTO } from '../../../../cadastro/models/transportadora.dto';
import {
  MovimentosExcedenteFiltro,
  MovimentosFiltrosAvancados,
  MovimentosPeriodoCelula,
  MovimentosPeriodoGranularidade,
  aplicarGranularidadeAno,
  aplicarGranularidadeAoSelecionarDia,
  aplicarGranularidadeMes,
  contarFiltrosAvancadosAtivos,
  criarFiltrosAvancadosVazios,
  formatarPeriodoLabel,
  montarGradeCalendario,
  toIsoDate
} from '../movimentos-filtros.util';

interface LookupOption {
  id: number;
  label: string;
}

interface PeriodoGranularidadeOpcao {
  id: MovimentosPeriodoGranularidade;
  label: string;
}

@Component({
  selector: 'app-movimentos-filtros-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, FaturamentoDataPickerPanelDirective, MovimentosFiltrosDropdownPanelDirective],
  templateUrl: './movimentos-filtros-panel.component.html',
  styleUrls: ['./movimentos-filtros-panel.component.scss']
})
export class MovimentosFiltrosPanelComponent {
  private readonly motoristaService = inject(MotoristaService);
  private readonly transportadoraService = inject(TransportadoraService);
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  /** Filtros já aplicados (para badge / limpar). */
  readonly aplicados = input.required<MovimentosFiltrosAvancados>();
  /** Perfil transportadora: não permite trocar transportadora no filtro. */
  readonly ocultarTransportadora = input(false);

  readonly aplicar = output<MovimentosFiltrosAvancados>();
  readonly limpar = output<void>();

  readonly aberto = signal(false);
  readonly draft = signal<MovimentosFiltrosAvancados>(criarFiltrosAvancadosVazios());
  readonly panelDataAberto = signal(false);

  readonly motoristaOpcoes = signal<LookupOption[]>([]);
  readonly transportadoraOpcoes = signal<LookupOption[]>([]);
  readonly motoristaBuscando = signal(false);
  readonly transportadoraBuscando = signal(false);

  readonly calendarioAno = signal(new Date().getFullYear());
  readonly calendarioMes = signal(new Date().getMonth());
  readonly arrastandoPeriodo = signal(false);
  private arrasteAnchor: Date | null = null;

  readonly periodoGranularidadeOpcoes: PeriodoGranularidadeOpcao[] = [
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

  private readonly motoristaTermo$ = new Subject<string>();
  private readonly transportadoraTermo$ = new Subject<string>();

  constructor() {
    this.motoristaTermo$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((termo) => {
          const q = termo.trim();
          if (q.length < 2) {
            this.motoristaOpcoes.set([]);
            this.motoristaBuscando.set(false);
            return of(null);
          }
          this.motoristaBuscando.set(true);
          return this.motoristaService.buscar({ Termo: q, NumeroPagina: 1, TamanhoPagina: 20 }).pipe(
            catchError(() => of({ items: [] as MotoristaListItemDTO[], totalCount: 0, numeroPagina: 1, tamanhoPagina: 20 }))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => {
        this.motoristaBuscando.set(false);
        if (!res) return;
        const items = (res.items ?? []).map((m: MotoristaListItemDTO) => ({
          id: m.id,
          label: m.nomeCompleto?.trim() || `Motorista #${m.id}`
        }));
        this.motoristaOpcoes.set(items);
      });

    this.transportadoraTermo$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((termo) => {
          const q = termo.trim();
          if (q.length < 2) {
            this.transportadoraOpcoes.set([]);
            this.transportadoraBuscando.set(false);
            return of(null);
          }
          this.transportadoraBuscando.set(true);
          return this.transportadoraService
            .listarTransportadoras({ Termo: q, NumeroPagina: 1, TamanhoPagina: 20 })
            .pipe(
              catchError(() =>
                of({ items: [] as TransportadoraListItemDTO[], totalCount: 0, numeroPagina: 1, tamanhoPagina: 20 })
              )
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => {
        this.transportadoraBuscando.set(false);
        if (!res) return;
        const items = (res.items ?? []).map((t: TransportadoraListItemDTO) => ({
          id: t.id,
          label: (t.nomeFantasia || t.razaoSocial || '').trim() || `Transportadora #${t.id}`
        }));
        this.transportadoraOpcoes.set(items);
      });
  }

  filtrosAtivosCount(): number {
    return contarFiltrosAvancadosAtivos(this.aplicados());
  }

  isDarkTheme(): boolean {
    return this.themeService.getCurrentTheme().mode !== 'light';
  }

  togglePanel(event: MouseEvent): void {
    event.stopPropagation();
    const abrindo = !this.aberto();
    if (abrindo) {
      this.draft.set(this.cloneFiltros(this.aplicados()));
      const d = this.draft();
      this.calendarioAno.set(d.dataInicio.getFullYear());
      this.calendarioMes.set(d.dataInicio.getMonth());
      this.panelDataAberto.set(false);
    }
    this.aberto.set(abrindo);
  }

  fecharPanel(): void {
    this.aberto.set(false);
    this.panelDataAberto.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.panelDataAberto()) {
      this.panelDataAberto.set(false);
      return;
    }
    if (this.aberto()) this.fecharPanel();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest('.mov-filtros')) {
      this.fecharPanel();
    }
    if (!target.closest('.rec-data-picker')) {
      this.panelDataAberto.set(false);
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.arrastandoPeriodo.set(false);
    this.arrasteAnchor = null;
  }

  onPlacaChange(value: string): void {
    this.patchDraft({ placa: value.toUpperCase() });
  }

  onMotoristaTermo(value: string): void {
    this.patchDraft({
      motoristaLabel: value,
      motoristaId: null
    });
    this.motoristaTermo$.next(value);
  }

  selecionarMotorista(opt: LookupOption): void {
    this.patchDraft({ motoristaId: opt.id, motoristaLabel: opt.label });
    this.motoristaOpcoes.set([]);
  }

  limparMotorista(): void {
    this.patchDraft({ motoristaId: null, motoristaLabel: '' });
    this.motoristaOpcoes.set([]);
  }

  onTransportadoraTermo(value: string): void {
    this.patchDraft({
      transportadoraLabel: value,
      transportadoraId: null
    });
    this.transportadoraTermo$.next(value);
  }

  selecionarTransportadora(opt: LookupOption): void {
    this.patchDraft({ transportadoraId: opt.id, transportadoraLabel: opt.label });
    this.transportadoraOpcoes.set([]);
  }

  limparTransportadora(): void {
    this.patchDraft({ transportadoraId: null, transportadoraLabel: '' });
    this.transportadoraOpcoes.set([]);
  }

  onExcedenteChange(value: MovimentosExcedenteFiltro): void {
    this.patchDraft({ excedente: value });
  }

  togglePanelData(event: MouseEvent): void {
    event.stopPropagation();
    this.panelDataAberto.update((v) => !v);
  }

  limparPeriodo(): void {
    this.patchDraft({ periodoAtivo: false });
    this.panelDataAberto.set(false);
  }

  setPeriodoGranularidade(id: MovimentosPeriodoGranularidade): void {
    const d = this.draft();
    this.patchDraft({ granularidade: id });
    this.calendarioAno.set(d.dataInicio.getFullYear());
    this.calendarioMes.set(d.dataInicio.getMonth());
  }

  periodoLabel(): string {
    const d = this.draft();
    if (!d.periodoAtivo) return 'Qualquer período';
    return formatarPeriodoLabel(d.dataInicio, d.dataFim, d.granularidade);
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
    const g = this.draft().granularidade;
    if (g === 'dia') {
      this.arrastandoPeriodo.set(true);
      this.arrasteAnchor = cell.date;
      this.definirIntervaloDias(cell.date, cell.date);
    } else {
      const range = aplicarGranularidadeAoSelecionarDia(g, cell.date);
      this.patchDraft({
        periodoAtivo: true,
        dataInicio: range.inicio,
        dataFim: range.fim
      });
    }
  }

  onDiaCalendarioPointerEnter(cell: MovimentosPeriodoCelula): void {
    if (!this.arrastandoPeriodo() || this.draft().granularidade !== 'dia') return;
    const anchor = this.arrasteAnchor;
    if (!anchor) return;
    this.navegarParaMesDoDia(cell);
    this.definirIntervaloDias(anchor, cell.date);
  }

  selecionarMesCalendario(mesIndex: number): void {
    const ano = this.calendarioAno();
    const range = aplicarGranularidadeMes(ano, mesIndex);
    this.calendarioMes.set(mesIndex);
    this.patchDraft({
      granularidade: 'mes',
      periodoAtivo: true,
      dataInicio: range.inicio,
      dataFim: range.fim
    });
  }

  selecionarAnoCalendario(ano: number): void {
    const range = aplicarGranularidadeAno(ano);
    this.calendarioAno.set(ano);
    this.patchDraft({
      granularidade: 'ano',
      periodoAtivo: true,
      dataInicio: range.inicio,
      dataFim: range.fim
    });
  }

  diaCalendarioModificadores(cell: MovimentosPeriodoCelula): Record<string, boolean> {
    const d = this.draft();
    if (!d.periodoAtivo) {
      return { 'rec-cal__dia--fora': !cell.inMonth };
    }
    const iso = cell.iso;
    const ini = toIsoDate(d.dataInicio);
    const fim = toIsoDate(d.dataFim);
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
    const d = this.draft();
    const ativo =
      d.periodoAtivo &&
      d.granularidade === 'mes' &&
      d.dataInicio.getFullYear() === this.calendarioAno() &&
      d.dataInicio.getMonth() === mesIndex;
    return { 'rec-cal__mes--ativo': ativo };
  }

  anoCalendarioModificadores(ano: number): Record<string, boolean> {
    const d = this.draft();
    const ativo = d.periodoAtivo && d.granularidade === 'ano' && d.dataInicio.getFullYear() === ano;
    return { 'rec-cal__ano--ativo': ativo };
  }

  onAplicar(): void {
    const d = this.cloneFiltros(this.draft());
    d.placa = d.placa.trim() ? d.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    this.aplicar.emit(d);
    this.fecharPanel();
  }

  onLimpar(): void {
    this.draft.set(criarFiltrosAvancadosVazios());
    this.limpar.emit();
    this.fecharPanel();
  }

  private definirIntervaloDias(a: Date, b: Date): void {
    const aT = a.getTime();
    const bT = b.getTime();
    const inicio = new Date(Math.min(aT, bT));
    const fim = new Date(Math.max(aT, bT));
    this.patchDraft({
      periodoAtivo: true,
      dataInicio: new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()),
      dataFim: new Date(fim.getFullYear(), fim.getMonth(), fim.getDate())
    });
  }

  private navegarParaMesDoDia(cell: MovimentosPeriodoCelula): void {
    this.calendarioAno.set(cell.date.getFullYear());
    this.calendarioMes.set(cell.date.getMonth());
  }

  private patchDraft(partial: Partial<MovimentosFiltrosAvancados>): void {
    this.draft.update((cur) => ({ ...cur, ...partial }));
  }

  private cloneFiltros(f: MovimentosFiltrosAvancados): MovimentosFiltrosAvancados {
    return {
      ...f,
      dataInicio: new Date(f.dataInicio.getFullYear(), f.dataInicio.getMonth(), f.dataInicio.getDate()),
      dataFim: new Date(f.dataFim.getFullYear(), f.dataFim.getMonth(), f.dataFim.getDate())
    };
  }
}
