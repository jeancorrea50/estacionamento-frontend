import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from, Observable, of, Subject } from 'rxjs';
import {
  catchError,
  concatMap,
  finalize,
  map,
  switchMap,
  takeUntil,
  toArray,
} from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { VeiculoService } from '../../../cadastro/services/veiculo.service';
import {
  formatPlacaDisplay,
  normalizePlaca,
  placaCompleta,
} from '../../../cadastro/utils/placa-br';
import { TransportadoraLookupFieldComponent } from '../../../movimentos/entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
import { ModalBuscaVeiculoComponent } from '../../../movimentos/entrada-saida/components/modal-busca-veiculo/modal-busca-veiculo.component';
import { PortariaAlertasStore } from '../../../movimentos/services/portaria-alertas.store';
import { PaginatedSearchItem } from '../../../../shared/models/paginated-search.models';
import { datetimeLocalInputToApiIso } from '../../../../shared/utils/local-iso-datetime';
import { AgendamentoPostInput } from '../../models/agendamento.models';
import type {
  JanelaDisponibilidadeDia,
  JanelaSlotDisponivel,
  ModalidadeAgendamento,
  PagadorSlot,
} from '../../models/janela-agendamento.models';
import { AgendamentoService } from '../../services/agendamento.service';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import { JanelaDisponibilidadeRealtimeService } from '../../services/janela-disponibilidade-realtime.service';
import { ResponsavelFaturamentoLookupFieldComponent } from '../../../cadastro/components/responsavel-faturamento-lookup-field/responsavel-faturamento-lookup-field.component';
import { StatusConfiguracaoCobranca } from '../../../financeiro/models/configuracao-cobranca.models';
import { ConfiguracaoCobrancaService } from '../../../financeiro/services/configuracao-cobranca.service';

/** Serviço do agendamento. Os dois juntos = modalidade Ambos (1 vaga de cada por placa). */
export type ServicoAgendamento = 'estacionamento' | 'limpeza';
/** CIF = a própria transportadora paga · FOB = um terceiro paga (fatura para ele). */
export type FreteAgendamento = 'CIF' | 'FOB';

export const SERVICO_INFO: Record<
  ServicoAgendamento,
  { label: string; icon: string; ajuda: string; modalidade: 1 | 2 }
> = {
  estacionamento: {
    label: 'Estacionamento',
    icon: 'local_parking',
    ajuda: 'Vaga para o caminhão aguardar no pátio.',
    modalidade: 1,
  },
  limpeza: {
    label: 'Limpeza',
    icon: 'water_drop',
    ajuda: 'Vaga para lavagem/limpeza do veículo.',
    modalidade: 2,
  },
};

export const FRETE_INFO: Record<FreteAgendamento, string> = {
  CIF: 'A própria transportadora paga a fatura.',
  FOB: 'Um terceiro (quem recebe a carga) paga a fatura.',
};

interface PlacaSelecionada {
  id: number;
  placa: string;
  marcaModelo?: string;
  motoristaId?: number | null;
  motoristaNome?: string | null;
  motoristaCpf?: string | null;
}

interface CelulaDia {
  iso: string | null;
  dia: number;
  vagas: number;
  nivel: 'sem' | 'pouca' | 'ok';
  hoje: boolean;
  passado: boolean;
}

