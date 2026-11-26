import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import { catchError, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  PeriodoDataPickerComponent,
  type PeriodoDataSelecionado,
} from '../../../../shared/ui/periodo-data-picker/periodo-data-picker.component';
import {
  ResponsavelFaturamentoFormDialogComponent,
  type ResponsavelFaturamentoFormDialogResult,
} from '../../../cadastro/components/responsavel-faturamento-form-dialog/responsavel-faturamento-form-dialog.component';
import { ResponsavelFaturamentoLookupFieldComponent } from '../../../cadastro/components/responsavel-faturamento-lookup-field/responsavel-faturamento-lookup-field.component';
import { TransportadoraLookupFieldComponent } from '../../../movimentos/entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
import {
  ModalidadeCobranca,
  StatusConfiguracaoCobranca,
} from '../../../financeiro/models/configuracao-cobranca.models';
import type { ConfigCobrancaVagasAcordo } from '../../../financeiro/pages/faturamento-page/config-cobranca/faturamento-config-cobranca.types';
import { ConfiguracaoCobrancaService } from '../../../financeiro/services/configuracao-cobranca.service';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import { VagaDisponibilidadeService } from '../../services/vaga-disponibilidade.service';
import type {
  ModalidadeVagaAgendamento,
  PeriodicidadeVagaReserva,
  VagaDisponibilidadeResumo,
  VagaReservaTransportadoraInput,
  VagaReservaTransportadoraItem,
} from '../../models/vaga-disponibilidade.models';
import {
  calcularCotaDia,
  coletarFaixasUnicas,
  maxQuantidadePermitida,
  type CotaTransportadoraDia,
  type FaixaHorarioLab,
} from './vaga-reserva-lab.util';
import {
  agruparDestinacoesLista,
  type DestinacaoListaModalidade,
  type DestinacaoListaSituacao,
  type DestinacaoTransportadoraGrupo,
} from './vaga-reserva-lista.util';
import {
  DIAS_SEMANA_OPCOES,
  type ModalidadeAgendamento,
} from '../../models/janela-agendamento.models';

export type DestinoFaturamentoTipo = 'transportadora' | 'terceiro';

