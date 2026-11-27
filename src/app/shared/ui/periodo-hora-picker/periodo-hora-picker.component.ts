import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { FaturamentoDataPickerPanelDirective } from '../../../features/financeiro/pages/faturamento-page/shared/faturamento-data-picker-panel.directive';

export interface PeriodoHoraSelecionado {
  horaInicio: string;
  horaFim: string;
}

function parseHoraMinutos(hora: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hora ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatMinutos(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Seletor de intervalo de horário (início → fim), no mesmo espírito do
 * `periodo-data-picker`: 1º clique = início, 2º = fim.
 */
@Component({
  selector: 'app-periodo-hora-picker',
  standalone: true,
  imports: [CommonModule, FaturamentoDataPickerPanelDirective],
  templateUrl: './periodo-hora-picker.component.html',
  styleUrls: ['./periodo-hora-picker.component.scss'],
  host: {
    '[class.periodo-hora-picker--open]': 'panelAberto()',
  },
})
export class PeriodoHoraPickerComponent {
  private readonly themeService = inject(ThemeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly emptyLabel = input('Selecionar horário');
  readonly ariaLabel = input('Selecionar intervalo de horário');
  /** Passo em minutos entre opções (padrão 30). */
  readonly passoMinutos = input(30);
  readonly horaInicio = input<string>('');
  readonly horaFim = input<string>('');
  /** Início mais cedo permitido (ex.: fim da faixa anterior). Vazio = sem limite. */
  readonly minHora = input<string>('');
  /** Fim mais tarde permitido (ex.: início da próxima faixa). Vazio = sem limite. */
  readonly maxHora = input<string>('');

  readonly periodoChange = output<PeriodoHoraSelecionado>();

  readonly panelAberto = signal(false);
  readonly inicio = signal<string>('');
  readonly fim = signal<string>('');
  /** Rascunho do 1º clique enquanto espera o fim. */
  readonly pendenteInicio = signal<string | null>(null);

  readonly opcoes = signal<string[]>([]);

  constructor() {
    effect(() => {
      const passo = Math.max(5, Math.min(60, Math.trunc(this.passoMinutos()) || 30));
      const list: string[] = [];
      for (let m = 0; m < 24 * 60; m += passo) {
        list.push(formatMinutos(m));
      }
      // Garante 24:00 equivalente? Não — fim máximo 23:xx. Faixas usam fim exclusivo típico HH:mm.
      untracked(() => this.opcoes.set(list));
    });

    effect(() => {
      const ini = this.horaInicio().trim();
      const fim = this.horaFim().trim();
      untracked(() => {
        this.inicio.set(ini);
        this.fim.set(fim);
        this.pendenteInicio.set(null);
      });
    });
  }

  isDarkTheme(): boolean {
    return this.themeService.getCurrentTheme().mode !== 'light';
  }

  periodoLabel(): string {
    const ini = this.inicio();
    const fim = this.fim();
    if (ini && fim) return `${ini} → ${fim}`;
    if (this.pendenteInicio()) return `${this.pendenteInicio()} → …`;
    return this.emptyLabel();
  }

  dicaSelecao(): string {
    return this.pendenteInicio()
      ? 'Agora selecione o horário final.'
      : 'Selecione o horário inicial e depois o final.';
  }

  togglePanel(event: MouseEvent): void {
    event.stopPropagation();
    if (this.panelAberto()) {
      this.panelAberto.set(false);
      this.pendenteInicio.set(null);
      return;
    }
    this.pendenteInicio.set(null);
    this.panelAberto.set(true);
    // Abre já no horário atual (ou no primeiro permitido), não no 00:00.
    setTimeout(() => this.rolarParaSelecao());
  }

  /**
   * Fora dos limites: no 1º clique (início) vale [min, max); no 2º (fim) vale (início, max].
   * Evita escolher uma faixa que passa por cima das vizinhas.
   */
  desabilitada(hora: string): boolean {
    const mins = parseHoraMinutos(hora);
    if (mins == null) return true;
    const min = parseHoraMinutos(this.minHora()) ?? 0;
    const max = parseHoraMinutos(this.maxHora()) ?? 24 * 60;
    const pendente = parseHoraMinutos(this.pendenteInicio() ?? '');
    const inicioValido = mins >= min && mins < max;
    if (pendente == null) return !inicioValido;
    // 2º clique: depois do início = fim (até o máximo); antes/igual = recomeça (se for início válido).
    return mins > pendente ? mins > max : !inicioValido;
  }

  private rolarParaSelecao(): void {
    const grid = this.host.nativeElement.querySelector<HTMLElement>('.ph-grid');
    if (!grid) return;
    const alvo =
      grid.querySelector<HTMLElement>('.ph-hora--start') ??
      grid.querySelector<HTMLElement>('.ph-hora:not([disabled])');
    if (alvo) grid.scrollTop = Math.max(0, alvo.offsetTop - grid.offsetTop - 8);
  }

  selecionar(hora: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.desabilitada(hora)) return;
    const pendente = this.pendenteInicio();
    if (!pendente) {
      this.pendenteInicio.set(hora);
      return;
    }

    let ini = pendente;
    let fim = hora;
    const a = parseHoraMinutos(ini);
    const b = parseHoraMinutos(fim);
    if (a == null || b == null) {
      this.pendenteInicio.set(hora);
      return;
    }
    if (b <= a) {
      // Segundo clique igual/antes: reinicia com novo início.
      this.pendenteInicio.set(hora);
      return;
    }

    this.inicio.set(ini);
    this.fim.set(fim);
    this.pendenteInicio.set(null);
    this.periodoChange.emit({ horaInicio: ini, horaFim: fim });
    this.panelAberto.set(false);
  }

  limpar(event: MouseEvent): void {
    event.stopPropagation();
    this.inicio.set('');
    this.fim.set('');
    this.pendenteInicio.set(null);
    this.periodoChange.emit({ horaInicio: '', horaFim: '' });
    this.panelAberto.set(false);
  }

  modificadores(hora: string): Record<string, boolean> {
    const mins = parseHoraMinutos(hora);
    const pendente = this.pendenteInicio();
    const ini = parseHoraMinutos(pendente ?? this.inicio());
    const fim = pendente ? null : parseHoraMinutos(this.fim());

    const isStart = ini != null && mins === ini;
    const isEnd = fim != null && mins === fim;
    const inRange =
      ini != null && fim != null && mins != null && mins > ini && mins < fim;

    return {
      'ph-hora--start': isStart,
      'ph-hora--end': isEnd,
      'ph-hora--range': inRange,
      'ph-hora--pendente': !!pendente && isStart,
    };
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.panelAberto()) return;
    this.panelAberto.set(false);
    this.pendenteInicio.set(null);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.panelAberto()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.periodo-hora-picker')) return;
    this.panelAberto.set(false);
    this.pendenteInicio.set(null);
  }
}
