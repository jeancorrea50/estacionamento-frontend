import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, from, of } from 'rxjs';
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
import { formatPlacaDisplay, normalizePlaca, placaCompleta } from '../../../cadastro/utils/placa-br';
import {
  ModalidadeCobranca,
  StatusConfiguracaoCobranca,
  TipoPagadorCobranca,
} from '../../../financeiro/models/configuracao-cobranca.models';
import { ConfiguracaoCobrancaService } from '../../../financeiro/services/configuracao-cobranca.service';
import { TransportadoraLookupFieldComponent } from '../../../movimentos/entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
import { PortariaAlertasStore } from '../../../movimentos/services/portaria-alertas.store';
import { datetimeLocalInputToApiIso } from '../../../../shared/utils/local-iso-datetime';
import { AgendamentoDataHoraPickerComponent } from '../../pages/agendamentos-page/agendamento-data-hora-picker/agendamento-data-hora-picker.component';
import { toIsoDateLocal } from '../../pages/agendamentos-page/agendamento-dashboard.util';
import {
  AgendamentoPostInput,
  AgendamentoSlotHold,
  DestinoFreteAgendamento,
} from '../../models/agendamento.models';
import { JanelaSlotDisponivel, ModalidadeAgendamento } from '../../models/janela-agendamento.models';
import { AgendamentoService } from '../../services/agendamento.service';
import { JanelaDisponibilidadeRealtimeService } from '../../services/janela-disponibilidade-realtime.service';
import { JanelaSlotSelectComponent } from '../janela-slot-select/janela-slot-select.component';
import { AgendamentoVeiculosMotoristasModalComponent } from '../agendamento-veiculos-motoristas-modal/agendamento-veiculos-motoristas-modal.component';
import type { AgendamentoPlacaSelecionada } from './agendamento-placa.model';

type ResolvePlacaResult =
  | { ok: true; payload: AgendamentoPostInput }
  | { ok: false; message: string };

type EtapaWizard = 1 | 2;

/**
 * Modal compartilhado de criação de agendamento (Pátio e Agendar/transportadora).
 * Fluxo em 2 etapas: (1) data/horário/qtd + hold 20 min → (2) placas/motoristas + CIF/FOB.
 */
