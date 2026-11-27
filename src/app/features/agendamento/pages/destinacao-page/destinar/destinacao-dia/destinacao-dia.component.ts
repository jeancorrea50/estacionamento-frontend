import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type ModalidadePainel = 'estacionamento' | 'limpeza';
export type Nivel = 'ok' | 'warn' | 'danger';

export interface PainelModalidade {
  /** null = estacionamento sem controle de capacidade para a modalidade. */
  capacidade: number | null;
  destinadas: number;
  /** Para o delta "vs. ontem". Omitir = sem delta. */
  destinadasOntem?: number;
}

export interface OcupacaoHorario {
  inicio: string; // 'HH:mm'
  fim: string; // 'HH:mm'
  capacidade: number;
  destinadas: number;
}

const NIVEL_LABEL: Record<Nivel, string> = { ok: 'Com folga', warn: 'Atenção', danger: 'Lotando' };
const nivelDe = (pct: number): Nivel => (pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : 'ok');
const pct = (parte: number, total: number | null) =>
  total ? Math.min(100, Math.round((parte / total) * 100)) : 0;

/**
 * "Disponibilidade do dia" da Destinação: indicadores + destinado por horário.
 * Apresentação pura: o estado (data, modalidade, dados) fica no painel pai.
 */
@Component({
  selector: 'app-destinacao-dia',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './destinacao-dia.component.html',
  styleUrl: './destinacao-dia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinacaoDiaComponent {
  // ─── Entradas ─────────────────────────────────────────────────────────
  readonly data = model.required<string>(); // ISO yyyy-MM-dd
  readonly visao = model<ModalidadePainel>('estacionamento');
  readonly modalidades = input.required<Record<ModalidadePainel, PainelModalidade>>();
  readonly horarios = input<OcupacaoHorario[]>([]);
  readonly destinacoesAtivas = input(0);
  readonly vagasDiaDestinadas = input(0);
  readonly carregando = input(false);
  /** 'HH:mm' para marcar a coluna "agora". Vazio = não marca (ex.: dia ≠ hoje). */
  readonly horaAtual = input<string>('');
  readonly ehHoje = input(false);

  readonly atualizar = output<void>();
  readonly irParaHoje = output<void>();
  readonly mudarDia = output<number>();

  readonly opcoes: ReadonlyArray<{ id: ModalidadePainel; label: string; icon: string }> = [
    { id: 'estacionamento', label: 'Estacionamento', icon: 'local_parking' },
    { id: 'limpeza', label: 'Limpeza', icon: 'water_drop' },
  ];

  // ─── Derivados ────────────────────────────────────────────────────────
  readonly atual = computed(() => this.modalidades()[this.visao()]);
  readonly semControle = computed(() => this.atual().capacidade == null);
  readonly outra = computed(() => {
    const id: ModalidadePainel = this.visao() === 'estacionamento' ? 'limpeza' : 'estacionamento';
    const m = this.modalidades()[id];
    const p = pct(m.destinadas, m.capacidade);
    const opcao = this.opcoes.find((o) => o.id === id)!;
    return {
      ...m,
      label: opcao.label,
      icon: opcao.icon,
      livres: m.capacidade == null ? null : Math.max(m.capacidade - m.destinadas, 0),
      pct: p,
      nivel: nivelDe(p),
    };
  });

  readonly livres = computed(() => {
    const { capacidade, destinadas } = this.atual();
    return capacidade == null ? null : Math.max(capacidade - destinadas, 0);
  });
  readonly ocupacao = computed(() => pct(this.atual().destinadas, this.atual().capacidade));
  readonly nivel = computed(() => nivelDe(this.ocupacao()));
  readonly nivelLabel = computed(() => NIVEL_LABEL[this.nivel()]);

  /** Delta vs. ontem — mais destinado não é "bom" nem "ruim": tom neutro, só direção. */
  readonly delta = computed(() => {
    const ontem = this.atual().destinadasOntem;
    if (ontem === undefined) return null;
    const d = this.atual().destinadas - ontem;
    return { valor: d, icone: d > 0 ? 'arrow_upward' : d < 0 ? 'arrow_downward' : 'remove' };
  });

  readonly colunas = computed(() => {
    const hs = this.horarios();
    const pcts = hs.map((h) => pct(h.destinadas, h.capacidade));
    const pico = pcts.indexOf(Math.max(0, ...pcts)); // só o pico recebe rótulo direto
    const agora = this.horaAtual();
    return hs.map((h, i) => {
      const p = pcts[i];
      const nivel = nivelDe(p);
      return {
        ...h,
        pct: p,
        nivel,
        nivelLabel: NIVEL_LABEL[nivel],
        agora: !!agora && agora >= h.inicio && agora < h.fim,
        pico: i === pico && p > 0,
        hora: h.inicio.slice(0, 2) + 'h',
      };
    });
  });

  /** Coluna sob o mouse/foco — mostrada na linha de detalhe (não corta como tooltip). */
  readonly focoIdx = signal<number | null>(null);
  readonly foco = computed(() => {
    const i = this.focoIdx();
    return i === null ? null : (this.colunas()[i] ?? null);
  });

  readonly resumoHorarios = computed(() => {
    const c = this.colunas();
    return {
      atencao: c.filter((x) => x.nivel === 'warn').length,
      lotando: c.filter((x) => x.nivel === 'danger').length,
    };
  });

  onData(iso: string): void {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    this.data.set(iso);
    this.atualizar.emit();
  }
}