type ResolvePlacaResult =
  { ok: true; payload: AgendamentoPostInput } | { ok: false; message: string };

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
/** Placa antiga (ABC1234) ou Mercosul (ABC1D23). */
const PLACA_RE = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;
const POUCAS_VAGAS = 3;
const MESES = [
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
const SEMANA_LONGA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

/**
 * Modal "Novo agendamento" (Pátio e Agendar/transportadora), escrito como perguntas:
 * serviço → dia → horário → placa → quem paga. Só mostra dias e horários com vaga
 * (destinação da transportadora quando existe; senão, vagas livres do pátio).
 */
@Component({
  selector: 'app-agendamento-novo-modal',
  standalone: true,
  imports: [
    DatePipe,
    TransportadoraLookupFieldComponent,
    ResponsavelFaturamentoLookupFieldComponent,
    ModalBuscaVeiculoComponent,
  ],
  templateUrl: './agendamento-novo-modal.component.html',
  styleUrls: ['./agendamento-novo-modal.component.scss'],
  host: {
    '[class.ag-novo-modal--ativo]': 'overlayAtivo()',
    '[attr.aria-hidden]': 'overlayAtivo() ? null : "true"',
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class AgendamentoNovoModalComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AgendamentoService);
  private readonly janelasApi = inject(JanelaAgendamentoService);
  private readonly realtime = inject(JanelaDisponibilidadeRealtimeService);
  private readonly veiculoApi = inject(VeiculoService);
  private readonly toast = inject(ToastService);
  private readonly portariaAlertas = inject(PortariaAlertasStore);
  private readonly cobrancaApi = inject(ConfiguracaoCobrancaService);
  private readonly destroyRef = inject(DestroyRef);

  /** Quando true, exibe o modal e reinicia o formulário. */
  readonly aberto = input(false);
  /** Operador de pátio escolhe transportadora; transportadora usa a da sessão. */
  readonly podeEscolherTransportadora = input(false);
  /** Pré-seleciona o dia (ex.: "Agendar nesse dia" do painel). `yyyy-MM-dd`. */
  readonly diaInicial = input<string | null>(null);
  /** Pré-preenche placas (ex.: "Agendar de novo esta placa"). */
  readonly placasIniciais = input<string[]>([]);
  /** Pré-marca o serviço (1 Estacionamento, 2 Limpeza, 3 os dois). */
  readonly modalidadeInicial = input<ModalidadeAgendamento | null>(null);
  /** Nome da transportadora da sessão (subtítulo do modal). */
  readonly transportadoraNome = input<string>('');
  /** Operador: transportadora já escolhida (ex.: "Agendar de novo esta placa"). */
  readonly transportadoraInicial = input<{ id: number; nome: string } | null>(null);

  readonly fechado = output<void>();
  readonly salvo = output<void>();

  readonly SERVICO_INFO = SERVICO_INFO;
  readonly FRETE_INFO = FRETE_INFO;
  readonly servicosOpcoes: ServicoAgendamento[] = ['estacionamento', 'limpeza'];
  readonly fretes: FreteAgendamento[] = ['CIF', 'FOB'];
  readonly semana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // ─── Transportadora ───────────────────────────────────────────────────
  readonly transportadoraFormId = signal<number | null>(null);
  readonly transportadoraFormNome = signal('');

  // ─── 1. Serviço ───────────────────────────────────────────────────────
  readonly servicos = signal<ServicoAgendamento[]>(['estacionamento']);
  /** Serviços com vaga destinada para a transportadora (próximos 60 dias). */
  readonly destinadoPorServico = signal<Partial<Record<ServicoAgendamento, boolean>>>({});

  // ─── 2. Dia ───────────────────────────────────────────────────────────
  readonly mesRef = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly diasInfo = signal<ReadonlyMap<string, JanelaDisponibilidadeDia>>(new Map());
  readonly carregandoMes = signal(false);
  readonly erroMes = signal<string | null>(null);
  readonly avisoMes = signal('');
  readonly dia = signal<string | null>(null);
  private procurandoPrimeiroMes = true;
  private saltosAutomaticos = 0;

  // ─── 3. Horário ───────────────────────────────────────────────────────
  readonly slots = signal<JanelaSlotDisponivel[]>([]);
  readonly carregandoSlots = signal(false);
  readonly erroSlots = signal<string | null>(null);
  readonly slot = signal<JanelaSlotDisponivel | null>(null);

  // ─── 4. Placas ────────────────────────────────────────────────────────
  readonly placas = signal<PlacaSelecionada[]>([]);
  readonly placaDigitada = signal('');
  readonly placaErro = signal('');
  readonly validandoPlaca = signal(false);
  readonly buscaPlacaAberta = signal(false);

  // ─── 5. Quem paga ─────────────────────────────────────────────────────
  // A vaga e o movimento são sempre da transportadora; aqui só se define quem recebe a fatura.
  readonly frete = signal<FreteAgendamento>('CIF');
  readonly pagadorId = signal<number | null>(null);
  readonly pagadorNome = signal('');
  /** Valor vindo de regra (destinação/cobrança): cadeado até o usuário limpar no X. */
  readonly pagadorBloqueado = signal(false);
  readonly pagadorOrigem = signal<'destinacao' | 'cobranca' | 'manual' | null>(null);
  private readonly pagadorCobranca = signal<{ id: number; nome: string } | null>(null);

  // ─── Extras ───────────────────────────────────────────────────────────
  readonly observacao = signal('');
  readonly mostrarObs = signal(false);
  readonly salvando = signal(false);
  /** Confirmação "Sair sem salvar?" dentro do próprio modal. */
  readonly confirmandoSaida = signal(false);

  private readonly cancelarResolucaoPlaca$ = new Subject<void>();
  private geracaoSelecaoPlaca = 0;
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

  private readonly placaInput = viewChild<ElementRef<HTMLInputElement>>('placaInput');
  private readonly bodyEl = viewChild<ElementRef<HTMLElement>>('bodyEl');

  // ─── Derivados ────────────────────────────────────────────────────────
  readonly modalidade = computed<ModalidadeAgendamento>(() => {
    const s = this.servicos();
    if (s.length > 1) return 3;
    return s[0] === 'limpeza' ? 2 : 1;
  });
  readonly doisServicos = computed(() => this.servicos().length > 1);
  readonly servicosLabel = computed(() =>
    this.servicos()
      .map((s) => SERVICO_INFO[s].label)
      .join(' + '),
  );
  readonly usouDestinacao = computed(() =>
    [...this.diasInfo().values()].some((d) => d.usouDestinacao),
  );

  readonly tituloMes = computed(() => {
    const m = MESES[this.mesRef().getMonth()];
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${this.mesRef().getFullYear()}`;
  });
  readonly podeVoltarMes = computed(() => {
    const hoje = new Date();
    const ref = this.mesRef();
    return ref.getFullYear() * 12 + ref.getMonth() > hoje.getFullYear() * 12 + hoje.getMonth();
  });

  readonly grade = computed<CelulaDia[]>(() => {
    const ref = this.mesRef();
    const total = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const offset = (ref.getDay() + 6) % 7; // segunda = 0
    const info = this.diasInfo();
    const hoje = hojeIso();
    const vazio = (): CelulaDia => ({
      iso: null,
      dia: 0,
      vagas: 0,
      nivel: 'sem',
      hoje: false,
      passado: false,
    });
    const cels: CelulaDia[] = Array.from({ length: offset }, vazio);
    for (let d = 1; d <= total; d++) {
      const iso = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-${pad(d)}`;
      const passado = iso < hoje;
      const vagas = passado ? 0 : Math.max(0, info.get(iso)?.totalDisponiveis ?? 0);
      cels.push({
        iso,
        dia: d,
        vagas,
        nivel: vagas === 0 ? 'sem' : vagas <= POUCAS_VAGAS ? 'pouca' : 'ok',
        hoje: iso === hoje,
        passado,
      });
    }
    while (cels.length % 7) cels.push(vazio());
    return cels;
  });
  readonly diasComVaga = computed(() => this.grade().filter((c) => c.vagas > 0).length);

  readonly slotsLivres = computed(() => this.slots().filter((s) => s.disponiveis > 0));
  readonly slotsCheios = computed(() => this.slots().length - this.slotsLivres().length);
  readonly vagasNoHorario = computed(() => this.slot()?.disponiveis ?? 0);
  readonly placasDemais = computed(
    () => !!this.slot() && this.placas().length > this.vagasNoHorario(),
  );
  /** Horário com destinação mista (a própria + terceiros): atalhos de quem paga. */
  readonly pagadoresDoHorario = computed<PagadorSlot[]>(() => {
    const p = this.slot()?.pagadores ?? [];
    return p.length > 1 ? p : [];
  });
  /** CIF fica travado enquanto o terceiro vier de regra (destinação/cobrança) com cadeado. */
  readonly freteTravado = computed(
    () => this.pagadorBloqueado() && this.pagadorOrigem() !== 'manual' && !!this.pagadorId(),
  );

  /** Número de cada pergunta (o operador tem a pergunta da transportadora antes). */
  readonly n = computed(() => {
    const base = this.podeEscolherTransportadora() ? 1 : 0;
    return {
      transportadora: 1,
      servico: base + 1,
      dia: base + 2,
      horario: base + 3,
      placa: base + 4,
      frete: base + 5,
    };
  });

  readonly passo = computed(() => ({
    transportadora: !!this.transportadoraFormId(),
    servico: this.servicos().length > 0,
    dia: !!this.dia(),
    horario: !!this.slot(),
    placas: this.placas().length > 0 && !this.placasDemais(),
    frete: this.frete() === 'CIF' || !!this.pagadorId(),
  }));

  /** Pendência em linguagem simples, na ordem em que a pessoa preenche. */
  readonly falta = computed(() => {
    if (!this.transportadoraFormId()) return 'Escolha a transportadora';
    if (!this.servicos().length) return 'Marque ao menos um serviço';
    if (!this.dia()) return 'Escolha o dia no calendário';
    if (!this.slot()) return 'Escolha o horário de chegada';
    if (!this.placas().length) return 'Informe a placa do veículo';
    if (this.placasDemais()) {
      const v = this.vagasNoHorario();
      return `Este horário tem só ${v} ${v === 1 ? 'vaga' : 'vagas'}${this.doisServicos() ? ' nos dois serviços' : ''}. Tire placas ou escolha outro horário`;
    }
    if (this.frete() === 'FOB' && !this.pagadorId()) return 'Informe quem paga (FOB) ou marque CIF';
    return '';
  });
  readonly podeSalvar = computed(() => !this.falta() && !this.salvando());
  readonly sujo = computed(
    () => !!this.dia() || this.placas().length > 0 || !!this.observacao().trim(),
  );

  constructor() {
    this.mes$
      .pipe(
        switchMap(({ ini, fim, mod, tid }) => {
          this.carregandoMes.set(true);
          this.erroMes.set(null);
          return this.janelasApi.disponibilidadePeriodo(ini, fim, mod, tid).pipe(
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

        // Abre no primeiro mês com vaga: sem vaga neste mês, avança sozinho (até 6 meses).
        if (this.procurandoPrimeiroMes) {
          if (!erro && this.diasComVaga() === 0 && this.saltosAutomaticos < 6) {
            this.saltosAutomaticos++;
            const ref = this.mesRef();
            this.mesRef.set(new Date(ref.getFullYear(), ref.getMonth() + 1, 1));
          } else {
            this.procurandoPrimeiroMes = false;
            this.avisoMes.set(
              this.saltosAutomaticos > 0 && this.diasComVaga() > 0
                ? `Abrimos em ${MESES[this.mesRef().getMonth()]} porque os meses anteriores não têm vaga.`
                : '',
            );
          }
        }
      });

    this.dia$
      .pipe(
        switchMap(({ dia, mod, tid }) => {
          this.carregandoSlots.set(true);
          this.erroSlots.set(null);
          // Grade completa (inclui horários cheios) para contar quantos não aparecem.
          return this.janelasApi
            .disponibilidade(dia, mod, tid, { incluirEsgotados: mod !== 3 })
            .pipe(
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
        const futuros = slots.filter((s) => dia !== hojeIso() || normHora(s.horaInicio) >= agora);
        this.slots.set(futuros);
        const atual = this.slot();
        const mantido = atual
          ? (futuros.find((s) => s.disponiveis > 0 && slotKey(s) === slotKey(atual)) ?? null)
          : null;
        const livres = futuros.filter((s) => s.disponiveis > 0);
        this.escolherSlot(mantido ?? (livres.length === 1 ? livres[0] : null));
      });

    // Abrir: reinicia o formulário.
    effect(() => {
      if (!this.aberto()) return;
      untracked(() => this.resetForm());
    });

    // Recarrega o mês quando muda transportadora, serviço, mês ou há evento de disponibilidade.
    effect(() => {
      const aberto = this.aberto();
      const tid = this.transportadoraFormId();
      const mod = this.modalidade();
      const ref = this.mesRef();
      this.realtime.versao();
      untracked(() => {
        if (!aberto || !tid || !this.servicos().length) return;
        const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
        this.mes$.next({ ini: isoDe(ref), fim: isoDe(fim), mod, tid });
        const dia = this.dia();
        if (dia) this.dia$.next({ dia, mod, tid });
      });
    });
  }

  /** Host cobre a viewport só enquanto algum overlay deste modal está ativo. */
  overlayAtivo(): boolean {
    return this.aberto() || this.buscaPlacaAberta();
  }

  // ─── Abertura ─────────────────────────────────────────────────────────
  private resetForm(): void {
    this.invalidarResolucoesPendentes();
    const tid =
      !this.podeEscolherTransportadora() && this.auth.isTransportadoraRole() && !this.auth.isAdmin()
        ? this.auth.resolveTransportadoraId()
        : null;
    // Operador: "Agendar de novo" já traz a transportadora da linha.
    const pre = this.podeEscolherTransportadora() ? this.transportadoraInicial() : null;
    const id = pre?.id && pre.id > 0 ? pre.id : tid && tid > 0 ? tid : null;
    this.transportadoraFormId.set(id);
    this.transportadoraFormNome.set(
      pre?.id
        ? pre.nome || ''
        : this.podeEscolherTransportadora()
          ? ''
          : this.transportadoraNome() || '',
    );
    this.placas.set([]);
    this.placaDigitada.set('');
    this.placaErro.set('');
    this.buscaPlacaAberta.set(false);
    this.observacao.set('');
    this.mostrarObs.set(false);
    this.confirmandoSaida.set(false);
    this.destinadoPorServico.set({});
    this.limparDiaEHorario();
    this.definirPagador(null, '', false, null);
    this.frete.set('CIF');

    const mod = this.modalidadeInicial();
    this.servicos.set(
      mod === 3 ? ['estacionamento', 'limpeza'] : mod === 2 ? ['limpeza'] : ['estacionamento'],
    );
    this.posicionarMes(this.diaInicial());
    if (this.transportadoraFormId()) this.aoDefinirTransportadora(!mod);

    for (const p of this.placasIniciais() ?? []) this.adicionarPlacaPorTexto(p, true);
  }

  /** Volta ao mês do dia pedido (ou ao atual, procurando o primeiro mês com vaga). */
  private posicionarMes(diaInicial: string | null): void {
    const hoje = new Date();
    const valido =
      !!diaInicial && /^\d{4}-\d{2}-\d{2}$/.test(diaInicial) && diaInicial >= hojeIso();
    const ref = valido
      ? new Date(Number(diaInicial!.slice(0, 4)), Number(diaInicial!.slice(5, 7)) - 1, 1)
      : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    this.procurandoPrimeiroMes = !valido;
    this.saltosAutomaticos = 0;
    this.avisoMes.set('');
    if (this.mesRef().getTime() !== ref.getTime()) this.mesRef.set(ref);
    if (valido) this.escolherDia(diaInicial!);
  }

  /** Transportadora definida: regra de cobrança (padrão do FOB) e serviços com destinação. */
  private aoDefinirTransportadora(escolherServicosDestinados: boolean): void {
    const tid = this.transportadoraFormId();
    this.carregarPagadorCobranca(tid);
    if (!tid) return;
    const ini = hojeIso();
    const f = new Date();
    f.setDate(f.getDate() + 59);
    const fim = isoDe(f);
    const consulta = (mod: 1 | 2) =>
      this.janelasApi.disponibilidadePeriodo(ini, fim, mod, tid).pipe(
        map((dias) => dias.some((d) => d.usouDestinacao)),
        catchError(() => of(false)),
      );
    consulta(1)
      .pipe(switchMap((est) => consulta(2).pipe(map((limp) => ({ est, limp })))))
      .subscribe(({ est, limp }) => {
        if (tid !== this.transportadoraFormId()) return;
        this.destinadoPorServico.set({ estacionamento: est, limpeza: limp });
        // Vêm marcados os serviços que têm vaga destinada; sem nenhum, Estacionamento.
        if (escolherServicosDestinados && !this.dia()) {
          const destinados = this.servicosOpcoes.filter((s) =>
            s === 'estacionamento' ? est : limp,
          );
          if (destinados.length) this.aplicarServicos(destinados);
        }
      });
  }

  private invalidarResolucoesPendentes(): void {
    this.geracaoSelecaoPlaca += 1;
    this.cancelarResolucaoPlaca$.next();
  }

  // ─── Transportadora (operador) ────────────────────────────────────────
  onTransportadoraIdChange(id: number | null): void {
    if (!this.podeEscolherTransportadora()) return;
    this.invalidarResolucoesPendentes();
    this.transportadoraFormId.set(id && id > 0 ? id : null);
    this.placas.set([]);
    this.destinadoPorServico.set({});
    // Vagas dependem da destinação da transportadora: escolhe dia/horário de novo.
    this.limparDiaEHorario();
    this.definirPagador(null, '', false, null);
    this.frete.set('CIF');
    this.posicionarMes(null);
    this.aoDefinirTransportadora(true);
  }

  onTransportadoraNomeChange(nome: string): void {
    if (!this.podeEscolherTransportadora()) return;
    this.transportadoraFormNome.set(nome || '');
  }

  // ─── 1. Serviço ───────────────────────────────────────────────────────
  alternarServico(s: ServicoAgendamento, marcado: boolean): void {
    const atual = this.servicos();
    const novo = marcado
      ? this.servicosOpcoes.filter((x) => x === s || atual.includes(x))
      : atual.filter((x) => x !== s);
    this.aplicarServicos(novo);
  }

  private aplicarServicos(servicos: ServicoAgendamento[]): void {
    this.servicos.set(servicos);
    this.limparDiaEHorario();
    this.posicionarMes(null);
  }

  // ─── 2. Dia ───────────────────────────────────────────────────────────
  mudarMes(delta: number): void {
    this.procurandoPrimeiroMes = false;
    this.avisoMes.set('');
    const ref = this.mesRef();
    this.mesRef.set(new Date(ref.getFullYear(), ref.getMonth() + delta, 1));
  }

  escolherDia(iso: string): void {
    this.dia.set(iso);
    this.slots.set([]);
    this.escolherSlot(null);
    const tid = this.transportadoraFormId();
    if (tid && this.servicos().length) this.dia$.next({ dia: iso, mod: this.modalidade(), tid });
  }

  /** Setas do teclado andam pelos dias com vaga do mês. */
  onGradeKeydown(ev: KeyboardEvent): void {
    const passos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const p = passos[ev.key];
    const atual = (ev.target as HTMLElement).dataset['iso'];
    if (!p || !atual) return;
    ev.preventDefault();
    const raiz = ev.currentTarget as HTMLElement;
    let alvo = atual;
    for (let i = 0; i < 62; i++) {
      const d = new Date(`${alvo}T12:00:00`);
      d.setDate(d.getDate() + p);
      alvo = isoDe(d);
      if (!raiz.querySelector(`[data-iso="${alvo}"]`)) return; // saiu do mês
      const btn = raiz.querySelector<HTMLButtonElement>(
        `button[data-iso="${alvo}"]:not([disabled])`,
      );
      if (btn) {
        btn.focus();
        return;
      }
    }
  }

  celulaLabel(c: CelulaDia): string {
    if (!c.iso) return '';
    const base = `${c.dia} de ${MESES[this.mesRef().getMonth()]}, ${this.diaSemana(c.iso)}`;
    if (c.passado) return `${base}: dia já passou`;
    if (!c.vagas) return `${base}: sem vaga`;
    return `${base}: ${c.vagas} ${c.vagas === 1 ? 'vaga' : 'vagas'}${c.nivel === 'pouca' ? ', poucas vagas' : ''}`;
  }

  diaSemana(iso: string): string {
    return SEMANA_LONGA[(new Date(`${iso}T12:00:00`).getDay() + 6) % 7];
  }

  /** Dia escolhido sumiu (lotou/mudou serviço): limpa a seleção. */
  private validarDiaSelecionado(): void {
    const dia = this.dia();
    if (!dia) return;
    const ref = this.mesRef();
    if (!dia.startsWith(`${ref.getFullYear()}-${pad(ref.getMonth() + 1)}`)) return;
    const info = this.diasInfo().get(dia);
    if (!info || info.totalDisponiveis <= 0) this.limparDiaEHorario();
  }

  private limparDiaEHorario(): void {
    this.dia.set(null);
    this.slots.set([]);
    this.escolherSlot(null);
  }

  // ─── 3. Horário ───────────────────────────────────────────────────────
  escolherSlot(s: JanelaSlotDisponivel | null): void {
    this.slot.set(s);
    // Novo horário: o padrão de quem paga volta a valer.
    if (this.pagadorOrigem() === 'manual') this.pagadorOrigem.set(null);
    this.aplicarPagadorPadrao();
  }

  ehSlot(s: JanelaSlotDisponivel): boolean {
    const atual = this.slot();
    return !!atual && slotKey(atual) === slotKey(s);
  }

  chave(s: JanelaSlotDisponivel): string {
    return slotKey(s);
  }

  hora(raw: string): string {
    return normHora(raw);
  }

  // ─── 4. Placas ────────────────────────────────────────────────────────
  onPlaca(v: string): void {
    this.placaDigitada.set(
      String(v ?? '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 7),
    );
    this.placaErro.set('');
  }

  adicionarPlaca(): void {
    const p = this.placaDigitada();
    if (!p || this.validandoPlaca()) return;
    this.adicionarPlacaPorTexto(p, false);
  }

  /**
   * Placa digitada: precisa estar cadastrada (com motorista) e ser da transportadora.
   * `silencioso` = pré-preenchida (Agendar de novo): erro vai para toast.
   */
  private adicionarPlacaPorTexto(texto: string, silencioso: boolean): void {
    const p = normalizePlaca(texto);
    const erro = (msg: string) => (silencioso ? this.toast.error(msg) : this.placaErro.set(msg));
    if (!PLACA_RE.test(p)) {
      erro('Placa inválida. Use o formato ABC1D23 ou ABC1234.');
      return;
    }
    if (this.placas().some((x) => normalizePlaca(x.placa) === p)) {
      if (!silencioso) erro('Essa placa já está na lista.');
      return;
    }
    const tid = this.transportadoraFormId();
    if (!tid) {
      erro('Escolha a transportadora antes de informar a placa.');
      return;
    }
    const geracao = this.geracaoSelecaoPlaca;
    this.validandoPlaca.set(true);
    this.api
      .obterPorPlaca(p)
      .pipe(
        switchMap((agg) => {
          if (!agg || !(agg.veiculoId > 0)) {
            return of({
              erro: `Placa ${formatPlacaDisplay(p)} não encontrada no cadastro de veículos.`,
            });
          }
          if (agg.transportadoraId && agg.transportadoraId !== tid) {
            return of({ erro: `A placa ${formatPlacaDisplay(p)} é de outra transportadora.` });
          }
          const base: PlacaSelecionada = {
            id: agg.veiculoId,
            placa: agg.veiculoPlaca || p,
            marcaModelo:
              [agg.veiculoMarca, agg.veiculoModelo].filter(Boolean).join(' ') || undefined,
            motoristaId: agg.motoristaId > 0 ? agg.motoristaId : null,
            motoristaNome: agg.motoristaNome || null,
            motoristaCpf: agg.motoristaCpf || null,
          };
          return this.resolverMotoristaDaPlaca(base, tid).pipe(
            map((r) =>
              r.motoristaId && r.motoristaId > 0
                ? { placa: r }
                : {
                    erro: `A placa ${formatPlacaDisplay(p)} não tem motorista vinculado. Vincule um motorista no cadastro do veículo.`,
                  },
            ),
          );
        }),
        catchError(() =>
          of({ erro: `Não foi possível validar a placa ${formatPlacaDisplay(p)}.` }),
        ),
        takeUntil(this.cancelarResolucaoPlaca$),
        finalize(() => this.validandoPlaca.set(false)),
      )
      .subscribe((r: { placa?: PlacaSelecionada; erro?: string }) => {
        if (geracao !== this.geracaoSelecaoPlaca || !this.aberto()) return;
        if (r.erro || !r.placa) {
          erro(r.erro || 'Placa inválida.');
          return;
        }
        const nova = r.placa;
        if (this.placas().some((x) => x.id === nova.id)) return;
        this.placas.update((l) => [...l, nova]);
        if (!silencioso) {
          this.placaDigitada.set('');
          this.placaInput()?.nativeElement.focus();
        }
      });
  }

  removerPlaca(id: number): void {
    this.placas.update((l) => l.filter((x) => x.id !== id));
    this.placaInput()?.nativeElement.focus();
  }

  formatPlaca(placa: string | null | undefined): string {
    return formatPlacaDisplay(placa) || placa || '—';
  }

  abrirBuscaPlaca(): void {
    if (!this.transportadoraFormId()) {
      this.placaErro.set('Escolha a transportadora antes de buscar placas.');
      return;
    }
    this.buscaPlacaAberta.set(true);
  }

  fecharBuscaPlaca(): void {
    this.buscaPlacaAberta.set(false);
  }

  idsPlacasJaSelecionadas(): number[] {
    return this.placas().map((p) => p.id);
  }

  /** Confirmação em lote do modal "Buscar no cadastro". */
  onPlacasBuscaSelecionadas(itens: PaginatedSearchItem[]): void {
    if (!itens?.length) return;
    this.buscaPlacaAberta.set(false);
    let inativas = 0;
    for (const item of itens) {
      if ((item.campo5 || '').trim().toLowerCase() === 'não') {
        inativas += 1;
        continue;
      }
      const placa = String(item.titulo || '').trim();
      if (placa) this.adicionarPlacaPorTexto(placa, true);
    }
    if (inativas) {
      this.toast.warning(
        inativas === 1
          ? '1 placa inativa foi ignorada.'
          : `${inativas} placas inativas foram ignoradas.`,
      );
    }
  }

  // ─── 5. Quem paga ─────────────────────────────────────────────────────
  escolherFrete(f: FreteAgendamento): void {
    if (f === 'CIF' && this.freteTravado()) return;
    this.frete.set(f);
    if (f === 'CIF') this.definirPagador(null, '', false, 'manual');
    else if (!this.pagadorId()) {
      // FOB: começa pelo terceiro da regra de cobrança, se houver.
      const c = this.pagadorCobranca();
      if (c) this.definirPagador(c.id, c.nome, false, 'manual');
      else this.pagadorOrigem.set('manual');
    }
  }

  private definirPagador(
    id: number | null,
    nome: string,
    bloqueado: boolean,
    origem: 'destinacao' | 'cobranca' | 'manual' | null,
  ): void {
    this.pagadorId.set(id && id > 0 ? id : null);
    this.pagadorNome.set(id && id > 0 ? nome : '');
    this.pagadorBloqueado.set(bloqueado && !!id);
    this.pagadorOrigem.set(origem);
  }

  /** Regra de cobrança ativa da transportadora: se for FOB, o terceiro vira o padrão. */
  private carregarPagadorCobranca(transportadoraId: number | null): void {
    this.pagadorCobranca.set(null);
    if (!transportadoraId) return;
    this.cobrancaApi
      .listar({
        transportadoraId,
        status: StatusConfiguracaoCobranca.Ativa,
        numeroPagina: 1,
        tamanhoPagina: 5,
      })
      .pipe(catchError(() => of(null)))
      .subscribe((page) => {
        if (transportadoraId !== this.transportadoraFormId()) return;
        const regra = page?.items?.[0];
        this.pagadorCobranca.set(
          regra?.tipoPagador === 'terceiro' && regra.responsavelFaturamentoId
            ? {
                id: regra.responsavelFaturamentoId,
                nome:
                  regra.responsavelFaturamentoNome || `Pagador #${regra.responsavelFaturamentoId}`,
              }
            : null,
        );
        this.aplicarPagadorPadrao();
      });
  }

  /**
   * Padrão de quem paga: destinação do horário (1 pagador) > regra de cobrança > a própria.
   * Não mexe se o usuário já escolheu manualmente.
   */
  private aplicarPagadorPadrao(): void {
    if (this.pagadorOrigem() === 'manual') return;
    const opcoes = this.slot()?.pagadores ?? [];
    if (opcoes.length === 1) {
      const p = opcoes[0];
      this.definirPagador(p.responsavelFaturamentoId, p.nome ?? '', true, 'destinacao');
    } else if (opcoes.length > 1) {
      const p = opcoes.find((o) => o.disponiveis > 0) ?? opcoes[0];
      this.definirPagador(p.responsavelFaturamentoId, p.nome ?? '', false, 'destinacao');
    } else {
      const c = this.pagadorCobranca();
      if (c) this.definirPagador(c.id, c.nome, true, 'cobranca');
      else this.definirPagador(null, '', false, null);
    }
    this.frete.set(this.pagadorId() ? 'FOB' : 'CIF');
  }

  /** Lookup: o X limpa e libera a busca; escolher outro = manual. */
  onPagadorIdChange(id: number | null): void {
    this.pagadorId.set(id && id > 0 ? id : null);
    this.pagadorBloqueado.set(false);
    this.pagadorOrigem.set('manual');
    if (!id) this.pagadorNome.set('');
  }

  onPagadorNomeChange(nome: string): void {
    this.pagadorNome.set(nome || '');
  }

  escolherPagadorDoHorario(p: PagadorSlot): void {
    this.definirPagador(p.responsavelFaturamentoId, p.nome ?? '', false, 'manual');
    this.frete.set(p.responsavelFaturamentoId ? 'FOB' : 'CIF');
  }

  pagadorEhOpcao(p: PagadorSlot): boolean {
    return (p.responsavelFaturamentoId ?? null) === this.pagadorId();
  }

  // ─── Fechar / salvar ──────────────────────────────────────────────────
  onEscape(): void {
    if (!this.aberto() || this.buscaPlacaAberta()) return;
    if (this.confirmandoSaida()) this.confirmandoSaida.set(false);
    else this.cancelar();
  }

  /** Com algo preenchido, pergunta antes de descartar. */
  cancelar(): void {
    if (this.sujo() && !this.salvando()) {
      this.confirmandoSaida.set(true);
      return;
    }
    this.fechar();
  }

  fechar(): void {
    this.invalidarResolucoesPendentes();
    this.confirmandoSaida.set(false);
    this.buscaPlacaAberta.set(false);
    this.fechado.emit();
  }

  salvar(): void {
    if (!this.podeSalvar()) {
      this.focarPendencia();
      return;
    }
    const tid = this.transportadoraFormId()!;
    const s = this.slot()!;
    const dataAgendamento = datetimeLocalInputToApiIso(`${this.dia()}T${normHora(s.horaInicio)}`);
    if (!dataAgendamento) {
      this.toast.error('Data/hora inválida.');
      return;
    }
    const observacao = this.observacao().trim() || null;
    const isTransportadora = this.auth.isTransportadoraRole();
    const isAdmin = this.auth.isAdmin();
    const pagadorId = this.frete() === 'FOB' ? this.pagadorId() : null;

    this.salvando.set(true);
    // Em sequência: cada POST ocupa uma vaga e o backend valida o saldo do horário a cada um.
    from(this.placas())
      .pipe(
        concatMap((veiculo) =>
          this.resolverPayloadPlaca(
            veiculo,
            tid,
            dataAgendamento,
            observacao,
            isTransportadora,
            isAdmin,
          ).pipe(
            switchMap((resolved) => {
              if (!resolved.ok) {
                return of({
                  success: false as const,
                  placa: veiculo.placa,
                  message: resolved.message,
                });
              }
              return this.api
                .gravar({
                  ...resolved.payload,
                  modalidadeAgendamento: this.modalidade(),
                  // Sempre explícito: 1 = a própria (CIF), 2 = terceiro (FOB).
                  tipoPagador: pagadorId ? 2 : 1,
                  responsavelFaturamentoId: pagadorId,
                })
                .pipe(
                  map((res) => ({
                    success: res.success,
                    placa: veiculo.placa,
                    message: res.message,
                  })),
                );
            }),
            catchError(() =>
              of({
                success: false as const,
                placa: veiculo.placa,
                message: 'Falha ao criar agendamento.',
              }),
            ),
          ),
        ),
        toArray(),
        finalize(() => this.salvando.set(false)),
      )
      .subscribe((results) => {
        const ok = results.filter((r) => r.success);
        const falhas = results.filter((r) => !r.success);
        const quando = `${this.dia()!.split('-').reverse().slice(0, 2).join('/')} às ${normHora(s.horaInicio)}`;

        if (ok.length) {
          const transportadoraLabel = this.transportadoraFormNome().trim() || '—';
          for (const item of ok) {
            this.portariaAlertas.push({
              id: `agendamento-${item.placa}-${Date.now()}-${Math.random()}`,
              titulo: 'Agendamento registrado',
              descricao: `Placa ${formatPlacaDisplay(item.placa) || item.placa} - ${transportadoraLabel}`,
            });
          }
        }
        if (ok.length && !falhas.length) {
          this.toast.success(
            ok.length === 1
              ? `Agendamento salvo: ${quando}.`
              : `${ok.length} agendamentos salvos: ${quando}.`,
          );
          this.fechar();
          this.salvo.emit();
          return;
        }
        if (ok.length && falhas.length) {
          // Tira da lista as placas que já foram salvas; ficam só as que falharam.
          const salvas = new Set(ok.map((o) => o.placa));
          this.placas.update((l) => l.filter((p) => !salvas.has(p.placa)));
          this.toast.warning(
            `${ok.length} salvo(s); ${falhas.length} com erro: ${falhas
              .map((f) => `${formatPlacaDisplay(f.placa) || f.placa} (${f.message || 'erro'})`)
              .join(', ')}`,
          );
          this.salvo.emit();
          return;
        }
        this.toast.error(falhas[0]?.message || 'Não foi possível criar o agendamento.');
      });
  }

  private focarPendencia(): void {
    const root = this.bodyEl()?.nativeElement;
    const alvo = !this.dia()
      ? root?.querySelector<HTMLElement>('.cal__day:not([disabled])')
      : !this.slot()
        ? root?.querySelector<HTMLElement>('.hora input')
        : !this.placas().length || this.placasDemais()
          ? this.placaInput()?.nativeElement
          : root?.querySelector<HTMLElement>('.frete-busca input, .frete-busca button');
    alvo?.focus();
    alvo?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  private resolverPayloadPlaca(
    veiculo: PlacaSelecionada,
    transportadoraId: number,
    dataAgendamento: string,
    observacao: string | null,
    isTransportadora: boolean,
    isAdmin: boolean,
  ): Observable<ResolvePlacaResult> {
    const placa = normalizePlaca(veiculo.placa);
    const fmt = formatPlacaDisplay(veiculo.placa) || veiculo.placa;
    if (!placaCompleta(placa)) return of({ ok: false, message: `Placa ${fmt} inválida.` });

    return this.resolverMotoristaDaPlaca(veiculo, transportadoraId).pipe(
      map((resolved): ResolvePlacaResult => {
        const motoristaId =
          resolved.motoristaId && resolved.motoristaId > 0 ? resolved.motoristaId : null;
        if (!motoristaId) {
          return {
            ok: false,
            message: `A placa ${fmt} não possui motorista vinculado. Vincule um motorista no cadastro do veículo.`,
          };
        }
        return {
          ok: true,
          payload: {
            dataAgendamento,
            observacao,
            transportadoraId,
            motorista: {
              id: motoristaId,
              cpf: resolved.motoristaCpf || null,
              nome: resolved.motoristaNome || null,
            },
            veiculo: { id: resolved.id, placa },
          } satisfies AgendamentoPostInput,
        };
      }),
      switchMap((result) => {
        if (!result.ok || !(isTransportadora && !isAdmin)) return of(result);
        // Garante que a placa pertence à transportadora da sessão.
        return this.api.obterPorPlaca(placa).pipe(
          map((agg): ResolvePlacaResult => {
            if (!agg) return { ok: false, message: `Não foi possível validar a placa ${fmt}.` };
            if (agg.transportadoraId && agg.transportadoraId !== transportadoraId) {
              return {
                ok: false,
                message: `A placa ${fmt} não pertence à transportadora da sessão.`,
              };
            }
            return result;
          }),
          catchError(() =>
            of<ResolvePlacaResult>({
              ok: false,
              message: `Não foi possível validar a placa ${fmt}.`,
            }),
          ),
        );
      }),
      catchError(() =>
        of<ResolvePlacaResult>({ ok: false, message: `Não foi possível validar a placa ${fmt}.` }),
      ),
    );
  }

  /** Resolve motorista: chip → GET Agendamento/por-placa → GET Veiculo por id. */
  private resolverMotoristaDaPlaca(
    veiculo: PlacaSelecionada,
    transportadoraId: number,
  ): Observable<PlacaSelecionada> {
    if (veiculo.motoristaId && veiculo.motoristaId > 0) return of(veiculo);
    const placa = normalizePlaca(veiculo.placa);
    return this.api.obterPorPlaca(placa).pipe(
      switchMap((agg) => {
        if (agg?.motoristaId && agg.motoristaId > 0) {
          return of({
            ...veiculo,
            id: agg.veiculoId > 0 ? agg.veiculoId : veiculo.id,
            motoristaId: agg.motoristaId,
            motoristaNome: agg.motoristaNome || veiculo.motoristaNome || null,
            motoristaCpf: agg.motoristaCpf || veiculo.motoristaCpf || null,
          });
        }
        if (!(transportadoraId > 0 && veiculo.id > 0)) return of(veiculo);
        return this.veiculoApi.obterPorId(veiculo.id, transportadoraId).pipe(
          map((detalhe) => {
            if (!detalhe) return veiculo;
            const vinculo =
              detalhe.motoristasVinculos?.find((m) => m.principal === true) ??
              detalhe.motoristasVinculos?.[0];
            const mid =
              (detalhe.motoristaId && detalhe.motoristaId > 0 ? detalhe.motoristaId : null) ??
              (vinculo && vinculo.id > 0 ? vinculo.id : null);
            if (!mid) return veiculo;
            return {
              ...veiculo,
              motoristaId: mid,
              motoristaNome:
                detalhe.motoristaNome || vinculo?.nome || veiculo.motoristaNome || null,
              motoristaCpf: vinculo?.cpf || veiculo.motoristaCpf || null,
            };
          }),
          catchError(() => of(veiculo)),
        );
      }),
      catchError(() => of(veiculo)),
    );
  }
}
