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
import { FaturamentoDataPickerPanelDirective } from '../../../../financeiro/pages/faturamento-page/shared/faturamento-data-picker-panel.directive';
import { TransportadoraLookupFieldComponent } from '../../../entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
import { MovimentosFiltrosDropdownPanelDirective } from './movimentos-filtros-dropdown-panel.directive';
import { MotoristaListItemDTO } from '../../../../cadastro/models/motorista.dto';
import {
  MovimentosExcedenteFiltro,
  MovimentosFiltrosAvancados,
  MovimentosPeriodoCelula,
  MovimentosPeriodoGranularidade,
  aplicarGranularidadeAno,
  aplicarGranularidadeMes,
  contarFiltrosAvancadosAtivos,
  criarFiltrosAvancadosVazios,
  fimSemana,
  formatarPeriodoLabel,
  inicioSemana,
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

/** Seleção ainda não gravada no rascunho do filtro. Só entra no draft ao confirmar. */
interface PeriodoPendente {
  granularidade: MovimentosPeriodoGranularidade;
  dataInicio: Date;
  dataFim: Date;
}

interface MesAnchor {
  ano: number;
  mes: number;
}

@Component({
  selector: 'app-movimentos-filtros-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FaturamentoDataPickerPanelDirective,
    MovimentosFiltrosDropdownPanelDirective,
    TransportadoraLookupFieldComponent,
  ],
  templateUrl: './movimentos-filtros-panel.component.html',
  styleUrls: ['./movimentos-filtros-panel.component.scss']
})
export class MovimentosFiltrosPanelComponent {
  private readonly motoristaService = inject(MotoristaService);
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
  readonly motoristaBuscando = signal(false);

