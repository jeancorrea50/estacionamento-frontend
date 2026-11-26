import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogConfig,
  MatDialogRef,
} from '@angular/material/dialog';
import { Observable, Subject, firstValueFrom, forkJoin, from, of } from 'rxjs';
import {
  catchError,
  concatMap,
  debounceTime,
  defaultIfEmpty,
  distinctUntilChanged,
  filter,
  first,
  map,
  switchMap,
  toArray,
} from 'rxjs/operators';

import { AuthService } from '../../../../../../core/services/auth.service';
import {
  CadastroConfirmDialogComponent,
  type CadastroConfirmDialogData,
} from '../../../../../cadastro/components/cadastro-confirm-dialog/cadastro-confirm-dialog.component';
import { ResponsavelFaturamentoService } from '../../../../../cadastro/services/responsavel-faturamento.service';
import { TransportadoraService } from '../../../../../cadastro/services/transportadora.service';
import {
  ModalidadeCobranca,
  StatusConfiguracaoCobranca,
} from '../../../../../financeiro/models/configuracao-cobranca.models';
import type { ConfigCobrancaVagasAcordo } from '../../../../../financeiro/pages/faturamento-page/config-cobranca/faturamento-config-cobranca.types';
import { ConfiguracaoCobrancaService } from '../../../../../financeiro/services/configuracao-cobranca.service';
import { JANELAS_ROUTE } from '../../../../agendamento-rotas';
import { calcularCotaDia } from '../cota-acordo.util';
import { QtyStepperComponent } from './qty-stepper.component';
import type { ModalidadeAgendamento } from '../../../../models/janela-agendamento.models';
import type { VagaReservaTransportadoraInput } from '../../../../models/vaga-disponibilidade.models';
import { JanelaAgendamentoService } from '../../../../services/janela-agendamento.service';
import { VagaDisponibilidadeService } from '../../../../services/vaga-disponibilidade.service';
import {
  DestinacaoFormData,
  DestinacaoFormResult,
  Empresa,
  Faturamento,
  Janela,
  MODALIDADES,
  Modalidade,
  RECORRENCIAS,
  RECORRENCIA_LABEL,
  Recorrencia,
  TipoFaturamento,
  Transportadora,
  TransportadoraSelecionada,
} from '../destinacao.models';
import {
  calcularJanelas,
  grupoIdDe,
  hojeISO,
  janelaKey,
  modalidadeParaApi,
  montarInput,
  somarDias,
} from '../destinacao.mapper';

/**
 * Modal amplo (quase tela cheia) — fecha só por X / Cancelar / Esc com confirmação.
 * O visual do painel vem de `.gts-dialog-main` no styles.css global.
 */
export const DESTINACAO_DIALOG_CONFIG: MatDialogConfig = {
  panelClass: 'gts-dialog-main',
  ariaLabelledBy: 'dst-dlg-title',
  disableClose: true,
  autoFocus: 'first-tabbable',
  restoreFocus: true,
  maxWidth: '100vw',
  width: 'min(1280px, calc(100vw - 32px))',
  height: 'min(900px, calc(100dvh - 32px))',
};

type Operacao =
  | { tipo: 'criar'; input: VagaReservaTransportadoraInput }
  | { tipo: 'alterar'; id: number; input: VagaReservaTransportadoraInput }
  | { tipo: 'excluir'; id: number };

