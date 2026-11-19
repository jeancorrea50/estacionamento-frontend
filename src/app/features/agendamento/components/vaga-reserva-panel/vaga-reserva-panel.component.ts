import { CommonModule, DatePipe } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
import { ToastService } from '../../../../core/api/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  PeriodoDataPickerComponent,
  type PeriodoDataSelecionado,
} from '../../../../shared/ui/periodo-data-picker/periodo-data-picker.component';
import { ResponsavelFaturamentoLookupFieldComponent } from '../../../cadastro/components/responsavel-faturamento-lookup-field/responsavel-faturamento-lookup-field.component';
import {
  ModalidadeCobranca,
  StatusConfiguracaoCobranca,
  TipoPagadorCobranca,
  type ConfiguracaoCobrancaOutput,
} from '../../../financeiro/models/configuracao-cobranca.models';
import { ConfiguracaoCobrancaService } from '../../../financeiro/services/configuracao-cobranca.service';
import { TransportadoraLookupFieldComponent } from '../../../movimentos/entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
import type { JanelaSlotDisponivel } from '../../models/janela-agendamento.models';
import type {
  ModalidadeVagaAgendamento,
  PeriodicidadeVagaReserva,
  VagaDisponibilidadeResumo,
  VagaReservaTransportadoraItem,
} from '../../models/vaga-disponibilidade.models';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import { VagaDisponibilidadeService } from '../../services/vaga-disponibilidade.service';

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

function slotKey(s: JanelaSlotDisponivel): string {
  return `${s.janelaAgendamentoId}|${s.horaInicio}|${s.horaFim}`;
}

function vagasAcordoDoMes(cfg: ConfiguracaoCobrancaOutput | null, mes1a12: number): number | null {
  if (!cfg || cfg.modalidadeCobranca !== ModalidadeCobranca.Acordo) return null;
  const mapa: Record<number, number | null | undefined> = {
    1: cfg.vagasJaneiro,
    2: cfg.vagasFevereiro,
    3: cfg.vagasMarco,
    4: cfg.vagasAbril,
    5: cfg.vagasMaio,
    6: cfg.vagasJunho,
    7: cfg.vagasJulho,
    8: cfg.vagasAgosto,
    9: cfg.vagasSetembro,
    10: cfg.vagasOutubro,
    11: cfg.vagasNovembro,
    12: cfg.vagasDezembro,
  };
  const v = mapa[mes1a12];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : null;
}

export interface CalendarioDiaVaga {
  iso: string;
  dia: number;
  foraDoMes: boolean;
  disponiveis: number | null;
  /** null = ainda não consultado / falha */
  status: 'ok' | 'vazio' | 'parcial' | 'cheio' | 'desconhecido';
}

/**
 * Painel do operador/pátio: destina vagas (estacionamento/limpeza) para transportadoras.
 * Slots vêm das janelas; teto considera acordo de cobrança; pagador aparece se terceiro.
 */
