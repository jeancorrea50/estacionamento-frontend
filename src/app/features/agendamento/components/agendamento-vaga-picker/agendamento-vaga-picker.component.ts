import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {
  JanelaDisponibilidadeDia,
  JanelaSlotDisponivel,
  MODALIDADE_AGENDAMENTO_OPCOES,
  ModalidadeAgendamento,
} from '../../models/janela-agendamento.models';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import { JanelaDisponibilidadeRealtimeService } from '../../services/janela-disponibilidade-realtime.service';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hojeIso = () => isoDe(new Date());
const horaAgora = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const normHora = (raw: string | null | undefined) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw ?? '').trim());
  return m ? `${pad(Number(m[1]))}:${m[2]}` : '';
};
const slotKey = (s: JanelaSlotDisponivel) =>
  `${s.janelaAgendamentoId}|${s.horaInicio}|${s.horaFim}`;

interface CelulaDia {
  iso: string;
  dia: number;
  noMes: boolean;
  passado: boolean;
  info: JanelaDisponibilidadeDia | null;
  vagas: number;
}

/**
 * Escolha de vaga do agendamento: modalidade → dia (só dias com vaga, com a quantidade)
 * → horário (só horários com vaga). Com destinação, mostra o saldo destinado à transportadora;
 * sem destinação, o saldo livre das janelas (descontando o que está destinado a outras).
 */