@Component({
  selector: 'app-destinacao-form-dialog',
  standalone: true,
  imports: [FormsModule, DatePipe, QtyStepperComponent],
  templateUrl: './destinacao-form-dialog.component.html',
  styleUrl: './destinacao-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinacaoFormDialogComponent {
  private readonly ref =
    inject<MatDialogRef<DestinacaoFormDialogComponent, DestinacaoFormResult>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  private readonly api = inject(VagaDisponibilidadeService);
  private readonly janelasApi = inject(JanelaAgendamentoService);
  private readonly transportadorasApi = inject(TransportadoraService);
  private readonly responsaveisApi = inject(ResponsavelFaturamentoService);
  private readonly cobrancaApi = inject(ConfiguracaoCobrancaService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = inject<DestinacaoFormData>(MAT_DIALOG_DATA);

  readonly janelasRoute = JANELAS_ROUTE;
  readonly modalidades = MODALIDADES;
  readonly recorrencias =
    this.data.destinacao?.recorrencia === 'personalizado'
      ? [...RECORRENCIAS, { id: 'personalizado' as const, label: RECORRENCIA_LABEL.personalizado }]
      : RECORRENCIAS;

  private readonly patio: Empresa = {
    id: 0,
    nome: this.auth.getSessionEstacionamento()?.nome?.trim() || 'Pátio',
  };
  /** Responsáveis de faturamento ativos — servem de pagador e de "quem destina". */
  readonly pagadores = signal<Empresa[]>([]);
  readonly destinadores = computed<Empresa[]>(() => {
    const lista = [this.patio, ...this.pagadores()];
    const atual = this.data.destinacao?.destinador;
    return atual && atual.id && !lista.some((e) => e.id === atual.id) ? [...lista, atual] : lista;
  });
  readonly sugestoes = signal<Transportadora[]>([]);
  readonly buscandoTransportadoras = signal(false);

  readonly usuario = signal(this.auth.getLoggedUser()?.username || 'você');

  readonly modo = this.data.modo;
  readonly editando = this.modo === 'editar';
  readonly titulo =
    this.modo === 'editar'
      ? 'Editar destinação'
      : this.modo === 'duplicar'
        ? 'Duplicar destinação'
        : 'Nova destinação';

  // ─── Estado do formulário ─────────────────────────────────────────────
  readonly destinadorId = signal(0);
  readonly selecionadas = signal<TransportadoraSelecionada[]>([]);
  readonly busca = signal('');
  readonly comboAberto = signal(false);
  readonly comboAtivo = signal(0);
  readonly avulso = signal(false);
  readonly modalidade = signal<Modalidade>('estacionamento');
  readonly vigInicio = signal(somarDias(hojeISO(), 1));
  readonly vigFim = signal('');
  readonly recorrencia = signal<Recorrencia>('todos');
  /**
   * Vagas por horário e por destino: janelaId → (transportadoraId | 'avulso') → vagas/dia.
   * Cada transportadora pode ter sua própria quantidade no mesmo horário (regra de cobrança própria).
   */
  readonly qtd = signal<Record<string, Record<string, number>>>({});
  /** Quantidade usada ao marcar um horário (para cada transportadora). */
  readonly padrao = signal<number | null>(1);
  /** Horários com o detalhamento "por transportadora" aberto. */
  readonly detalhados = signal<ReadonlySet<string>>(new Set());
  readonly transferencia = signal(false);
  readonly salvando = signal(false);

  readonly janelasDoDia = signal<Janela[]>([]);
  readonly carregandoJanelas = signal(false);
  readonly proximoDiaComJanela = signal<string | null>(null);

  private readonly buscaInput = viewChild<ElementRef<HTMLInputElement>>('buscaInput');
  private readonly horariosGrupo = viewChild<ElementRef<HTMLElement>>('horariosGrupo');
  private readonly bodyEl = viewChild<ElementRef<HTMLElement>>('bodyEl');

  private readonly busca$ = new Subject<string>();
  private readonly janelas$ = new Subject<void>();
  /** Reservas da própria destinação (edição): não contam contra o saldo livre. */
  private readonly idsProprios = new Set<number>(
    this.editando ? (this.data.destinacao?.itens ?? []).map((i) => i.id) : [],
  );
  private snapshot = '';

  constructor() {
    this.preencher();
    this.snapshot = this.serializar();

    this.ref
      .keydownEvents()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        if (e.key === 'Escape' && !this.comboAberto()) {
          e.preventDefault();
          void this.cancelar();
        }
      });

    this.responsaveisApi
      .buscar({ Ativo: true, NumeroPagina: 1, TamanhoPagina: 200 })
      .pipe(
        map((page) =>
          (page.items ?? [])
            .map((r) => ({
              id: r.id,
              nome: (r.nomeFantasia || r.razaoSocial || '').trim(),
              cnpj: r.cnpj,
            }))
            .filter((r) => r.id > 0 && r.nome)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        ),
        catchError(() => of([] as Empresa[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lista) => this.pagadores.set(lista));

    this.busca$
      .pipe(
        map((t) => t.trim()),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((termo) => {
          this.buscandoTransportadoras.set(true);
          return this.transportadorasApi
            .listarTransportadoras({
              Termo: termo || undefined,
              NumeroPagina: 1,
              TamanhoPagina: 12,
            })
            .pipe(
              map((page) =>
                (page.items ?? [])
                  .filter((t) => t.ativo !== false)
                  .map((t): Transportadora => ({
                    id: t.id,
                    nome: (t.razaoSocial || t.nomeFantasia || '').trim(),
                    cnpj: t.cnpj,
                  })),
              ),
              catchError(() => of([] as Transportadora[])),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((lista) => {
        this.buscandoTransportadoras.set(false);
        this.sugestoes.set(lista);
        this.comboAtivo.set(0);
      });

    this.janelas$
      .pipe(
        switchMap(() => {
          const dia = this.vigInicio();
          const modalidade = this.modalidade();
          this.carregandoJanelas.set(true);
          this.proximoDiaComJanela.set(null);
          return this.slotsDoDia(dia, modalidade).pipe(
            map((slots) => ({ dia, modalidade, slots })),
            catchError(() => of({ dia, modalidade, slots: [] as SlotDia[] })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ dia, modalidade, slots }) => {
        this.carregandoJanelas.set(false);
        this.janelasDoDia.set(this.montarJanelas(slots, dia, modalidade));
        if (!this.janelasDoDia().length) this.procurarProximoDia(dia, modalidade);
      });

    this.janelas$.next();
    this.busca$.next('');
  }

  // ─── Derivados ────────────────────────────────────────────────────────
  readonly destinador = computed(
    () => this.destinadores().find((e) => e.id === this.destinadorId()) ?? null,
  );

  readonly sugestoesFiltradas = computed(() => {
    const ja = new Set(this.selecionadas().map((s) => s.transportadora.id));
    return this.sugestoes()
      .filter((t) => !ja.has(t.id))
      .slice(0, 8);
  });

  /** Destinos: cada transportadora selecionada (chave = id) ou o avulso. */
  readonly destinos = computed(() =>
    this.avulso()
      ? [{ id: 'avulso', nome: 'Avulso', saldoAcordo: undefined as number | undefined }]
      : this.selecionadas().map((s) => ({
          id: String(s.transportadora.id),
          nome: s.transportadora.nome,
          saldoAcordo: s.transportadora.saldoAcordo,
        })),
  );
  readonly multi = computed(() => this.destinos().length > 1);

  readonly totalHorarios = computed(() => Object.keys(this.qtd()).length);
  readonly fimInvalido = computed(() => !!this.vigFim() && this.vigFim() < this.vigInicio());
  readonly horariosMarcados = computed(() => this.janelasDoDia().filter((j) => j.id in this.qtd()));

  /** Vagas/dia de cada destino somando os horários marcados. */
  readonly totalPorDestino = computed(() => {
    const t: Record<string, number> = {};
    for (const d of this.destinos()) t[d.id] = 0;
    for (const j of this.horariosMarcados()) {
      for (const [k, v] of Object.entries(this.qtd()[j.id] ?? {})) if (k in t) t[k] += v;
    }
    return t;
  });
  readonly totalVagasDia = computed(() =>
    Object.values(this.totalPorDestino()).reduce((s, n) => s + n, 0),
  );

  /** Horários cuja soma passa o saldo livre da janela (bloqueia — backend também recusa). */
  readonly horariosExcedidos = computed(() =>
    this.horariosMarcados().filter((j) => this.soma(j) > this.maxPara(j)),
  );

  /**
   * Destinos acima do saldo do acordo: não bloqueia — vira excedente na cobrança
   * (pede confirmação ao gravar; o backend exige essa confirmação).
   */
  readonly acimaDoAcordo = computed(() =>
    this.destinos().filter(
      (d) => d.saldoAcordo !== undefined && this.totalPorDestino()[d.id] > d.saldoAcordo,
    ),
  );

  /** Transportadoras sem regra de cobrança ativa: não geram fatura automática. */
  readonly semCobranca = computed(() =>
    this.selecionadas().filter((s) => s.transportadora.semCobranca),
  );

  readonly pendencias = computed(() => {
    const p: string[] = [];
    if (!this.destinador()) p.push('quem destina');
    if (!this.avulso() && !this.selecionadas().length) p.push('transportadora ou Avulso');
    const semPagador = this.selecionadas().filter(
      (s) => s.faturamento.tipo === 'terceiro' && !s.faturamento.pagador,
    );
    if (semPagador.length) p.push(`pagador terceiro (${semPagador.length})`);
    if (this.fimInvalido()) p.push('fim antes do início');
    if (this.carregandoJanelas()) p.push('carregando horários');
    else if (!this.janelasDoDia().length) p.push('janelas na vigência');
    else if (!this.totalHorarios()) p.push('ao menos um horário');
    const exc = this.horariosExcedidos();
    if (exc.length) p.push(`saldo excedido em ${exc.map((j) => j.inicio).join(', ')}`);
    return p;
  });
  readonly podeSalvar = computed(() => !this.pendencias().length && !this.salvando());

  // ─── Helpers ──────────────────────────────────────────────────────────
  plural(n: number, um: string, varios: string): string {
    return `${n} ${n === 1 ? um : varios}`;
  }

  maxPara(j: Janela): number {
    return j.livres;
  }

  janelaMarcada(j: Janela): boolean {
    return j.id in this.qtd();
  }

  soma(j: Janela): number {
    return Object.values(this.qtd()[j.id] ?? {}).reduce((s, n) => s + n, 0);
  }

  /** Valor comum do horário, ou null se as transportadoras têm quantidades diferentes. */
  valorTodos(j: Janela): number | null {
    const vs = Object.values(this.qtd()[j.id] ?? {});
    return vs.length && vs.every((v) => v === vs[0]) ? vs[0] : null;
  }

  /** Teto do "todas": cada destino recebe o valor, então divide o saldo. */
  maxTodos(j: Janela): number {
    return Math.max(1, Math.floor(this.maxPara(j) / Math.max(1, this.destinos().length)));
  }

  /** Teto de um destino: saldo menos o que os outros já pegaram. */
  maxDestino(j: Janela, chave: string): number {
    const atual = this.qtd()[j.id]?.[chave] ?? 0;
    return Math.max(1, this.maxPara(j) - (this.soma(j) - atual));
  }

  qtdDe(j: Janela, chave: string): number | null {
    return this.qtd()[j.id]?.[chave] ?? null;
  }

  detalhado(j: Janela): boolean {
    return this.detalhados().has(j.id);
  }

  /** Faturamento (quem paga) de um destino, para o resumo. */
  faturamentoDe(chave: string): Faturamento | null {
    return (
      this.selecionadas().find((s) => String(s.transportadora.id) === chave)?.faturamento ?? null
    );
  }

  // ─── Preenchimento (editar / duplicar / criar p/ transportadora) ──────
  private preencher(): void {
    const { destinacao: d, transportadora } = this.data;

    if (transportadora) {
      this.adicionarSelecionada({ id: transportadora.id, nome: transportadora.nome });
    }
    if (!d) return;

    // Vigência antes da transportadora: o saldo do acordo é calculado no dia de início.
    if (this.modo === 'duplicar') {
      const prox = somarDias(d.fim ?? d.inicio, 1);
      this.vigInicio.set(prox < hojeISO() ? hojeISO() : prox);
      this.vigFim.set('');
    } else {
      this.vigInicio.set(d.inicio);
      this.vigFim.set(d.fim ?? '');
    }

    const fat: Faturamento = d.itens[0]?.faturamento ?? { tipo: 'transportadora', pagador: null };
    this.destinadorId.set(d.destinador.id);
    this.avulso.set(!d.transportadoraId);
    this.selecionadas.set([]);
    if (d.transportadoraId) {
      this.adicionarSelecionada({ id: d.transportadoraId, nome: d.transportadoraNome }, { ...fat });
    }
    this.modalidade.set(d.modalidade);
    this.recorrencia.set(d.recorrencia);
    this.transferencia.set(d.transferenciaSaldo);

    const chave = d.transportadoraId ? String(d.transportadoraId) : 'avulso';
    const q: Record<string, Record<string, number>> = {};
    for (const i of d.itens) {
      if (i.horaInicio && i.horaFim) q[janelaKey(i.horaInicio, i.horaFim)] = { [chave]: i.vagas };
    }
    this.qtd.set(q);
  }

  private serializar(): string {
    return JSON.stringify([
      this.destinadorId(),
      this.selecionadas().map((s) => [
        s.transportadora.id,
        s.faturamento.tipo,
        s.faturamento.pagador?.id,
      ]),
      this.avulso(),
      this.modalidade(),
      this.vigInicio(),
      this.vigFim(),
      this.recorrencia(),
      this.qtd(),
      this.transferencia(),
    ]);
  }

  // ─── Janelas ──────────────────────────────────────────────────────────
  private slotsDoDia(dia: string, modalidade: Modalidade): Observable<SlotDia[]> {
    const mods: ModalidadeAgendamento[] =
      modalidade === 'ambos' ? [1, 2] : [modalidadeParaApi(modalidade) as ModalidadeAgendamento];
    return forkJoin(
      mods.map((m) =>
        this.janelasApi.disponibilidade(dia, m).pipe(
          map((disp) => disp.slots ?? []),
          catchError(() => of([])),
        ),
      ),
    ).pipe(map((listas) => (modalidade === 'ambos' ? intersecao(listas) : listas.flat())));
  }

  private montarJanelas(slots: SlotDia[], dia: string, modalidade: Modalidade): Janela[] {
    const janelas = calcularJanelas(slots, this.data.reservas, dia, modalidade, this.idsProprios);
    // Em edição, mantém horários da destinação que não existem mais nas janelas do dia
    // (para não excluí-los sem querer ao salvar).
    if (this.editando) {
      for (const i of this.data.destinacao?.itens ?? []) {
        const id = janelaKey(i.horaInicio, i.horaFim);
        if (!i.horaInicio || janelas.some((j) => j.id === id)) continue;
        janelas.push({
          id,
          inicio: i.horaInicio,
          fim: i.horaFim,
          capacidade: i.vagas,
          livres: i.vagas,
        });
      }
      janelas.sort((a, b) => a.inicio.localeCompare(b.inicio));
    }
    return janelas;
  }

  /** Sem janelas no início da vigência: procura o próximo dia (até 14) que tenha. */
  private procurarProximoDia(dia: string, modalidade: Modalidade): void {
    from(Array.from({ length: 14 }, (_, n) => somarDias(dia, n + 1)))
      .pipe(
        concatMap((d) => this.slotsDoDia(d, modalidade).pipe(map((s) => ({ d, n: s.length })))),
        first((r) => r.n > 0),
        map((r) => r.d),
        defaultIfEmpty(null),
        catchError(() => of(null)),
        filter(() => this.vigInicio() === dia && this.modalidade() === modalidade),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((d) => this.proximoDiaComJanela.set(d));
  }

  // ─── Regra de cobrança: saldo do acordo + pagador padrão ──────────────
  /**
   * Lê a regra de cobrança ativa da transportadora: saldo do acordo no dia e quem paga por padrão
   * (CIF = a própria, FOB = terceiro). `preencherPagador` aplica esse padrão ao "Quem paga"
   * quando a transportadora acabou de ser adicionada (o usuário pode trocar depois).
   */
  private carregarSaldo(transportadoraId: number, preencherPagador = false): void {
    const dia = this.vigInicio();
    const reservas = this.data.reservas.filter((r) => !this.idsProprios.has(r.id));
    const calc = (vagasAcordo: ConfigCobrancaVagasAcordo | null, temAcordo: boolean) =>
      calcularCotaDia({ vagasAcordo, temAcordo, dataIso: dia, transportadoraId, reservas });

    this.cobrancaApi
      .listar({
        transportadoraId,
        status: StatusConfiguracaoCobranca.Ativa,
        numeroPagina: 1,
        tamanhoPagina: 30,
      })
      .pipe(
        switchMap((page) => {
          const items = page.items ?? [];
          const regra = items[0] ?? null;
          const pagadorPadrao =
            regra && regra.tipoPagador === 'terceiro' && regra.responsavelFaturamentoId
              ? {
                  id: regra.responsavelFaturamentoId,
                  nome:
                    regra.responsavelFaturamentoNome ||
                    `Pagador #${regra.responsavelFaturamentoId}`,
                }
              : null;
          const base = { semCobranca: items.length === 0, pagadorPadrao };
          const acordo = items.find(
            (i) => Number(i.modalidadeCobranca) === ModalidadeCobranca.Acordo,
          );
          if (!acordo) return of({ ...base, cota: calc(null, false) });
          return this.cobrancaApi.obterListaItemPorId(acordo.id).pipe(
            map((item) => ({
              ...base,
              cota: calc(
                (item?.acordo?.vagas ?? null) as ConfigCobrancaVagasAcordo | null,
                !!item && Number(item.modalidadeCobranca) === ModalidadeCobranca.Acordo,
              ),
            })),
          );
        }),
        catchError(() => of({ semCobranca: false, pagadorPadrao: null, cota: calc(null, false) })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ cota, semCobranca, pagadorPadrao }) => {
        this.selecionadas.update((l) =>
          l.map((s) =>
            s.transportadora.id === transportadoraId
              ? {
                  ...s,
                  transportadora: {
                    ...s.transportadora,
                    saldoAcordo: cota.livres ?? undefined,
                    carregandoSaldo: false,
                    semCobranca,
                    pagadorPadrao,
                  },
                  faturamento:
                    preencherPagador && pagadorPadrao
                      ? { tipo: 'terceiro', pagador: pagadorPadrao }
                      : s.faturamento,
                }
              : s,
          ),
        );
      });
  }

  // ─── Combobox ─────────────────────────────────────────────────────────
  onBusca(valor: string): void {
    this.busca.set(valor);
    this.busca$.next(valor);
    this.comboAtivo.set(0);
    this.comboAberto.set(true);
  }

  onComboKeydown(ev: KeyboardEvent): void {
    const total = this.sugestoesFiltradas().length;
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault();
        this.comboAberto.set(true);
        this.comboAtivo.update((i) => (total ? (i + 1) % total : 0));
        break;
      case 'ArrowUp':
        ev.preventDefault();
        this.comboAtivo.update((i) => (total ? (i - 1 + total) % total : 0));
        break;
      case 'Enter':
        if (this.comboAberto() && total) {
          ev.preventDefault();
          this.adicionarTransportadora(this.sugestoesFiltradas()[this.comboAtivo()]);
        }
        break;
      case 'Escape':
        if (this.comboAberto()) {
          ev.stopPropagation();
          this.comboAberto.set(false);
        }
        break;
    }
  }

  fecharComboDepois(): void {
    setTimeout(() => this.comboAberto.set(false), 120);
  }

  private adicionarSelecionada(
    t: Transportadora,
    faturamento: Faturamento = { tipo: 'transportadora', pagador: null },
    preencherPagador = false,
  ): void {
    this.selecionadas.update((l) => [
      ...l,
      { transportadora: { ...t, carregandoSaldo: true }, faturamento },
    ]);
    this.carregarSaldo(t.id, preencherPagador);
  }

  adicionarTransportadora(t: Transportadora): void {
    this.adicionarSelecionada(t, undefined, true);
    // Nos horários já marcados, a nova transportadora entra com o valor comum (ou o padrão).
    this.qtd.update((q) => {
      const n: typeof q = {};
      for (const [jid, porDestino] of Object.entries(q)) {
        const vs = Object.values(porDestino);
        const comum = vs.length && vs.every((v) => v === vs[0]) ? vs[0] : (this.padrao() ?? 1);
        const { avulso: _avulso, ...semAvulso } = porDestino;
        n[jid] = { ...semAvulso, [String(t.id)]: comum };
      }
      return n;
    });
    this.busca.set('');
    this.busca$.next('');
    this.comboAtivo.set(0);
    // Fecha a lista para não cobrir o "Quem paga"; reabre ao digitar ou com ↓.
    this.comboAberto.set(false);
    this.buscaInput()?.nativeElement.focus();
  }

  removerTransportadora(id: number): void {
    this.selecionadas.update((l) => l.filter((s) => s.transportadora.id !== id));
    const chave = String(id);
    this.qtd.update((q) => {
      const n: typeof q = {};
      for (const [jid, porDestino] of Object.entries(q)) {
        const { [chave]: removido, ...resto } = porDestino;
        // Sem destino: guarda o valor sob 'avulso' até escolher outra transportadora.
        n[jid] = Object.keys(resto).length ? resto : { avulso: removido };
      }
      return n;
    });
    this.buscaInput()?.nativeElement.focus();
  }

  setFaturamento(id: number, tipo: TipoFaturamento): void {
    this.selecionadas.update((l) =>
      l.map((s) =>
        s.transportadora.id === id
          ? {
              ...s,
              faturamento: { tipo, pagador: tipo === 'terceiro' ? s.faturamento.pagador : null },
            }
          : s,
      ),
    );
  }

  setPagador(id: number, pagadorId: string): void {
    const pagador = this.pagadores().find((e) => e.id === Number(pagadorId)) ?? null;
    this.selecionadas.update((l) =>
      l.map((s) =>
        s.transportadora.id === id ? { ...s, faturamento: { tipo: 'terceiro', pagador } } : s,
      ),
    );
  }

  onAvulso(marcado: boolean): void {
    this.avulso.set(marcado);
    if (marcado) {
      this.selecionadas.set([]);
      this.busca.set('');
    }
    // Recomeça as quantidades com o novo conjunto de destinos.
    const base = this.padrao() ?? 1;
    this.qtd.set(
      Object.fromEntries(Object.keys(this.qtd()).map((jid) => [jid, this.mapaDestinos(base)])),
    );
  }

  // ─── Vigência / modalidade / horários ─────────────────────────────────
  onVigInicio(iso: string): void {
    this.vigInicio.set(iso || hojeISO());
    this.janelas$.next();
    for (const s of this.selecionadas()) this.carregarSaldo(s.transportadora.id);
  }

  onModalidade(m: Modalidade): void {
    this.modalidade.set(m);
    this.janelas$.next();
  }

  irParaProximoDiaComJanela(): void {
    const d = this.proximoDiaComJanela();
    if (d) this.onVigInicio(d);
  }

  private mapaDestinos(valor: number): Record<string, number> {
    const ds = this.destinos();
    // Sem destino ainda: guarda sob 'avulso' e redistribui quando escolher.
    return ds.length ? Object.fromEntries(ds.map((d) => [d.id, valor])) : { avulso: valor };
  }

  alternarJanela(j: Janela, marcado: boolean): void {
    this.qtd.update((q) => {
      const resto = { ...q };
      delete resto[j.id];
      if (!marcado) return resto;
      const v = Math.min(this.padrao() ?? 1, this.maxTodos(j));
      return { ...resto, [j.id]: this.mapaDestinos(v) };
    });
    if (!marcado) this.alternarDetalhe(j, false);
  }

  /** "Todas": aplica o mesmo valor a todas as transportadoras do horário. */
  setTodos(j: Janela, v: number | null): void {
    if (v === null) return;
    this.qtd.update((q) => ({ ...q, [j.id]: this.mapaDestinos(v) }));
  }

  /** Ajuste fino de uma transportadora num horário. */
  setQtd(j: Janela, chave: string, v: number | null): void {
    if (v === null) return;
    this.qtd.update((q) => ({ ...q, [j.id]: { ...q[j.id], [chave]: v } }));
  }

  alternarDetalhe(j: Janela, abrir = !this.detalhado(j)): void {
    this.detalhados.update((s) => {
      const n = new Set(s);
      if (abrir) n.add(j.id);
      else n.delete(j.id);
      return n;
    });
  }

  marcarTodas(): void {
    const base = this.padrao() ?? 1;
    const q: Record<string, Record<string, number>> = {};
    for (const j of this.janelasDoDia()) {
      if (this.maxPara(j) <= 0) continue;
      q[j.id] = this.qtd()[j.id] ?? this.mapaDestinos(Math.min(base, this.maxTodos(j)));
    }
    this.qtd.set(q);
  }

  limparHorarios(): void {
    this.qtd.set({});
    this.detalhados.set(new Set());
  }

  /** Aplica o padrão a todos os horários marcados e a todas as transportadoras. */
  aplicarPadraoEmTudo(): void {
    const v = this.padrao();
    if (v === null) return;
    this.qtd.update((q) =>
      Object.fromEntries(Object.keys(q).map((jid) => [jid, this.mapaDestinos(v)])),
    );
  }

  /** Aplica uma quantidade a UMA transportadora em todos os horários marcados. */
  aplicarParaDestino(chave: string, v: number | null): void {
    if (v === null) return;
    this.qtd.update((q) =>
      Object.fromEntries(Object.entries(q).map(([jid, m]) => [jid, { ...m, [chave]: v }])),
    );
  }

  /** Valor comum de um destino em todos os horários (null se varia). */
  valorDestino(chave: string): number | null {
    const vs = Object.values(this.qtd())
      .map((m) => m[chave])
      .filter((v) => v !== undefined);
    return vs.length && vs.every((v) => v === vs[0]) ? vs[0] : null;
  }

  // ─── Fechar / salvar ──────────────────────────────────────────────────
  async cancelar(): Promise<void> {
    if (this.salvando()) return;
    if (this.serializar() !== this.snapshot) {
      const ok = await this.confirmar({
        titulo: 'Descartar alterações?',
        mensagem: 'O que você preencheu neste formulário será perdido.',
        confirmLabel: 'Descartar',
        confirmColor: 'warn',
      });
      if (!ok) return;
    }
    this.ref.close();
  }

  async salvar(): Promise<void> {
    if (!this.podeSalvar()) {
      this.focarPrimeiraPendencia();
      return;
    }
    // Acima do acordo não bloqueia, mas vira excedente cobrado: pede confirmação explícita.
    const acima = this.acimaDoAcordo();
    let confirmarExcedente = false;
    if (acima.length) {
      const lista = acima
        .map((d) => `${d.nome}: ${this.totalPorDestino()[d.id]} de ${d.saldoAcordo} vagas/dia`)
        .join('; ');
      const ok = await this.confirmar({
        titulo: 'Destinar acima do acordo?',
        mensagem: `${lista}. O que passar do acordo é cobrado como excedente, pela regra de cobrança de cada transportadora.`,
        confirmLabel: 'Destinar com excedente',
        confirmColor: 'primary',
      });
      if (!ok) return;
      confirmarExcedente = true;
    }
    this.salvando.set(true);
    try {
      const ops = this.montarOperacoes(confirmarExcedente);
      const resultados = await firstValueFrom(
        from(ops).pipe(
          concatMap((op) => this.executar(op).pipe(catchError(() => of(false)))),
          toArray(),
        ),
      );
      const gravadas = resultados.filter(Boolean).length;
      const grupos = this.avulso()
        ? ['avulso']
        : this.selecionadas().map((s) => grupoIdDe(s.transportadora.id));
      this.ref.close({ gravadas, falhas: resultados.length - gravadas, grupos });
    } finally {
      this.salvando.set(false);
    }
  }

  private executar(op: Operacao): Observable<boolean> {
    switch (op.tipo) {
      case 'criar':
        return this.api.criarReserva(op.input).pipe(map((r) => r != null));
      case 'alterar':
        return this.api.atualizarReserva(op.id, op.input).pipe(map((r) => r != null));
      case 'excluir':
        return this.api.inativarReserva(op.id);
    }
  }

  private montarOperacoes(confirmarExcedente = false): Operacao[] {
    const destinos: Array<{ transportadoraId: number | null; faturamento: Faturamento }> =
      this.avulso()
        ? [{ transportadoraId: null, faturamento: { tipo: 'transportadora', pagador: null } }]
        : this.selecionadas().map((s) => ({
            transportadoraId: s.transportadora.id,
            faturamento: s.faturamento,
          }));

    const inputPara = (destino: (typeof destinos)[number], j: Janela) =>
      montarInput({
        transportadoraId: destino.transportadoraId,
        destinadorId: this.destinadorId(),
        modalidade: this.modalidade(),
        inicio: this.vigInicio(),
        fim: this.vigFim() || null,
        recorrencia: this.recorrencia(),
        diasOriginais: this.data.destinacao?.diasSemana ?? null,
        janela: j,
        quantidade:
          this.qtd()[j.id]?.[
            destino.transportadoraId ? String(destino.transportadoraId) : 'avulso'
          ] ?? 0,
        faturamento: destino.faturamento,
        transferencia: this.transferencia(),
        confirmarExcedente,
      });

    if (!this.editando) {
      return destinos.flatMap((destino) =>
        this.horariosMarcados()
          .map((j) => inputPara(destino, j))
          .filter((input) => input.quantidade > 0)
          .map((input): Operacao => ({ tipo: 'criar', input })),
      );
    }

    // Edição: um destino; altera os horários que continuam, cria os novos, exclui os desmarcados.
    const destino = destinos[0];
    const existentes = new Map(
      (this.data.destinacao?.itens ?? []).map((i) => [janelaKey(i.horaInicio, i.horaFim), i.id]),
    );
    const ops: Operacao[] = this.horariosMarcados().map((j) => {
      const id = existentes.get(j.id);
      existentes.delete(j.id);
      return id != null
        ? { tipo: 'alterar', id, input: inputPara(destino, j) }
        : { tipo: 'criar', input: inputPara(destino, j) };
    });
    for (const id of existentes.values()) ops.push({ tipo: 'excluir', id });
    return ops;
  }

  private focarPrimeiraPendencia(): void {
    const root = this.bodyEl()?.nativeElement;
    if (!this.avulso() && !this.selecionadas().length) {
      this.buscaInput()?.nativeElement.focus();
      return;
    }
    const pagadorVazio = root?.querySelector<HTMLElement>('select[data-pagador].is-invalid');
    if (pagadorVazio) {
      pagadorVazio.focus();
      return;
    }
    const exc = this.horariosExcedidos()[0];
    if (exc) {
      this.alternarDetalhe(exc, true);
      setTimeout(() =>
        root?.querySelector<HTMLElement>(`[data-slot="${exc.id}"] input[type=number]`)?.focus(),
      );
      return;
    }
    if (this.fimInvalido()) {
      root?.querySelector<HTMLElement>('#dst-fim')?.focus();
      return;
    }
    this.horariosGrupo()?.nativeElement.querySelector<HTMLElement>('input, a, button')?.focus();
  }

  private confirmar(data: CadastroConfirmDialogData): Promise<boolean> {
    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      data,
      width: '420px',
      maxWidth: '96vw',
      autoFocus: 'dialog',
      panelClass: 'cad-confirm-dialog-panel',
    });
    return firstValueFrom(ref.afterClosed()).then((r) => r === true);
  }
}

interface SlotDia {
  horaInicio: string;
  horaFim: string;
  capacidade: number;
}

/** "Ambos": só horários presentes nas duas modalidades (capacidade = menor). */
function intersecao(listas: SlotDia[][]): SlotDia[] {
  if (listas.length < 2) return listas.flat();
  const [a, b] = listas;
  const keysB = new Set(b.map((s) => janelaKey(s.horaInicio, s.horaFim)));
  return [
    ...a.filter((s) => keysB.has(janelaKey(s.horaInicio, s.horaFim))),
    ...b.filter((s) =>
      a.some((x) => janelaKey(x.horaInicio, x.horaFim) === janelaKey(s.horaInicio, s.horaFim)),
    ),
  ];
}