@Component({
  selector: 'app-vaga-reserva-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    PeriodoDataPickerComponent,
    TransportadoraLookupFieldComponent,
    ResponsavelFaturamentoLookupFieldComponent,
  ],
  templateUrl: './vaga-reserva-panel.component.html',
  styleUrls: ['./vaga-reserva-panel.component.scss'],
})
export class VagaReservaPanelComponent implements OnInit, OnChanges, OnDestroy {
  private readonly api = inject(VagaDisponibilidadeService);
  private readonly janelasApi = inject(JanelaAgendamentoService);
  private readonly cobrancaApi = inject(ConfiguracaoCobrancaService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  @Input() podeGerenciar = false;
  /** Quando true, omite título externo (uso dentro de modal). */
  @Input() embedded = false;

  readonly loading = signal(false);
  readonly loadingSlots = signal(false);
  readonly loadingCalendario = signal(false);
  readonly salvando = signal(false);
  readonly resumo = signal<VagaDisponibilidadeResumo | null>(null);
  readonly reservas = signal<VagaReservaTransportadoraItem[]>([]);
  readonly reservasAbertas = signal(true);
  readonly dataConsulta = signal(toIsoDateLocal());
  readonly transportadoraFormId = signal<number | null>(null);
  readonly transportadoraFormNome = signal('');
  readonly slots = signal<JanelaSlotDisponivel[]>([]);
  readonly slotSelecionadoKey = signal<string | null>(null);
  readonly acordo = signal<ConfiguracaoCobrancaOutput | null>(null);
  readonly pagadorId = signal<number | null>(null);
  readonly pagadorNome = signal('');
  readonly calendarioMes = signal<{ ano: number; mes: number }>(
    (() => {
      const d = parseIsoDateLocal(toIsoDateLocal()) ?? new Date();
      return { ano: d.getFullYear(), mes: d.getMonth() };
    })()
  );
  readonly calendarioDias = signal<CalendarioDiaVaga[]>([]);

  private readonly destroy$ = new Subject<void>();
  private readonly cancelarCarregar$ = new Subject<void>();
  private readonly cancelarSlots$ = new Subject<void>();
  private readonly cancelarAcordo$ = new Subject<void>();
  private readonly cancelarCalendario$ = new Subject<void>();
  private geracaoCarregar = 0;
  private geracaoSlots = 0;
  private geracaoAcordo = 0;
  private geracaoCalendario = 0;

  readonly modalidades: { value: ModalidadeVagaAgendamento; label: string }[] = [
    { value: 1, label: 'Estacionamento' },
    { value: 2, label: 'Limpeza' },
    { value: 3, label: 'Ambos' },
  ];
  readonly recorrencias: { value: PeriodicidadeVagaReserva; label: string; hint: string }[] = [
    { value: 1, label: 'Todos os dias', hint: 'Repete todos os dias na vigência.' },
    { value: 2, label: 'Toda semana', hint: 'Repete a cada semana na vigência.' },
    { value: 3, label: 'Todo mês', hint: 'Repete a cada mês na vigência.' },
    { value: 4, label: 'Período contínuo', hint: 'Sem repetição por dia/semana/mês.' },
  ];

  readonly form = this.fb.nonNullable.group({
    transportadoraId: [0, [Validators.min(1)]],
    modalidade: [1 as ModalidadeVagaAgendamento, Validators.required],
    quantidade: [1, [Validators.required, Validators.min(1)]],
    dataInicio: ['', Validators.required],
    dataFim: [''],
    periodicidade: [1 as PeriodicidadeVagaReserva, Validators.required],
    avulso: [false],
  });

  readonly exigePagador = computed(
    () => this.acordo()?.tipoPagadorCobranca === TipoPagadorCobranca.Terceiro
  );

  readonly vagasAcordoMes = computed(() => {
    const cfg = this.acordo();
    const iso = (this.form.controls.dataInicio.value || this.dataConsulta()).slice(0, 10);
    const d = parseIsoDateLocal(iso);
    if (!d) return null;
    return vagasAcordoDoMes(cfg, d.getMonth() + 1);
  });

  readonly slotAtual = computed(() => {
    const key = this.slotSelecionadoKey();
    if (!key) return null;
    return this.slots().find((s) => slotKey(s) === key) ?? null;
  });

  readonly maxQuantidade = computed(() => {
    const slot = this.slotAtual();
    const dispJanela = slot ? Math.max(0, Math.trunc(slot.disponiveis)) : null;
    const acordoVagas = this.vagasAcordoMes();
    if (dispJanela == null && acordoVagas == null) return null;
    if (dispJanela == null) return acordoVagas;
    if (acordoVagas == null) return dispJanela;
    return Math.min(dispJanela, acordoVagas);
  });

  readonly calendarioTitulo = computed(() => {
    const { ano, mes } = this.calendarioMes();
    const nome = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return nome.charAt(0).toUpperCase() + nome.slice(1);
  });

  ngOnInit(): void {
    this.form.controls.avulso.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((avulso) => {
      if (avulso) {
        this.limparTransportadoraSelecionada();
        this.limparAcordoEPagador();
      }
    });
    this.form.controls.modalidade.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.slotSelecionadoKey.set(null);
      this.carregarSlots();
    });
    this.form.controls.dataInicio.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      // Recalcula teto do acordo (mês da vigência).
      this.aplicarTetoQuantidade();
    });

    this.form.controls.dataInicio.setValue(this.dataConsulta(), { emitEvent: false });
    this.form.controls.dataFim.setValue(this.dataConsulta(), { emitEvent: false });

    const d = parseIsoDateLocal(this.dataConsulta()) ?? new Date();
    this.calendarioMes.set({ ano: d.getFullYear(), mes: d.getMonth() });

    this.carregar();
    this.carregarSlots();
    this.carregarCalendario();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cancelarCarregar$.next();
    this.cancelarCarregar$.complete();
    this.cancelarSlots$.next();
    this.cancelarSlots$.complete();
    this.cancelarAcordo$.next();
    this.cancelarAcordo$.complete();
    this.cancelarCalendario$.next();
    this.cancelarCalendario$.complete();
  }

  onTransportadoraIdChange(id: number | null): void {
    this.transportadoraFormId.set(id);
    this.form.controls.transportadoraId.setValue(id && id > 0 ? id : 0);
    this.form.controls.transportadoraId.markAsDirty();
    if (id && id > 0 && this.form.controls.avulso.value) {
      this.form.controls.avulso.setValue(false, { emitEvent: false });
    }
    this.slotSelecionadoKey.set(null);
    this.carregarSlots();
    this.carregarAcordo(id);
  }

  onTransportadoraNomeChange(nome: string): void {
    this.transportadoraFormNome.set(nome || '');
  }

  onPagadorIdChange(id: number | null): void {
    this.pagadorId.set(id);
  }

  onPagadorNomeChange(nome: string): void {
    this.pagadorNome.set(nome || '');
  }

  private limparTransportadoraSelecionada(): void {
    this.transportadoraFormId.set(null);
    this.transportadoraFormNome.set('');
    this.form.controls.transportadoraId.setValue(0, { emitEvent: false });
  }

  private limparAcordoEPagador(): void {
    this.acordo.set(null);
    this.pagadorId.set(null);
    this.pagadorNome.set('');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['podeGerenciar'] && !this.podeGerenciar) {
      this.form.disable({ emitEvent: false });
    } else if (changes['podeGerenciar'] && this.podeGerenciar) {
      this.form.enable({ emitEvent: false });
    }
  }

  onDataConsultaChange(value: string): void {
    const iso = (value || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    if (iso === this.dataConsulta()) return;
    this.dataConsulta.set(iso);
    if (!this.form.controls.dataInicio.dirty) {
      this.form.controls.dataInicio.setValue(iso, { emitEvent: false });
      if (!this.form.controls.dataFim.dirty) {
        this.form.controls.dataFim.setValue(iso, { emitEvent: false });
      }
    }
    const d = parseIsoDateLocal(iso);
    if (d) {
      const atual = this.calendarioMes();
      if (atual.ano !== d.getFullYear() || atual.mes !== d.getMonth()) {
        this.calendarioMes.set({ ano: d.getFullYear(), mes: d.getMonth() });
        this.carregarCalendario();
      }
    }
    this.slotSelecionadoKey.set(null);
    this.carregar();
    this.carregarSlots();
  }

  onFiltroPeriodoChange(periodo: PeriodoDataSelecionado): void {
    if (!periodo.ativo || !periodo.dataInicial) return;
    this.onDataConsultaChange(periodo.dataInicial);
  }

  onVigenciaPeriodoChange(periodo: PeriodoDataSelecionado): void {
    if (!periodo.ativo || !periodo.dataInicial) {
      this.form.patchValue({ dataInicio: '', dataFim: '' });
      this.form.controls.dataInicio.markAsDirty();
      this.form.controls.dataFim.markAsDirty();
      return;
    }
    const fim = periodo.dataFinal || periodo.dataInicial;
    this.form.patchValue({
      dataInicio: periodo.dataInicial,
      dataFim: fim,
    });
    this.form.controls.dataInicio.markAsDirty();
    this.form.controls.dataFim.markAsDirty();
    this.aplicarTetoQuantidade();
  }

  onSlotChange(key: string): void {
    const k = (key || '').trim();
    this.slotSelecionadoKey.set(k || null);
    this.aplicarTetoQuantidade();
  }

  selecionarDiaCalendario(iso: string): void {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    this.onDataConsultaChange(iso);
  }

  mesAnterior(): void {
    const { ano, mes } = this.calendarioMes();
    const d = new Date(ano, mes - 1, 1);
    this.calendarioMes.set({ ano: d.getFullYear(), mes: d.getMonth() });
    this.carregarCalendario();
  }

  mesProximo(): void {
    const { ano, mes } = this.calendarioMes();
    const d = new Date(ano, mes + 1, 1);
    this.calendarioMes.set({ ano: d.getFullYear(), mes: d.getMonth() });
    this.carregarCalendario();
  }

  recorrenciaHint(): string {
    const atual = this.form.controls.periodicidade.value;
    return this.recorrencias.find((r) => r.value === atual)?.hint ?? '';
  }

  toggleReservas(): void {
    this.reservasAbertas.update((v) => !v);
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

  slotOptionLabel(s: JanelaSlotDisponivel): string {
    const base = (s.label || `${s.horaInicio} — ${s.horaFim}`).trim();
    return `${base} (${s.disponiveis} vaga${s.disponiveis === 1 ? '' : 's'})`;
  }

  horarioReservaLabel(r: VagaReservaTransportadoraItem): string {
    if (r.horaInicio && r.horaFim) return `${r.horaInicio} — ${r.horaFim}`;
    return r.periodoDiaLabel || '—';
  }

  chaveSlot(s: JanelaSlotDisponivel): string {
    return slotKey(s);
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
        },
        error: () => {
          if (geracao !== this.geracaoCarregar || data !== this.dataConsulta()) return;
          this.resumo.set(null);
          this.reservas.set([]);
        },
      });
  }

  carregarSlots(): void {
    this.cancelarSlots$.next();
    const geracao = ++this.geracaoSlots;
    const data = this.dataConsulta();
    const modalidade = this.form.controls.modalidade.value;
    const transportadoraId = this.form.controls.avulso.value
      ? null
      : this.transportadoraFormId();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      this.slots.set([]);
      this.slotSelecionadoKey.set(null);
      return;
    }

    this.loadingSlots.set(true);
    this.janelasApi
      .disponibilidade(data, modalidade, transportadoraId)
      .pipe(
        takeUntil(this.cancelarSlots$),
        catchError(() => of({ slots: [] as JanelaSlotDisponivel[] })),
        finalize(() => {
          if (geracao === this.geracaoSlots) this.loadingSlots.set(false);
        })
      )
      .subscribe((disp) => {
        if (geracao !== this.geracaoSlots) return;
        const lista = (disp.slots ?? []).filter((s) => (s.disponiveis ?? 0) > 0);
        this.slots.set(lista);
        const key = this.slotSelecionadoKey();
        if (key && !lista.some((s) => slotKey(s) === key)) {
          this.slotSelecionadoKey.set(null);
        }
        this.aplicarTetoQuantidade();
      });
  }

  private carregarAcordo(transportadoraId: number | null): void {
    this.cancelarAcordo$.next();
    const geracao = ++this.geracaoAcordo;
    this.limparAcordoEPagador();

    if (!transportadoraId || transportadoraId <= 0) return;

    const estacionamentoId = this.auth.resolveEstacionamentoId();
    this.cobrancaApi
      .buscar({
        transportadoraId,
        estacionamentoId: estacionamentoId ?? undefined,
        status: StatusConfiguracaoCobranca.Ativa,
        numeroPagina: 1,
        tamanhoPagina: 30,
      })
      .pipe(
        takeUntil(this.cancelarAcordo$),
        switchMap((page) => {
          const items = page.items ?? [];
          const preferido =
            items.find((i) => i.modalidadeCobranca === ModalidadeCobranca.Acordo) ?? items[0];
          if (!preferido?.id) return of(null);
          return this.cobrancaApi.obterPorId(preferido.id).pipe(catchError(() => of(null)));
        }),
        catchError(() => of(null))
      )
      .subscribe((cfg) => {
        if (geracao !== this.geracaoAcordo) return;
        this.acordo.set(cfg);
        if (cfg?.tipoPagadorCobranca === TipoPagadorCobranca.Terceiro) {
          const id = cfg.responsavelFaturamentoId ?? null;
          this.pagadorId.set(id && id > 0 ? id : null);
          this.pagadorNome.set((cfg.responsavelFaturamentoNome || '').trim());
        }
        this.aplicarTetoQuantidade();
      });
  }

  carregarCalendario(): void {
    this.cancelarCalendario$.next();
    const geracao = ++this.geracaoCalendario;
    const { ano, mes } = this.calendarioMes();
    const primeiro = new Date(ano, mes, 1);
    const inicioGrade = new Date(primeiro);
    inicioGrade.setDate(primeiro.getDate() - ((primeiro.getDay() + 6) % 7)); // segunda
    const dias: CalendarioDiaVaga[] = [];
    const cursor = new Date(inicioGrade);
    for (let i = 0; i < 42; i++) {
      const iso = toIsoDateLocal(cursor);
      const fora = cursor.getMonth() !== mes;
      dias.push({
        iso,
        dia: cursor.getDate(),
        foraDoMes: fora,
        disponiveis: null,
        status: 'desconhecido',
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    this.calendarioDias.set(dias);

    const doMes = dias.filter((d) => !d.foraDoMes);
    this.loadingCalendario.set(true);

    const reqs = doMes.map((d) =>
      this.janelasApi.disponibilidade(d.iso, 1, null).pipe(
        map((disp) => ({
          iso: d.iso,
          disponiveis:
            typeof disp.totalDisponiveis === 'number'
              ? disp.totalDisponiveis
              : (disp.slots ?? []).reduce((acc, s) => acc + (s.disponiveis || 0), 0),
        })),
        catchError(() => of({ iso: d.iso, disponiveis: null as number | null }))
      )
    );

    forkJoin(reqs)
      .pipe(
        takeUntil(this.cancelarCalendario$),
        finalize(() => {
          if (geracao === this.geracaoCalendario) this.loadingCalendario.set(false);
        })
      )
      .subscribe((resultados) => {
        if (geracao !== this.geracaoCalendario) return;
        const mapa = new Map(resultados.map((r) => [r.iso, r.disponiveis]));
        this.calendarioDias.update((lista) =>
          lista.map((d) => {
            if (d.foraDoMes) return d;
            const disp = mapa.get(d.iso);
            if (disp == null) return { ...d, disponiveis: null, status: 'desconhecido' as const };
            let status: CalendarioDiaVaga['status'] = 'ok';
            if (disp <= 0) status = 'vazio';
            else if (disp <= 3) status = 'parcial';
            else status = 'ok';
            return { ...d, disponiveis: disp, status };
          })
        );
      });
  }

  private aplicarTetoQuantidade(): void {
    const max = this.maxQuantidade();
    if (max == null || max <= 0) return;
    const atual = Number(this.form.controls.quantidade.value);
    if (Number.isFinite(atual) && atual > max) {
      this.form.controls.quantidade.setValue(max, { emitEvent: false });
    }
  }

  salvar(): void {
    if (!this.podeGerenciar) return;
    const raw = this.form.getRawValue();
    if (!raw.avulso && (!raw.transportadoraId || raw.transportadoraId <= 0)) {
      this.toast.error('Selecione a transportadora.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Preencha os campos obrigatórios da reserva.');
      return;
    }

    const slot = this.slotAtual();
    if (!slot) {
      this.toast.error('Selecione um horário de janela com vagas disponíveis.');
      return;
    }

    if (this.exigePagador() && (!this.pagadorId() || this.pagadorId()! <= 0)) {
      this.toast.error('Selecione o pagador (terceiro) conforme o acordo de cobrança.');
      return;
    }

    const dataInicio = (raw.dataInicio || '').trim().slice(0, 10);
    const dataFim = (raw.dataFim || '').trim().slice(0, 10) || null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
      this.toast.error('Selecione o período de vigência no calendário.');
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

    const max = this.maxQuantidade();
    if (max != null && raw.quantidade > max) {
      this.toast.error(`Quantidade máxima disponível: ${max}.`);
      return;
    }
    if (max != null && max <= 0) {
      this.toast.error('Não há vagas disponíveis neste horário/acordo.');
      return;
    }

    this.salvando.set(true);
    this.api
      .criarReserva({
        transportadoraId: raw.avulso ? 0 : raw.transportadoraId,
        modalidade: raw.modalidade,
        quantidade: raw.quantidade,
        dataInicio,
        dataFim,
        periodicidade: raw.periodicidade,
        horaInicio: slot.horaInicio,
        horaFim: slot.horaFim,
        responsavelFaturamentoId: this.exigePagador() ? this.pagadorId() : null,
        avulso: raw.avulso,
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: (criada) => {
          if (!criada) {
            this.toast.error('Não foi possível criar a reserva.');
            return;
          }
          this.toast.success('Reserva de vaga criada.');
          const dia = this.dataConsulta();
          this.form.patchValue({
            quantidade: 1,
            dataInicio: dia,
            dataFim: dia,
            avulso: false,
            periodicidade: 1,
          });
          this.limparTransportadoraSelecionada();
          this.limparAcordoEPagador();
          this.slotSelecionadoKey.set(null);
          this.form.controls.dataInicio.markAsPristine();
          this.form.controls.dataFim.markAsPristine();
          this.carregar();
          this.carregarSlots();
          this.carregarCalendario();
        },
        error: () => this.toast.error('Falha ao criar reserva de vaga.'),
      });
  }

  inativar(id: number): void {
    if (!this.podeGerenciar) return;
    this.api.inativarReserva(id).subscribe({
      next: (ok) => {
        if (!ok) {
          this.toast.error('Não foi possível inativar a reserva.');
          return;
        }
        this.toast.success('Reserva inativada.');
        this.carregar();
        this.carregarSlots();
        this.carregarCalendario();
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