@Component({
  selector: 'app-agendamento-novo-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AgendamentoDataHoraPickerComponent,
    JanelaSlotSelectComponent,
    TransportadoraLookupFieldComponent,
    AgendamentoVeiculosMotoristasModalComponent,
  ],
  templateUrl: './agendamento-novo-modal.component.html',
  styleUrls: ['./agendamento-novo-modal.component.scss'],
  host: {
    '[class.ag-novo-modal--ativo]': 'overlayAtivo()',
    '[attr.aria-hidden]': 'overlayAtivo() ? null : "true"',
  },
})
export class AgendamentoNovoModalComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AgendamentoService);
  private readonly cobrancaApi = inject(ConfiguracaoCobrancaService);
  private readonly toast = inject(ToastService);
  private readonly portariaAlertas = inject(PortariaAlertasStore);
  private readonly realtime = inject(JanelaDisponibilidadeRealtimeService);
  private readonly fb = inject(FormBuilder);

  private readonly destroy$ = new Subject<void>();
  private readonly cancelarCobranca$ = new Subject<void>();
  private timerId: ReturnType<typeof setInterval> | null = null;
  private geracaoCobranca = 0;

  readonly aberto = input(false);
  readonly podeEscolherTransportadora = input(false);

  readonly fechado = output<void>();
  readonly salvo = output<void>();

  readonly etapa = signal<EtapaWizard>(1);
  readonly salvando = signal(false);
  readonly reservando = signal(false);
  readonly transportadoraFormId = signal<number | null>(null);
  readonly transportadoraFormNome = signal('');
  readonly placasSelecionadas = signal<AgendamentoPlacaSelecionada[]>([]);
  readonly frotaModalAberto = signal(false);
  readonly dataSelecionada = signal('');
  readonly modalidadeJanela = signal<ModalidadeAgendamento>(1);
  readonly slotSelecionado = signal<JanelaSlotDisponivel | null>(null);
  readonly quantidade = signal(1);
  readonly hold = signal<AgendamentoSlotHold | null>(null);
  readonly segundosRestantes = signal(0);
  /** FOB liberado quando cobrança ativa usa pagador terceiro. */
  readonly fobLiberado = signal(false);
  readonly pagadorFobId = signal<number | null>(null);
  readonly pagadorFobNome = signal('');

  readonly form = this.fb.group({
    dataAgendamento: ['', Validators.required],
    transportadoraId: [null as number | null],
    observacao: [''],
  });

  constructor() {
    effect(() => {
      if (!this.aberto()) {
        untracked(() => {
          void this.realtime.disconnect();
          this.limparHoldLocal(true);
        });
        return;
      }
      untracked(() => {
        this.resetForm();
        void this.realtime.connect();
      });
    });

    effect(() => {
      const slot = this.slotSelecionado();
      const max = Math.max(1, slot?.disponiveis ?? 1);
      if (this.quantidade() > max) {
        untracked(() => this.quantidade.set(max));
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cancelarCobranca$.next();
    this.cancelarCobranca$.complete();
    this.pararTimer();
    this.limparHoldLocal(true);
  }

  @HostListener('window:pagehide')
  @HostListener('window:beforeunload')
  onPageHideCancelHold(): void {
    const h = this.hold();
    if (!h?.id || !h.token || h.status !== 1) return;
    this.api.cancelarHoldBeacon(h.id, h.token);
  }

  overlayAtivo(): boolean {
    return this.aberto() || this.frotaModalAberto();
  }

  timerLabel(): string {
    const s = Math.max(0, this.segundosRestantes());
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  maxQuantidade(): number {
    return Math.max(1, this.slotSelecionado()?.disponiveis ?? 1);
  }

  resumoCifFob(): { cif: number; fob: number } {
    const lista = this.placasSelecionadas();
    return {
      cif: lista.filter((p) => (p.destinoFrete || 'cif') === 'cif').length,
      fob: lista.filter((p) => p.destinoFrete === 'fob').length,
    };
  }

  private resetForm(): void {
    this.pararTimer();
    this.hold.set(null);
    this.segundosRestantes.set(0);
    this.etapa.set(1);
    this.quantidade.set(1);
    this.fobLiberado.set(false);
    this.pagadorFobId.set(null);
    this.pagadorFobNome.set('');

    const tid =
      !this.podeEscolherTransportadora() && this.auth.isTransportadoraRole() && !this.auth.isAdmin()
        ? this.auth.resolveTransportadoraId()
        : null;
    const hoje = toIsoDateLocal(new Date());
    this.form.reset({
      dataAgendamento: hoje,
      transportadoraId: tid,
      observacao: '',
    });
    this.dataSelecionada.set(hoje);
    this.modalidadeJanela.set(1);
    this.slotSelecionado.set(null);
    this.transportadoraFormId.set(tid && tid > 0 ? tid : null);
    this.transportadoraFormNome.set('');
    this.placasSelecionadas.set([]);
    this.frotaModalAberto.set(false);
    if (tid && tid > 0) this.carregarCobranca(tid);
  }

  fechar(): void {
    this.frotaModalAberto.set(false);
    this.limparHoldLocal(true);
    this.fechado.emit();
  }

  voltarEtapa1(): void {
    this.limparHoldLocal(true);
    this.etapa.set(1);
    this.placasSelecionadas.set([]);
  }

  todasPlacasComMotorista(): boolean {
    const lista = this.placasSelecionadas();
    return lista.length > 0 && lista.every((p) => !!p.motoristaId && p.motoristaId > 0);
  }

  quantidadePlacasOk(): boolean {
    const q = this.quantidade();
    return this.placasSelecionadas().length === q;
  }

  onDataHoraChange(value: string): void {
    this.form.controls.dataAgendamento.setValue(value);
    this.form.controls.dataAgendamento.markAsDirty();
    this.dataSelecionada.set(value);
  }

  onTransportadoraIdChange(id: number | null): void {
    if (!this.podeEscolherTransportadora()) return;
    this.transportadoraFormId.set(id);
    this.form.controls.transportadoraId.setValue(id && id > 0 ? id : null);
    this.form.controls.transportadoraId.markAsDirty();
    this.placasSelecionadas.set([]);
    if (id && id > 0) this.carregarCobranca(id);
    else {
      this.fobLiberado.set(false);
      this.pagadorFobId.set(null);
      this.pagadorFobNome.set('');
    }
  }

  onTransportadoraNomeChange(nome: string): void {
    if (!this.podeEscolherTransportadora()) return;
    this.transportadoraFormNome.set(nome || '');
  }

  onQuantidadeChange(raw: string | number): void {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 1) {
      this.quantidade.set(1);
      return;
    }
    this.quantidade.set(Math.min(n, this.maxQuantidade()));
  }

  abrirFrotaModal(): void {
    const tid = this.transportadoraFormId();
    if (!tid) {
      this.toast.error('Selecione a transportadora antes de gerenciar veículos.');
      return;
    }
    this.frotaModalAberto.set(true);
  }

  fecharFrotaModal(): void {
    this.frotaModalAberto.set(false);
  }

  onFrotaConfirmada(lista: AgendamentoPlacaSelecionada[]): void {
    const destinoPadrao: DestinoFreteAgendamento = 'cif';
    const mapeadas = lista.map((p) => ({
      ...p,
      destinoFrete: p.destinoFrete || destinoPadrao,
    }));
    this.placasSelecionadas.set(mapeadas);
    this.frotaModalAberto.set(false);
    if (mapeadas.length !== this.quantidade()) {
      this.toast.warning(
        `Selecione exatamente ${this.quantidade()} veículo(s) para as vagas reservadas.`
      );
    }
  }

  removerPlacaSelecionada(veiculoId: number): void {
    this.placasSelecionadas.update((lista) => lista.filter((p) => p.id !== veiculoId));
  }

  selecionarDestinoFrete(veiculoId: number, destino: DestinoFreteAgendamento): void {
    if (destino === 'fob' && !this.fobLiberado()) {
      this.toast.warning('FOB bloqueado: cobrança sem pagador terceiro configurado.');
      return;
    }
    this.placasSelecionadas.update((lista) =>
      lista.map((p) => (p.id === veiculoId ? { ...p, destinoFrete: destino } : p))
    );
  }

  formatPlaca(placa: string | null | undefined): string {
    return formatPlacaDisplay(placa) || placa || '—';
  }

  labelMotorista(p: AgendamentoPlacaSelecionada): string {
    const nome = (p.motoristaNome || '').trim();
    if (nome) return nome;
    if (p.motoristaId && p.motoristaId > 0) return `Motorista #${p.motoristaId}`;
    return '';
  }

  continuarEtapa1(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Informe a data do agendamento.');
      return;
    }

    const tid = this.resolverTransportadoraId();
    if (!tid) {
      this.toast.error('Selecione a transportadora.');
      return;
    }

    const slot = this.slotSelecionado();
    if (!slot) {
      this.toast.error('Selecione o horário do agendamento.');
      return;
    }

    const qtd = this.quantidade();
    if (qtd < 1 || qtd > slot.disponiveis) {
      this.toast.error(
        `Informe uma quantidade entre 1 e ${slot.disponiveis} (vagas disponíveis no horário).`
      );
      return;
    }

    const data = String(this.form.controls.dataAgendamento.value ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      this.toast.error('Data inválida.');
      return;
    }

    this.reservando.set(true);
    this.api
      .criarHold({
        data,
        modalidadeAgendamento: this.modalidadeJanela(),
        horaInicio: slot.horaInicio,
        horaFim: slot.horaFim,
        janelaAgendamentoId: slot.janelaAgendamentoId ?? null,
        quantidade: qtd,
        transportadoraId: tid,
      })
      .pipe(finalize(() => this.reservando.set(false)))
      .subscribe({
        next: (h) => {
          this.hold.set(h);
          this.iniciarTimer(h.expiraEm);
          this.etapa.set(2);
          this.carregarCobranca(tid);
          this.toast.success(
            `Reserva de ${qtd} vaga(s) por 20 minutos. Complete veículos e destino do frete.`
          );
        },
        error: (err: { message?: string }) => {
          this.toast.error(err?.message || 'Não foi possível reservar as vagas.');
        },
      });
  }

  salvar(): void {
    if (this.etapa() !== 2) {
      this.continuarEtapa1();
      return;
    }

    const hold = this.hold();
    if (!hold || hold.status !== 1) {
      this.toast.error('A reserva temporária expirou. Volte e selecione o horário novamente.');
      this.voltarEtapa1();
      return;
    }

    const tid = this.resolverTransportadoraId();
    if (!tid) {
      this.toast.error('Selecione a transportadora.');
      return;
    }

    const selecionados = this.placasSelecionadas();
    if (!selecionados.length) {
      this.toast.error('Selecione os veículos das vagas reservadas.');
      return;
    }
    if (!this.quantidadePlacasOk()) {
      this.toast.error(`Selecione exatamente ${this.quantidade()} veículo(s).`);
      return;
    }
    if (!this.todasPlacasComMotorista()) {
      this.toast.error('Defina o motorista de cada placa.');
      this.abrirFrotaModal();
      return;
    }

    const fobSemPagador =
      this.fobLiberado() &&
      selecionados.some((p) => p.destinoFrete === 'fob') &&
      !(this.pagadorFobId() && this.pagadorFobId()! > 0);
    if (fobSemPagador) {
      this.toast.error('Cobrança FOB sem pagador terceiro cadastrado. Ajuste a configuração de cobrança.');
      return;
    }

    const slot = this.slotSelecionado();
    if (!slot) {
      this.toast.error('Horário inválido.');
      return;
    }

    const dataAgendamento = datetimeLocalInputToApiIso(
      `${String(this.form.controls.dataAgendamento.value ?? '').slice(0, 10)}T${slot.horaInicio}`
    );
    if (!dataAgendamento) {
      this.toast.error('Data/hora inválida.');
      return;
    }

    const modalidadeAgendamento = this.modalidadeJanela();
    const observacao = (this.form.controls.observacao.value ?? '').trim() || null;
    const isTransportadora = this.auth.isTransportadoraRole();
    const isAdmin = this.auth.isAdmin();
    const holdId = hold.id;

    this.salvando.set(true);
    from(selecionados)
      .pipe(
        concatMap((veiculo) =>
          this.resolverPayloadPlaca(
            veiculo,
            tid,
            dataAgendamento,
            observacao,
            isTransportadora,
            isAdmin,
            holdId
          ).pipe(
            switchMap((resolved) => {
              if (!resolved.ok) {
                return of({
                  success: false as const,
                  placa: veiculo.placa,
                  message: resolved.message,
                });
              }
              return this.api.gravar({ ...resolved.payload, modalidadeAgendamento }).pipe(
                map((res) => ({
                  success: res.success,
                  placa: veiculo.placa,
                  message: res.message,
                }))
              );
            }),
            catchError(() =>
              of({
                success: false as const,
                placa: veiculo.placa,
                message: 'Falha ao criar agendamento.',
              })
            )
          )
        ),
        toArray(),
        finalize(() => this.salvando.set(false))
      )
      .subscribe({
        next: (results) => {
          const ok = results.filter((r) => r.success);
          const falhas = results.filter((r) => !r.success);

          if (ok.length) {
            const transportadoraLabel = this.transportadoraFormNome().trim() || '—';
            for (const item of ok) {
              const placaFmt = formatPlacaDisplay(item.placa) || item.placa;
              this.portariaAlertas.push({
                id: `agendamento-${item.placa}-${Date.now()}-${Math.random()}`,
                titulo: 'Agendamento registrado',
                descricao: `Placa ${placaFmt} - ${transportadoraLabel}`,
              });
            }
          }

          if (ok.length && !falhas.length) {
            this.toast.success(
              ok.length === 1 ? 'Agendamento criado.' : `${ok.length} agendamentos criados.`
            );
            this.hold.set(null);
            this.pararTimer();
            this.fechar();
            this.salvo.emit();
            return;
          }

          if (ok.length && falhas.length) {
            this.toast.warning(
              `${ok.length} criado(s); ${falhas.length} falha(s): ${falhas
                .map((f) => formatPlacaDisplay(f.placa) || f.placa)
                .join(', ')}`
            );
            this.salvo.emit();
            return;
          }

          this.toast.error(falhas[0]?.message || 'Não foi possível criar o agendamento.');
        },
      });
  }

  private resolverTransportadoraId(): number | null {
    if (!this.podeEscolherTransportadora() && this.auth.isTransportadoraRole() && !this.auth.isAdmin()) {
      return this.auth.resolveTransportadoraId();
    }
    return Number(this.form.controls.transportadoraId.value) || this.transportadoraFormId() || null;
  }

  private carregarCobranca(transportadoraId: number): void {
    this.cancelarCobranca$.next();
    const geracao = ++this.geracaoCobranca;
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
        takeUntil(this.cancelarCobranca$),
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
        if (geracao !== this.geracaoCobranca) return;
        const liberado = cfg?.tipoPagadorCobranca === TipoPagadorCobranca.Terceiro;
        this.fobLiberado.set(!!liberado);
        if (liberado) {
          const id = cfg?.responsavelFaturamentoId ?? null;
          this.pagadorFobId.set(id && id > 0 ? id : null);
          this.pagadorFobNome.set((cfg?.responsavelFaturamentoNome || '').trim());
        } else {
          this.pagadorFobId.set(null);
          this.pagadorFobNome.set('');
          this.placasSelecionadas.update((lista) =>
            lista.map((p) => ({ ...p, destinoFrete: 'cif' as const }))
          );
        }
      });
  }

  private iniciarTimer(expiraEm: string): void {
    this.pararTimer();
    const tick = () => {
      const fim = Date.parse(expiraEm);
      if (!Number.isFinite(fim)) {
        this.segundosRestantes.set(0);
        return;
      }
      const restante = Math.max(0, Math.floor((fim - Date.now()) / 1000));
      this.segundosRestantes.set(restante);
      if (restante <= 0) {
        this.pararTimer();
        this.toast.warning('Tempo da reserva esgotado (20 min). Selecione o horário novamente.');
        this.limparHoldLocal(false);
        this.etapa.set(1);
        this.placasSelecionadas.set([]);
      }
    };
    tick();
    this.timerId = setInterval(tick, 1000);
  }

  private pararTimer(): void {
    if (this.timerId != null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private limparHoldLocal(cancelarNoServidor: boolean): void {
    const h = this.hold();
    this.pararTimer();
    this.hold.set(null);
    this.segundosRestantes.set(0);
    if (cancelarNoServidor && h?.id && h.status === 1) {
      this.api.cancelarHold(h.id, h.token).subscribe({ error: () => undefined });
    }
  }

  private resolverPayloadPlaca(
    veiculo: AgendamentoPlacaSelecionada,
    transportadoraId: number,
    dataAgendamento: string,
    observacao: string | null,
    isTransportadora: boolean,
    isAdmin: boolean,
    holdId: number
  ): Observable<ResolvePlacaResult> {
    const placa = normalizePlaca(veiculo.placa);
    if (!placaCompleta(placa)) {
      return of({
        ok: false,
        message: `Placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa} inválida.`,
      });
    }

    const motoristaId = veiculo.motoristaId && veiculo.motoristaId > 0 ? veiculo.motoristaId : null;
    if (!motoristaId) {
      return of({
        ok: false,
        message: `A placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa} está sem motorista.`,
      });
    }

    const payload: AgendamentoPostInput = {
      dataAgendamento,
      observacao,
      transportadoraId,
      holdId,
      motorista: {
        id: motoristaId,
        cpf: veiculo.motoristaCpf || null,
        nome: veiculo.motoristaNome || null,
      },
      veiculo: {
        id: veiculo.id,
        placa,
      },
    };

    if (!(isTransportadora && !isAdmin)) {
      return of({ ok: true, payload });
    }

    return this.api.obterPorPlaca(placa).pipe(
      map((agg) => {
        if (!agg) {
          return {
            ok: false as const,
            message: `Não foi possível validar a placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa}.`,
          };
        }
        if (agg.transportadoraId && agg.transportadoraId !== transportadoraId) {
          return {
            ok: false as const,
            message: `A placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa} não pertence à transportadora da sessão.`,
          };
        }
        return { ok: true as const, payload };
      }),
      catchError(() =>
        of({
          ok: false as const,
          message: `Não foi possível validar a placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa}.`,
        })
      )
    );
  }
}