  readonly calendarioAno = signal(new Date().getFullYear());
  readonly calendarioMes = signal(new Date().getMonth());
  /** Aba visível do calendário. Não altera o filtro até Confirmar. */
  readonly calendarioGranularidade = signal<MovimentosPeriodoGranularidade>('dia');
  /** Intervalo marcado no calendário, ainda não confirmado. */
  readonly periodoPendente = signal<PeriodoPendente | null>(null);
  readonly arrastandoPeriodo = signal(false);
  private arrasteDiaAnchor: Date | null = null;
  private arrasteMesAnchor: MesAnchor | null = null;
  private arrasteAnoAnchor: number | null = null;

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
    }
    this.fecharCalendario();
    this.aberto.set(abrindo);
  }

  fecharPanel(): void {
    this.aberto.set(false);
    this.fecharCalendario();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.panelDataAberto()) {
      this.fecharCalendario();
      return;
    }
    if (this.aberto()) this.fecharPanel();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    // Não fecha o painel ao interagir com o modal compartilhado de transportadora.
    if (target.closest('.modal-overlay') || target.closest('app-modal-busca-transportadora')) {
      return;
    }
    if (!target.closest('.mov-filtros')) {
      this.fecharPanel();
    }
    if (!target.closest('.rec-data-picker')) {
      this.fecharCalendario();
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.encerrarArrastePeriodo();
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

  onTransportadoraIdChange(id: number | null): void {
    const nextId = id && id > 0 ? id : null;
    this.patchDraft({
      transportadoraId: nextId,
      transportadoraLabel: nextId ? this.draft().transportadoraLabel : '',
    });
  }

  onTransportadoraNomeChange(nome: string): void {
    this.patchDraft({ transportadoraLabel: nome || '' });
  }

  onExcedenteChange(value: MovimentosExcedenteFiltro): void {
    this.patchDraft({ excedente: value });
  }

  togglePanelData(event: MouseEvent): void {
    event.stopPropagation();
    if (this.panelDataAberto()) {
      this.fecharCalendario();
      return;
    }
    this.iniciarEdicaoCalendario();
    this.panelDataAberto.set(true);
  }

  limparPeriodo(): void {
    this.patchDraft({ periodoAtivo: false });
    this.fecharCalendario();
  }

  setPeriodoGranularidade(id: MovimentosPeriodoGranularidade): void {
    this.calendarioGranularidade.set(id);
    this.limparAncorasArraste();
    this.periodoPendente.set(null);
    const ref = this.draft();
    this.calendarioAno.set(ref.dataInicio.getFullYear());
    this.calendarioMes.set(ref.dataInicio.getMonth());
  }

  periodoPendenteResumo(): string {
    const p = this.periodoPendente();
    if (!p) return 'Selecione um período';
    const label = formatarPeriodoLabel(p.dataInicio, p.dataFim, p.granularidade);
    const aguardandoFimMes =
      !!this.arrasteMesAnchor &&
      !this.arrastandoPeriodo() &&
      p.granularidade === 'mes' &&
      p.dataInicio.getFullYear() === p.dataFim.getFullYear() &&
      p.dataInicio.getMonth() === p.dataFim.getMonth();
    const aguardandoFimAno =
      this.arrasteAnoAnchor != null &&
      !this.arrastandoPeriodo() &&
      p.granularidade === 'ano' &&
      p.dataInicio.getFullYear() === p.dataFim.getFullYear();
    if (aguardandoFimMes || aguardandoFimAno) {
      return `${label} · selecione o fim`;
    }
    return label;
  }

  confirmarPeriodo(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.gravarPeriodoPendenteNoDraft()) return;
    this.fecharCalendario();
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
    const g = this.calendarioGranularidade();
    if (g !== 'dia' && g !== 'semana') return;

    this.arrastandoPeriodo.set(true);
    this.arrasteDiaAnchor = cell.date;
    this.arrasteMesAnchor = null;
    this.arrasteAnoAnchor = null;

    if (g === 'dia') {
      this.definirIntervaloDias(cell.date, cell.date);
      return;
    }
    this.definirIntervaloSemanas(cell.date, cell.date);
  }

  onDiaCalendarioPointerEnter(cell: MovimentosPeriodoCelula): void {
    if (!this.arrastandoPeriodo()) return;
    const g = this.calendarioGranularidade();
    const anchor = this.arrasteDiaAnchor;
    if (!anchor || (g !== 'dia' && g !== 'semana')) return;
    this.navegarParaMesDoDia(cell);
    if (g === 'dia') {
      this.definirIntervaloDias(anchor, cell.date);
      return;
    }
    this.definirIntervaloSemanas(anchor, cell.date);
  }

  onMesCalendarioPointerDown(mesIndex: number, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const atual: MesAnchor = { ano: this.calendarioAno(), mes: mesIndex };

    // Segundo clique (após soltar o primeiro): completa o intervalo, inclusive entre anos.
    if (this.arrasteMesAnchor && !this.arrastandoPeriodo()) {
      this.definirIntervaloMeses(this.arrasteMesAnchor, atual);
      this.arrasteMesAnchor = null;
      return;
    }

    this.arrastandoPeriodo.set(true);
    this.arrasteMesAnchor = atual;
    this.arrasteDiaAnchor = null;
    this.arrasteAnoAnchor = null;
    this.calendarioMes.set(mesIndex);
    this.definirIntervaloMeses(atual, atual);
  }

  onMesCalendarioPointerEnter(mesIndex: number): void {
    if (!this.arrastandoPeriodo() || this.calendarioGranularidade() !== 'mes') return;
    const anchor = this.arrasteMesAnchor;
    if (!anchor) return;
    this.definirIntervaloMeses(anchor, { ano: this.calendarioAno(), mes: mesIndex });
  }

  onAnoCalendarioPointerDown(ano: number, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    // Segundo clique (após soltar o primeiro): completa o intervalo.
    if (this.arrasteAnoAnchor != null && !this.arrastandoPeriodo()) {
      this.definirIntervaloAnos(this.arrasteAnoAnchor, ano);
      this.arrasteAnoAnchor = null;
      return;
    }

    this.arrastandoPeriodo.set(true);
    this.arrasteAnoAnchor = ano;
    this.arrasteDiaAnchor = null;
    this.arrasteMesAnchor = null;
    this.calendarioAno.set(ano);
    this.definirIntervaloAnos(ano, ano);
  }

  onAnoCalendarioPointerEnter(ano: number): void {
    if (!this.arrastandoPeriodo() || this.calendarioGranularidade() !== 'ano') return;
    const anchor = this.arrasteAnoAnchor;
    if (anchor == null) return;
    this.definirIntervaloAnos(anchor, ano);
  }

  diaCalendarioModificadores(cell: MovimentosPeriodoCelula): Record<string, boolean> {
    const p = this.periodoPendente();
    if (!p) {
      return { 'rec-cal__dia--fora': !cell.inMonth };
    }
    const iso = cell.iso;
    const ini = toIsoDate(p.dataInicio);
    const fim = toIsoDate(p.dataFim);
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
    const p = this.periodoPendente();
    if (!p || p.granularidade !== 'mes') {
      return { 'rec-cal__mes--ativo': false };
    }
    const atual = new Date(this.calendarioAno(), mesIndex, 1).getTime();
    const iniT = new Date(p.dataInicio.getFullYear(), p.dataInicio.getMonth(), 1).getTime();
    const fimT = new Date(p.dataFim.getFullYear(), p.dataFim.getMonth(), 1).getTime();
    return { 'rec-cal__mes--ativo': atual >= iniT && atual <= fimT };
  }

  anoCalendarioModificadores(ano: number): Record<string, boolean> {
    const p = this.periodoPendente();
    if (!p || p.granularidade !== 'ano') {
      return { 'rec-cal__ano--ativo': false };
    }
    const ini = p.dataInicio.getFullYear();
    const fim = p.dataFim.getFullYear();
    return { 'rec-cal__ano--ativo': ano >= ini && ano <= fim };
  }

  onAplicar(): void {
    this.gravarPeriodoPendenteNoDraft();
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
    this.definirPeriodoPendente('dia', inicio, fim);
  }

  private definirIntervaloSemanas(a: Date, b: Date): void {
    const iniA = inicioSemana(a);
    const fimA = fimSemana(a);
    const iniB = inicioSemana(b);
    const fimB = fimSemana(b);
    const inicio = iniA.getTime() <= iniB.getTime() ? iniA : iniB;
    const fim = fimA.getTime() >= fimB.getTime() ? fimA : fimB;
    this.definirPeriodoPendente('semana', inicio, fim);
  }

  private definirIntervaloMeses(a: MesAnchor, b: MesAnchor): void {
    const aT = new Date(a.ano, a.mes, 1).getTime();
    const bT = new Date(b.ano, b.mes, 1).getTime();
    const iniRef = aT <= bT ? a : b;
    const fimRef = aT <= bT ? b : a;
    const ini = aplicarGranularidadeMes(iniRef.ano, iniRef.mes);
    const fim = aplicarGranularidadeMes(fimRef.ano, fimRef.mes);
    this.definirPeriodoPendente('mes', ini.inicio, fim.fim);
  }

  private definirIntervaloAnos(a: number, b: number): void {
    const iniAno = Math.min(a, b);
    const fimAno = Math.max(a, b);
    const ini = aplicarGranularidadeAno(iniAno);
    const fim = aplicarGranularidadeAno(fimAno);
    this.definirPeriodoPendente('ano', ini.inicio, fim.fim);
  }

  private encerrarArrastePeriodo(): void {
    const estavaArrastando = this.arrastandoPeriodo();
    this.arrastandoPeriodo.set(false);
    this.arrasteDiaAnchor = null;

    if (!estavaArrastando) return;

    // Arraste com vários meses/anos: intervalo já completo.
    // Clique simples: mantém âncora para o segundo clique completar o intervalo.
    const p = this.periodoPendente();
    if (this.arrasteMesAnchor && p?.granularidade === 'mes') {
      const multiMes =
        p.dataInicio.getFullYear() !== p.dataFim.getFullYear() ||
        p.dataInicio.getMonth() !== p.dataFim.getMonth();
      if (multiMes) this.arrasteMesAnchor = null;
    }

    if (this.arrasteAnoAnchor != null && p?.granularidade === 'ano') {
      const multiAno = p.dataInicio.getFullYear() !== p.dataFim.getFullYear();
      if (multiAno) this.arrasteAnoAnchor = null;
    }
  }

  private limparAncorasArraste(): void {
    this.arrastandoPeriodo.set(false);
    this.arrasteDiaAnchor = null;
    this.arrasteMesAnchor = null;
    this.arrasteAnoAnchor = null;
  }

  private gravarPeriodoPendenteNoDraft(): boolean {
    const p = this.periodoPendente();
    if (!p) return false;
    this.patchDraft({
      periodoAtivo: true,
      granularidade: p.granularidade,
      dataInicio: p.dataInicio,
      dataFim: p.dataFim
    });
    return true;
  }

  private definirPeriodoPendente(
    granularidade: MovimentosPeriodoGranularidade,
    inicio: Date,
    fim: Date
  ): void {
    this.periodoPendente.set({
      granularidade,
      dataInicio: new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()),
      dataFim: new Date(fim.getFullYear(), fim.getMonth(), fim.getDate())
    });
  }

  private iniciarEdicaoCalendario(): void {
    const d = this.draft();
    this.calendarioGranularidade.set(d.granularidade);
    this.calendarioAno.set(d.dataInicio.getFullYear());
    this.calendarioMes.set(d.dataInicio.getMonth());
    this.limparAncorasArraste();
    if (d.periodoAtivo) {
      this.definirPeriodoPendente(d.granularidade, d.dataInicio, d.dataFim);
      return;
    }
    this.periodoPendente.set(null);
  }

  private fecharCalendario(): void {
    this.periodoPendente.set(null);
    this.limparAncorasArraste();
    this.panelDataAberto.set(false);
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