@Component({
  selector: 'app-agendamento-vaga-picker',
  standalone: true,
  templateUrl: './agendamento-vaga-picker.component.html',
  styleUrl: './agendamento-vaga-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendamentoVagaPickerComponent {
  private readonly api = inject(JanelaAgendamentoService);
  private readonly realtime = inject(JanelaDisponibilidadeRealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  /** Transportadora do agendamento (selecionada ou a da sessão). */
  readonly transportadoraId = input<number | null>(null);
  readonly ativo = input(true);

  readonly modalidade = model<ModalidadeAgendamento>(1);
  /** `YYYY-MM-DDTHH:mm` do início do horário escolhido ('' = nada escolhido). */
  readonly value = model<string>('');
  /** Horário escolhido (para o pai limitar a quantidade de placas). */
  readonly slotChange = output<JanelaSlotDisponivel | null>();

  readonly modalidades = MODALIDADE_AGENDAMENTO_OPCOES;
  readonly diasSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  private readonly meses = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];

  readonly mesRef = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly diasInfo = signal<ReadonlyMap<string, JanelaDisponibilidadeDia>>(new Map());
  readonly carregandoMes = signal(false);
  readonly erroMes = signal<string | null>(null);

  readonly diaSelecionado = signal<string | null>(null);
  readonly slots = signal<JanelaSlotDisponivel[]>([]);
  readonly carregandoSlots = signal(false);
  readonly erroSlots = signal<string | null>(null);
  readonly slotSelecionado = signal<JanelaSlotDisponivel | null>(null);

  private readonly mes$ = new Subject<{
    ini: string;
    fim: string;
    mod: ModalidadeAgendamento;
    tid: number | null;
  }>();
  private readonly dia$ = new Subject<{
    dia: string;
    mod: ModalidadeAgendamento;
    tid: number | null;
  }>();

  readonly tituloMes = computed(
    () => `${this.meses[this.mesRef().getMonth()]} de ${this.mesRef().getFullYear()}`,
  );
  readonly podeVoltarMes = computed(() => {
    const hoje = new Date();
    const ref = this.mesRef();
    return ref.getFullYear() * 12 + ref.getMonth() > hoje.getFullYear() * 12 + hoje.getMonth();
  });

  readonly celulas = computed<CelulaDia[]>(() => {
    const ref = this.mesRef();
    const offset = (ref.getDay() + 6) % 7; // segunda = 0
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), 1 - offset);
    const hoje = hojeIso();
    const info = this.diasInfo();
    const totalCelulas =
      Math.ceil((offset + new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: totalCelulas }, (_, i) => {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const iso = isoDe(d);
      const noMes = d.getMonth() === ref.getMonth();
      const dia = noMes ? (info.get(iso) ?? null) : null;
      return {
        iso,
        dia: d.getDate(),
        noMes,
        passado: iso < hoje,
        info: dia,
        vagas: dia?.totalDisponiveis ?? 0,
      };
    });
  });

  readonly diasComVaga = computed(
    () => this.celulas().filter((c) => c.noMes && !c.passado && c.vagas > 0).length,
  );
  readonly usouDestinacao = computed(() =>
    [...this.diasInfo().values()].some((d) => d.usouDestinacao),
  );
  readonly algumaJanela = computed(() =>
    [...this.diasInfo().values()].some((d) => d.possuiJanelas),
  );

  constructor() {
    this.mes$
      .pipe(
        switchMap(({ ini, fim, mod, tid }) => {
          this.carregandoMes.set(true);
          this.erroMes.set(null);
          return this.api.disponibilidadePeriodo(ini, fim, mod, tid).pipe(
            map((dias) => ({ dias, erro: null as string | null })),
            catchError((e) =>
              of({
                dias: [] as JanelaDisponibilidadeDia[],
                erro: (e?.message as string) || 'Não foi possível consultar as vagas do mês.',
              }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ dias, erro }) => {
        this.carregandoMes.set(false);
        this.erroMes.set(erro);
        this.diasInfo.set(new Map(dias.map((d) => [d.data, d])));
        this.validarDiaSelecionado();
      });

    this.dia$
      .pipe(
        switchMap(({ dia, mod, tid }) => {
          this.carregandoSlots.set(true);
          this.erroSlots.set(null);
          return this.api.disponibilidade(dia, mod, tid).pipe(
            map((d) => ({ dia, slots: d.slots ?? [], erro: null as string | null })),
            catchError((e) =>
              of({
                dia,
                slots: [] as JanelaSlotDisponivel[],
                erro: (e?.message as string) || 'Não foi possível consultar os horários.',
              }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ dia, slots, erro }) => {
        this.carregandoSlots.set(false);
        this.erroSlots.set(erro);
        const agora = horaAgora();
        const futuros = slots.filter(
          (s) => s.disponiveis > 0 && (dia !== hojeIso() || normHora(s.horaInicio) >= agora),
        );
        this.slots.set(futuros);
        const atual = this.slotSelecionado();
        const mantido = atual ? (futuros.find((s) => slotKey(s) === slotKey(atual)) ?? null) : null;
        this.selecionarSlot(mantido ?? (futuros.length === 1 ? futuros[0] : null));
      });

    // Recarrega o mês quando muda transportadora, modalidade, mês ou há evento de disponibilidade.
    effect(() => {
      const ativo = this.ativo();
      const tid = this.transportadoraId();
      const mod = this.modalidade();
      const ref = this.mesRef();
      this.realtime.versao();
      untracked(() => {
        if (!ativo) return;
        const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
        this.mes$.next({ ini: isoDe(ref), fim: isoDe(fim), mod, tid: tid && tid > 0 ? tid : null });
        const dia = this.diaSelecionado();
        if (dia) this.dia$.next({ dia, mod, tid: tid && tid > 0 ? tid : null });
      });
    });

    // Ao reabrir o modal, o pai zera `value`: limpa a seleção.
    effect(() => {
      if (this.value()) return;
      untracked(() => {
        if (this.slotSelecionado()) this.slotSelecionado.set(null);
      });
    });
  }

  // ─── Ações ────────────────────────────────────────────────────────────
  setModalidade(m: ModalidadeAgendamento): void {
    if (this.modalidade() === m) return;
    this.modalidade.set(m);
    this.selecionarSlot(null);
  }

  mudarMes(delta: number): void {
    const ref = this.mesRef();
    this.mesRef.set(new Date(ref.getFullYear(), ref.getMonth() + delta, 1));
  }

  escolherDia(c: CelulaDia): void {
    if (!c.noMes || c.passado || c.vagas <= 0) return;
    this.diaSelecionado.set(c.iso);
    this.slots.set([]);
    this.selecionarSlot(null);
    const tid = this.transportadoraId();
    this.dia$.next({ dia: c.iso, mod: this.modalidade(), tid: tid && tid > 0 ? tid : null });
  }

  selecionarSlot(s: JanelaSlotDisponivel | null): void {
    this.slotSelecionado.set(s);
    const dia = this.diaSelecionado();
    this.value.set(s && dia ? `${dia}T${normHora(s.horaInicio)}` : '');
    this.slotChange.emit(s);
  }

  ehSlotSelecionado(s: JanelaSlotDisponivel): boolean {
    const atual = this.slotSelecionado();
    return !!atual && slotKey(atual) === slotKey(s);
  }

  chave(s: JanelaSlotDisponivel): string {
    return slotKey(s);
  }

  hora(raw: string): string {
    return normHora(raw);
  }

  rotuloDia(c: CelulaDia): string {
    const data = `${pad(c.dia)}/${pad(this.mesRef().getMonth() + 1)}`;
    if (c.passado) return `${data}, dia já passou`;
    if (!c.info?.possuiJanelas && !c.info?.usouDestinacao) return `${data}, sem janela`;
    return c.vagas > 0 ? `${data}, ${c.vagas} vaga(s) disponível(is)` : `${data}, sem vagas`;
  }

  /** Dia escolhido sumiu (lotou/mudou modalidade): limpa a seleção. */
  private validarDiaSelecionado(): void {
    const dia = this.diaSelecionado();
    if (!dia) return;
    const info = this.diasInfo().get(dia);
    const ref = this.mesRef();
    const noMes = dia.startsWith(`${ref.getFullYear()}-${pad(ref.getMonth() + 1)}`);
    if (noMes && (!info || info.totalDisponiveis <= 0)) {
      this.diaSelecionado.set(null);
      this.slots.set([]);
      this.selecionarSlot(null);
    }
  }
}