function toIsoDateLocal(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

export interface DestinoTransportadoraLab {
  id: number;
  nome: string;
  cota: CotaTransportadoraDia | null;
  loadingCota: boolean;
  /** Padrão: faturar no CNPJ da própria transportadora. */
  faturamentoTipo: DestinoFaturamentoTipo;
  /** Preenchido só quando `faturamentoTipo === 'terceiro'` (`responsavelFaturamentoId` no POST). */
  responsavelFaturamentoId: number | null;
  responsavelFaturamentoNome: string;
}

/** Horário selecionado: qtd padrão para todas + overrides opcionais. */
export interface HorarioSelecionadoLab {
  faixa: FaixaHorarioLab;
  /** Quantidade aplicada a todas as transportadoras, salvo override. */
  quantidadePadrao: number;
  /** Exceções por `transportadoraId` (só quem difere do padrão). */
  overrides: Record<number, number>;
  quantidadeAvulsa: number;
  expandido: boolean;
}

/**
 * Destinação — multi-transportadora e multi-horário (tela canônica).
 * Qtd. Livres na lista (acordo); quantidade informada por horário × transportadora.
 */
@Component({
  selector: 'app-vaga-reserva-panel-lab',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    PeriodoDataPickerComponent,
    TransportadoraLookupFieldComponent,
    ResponsavelFaturamentoLookupFieldComponent,
  ],
  templateUrl: './vaga-reserva-panel-lab.component.html',
  styleUrls: ['./vaga-reserva-panel-lab.component.scss'],
})
export class VagaReservaPanelLabComponent implements OnInit, OnChanges, OnDestroy {
  private readonly api = inject(VagaDisponibilidadeService);
  private readonly janelasApi = inject(JanelaAgendamentoService);
  private readonly cobrancaApi = inject(ConfiguracaoCobrancaService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  @Input() podeGerenciar = false;
  @Input() embedded = false;

  readonly loading = signal(false);
  readonly salvando = signal(false);
  readonly loadingFaixas = signal(false);
  readonly resumo = signal<VagaDisponibilidadeResumo | null>(null);
  readonly reservas = signal<VagaReservaTransportadoraItem[]>([]);
  readonly reservasAbertas = signal(true);
  /** Visão do caput: Estacionamento (1) ou Limpeza (2). */
  readonly kpiModalidade = signal<1 | 2>(1);
  readonly dataConsulta = signal(toIsoDateLocal());
  readonly lookupId = signal<number | null>(null);
  readonly lookupNome = signal('');
  readonly destinos = signal<DestinoTransportadoraLab[]>([]);
  readonly faixas = signal<FaixaHorarioLab[]>([]);
  readonly horariosSelecionados = signal<HorarioSelecionadoLab[]>([]);
  readonly dataInicioSig = signal('');

  /** Filtros compactos da listagem hierárquica. */
  readonly filtroListaBusca = signal('');
  readonly filtroListaModalidade = signal<DestinacaoListaModalidade>('todas');
  readonly filtroListaSituacao = signal<DestinacaoListaSituacao>('ativas');
  readonly expandidoTransportadoras = signal<ReadonlySet<string>>(new Set());
  readonly expandidoPeriodos = signal<ReadonlySet<string>>(new Set());
  readonly expandidoHistoricos = signal<ReadonlySet<string>>(new Set());
  readonly menuAcaoHorarioId = signal<number | null>(null);

  /**
   * Regras da lista filtradas pela modalidade do caput.
   * Inclui `Ambos` (3) porque o backend aplica nas duas.
   */
  readonly reservasNaModalidade = computed(() => {
    const m = this.kpiModalidade();
    return this.reservas().filter((r) => r.modalidade === m || r.modalidade === 3);
  });
  readonly reservasAtivasCount = computed(
    () => this.reservasNaModalidade().filter((r) => r.ativo).length
  );
  readonly reservasCadastradasCount = computed(() => this.reservasNaModalidade().length);

  readonly destinacoesAgrupadas = computed((): DestinacaoTransportadoraGrupo[] =>
    agruparDestinacoesLista(this.reservas(), {
      busca: this.filtroListaBusca(),
      modalidade: this.filtroListaModalidade(),
      situacao: this.filtroListaSituacao(),
    })
  );
  readonly destinacoesTransportadorasCount = computed(() => this.destinacoesAgrupadas().length);
  readonly destinacoesAtivasVisiveisCount = computed(() =>
    this.destinacoesAgrupadas().reduce((acc, g) => acc + g.ativosCount, 0)
  );

  /**
   * KPIs 1:1 com `GET /Agendamento/vagas/disponibilidade`
   * (capacidade*, vagasReservadas*, vagasDisponiveis*).
   */
  readonly kpiDia = computed(() => {
    const v = this.resumo();
    if (!v) return null;
    const est = this.kpiModalidade() === 1;
    const capacidade = est ? v.capacidadeEstacionamento : v.capacidadeLimpeza;
    const reservadas = est ? v.vagasReservadasEstacionamento : v.vagasReservadasLimpeza;
    const disponiveis = est ? v.vagasDisponiveisEstacionamento : v.vagasDisponiveisLimpeza;
    const reservadasN = Number(reservadas);
    return {
      capacidade,
      reservadas: Number.isFinite(reservadasN) ? reservadasN : 0,
      disponiveis,
      pctLivres: this.pctDisponivel(disponiveis, capacidade),
      controleAtivo: !!v.controleAtivo,
    };
  });

  /** Snapshot da outra modalidade no mesmo payload de disponibilidade. */
  readonly kpiMetaOutra = computed(() => {
    const v = this.resumo();
    if (!v) return null;
    if (this.kpiModalidade() === 1) {
      return {
        label: 'Limpeza',
        icon: 'water_drop',
        capacidade: v.capacidadeLimpeza,
        disponiveis: v.vagasDisponiveisLimpeza,
        reservadas: v.vagasReservadasLimpeza,
      };
    }
    return {
      label: 'Estacionamento',
      icon: 'local_parking',
      capacidade: v.capacidadeEstacionamento,
      disponiveis: v.vagasDisponiveisEstacionamento,
      reservadas: v.vagasReservadasEstacionamento,
    };
  });

  /** Motivos visíveis de por que o botão Destinar está bloqueado. */
  readonly bloqueiosSalvar = computed((): string[] => {
    const motivos: string[] = [];
    if (this.salvando()) {
      motivos.push('Aguarde o salvamento em andamento.');
      return motivos;
    }

    const dataInicio = (this.dataInicioSig() || '').trim().slice(0, 10);
    const dataFim = (this.dataFimSig() || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
      motivos.push('Selecione a vigência (data início).');
    }
    const periodicidade = this.periodicidadeSig();
    if (periodicidade !== 4 && !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
      motivos.push('Informe o fim da vigência para a recorrência escolhida.');
    } else if (
      /^\d{4}-\d{2}-\d{2}$/.test(dataInicio) &&
      /^\d{4}-\d{2}-\d{2}$/.test(dataFim) &&
      dataFim < dataInicio
    ) {
      motivos.push('A data fim deve ser igual ou posterior à data início.');
    }
    if (periodicidade === 2 && this.diasSemana().length === 0) {
      motivos.push('Selecione ao menos um dia da semana para a recorrência “Toda semana”.');
    }

    const horarios = this.horariosSelecionados();
    if (!horarios.length) {
      motivos.push('Selecione ao menos um horário das janelas.');
    } else if (this.avulsoSig()) {
      if (!horarios.some((h) => h.quantidadeAvulsa >= 1)) {
        motivos.push('Informe quantidade (> 0) em ao menos um horário para o avulso.');
      }
    } else {
      const list = this.destinos();
      if (!list.length) {
        motivos.push('Adicione ao menos uma transportadora (ou marque Avulso).');
      }
      if (list.some((d) => d.loadingCota)) {
        motivos.push('Aguarde o cálculo da Qtd. Livres das transportadoras.');
      }
      for (const d of list) {
        if (
          d.faturamentoTipo === 'terceiro' &&
          !(d.responsavelFaturamentoId != null && d.responsavelFaturamentoId > 0)
        ) {
          motivos.push(`${d.nome}: selecione o CNPJ/responsável de faturamento (Terceiro).`);
        }
        const usado = this.totalReservadoTransportadora(d.id, horarios);
        const max = maxQuantidadePermitida(d.cota);
        if (max != null && usado > max) {
          motivos.push(
            `${d.nome}: neste formulário ${usado} vaga${usado === 1 ? '' : 's'}, mas só há ${max} livre${
              max === 1 ? '' : 's'
            } no acordo.`
          );
        }
      }
      if (
        list.length > 0 &&
        !list.some((d) => d.loadingCota) &&
        !list.some((d) => this.totalReservadoTransportadora(d.id, horarios) > 0)
      ) {
        motivos.push('Informe quantidade (> 0) em ao menos um horário.');
      }
    }

    if (!this.faixas().length && !this.loadingFaixas()) {
      motivos.push('Não há janelas com horário neste dia — ajuste a vigência ou cadastre Janelas.');
    }

    return motivos;
  });

  readonly podeSalvar = computed(() => this.bloqueiosSalvar().length === 0);

  private readonly cancelarCarregar$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();
  private geracaoCarregar = 0;
  private geracaoFaixas = 0;
  private modalidadeSub?: Subscription;

  readonly modalidades: { value: ModalidadeVagaAgendamento; label: string }[] = [
    { value: 1, label: 'Estacionamento' },
    { value: 2, label: 'Limpeza' },
    { value: 3, label: 'Ambos' },
  ];
  readonly recorrencias: { value: PeriodicidadeVagaReserva; label: string; hint: string }[] = [
    { value: 1, label: 'Todos os dias', hint: 'Repete todos os dias na vigência.' },
    { value: 2, label: 'Toda semana', hint: 'Repete nos dias escolhidos, a cada semana na vigência.' },
    { value: 3, label: 'Todo mês', hint: 'Repete a cada mês na vigência.' },
    { value: 4, label: 'Período contínuo', hint: 'Sem repetição por dia/semana/mês.' },
  ];
  readonly diasSemanaOpcoes = DIAS_SEMANA_OPCOES;
  /** Dias selecionados quando recorrência = Toda semana (0=Dom … 6=Sáb). */
  readonly diasSemana = signal<number[]>([]);
  private readonly periodicidadeSig = signal<PeriodicidadeVagaReserva>(1);
  private readonly avulsoSig = signal(false);
  private readonly dataFimSig = signal('');
  readonly mostraDiasSemana = computed(() => this.periodicidadeSig() === 2);

  readonly form = this.fb.nonNullable.group({
    modalidade: [1 as ModalidadeVagaAgendamento, Validators.required],
    dataInicio: ['', Validators.required],
    dataFim: [''],
    periodicidade: [1 as PeriodicidadeVagaReserva, Validators.required],
    avulso: [false],
    /** Saldo não usado passa para o próximo horário do mesmo dia (job BE). */
    transferenciaAutomaticaSaldo: [false],
  });

  ngOnInit(): void {
    this.avulsoSig.set(!!this.form.controls.avulso.value);
    this.form.controls.avulso.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((avulso) => {
      this.avulsoSig.set(!!avulso);
      if (avulso) {
        this.destinos.set([]);
        this.sincronizarQuantidadesHorarios();
      }
    });
    this.modalidadeSub = this.form.controls.modalidade.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((m) => {
        if (m === 1 || m === 2) this.kpiModalidade.set(m);
        this.carregarFaixas(m);
      });
    this.form.controls.periodicidade.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      this.periodicidadeSig.set(p);
      if (p !== 2) this.diasSemana.set([]);
      else if (this.diasSemana().length === 0) {
        // Padrão útil: dias úteis.
        this.diasSemana.set([1, 2, 3, 4, 5]);
      }
    });
    this.form.controls.dataInicio.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      this.dataInicioSig.set(v || '');
      this.recalcularCotasDestinos();
      // Horários vêm das janelas do dia da vigência (ex.: janela só em dez. ⇒ nov. fica vazio).
      this.carregarFaixas(this.form.controls.modalidade.value);
    });
    this.form.controls.dataFim.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      this.dataFimSig.set(v || '');
    });
    this.form.controls.dataInicio.setValue(this.dataConsulta(), { emitEvent: false });
    this.form.controls.dataFim.setValue(this.dataConsulta(), { emitEvent: false });
    this.dataInicioSig.set(this.dataConsulta());
    this.dataFimSig.set(this.dataConsulta());
    this.carregar();
    this.carregarFaixas(this.form.controls.modalidade.value);
  }

  ngOnDestroy(): void {
    this.cancelarCarregar$.next();
    this.cancelarCarregar$.complete();
    this.destroy$.next();
    this.destroy$.complete();
    this.modalidadeSub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['podeGerenciar'] && !this.podeGerenciar) {
      this.form.disable({ emitEvent: false });
    } else if (changes['podeGerenciar'] && this.podeGerenciar) {
      this.form.enable({ emitEvent: false });
    }
  }

  onLookupIdChange(id: number | null): void {
    this.lookupId.set(id);
    if (!id || id <= 0) return;
    // `transportadoraNomeChange` pode chegar no mesmo tick; espera o nome antes de montar a linha.
    queueMicrotask(() => {
      if (this.lookupId() !== id) return;
      this.adicionarDestino(id, (this.lookupNome() || '').trim() || `Transportadora #${id}`);
    });
  }

  onLookupNomeChange(nome: string): void {
    const limpo = (nome || '').trim();
    this.lookupNome.set(limpo);
    const id = this.lookupId();
    // Se a linha já entrou com placeholder, atualiza o nome real.
    if (id && id > 0 && limpo) {
      this.destinos.update((list) =>
        list.map((d) =>
          d.id === id && (!d.nome || d.nome.startsWith('Transportadora #'))
            ? { ...d, nome: limpo }
            : d
        )
      );
    }
  }

  private adicionarDestino(id: number, nome: string): void {
    if (id <= 0) {
      this.toast.error('Selecione uma transportadora válida.');
      return;
    }
    if (this.form.controls.avulso.value) {
      this.form.controls.avulso.setValue(false, { emitEvent: false });
    }
    if (this.destinos().some((d) => d.id === id)) {
      this.toast.error('Transportadora já está na lista.');
      this.lookupId.set(null);
      this.lookupNome.set('');
      return;
    }
    this.destinos.update((list) => [
      ...list,
      {
        id,
        nome: nome || `Transportadora #${id}`,
        cota: null,
        loadingCota: true,
        faturamentoTipo: 'transportadora',
        responsavelFaturamentoId: null,
        responsavelFaturamentoNome: '',
      },
    ]);
    this.sincronizarQuantidadesHorarios();
    this.carregarCotaDestino(id);
    this.lookupId.set(null);
    this.lookupNome.set('');
  }

  setFaturamentoTipo(destinoId: number, tipo: DestinoFaturamentoTipo): void {
    this.destinos.update((list) =>
      list.map((d) => {
        if (d.id !== destinoId) return d;
        if (tipo === 'transportadora') {
          return {
            ...d,
            faturamentoTipo: 'transportadora',
            responsavelFaturamentoId: null,
            responsavelFaturamentoNome: '',
          };
        }
        return { ...d, faturamentoTipo: 'terceiro' };
      })
    );
  }

  onResponsavelFaturamentoId(destinoId: number, id: number | null): void {
    this.destinos.update((list) =>
      list.map((d) => {
        if (d.id !== destinoId) return d;
        const rid = id != null && id > 0 ? id : null;
        return {
          ...d,
          responsavelFaturamentoId: rid,
          responsavelFaturamentoNome: rid ? d.responsavelFaturamentoNome : '',
        };
      })
    );
  }

  onResponsavelFaturamentoNome(destinoId: number, nome: string): void {
    this.destinos.update((list) =>
      list.map((d) =>
        d.id === destinoId ? { ...d, responsavelFaturamentoNome: (nome || '').trim() } : d
      )
    );
  }

  abrirNovoResponsavelFaturamento(destinoId: number): void {
    if (!this.podeGerenciar) return;
    this.dialog
      .open(ResponsavelFaturamentoFormDialogComponent, {
        width: '720px',
        maxWidth: '96vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((res: ResponsavelFaturamentoFormDialogResult | undefined) => {
        if (!res?.saved || !res.dto?.id) return;
        const rid = Number(res.dto.id);
        if (!Number.isFinite(rid) || rid <= 0) return;
        const nome =
          (res.dto.nomeFantasia || res.dto.razaoSocial || '').trim() || `Responsável #${rid}`;
        this.destinos.update((list) =>
          list.map((d) =>
            d.id === destinoId
              ? {
                  ...d,
                  faturamentoTipo: 'terceiro',
                  responsavelFaturamentoId: rid,
                  responsavelFaturamentoNome: nome,
                }
              : d
          )
        );
      });
  }

  removerDestino(id: number): void {
    this.destinos.update((list) => list.filter((d) => d.id !== id));
    this.horariosSelecionados.update((list) =>
      list.map((h) => {
        const overrides = { ...h.overrides };
        delete overrides[id];
        return { ...h, overrides };
      })
    );
  }

  maxDoDestino(d: DestinoTransportadoraLab): number | null {
    return maxQuantidadePermitida(d.cota);
  }

  /** Quantidade efetiva no horário (override ou padrão). */
  qtdResolvidaHorario(h: HorarioSelecionadoLab, transportadoraId: number): number {
    if (Object.prototype.hasOwnProperty.call(h.overrides, transportadoraId)) {
      return Math.max(0, Math.trunc(Number(h.overrides[transportadoraId]) || 0));
    }
    return Math.max(0, Math.trunc(Number(h.quantidadePadrao) || 0));
  }

  totalReservadoTransportadora(
    transportadoraId: number,
    horarios: HorarioSelecionadoLab[] = this.horariosSelecionados()
  ): number {
    return horarios.reduce((acc, h) => acc + this.qtdResolvidaHorario(h, transportadoraId), 0);
  }

  restoLivreTransportadora(d: DestinoTransportadoraLab): number | null {
    const max = this.maxDoDestino(d);
    if (max == null) return null;
    return Math.max(0, max - this.totalReservadoTransportadora(d.id));
  }

  excedeCotaDestino(d: DestinoTransportadoraLab): boolean {
    const max = this.maxDoDestino(d);
    if (max == null) return false;
    return this.totalReservadoTransportadora(d.id) > max;
  }

  motivoExcessoDestino(d: DestinoTransportadoraLab): string | null {
    if (!this.excedeCotaDestino(d)) return null;
    const max = this.maxDoDestino(d) ?? 0;
    const usado = this.totalReservadoTransportadora(d.id);
    return `Neste formulário ${usado} vaga${usado === 1 ? '' : 's'}, mas só há ${max} livre${
      max === 1 ? '' : 's'
    }. Reduza a quantidade nos horários.`;
  }

  faixaEstaSelecionada(key: string): boolean {
    return this.horariosSelecionados().some((h) => h.faixa.key === key);
  }

  qtdPadraoHorario(horarioKey: string): number {
    const h = this.horariosSelecionados().find((x) => x.faixa.key === horarioKey);
    return Math.max(0, Math.trunc(Number(h?.quantidadePadrao) || 0));
  }

  qtdHorarioTransportadora(horarioKey: string, transportadoraId: number): number {
    const h = this.horariosSelecionados().find((x) => x.faixa.key === horarioKey);
    if (!h) return 0;
    return this.qtdResolvidaHorario(h, transportadoraId);
  }

  temOverrideHorario(horarioKey: string, transportadoraId: number): boolean {
    const h = this.horariosSelecionados().find((x) => x.faixa.key === horarioKey);
    return !!h && Object.prototype.hasOwnProperty.call(h.overrides, transportadoraId);
  }

  qtdHorarioAvulso(horarioKey: string): number {
    const h = this.horariosSelecionados().find((x) => x.faixa.key === horarioKey);
    return Math.max(0, Math.trunc(Number(h?.quantidadeAvulsa) || 0));
  }

  toggleExpandirHorario(horarioKey: string): void {
    this.horariosSelecionados.update((list) =>
      list.map((h) => (h.faixa.key === horarioKey ? { ...h, expandido: !h.expandido } : h))
    );
  }

  labelCota(d: DestinoTransportadoraLab): string {
    if (d.loadingCota) return 'Consultando acordo…';
    const c = d.cota;
    if (!c?.temAcordo || c.cotaMes == null) return 'Sem cota de acordo neste mês';
    // Cota do acordo = direito diário (ex.: 5 no mês ⇒ 5 livres em cada dia).
    return `Direito diário do acordo: ${c.cotaMes} · já destinadas neste dia: ${c.destinadas} · livres: ${c.livres}`;
  }

  selecionarModalidade(value: ModalidadeVagaAgendamento): void {
    if (!this.podeGerenciar) return;
    this.form.controls.modalidade.setValue(value);
    this.form.controls.modalidade.markAsDirty();
  }

  /** Alterna a visão de KPIs do caput (e alinha o form quando for Est/Limp). */
  selecionarKpiModalidade(value: 1 | 2): void {
    this.kpiModalidade.set(value);
    if (this.podeGerenciar) this.selecionarModalidade(value);
  }

  toggleFaixa(faixa: FaixaHorarioLab): void {
    if (!this.podeGerenciar) return;
    const ja = this.horariosSelecionados().some((h) => h.faixa.key === faixa.key);
    if (ja) {
      this.horariosSelecionados.update((list) => list.filter((h) => h.faixa.key !== faixa.key));
      return;
    }
    this.horariosSelecionados.update((list) => [
      ...list,
      {
        faixa,
        quantidadePadrao: 1,
        overrides: {},
        quantidadeAvulsa: 1,
        expandido: false,
      },
    ]);
  }

  onQtdPadraoHorario(horarioKey: string, raw: string | number): void {
    const n = Math.max(0, Math.trunc(Number(raw) || 0));
    this.horariosSelecionados.update((list) =>
      list.map((h) => {
        if (h.faixa.key !== horarioKey) return h;
        // Overrides iguais ao novo padrão são removidos.
        const overrides: Record<number, number> = {};
        for (const [idStr, q] of Object.entries(h.overrides)) {
          const qn = Math.max(0, Math.trunc(Number(q) || 0));
          if (qn !== n) overrides[Number(idStr)] = qn;
        }
        return { ...h, quantidadePadrao: n, overrides };
      })
    );
  }

  onQtdHorarioTransportadora(horarioKey: string, transportadoraId: number, raw: string | number): void {
    const n = Math.max(0, Math.trunc(Number(raw) || 0));
    const destino = this.destinos().find((d) => d.id === transportadoraId);
    const max = destino ? this.maxDoDestino(destino) : null;

    this.horariosSelecionados.update((list) =>
      list.map((h) => {
        if (h.faixa.key !== horarioKey) return h;
        const outros = list
          .filter((x) => x.faixa.key !== horarioKey)
          .reduce((acc, x) => acc + this.qtdResolvidaHorario(x, transportadoraId), 0);
        const teto = max != null ? Math.max(0, max - outros) : n;
        const quantidade = max != null ? Math.min(n, teto) : n;
        const overrides = { ...h.overrides };
        if (quantidade === h.quantidadePadrao) {
          delete overrides[transportadoraId];
        } else {
          overrides[transportadoraId] = quantidade;
        }
        return { ...h, overrides };
      })
    );
  }

  onQtdHorarioAvulso(horarioKey: string, raw: string | number): void {
    const n = Math.max(0, Math.trunc(Number(raw) || 0));
    this.horariosSelecionados.update((list) =>
      list.map((h) => (h.faixa.key === horarioKey ? { ...h, quantidadeAvulsa: n } : h))
    );
  }

  /** Define a qtd padrão de todos os horários e limpa exceções. */
  aplicarQtdParaTodos(raw: string | number): void {
    const n = Math.max(0, Math.trunc(Number(raw) || 0));
    if (this.form.controls.avulso.value) {
      this.horariosSelecionados.update((list) => list.map((h) => ({ ...h, quantidadeAvulsa: n })));
      return;
    }
    this.horariosSelecionados.update((list) =>
      list.map((h) => ({
        ...h,
        quantidadePadrao: n,
        overrides: {},
      }))
    );
  }

  private sincronizarQuantidadesHorarios(): void {
    const ids = new Set(this.destinos().map((d) => d.id));
    this.horariosSelecionados.update((list) =>
      list.map((h) => {
        const overrides: Record<number, number> = {};
        for (const [idStr, q] of Object.entries(h.overrides)) {
          const id = Number(idStr);
          if (!ids.has(id)) continue;
          overrides[id] = Math.max(0, Math.trunc(Number(q) || 0));
        }
        return { ...h, overrides };
      })
    );
  }

  toggleReservas(): void {
    this.reservasAbertas.update((v) => !v);
  }

  onFiltroListaBusca(value: string): void {
    this.filtroListaBusca.set(value ?? '');
  }

  setFiltroListaModalidade(value: DestinacaoListaModalidade): void {
    this.filtroListaModalidade.set(value);
  }

  onFiltroListaModalidadeChange(raw: string): void {
    if (raw === '1' || raw === '2' || raw === '3') {
      this.filtroListaModalidade.set(Number(raw) as 1 | 2 | 3);
      return;
    }
    this.filtroListaModalidade.set('todas');
  }

  setFiltroListaSituacao(value: string): void {
    if (value === 'ativas' || value === 'inativas' || value === 'todas') {
      this.filtroListaSituacao.set(value);
    }
  }

  isTransportadoraExpandida(key: string): boolean {
    return this.expandidoTransportadoras().has(key);
  }

  isPeriodoExpandido(key: string): boolean {
    return this.expandidoPeriodos().has(key);
  }

  isHistoricoExpandido(key: string): boolean {
    return this.expandidoHistoricos().has(key);
  }

  toggleTransportadora(key: string): void {
    this.menuAcaoHorarioId.set(null);
    this.expandidoTransportadoras.update((set) => this.toggleSetKey(set, key));
  }

  togglePeriodo(key: string): void {
    this.menuAcaoHorarioId.set(null);
    this.expandidoPeriodos.update((set) => this.toggleSetKey(set, key));
  }

  toggleHistorico(key: string): void {
    this.menuAcaoHorarioId.set(null);
    this.expandidoHistoricos.update((set) => this.toggleSetKey(set, key));
  }

  expandirTodasDestinacoes(): void {
    const grupos = this.destinacoesAgrupadas();
    this.expandidoTransportadoras.set(new Set(grupos.map((g) => g.key)));
    this.expandidoPeriodos.set(
      new Set(grupos.flatMap((g) => g.periodosAtivos.map((p) => `${g.key}|${p.key}`)))
    );
  }

  recolherTodasDestinacoes(): void {
    this.expandidoTransportadoras.set(new Set());
    this.expandidoPeriodos.set(new Set());
    this.expandidoHistoricos.set(new Set());
    this.menuAcaoHorarioId.set(null);
  }

  periodoExpandKey(transportadoraKey: string, periodoKey: string): string {
    return `${transportadoraKey}|${periodoKey}`;
  }

  toggleMenuAcaoHorario(id: number, event: Event): void {
    event.stopPropagation();
    this.menuAcaoHorarioId.update((atual) => (atual === id ? null : id));
  }

  @HostListener('document:click')
  onDocumentClickFechaMenu(): void {
    if (this.menuAcaoHorarioId() != null) this.menuAcaoHorarioId.set(null);
  }

  private toggleSetKey(set: ReadonlySet<string>, key: string): Set<string> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  irParaHoje(): void {
    this.onDataConsultaChange(toIsoDateLocal());
  }

  dataConsultaLabel(): string {
    const d = parseIsoDateLocal(this.dataConsulta());
    if (!d) return this.dataConsulta();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  recorrenciaHint(): string {
    const atual = this.form.controls.periodicidade.value;
    return this.recorrencias.find((r) => r.value === atual)?.hint ?? '';
  }

  diaSemanaAtivo(dia: number): boolean {
    return this.diasSemana().includes(dia);
  }

  alternarDiaSemana(dia: number): void {
    if (!this.podeGerenciar || !this.mostraDiasSemana()) return;
    this.diasSemana.update((list) => {
      if (list.includes(dia)) return list.filter((d) => d !== dia);
      return [...list, dia].sort((a, b) => {
        const ordem = [1, 2, 3, 4, 5, 6, 0];
        return ordem.indexOf(a) - ordem.indexOf(b);
      });
    });
  }

  private diasSemanaCsv(): string | null {
    if (this.form.controls.periodicidade.value !== 2) return null;
    const dias = this.diasSemana();
    if (!dias.length) return null;
    return [...dias].sort((a, b) => a - b).join(',');
  }

  onDataConsultaChange(value: string): void {
    const iso = (value || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso === this.dataConsulta()) return;
    this.dataConsulta.set(iso);
    if (!this.form.controls.dataInicio.dirty) {
      this.form.controls.dataInicio.setValue(iso, { emitEvent: false });
      this.dataInicioSig.set(iso);
      if (!this.form.controls.dataFim.dirty) {
        this.form.controls.dataFim.setValue(iso, { emitEvent: false });
      }
      this.recalcularCotasDestinos();
      this.carregarFaixas(this.form.controls.modalidade.value);
    }
    this.carregar();
  }

  onFiltroPeriodoChange(periodo: PeriodoDataSelecionado): void {
    if (!periodo.ativo || !periodo.dataInicial) return;
    this.onDataConsultaChange(periodo.dataInicial);
  }

  onVigenciaPeriodoChange(periodo: PeriodoDataSelecionado): void {
    if (!periodo.ativo || !periodo.dataInicial) {
      this.form.patchValue({ dataInicio: '', dataFim: '' });
      this.dataInicioSig.set('');
      this.dataFimSig.set('');
      this.form.controls.dataInicio.markAsDirty();
      this.form.controls.dataFim.markAsDirty();
      return;
    }
    const fim = periodo.dataFinal || periodo.dataInicial;
    this.form.patchValue({ dataInicio: periodo.dataInicial, dataFim: fim });
    this.dataInicioSig.set(periodo.dataInicial);
    this.dataFimSig.set(fim);
    this.form.controls.dataInicio.markAsDirty();
    this.form.controls.dataFim.markAsDirty();
  }

  carregar(): void {
    this.cancelarCarregar$.next();
    const geracao = ++this.geracaoCarregar;
    const data = this.dataConsulta();
    this.loading.set(true);
    forkJoin({
      resumo: this.api.resumoParaTransportadora(data).pipe(catchError(() => of(null))),
      reservas: this.api.listarReservas().pipe(catchError(() => of([] as VagaReservaTransportadoraItem[]))),
    })
      .pipe(
        takeUntil(this.cancelarCarregar$),
        finalize(() => {
          if (geracao === this.geracaoCarregar) this.loading.set(false);
        })
      )
      .subscribe({
        next: ({ resumo, reservas }) => {
          if (geracao !== this.geracaoCarregar || data !== this.dataConsulta()) return;
          this.resumo.set(resumo);
          this.reservas.set(reservas?.length ? reservas : resumo?.reservas ?? []);
          this.recalcularCotasDestinos();
        },
        error: () => {
          if (geracao !== this.geracaoCarregar || data !== this.dataConsulta()) return;
          this.resumo.set(null);
          this.reservas.set([]);
        },
      });
  }

  private dataRefCota(): string {
    const inicio = (this.dataInicioSig() || '').trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(inicio) ? inicio : this.dataConsulta();
  }

  /**
   * Horários = slots das Janelas no dia de referência (vigência ou dia consultado).
   * Usa `GET /JanelaAgendamento/disponibilidade` — só o que vale naquele dia
   * (ex.: janela “Vagas Dezembro” não aparece em novembro).
   */
  private carregarFaixas(modalidade: ModalidadeVagaAgendamento): void {
    const geracao = ++this.geracaoFaixas;
    const data = this.dataRefCota();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      this.faixas.set([]);
      this.horariosSelecionados.set([]);
      this.loadingFaixas.set(false);
      return;
    }

    this.loadingFaixas.set(true);
    const mods: ModalidadeAgendamento[] =
      modalidade === 3 ? [1, 2] : [modalidade as ModalidadeAgendamento];

    forkJoin(
      mods.map((m) =>
        this.janelasApi.disponibilidade(data, m).pipe(
          catchError(() =>
            of({
              data,
              modalidade: m,
              usouDestinacao: false,
              slots: [],
            })
          )
        )
      )
    )
      .pipe(
        map((disps) =>
          coletarFaixasUnicas(
            disps.flatMap((d) =>
              (d.slots ?? []).map((s) => ({ horaInicio: s.horaInicio, horaFim: s.horaFim }))
            )
          )
        ),
        finalize(() => {
          if (geracao === this.geracaoFaixas) this.loadingFaixas.set(false);
        })
      )
      .subscribe({
        next: (faixas) => {
          if (geracao !== this.geracaoFaixas) return;
          this.faixas.set(faixas);
          const keys = new Set(faixas.map((f) => f.key));
          this.horariosSelecionados.update((list) => list.filter((h) => keys.has(h.faixa.key)));
        },
        error: () => {
          if (geracao !== this.geracaoFaixas) return;
          this.faixas.set([]);
          this.horariosSelecionados.set([]);
        },
      });
  }

  private carregarCotaDestino(transportadoraId: number): void {
    if (transportadoraId <= 0) return;
    this.obterCota(transportadoraId).subscribe((cota) => {
      this.destinos.update((list) =>
        list.map((d) => (d.id === transportadoraId ? { ...d, cota, loadingCota: false } : d))
      );
    });
  }

  private recalcularCotasDestinos(): void {
    const ids = this.destinos().map((d) => d.id);
    if (!ids.length) return;
    this.destinos.update((list) => list.map((d) => ({ ...d, loadingCota: true })));
    for (const id of ids) this.carregarCotaDestino(id);
  }

  private obterCota(transportadoraId: number) {
    return this.cobrancaApi
      .listar({
        transportadoraId,
        status: StatusConfiguracaoCobranca.Ativa,
        numeroPagina: 1,
        tamanhoPagina: 30,
      })
      .pipe(
        switchMap((page) => {
          const acordo = page.items.find((i) => Number(i.modalidadeCobranca) === ModalidadeCobranca.Acordo);
          if (!acordo) {
            return of(
              calcularCotaDia({
                vagasAcordo: null,
                temAcordo: false,
                dataIso: this.dataRefCota(),
                transportadoraId,
                reservas: this.reservas(),
              })
            );
          }
          return this.cobrancaApi.obterListaItemPorId(acordo.id).pipe(
            map((item) =>
              calcularCotaDia({
                vagasAcordo: (item?.acordo?.vagas ?? null) as ConfigCobrancaVagasAcordo | null,
                temAcordo: !!item && Number(item.modalidadeCobranca) === ModalidadeCobranca.Acordo,
                dataIso: this.dataRefCota(),
                transportadoraId,
                reservas: this.reservas(),
              })
            ),
            catchError(() =>
              of(
                calcularCotaDia({
                  vagasAcordo: null,
                  temAcordo: false,
                  dataIso: this.dataRefCota(),
                  transportadoraId,
                  reservas: this.reservas(),
                })
              )
            )
          );
        }),
        catchError(() =>
          of(
            calcularCotaDia({
              vagasAcordo: null,
              temAcordo: false,
              dataIso: this.dataRefCota(),
              transportadoraId,
              reservas: this.reservas(),
            })
          )
        )
      );
  }

  salvar(): void {
    if (!this.podeGerenciar) return;
    const bloqueios = this.bloqueiosSalvar();
    if (bloqueios.length) {
      this.toast.error(bloqueios[0]!);
      return;
    }
    const horarios = this.horariosSelecionados();
    if (!horarios.length) {
      this.toast.error('Selecione ao menos um horário das janelas.');
      return;
    }
    const raw = this.form.getRawValue();
    const dataInicio = (raw.dataInicio || '').trim().slice(0, 10);
    const dataFim = (raw.dataFim || '').trim().slice(0, 10) || null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
      this.toast.error('Selecione o período de vigência.');
      return;
    }
    if (dataFim && dataFim < dataInicio) {
      this.toast.error('A data fim deve ser igual ou posterior à data início.');
      return;
    }
    if (raw.periodicidade !== 4 && !dataFim) {
      this.toast.error('Informe o fim da vigência para a recorrência escolhida.');
      return;
    }
    const diasCsv = this.diasSemanaCsv();
    if (raw.periodicidade === 2 && !diasCsv) {
      this.toast.error('Selecione ao menos um dia da semana.');
      return;
    }

    if (!raw.avulso) {
      for (const d of this.destinos()) {
        if (
          d.faturamentoTipo === 'terceiro' &&
          !(d.responsavelFaturamentoId != null && d.responsavelFaturamentoId > 0)
        ) {
          this.toast.error(
            `${d.nome}: selecione o responsável de faturamento (terceiro) ou cadastre o CNPJ.`
          );
          return;
        }
        const usado = this.totalReservadoTransportadora(d.id, horarios);
        const max = this.maxDoDestino(d);
        if (max != null && usado > max) {
          this.toast.error(
            `${d.nome}: total ${usado} excede Qtd. Livres ${max}. Ajuste as quantidades por horário.`
          );
          return;
        }
      }
    }

    const payloads: VagaReservaTransportadoraInput[] = [];
    for (const h of horarios) {
      const base = {
        modalidade: raw.modalidade,
        dataInicio,
        dataFim,
        periodicidade: raw.periodicidade,
        periodoDia: null as null,
        horaInicio: h.faixa.horaInicio,
        horaFim: h.faixa.horaFim,
        diasSemana: diasCsv,
      };
      if (raw.avulso) {
        if (h.quantidadeAvulsa >= 1) {
          payloads.push({
            ...base,
            transportadoraId: 0,
            quantidade: h.quantidadeAvulsa,
            avulso: true,
            responsavelFaturamentoId: null,
            transferenciaAutomaticaSaldo: !!raw.transferenciaAutomaticaSaldo,
          });
        }
      } else {
        for (const d of this.destinos()) {
          if (d.id <= 0) continue;
          const qtd = this.qtdResolvidaHorario(h, d.id);
          if (qtd < 1) continue;
          payloads.push({
            ...base,
            transportadoraId: d.id,
            quantidade: qtd,
            avulso: false,
            responsavelFaturamentoId:
              d.faturamentoTipo === 'terceiro' &&
              d.responsavelFaturamentoId != null &&
              d.responsavelFaturamentoId > 0
                ? d.responsavelFaturamentoId
                : null,
            transferenciaAutomaticaSaldo: !!raw.transferenciaAutomaticaSaldo,
          });
        }
      }
    }

    if (!payloads.length) {
      this.toast.error('Informe quantidade (> 0) em ao menos um horário.');
      return;
    }

    this.salvando.set(true);
    forkJoin(
      payloads.map((input) =>
        this.api.criarReserva(input).pipe(
          map((r) => !!r),
          catchError(() => of(false))
        )
      )
    )
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: (results) => {
          const ok = results.filter(Boolean).length;
          const falhas = results.length - ok;
          if (ok > 0) {
            this.toast.success(ok === 1 ? '1 destinação criada.' : `${ok} destinações criadas.`);
            this.resetAposSucesso();
            this.carregar();
          }
          if (falhas > 0) this.toast.error(`${falhas} falha(s) ao criar destinação.`);
        },
        error: () => this.toast.error('Falha ao criar destinações.'),
      });
  }

  private resetAposSucesso(): void {
    const dia = this.dataConsulta();
    this.form.patchValue({
      dataInicio: dia,
      dataFim: dia,
      avulso: false,
      periodicidade: 1,
      transferenciaAutomaticaSaldo: false,
    });
    this.dataInicioSig.set(dia);
    this.dataFimSig.set(dia);
    this.periodicidadeSig.set(1);
    this.avulsoSig.set(false);
    this.diasSemana.set([]);
    this.destinos.set([]);
    this.horariosSelecionados.set([]);
    this.lookupId.set(null);
    this.lookupNome.set('');
    this.form.controls.dataInicio.markAsPristine();
    this.form.controls.dataFim.markAsPristine();
  }

  inativar(id: number): void {
    if (!this.podeGerenciar) return;
    this.menuAcaoHorarioId.set(null);
    this.api.inativarReserva(id).subscribe({
      next: (ok) => {
        if (!ok) {
          this.toast.error('Não foi possível inativar a reserva.');
          return;
        }
        this.toast.success('Reserva inativada.');
        this.carregar();
      },
      error: () => this.toast.error('Falha ao inativar reserva.'),
    });
  }

  pctDisponivel(disponiveis: number | null | undefined, capacidade: number | null | undefined): number {
    const cap = Number(capacidade);
    const disp = Number(disponiveis);
    if (!Number.isFinite(cap) || cap <= 0) return 0;
    if (!Number.isFinite(disp) || disp <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((disp / cap) * 100)));
  }
}
