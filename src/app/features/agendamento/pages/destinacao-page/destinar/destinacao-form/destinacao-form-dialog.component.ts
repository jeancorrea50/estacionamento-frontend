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
  imports: [FormsModule, DatePipe],
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
  /** Quantidade padrão por horário (vale para todas as transportadoras). */
  readonly qtdPorJanela = signal<Record<string, number>>({});
  /** Ajustes por horário › transportadora (só quem difere do padrão; 0 = sem vaga nesse horário). */
  readonly overrides = signal<Record<string, Record<number, number>>>({});
  /** Horários com o painel "por transportadora" aberto. */
  readonly ajustesAbertos = signal<ReadonlySet<string>>(new Set());
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

  readonly totalHorarios = computed(() => Object.keys(this.qtdPorJanela()).length);
  readonly qtdDestinos = computed(() =>
    this.avulso() ? 1 : Math.max(1, this.selecionadas().length),
  );
  readonly fimInvalido = computed(() => !!this.vigFim() && this.vigFim() < this.vigInicio());
  readonly horariosMarcados = computed(() =>
    this.janelasDoDia().filter((j) => j.id in this.qtdPorJanela()),
  );

  /** Quantidade de uma transportadora num horário: ajuste próprio ou o padrão do horário. */
  qtdPara(janelaId: string, transportadoraId: number): number {
    const padrao = this.qtdPorJanela()[janelaId] ?? 0;
    return this.overrides()[janelaId]?.[transportadoraId] ?? padrao;
  }

  temAjuste(janelaId: string, transportadoraId: number): boolean {
    return this.overrides()[janelaId]?.[transportadoraId] !== undefined;
  }

  /** Total no horário somando todas as transportadoras (ou o avulso). */
  totalNaJanela(j: Janela): number {
    if (this.avulso() || !this.selecionadas().length) return this.qtdPorJanela()[j.id] ?? 0;
    return this.selecionadas().reduce((s, sel) => s + this.qtdPara(j.id, sel.transportadora.id), 0);
  }

  /** Vagas/dia de uma transportadora somando os horários marcados. */
  vagasDaTransportadora(transportadoraId: number): number {
    return this.horariosMarcados().reduce((s, j) => s + this.qtdPara(j.id, transportadoraId), 0);
  }

  readonly totalVagasDia = computed(() =>
    this.horariosMarcados().reduce((s, j) => s + this.totalNaJanela(j), 0),
  );

  /** Horários em que a soma das transportadoras passa do saldo livre da janela. */
  readonly janelasExcedidas = computed(() =>
    this.horariosMarcados().filter((j) => this.totalNaJanela(j) > j.livres),
  );

  /** Transportadoras cuja soma de vagas/dia passa do saldo do acordo (regra de cobrança). */
  readonly acordosExcedidos = computed(() =>
    this.selecionadas()
      .filter(
        (s) =>
          s.transportadora.saldoAcordo !== undefined &&
          this.vagasDaTransportadora(s.transportadora.id) > s.transportadora.saldoAcordo,
      )
      .map((s) => ({
        nome: s.transportadora.nome,
        pedido: this.vagasDaTransportadora(s.transportadora.id),
        saldo: s.transportadora.saldoAcordo!,
      })),
  );

  /** Transportadoras sem nenhuma vaga nos horários marcados (todos os ajustes em 0). */
  readonly semVagas = computed(() =>
    this.horariosMarcados().length
      ? this.selecionadas().filter((s) => this.vagasDaTransportadora(s.transportadora.id) === 0)
      : [],
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
    const exc = this.janelasExcedidas();
    if (exc.length)
      p.push(`saldo da janela insuficiente em ${exc.map((j) => j.inicio).join(', ')}`);
    for (const a of this.acordosExcedidos()) {
      p.push(`acordo de ${a.nome}: ${a.pedido} de ${a.saldo} vagas/dia`);
    }
    const vazias = this.semVagas();
    if (vazias.length)
      p.push(`sem vagas para ${vazias.map((s) => s.transportadora.nome).join(', ')}`);
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
    return j.id in this.qtdPorJanela();
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

    const m: Record<string, number> = {};
    for (const i of d.itens) {
      if (i.horaInicio && i.horaFim) m[janelaKey(i.horaInicio, i.horaFim)] = i.vagas;
    }
    this.qtdPorJanela.set(m);
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
      this.qtdPorJanela(),
      this.overrides(),
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

  // ─── Saldo do acordo ──────────────────────────────────────────────────
  private carregarSaldo(transportadoraId: number): void {
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
          const acordo = page.items.find(
            (i) => Number(i.modalidadeCobranca) === ModalidadeCobranca.Acordo,
          );
          if (!acordo) return of(calc(null, false));
          return this.cobrancaApi
            .obterListaItemPorId(acordo.id)
            .pipe(
              map((item) =>
                calc(
                  (item?.acordo?.vagas ?? null) as ConfigCobrancaVagasAcordo | null,
                  !!item && Number(item.modalidadeCobranca) === ModalidadeCobranca.Acordo,
                ),
              ),
            );
        }),
        catchError(() => of(calc(null, false))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((cota) => {
        this.selecionadas.update((l) =>
          l.map((s) =>
            s.transportadora.id === transportadoraId
              ? {
                  ...s,
                  transportadora: {
                    ...s.transportadora,
                    saldoAcordo: cota.livres ?? undefined,
                    carregandoSaldo: false,
                  },
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
  ): void {
    this.selecionadas.update((l) => [
      ...l,
      { transportadora: { ...t, carregandoSaldo: true }, faturamento },
    ]);
    this.carregarSaldo(t.id);
  }

  adicionarTransportadora(t: Transportadora): void {
    this.adicionarSelecionada(t);
    this.busca.set('');
    this.busca$.next('');
    this.comboAtivo.set(0);
    // Fecha a lista para não cobrir o "Quem paga"; reabre ao digitar ou com ↓.
    this.comboAberto.set(false);
    this.buscaInput()?.nativeElement.focus();
  }

  removerTransportadora(id: number): void {
    this.selecionadas.update((l) => l.filter((s) => s.transportadora.id !== id));
    this.overrides.update((o) => {
      const n: Record<string, Record<number, number>> = {};
      for (const [k, v] of Object.entries(o)) {
        const { [id]: _removido, ...resto } = v;
        if (Object.keys(resto).length) n[k] = resto;
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

  alternarJanela(j: Janela, marcado: boolean): void {
    this.qtdPorJanela.update((m) => {
      const resto = { ...m };
      delete resto[j.id];
      return marcado ? { ...resto, [j.id]: 1 } : resto;
    });
    if (!marcado) this.limparAjustes(j.id);
  }

  /** Quantidade padrão do horário (aplica a todas as transportadoras sem ajuste próprio). */
  ajustarQtd(j: Janela, valor: number): void {
    const v = Math.max(1, Math.min(Math.max(1, this.maxPara(j)), Math.trunc(Number(valor) || 1)));
    this.qtdPorJanela.update((m) => ({ ...m, [j.id]: v }));
  }

  /** Ajuste de uma transportadora no horário; igual ao padrão remove o ajuste. 0 = sem vaga nele. */
  ajustarQtdTransportadora(j: Janela, transportadoraId: number, valor: number): void {
    const v = Math.max(0, Math.min(Math.max(0, this.maxPara(j)), Math.trunc(Number(valor) || 0)));
    const padrao = this.qtdPorJanela()[j.id] ?? 0;
    this.overrides.update((o) => {
      const doHorario = { ...(o[j.id] ?? {}) };
      if (v === padrao) delete doHorario[transportadoraId];
      else doHorario[transportadoraId] = v;
      const n = { ...o };
      if (Object.keys(doHorario).length) n[j.id] = doHorario;
      else delete n[j.id];
      return n;
    });
  }

  ajusteAberto(janelaId: string): boolean {
    return this.ajustesAbertos().has(janelaId);
  }

  alternarAjustes(janelaId: string): void {
    this.ajustesAbertos.update((s) => {
      const n = new Set(s);
      if (n.has(janelaId)) n.delete(janelaId);
      else n.add(janelaId);
      return n;
    });
  }

  /** Volta todas as transportadoras ao padrão do horário. */
  limparAjustes(janelaId: string): void {
    this.overrides.update((o) => {
      const n = { ...o };
      delete n[janelaId];
      return n;
    });
  }

  qtdAjustes(janelaId: string): number {
    return Object.keys(this.overrides()[janelaId] ?? {}).length;
  }

  marcarTodas(): void {
    const m: Record<string, number> = {};
    for (const j of this.janelasDoDia())
      if (this.maxPara(j) > 0) m[j.id] = this.qtdPorJanela()[j.id] ?? 1;
    this.qtdPorJanela.set(m);
  }

  limparHorarios(): void {
    this.qtdPorJanela.set({});
    this.overrides.set({});
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
    this.salvando.set(true);
    try {
      const ops = this.montarOperacoes();
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

  private montarOperacoes(): Operacao[] {
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
        quantidade: destino.transportadoraId
          ? this.qtdPara(j.id, destino.transportadoraId)
          : (this.qtdPorJanela()[j.id] ?? 0),
        faturamento: destino.faturamento,
        transferencia: this.transferencia(),
      });

    if (!this.editando) {
      // Horário com ajuste 0 para a transportadora = sem reserva nele.
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
