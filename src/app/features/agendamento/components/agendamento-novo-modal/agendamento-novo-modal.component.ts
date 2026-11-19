import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, from, of } from 'rxjs';
import { catchError, concatMap, finalize, map, switchMap, toArray } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { formatPlacaDisplay, normalizePlaca, placaCompleta } from '../../../cadastro/utils/placa-br';
import { TransportadoraLookupFieldComponent } from '../../../movimentos/entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
import { PortariaAlertasStore } from '../../../movimentos/services/portaria-alertas.store';
import { datetimeLocalInputToApiIso } from '../../../../shared/utils/local-iso-datetime';
import { AgendamentoDataHoraPickerComponent } from '../../pages/agendamentos-page/agendamento-data-hora-picker/agendamento-data-hora-picker.component';
import { toIsoDateLocal } from '../../pages/agendamentos-page/agendamento-dashboard.util';
import { AgendamentoPostInput } from '../../models/agendamento.models';
import { JanelaSlotDisponivel, ModalidadeAgendamento } from '../../models/janela-agendamento.models';
import { AgendamentoService } from '../../services/agendamento.service';
import { JanelaDisponibilidadeRealtimeService } from '../../services/janela-disponibilidade-realtime.service';
import { JanelaSlotSelectComponent } from '../janela-slot-select/janela-slot-select.component';
import { AgendamentoVeiculosMotoristasModalComponent } from '../agendamento-veiculos-motoristas-modal/agendamento-veiculos-motoristas-modal.component';
import type { AgendamentoPlacaSelecionada } from './agendamento-placa.model';

type ResolvePlacaResult =
  | { ok: true; payload: AgendamentoPostInput }
  | { ok: false; message: string };

/**
 * Modal compartilhado de criação de agendamento (Pátio e Agendar/transportadora).
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
export class AgendamentoNovoModalComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AgendamentoService);
  private readonly toast = inject(ToastService);
  private readonly portariaAlertas = inject(PortariaAlertasStore);
  private readonly realtime = inject(JanelaDisponibilidadeRealtimeService);
  private readonly fb = inject(FormBuilder);

  /** Quando true, exibe o modal e reinicia o formulário. */
  readonly aberto = input(false);
  /** Operador de pátio escolhe transportadora; transportadora usa a da sessão. */
  readonly podeEscolherTransportadora = input(false);

  readonly fechado = output<void>();
  readonly salvo = output<void>();

  readonly salvando = signal(false);
  readonly transportadoraFormId = signal<number | null>(null);
  readonly transportadoraFormNome = signal('');
  readonly placasSelecionadas = signal<AgendamentoPlacaSelecionada[]>([]);
  readonly frotaModalAberto = signal(false);

  /** Dia escolhido (`yyyy-MM-dd`) — espelha o form para o `app-janela-slot-select`. */
  readonly dataSelecionada = signal('');
  readonly modalidadeJanela = signal<ModalidadeAgendamento>(1);
  /** Slot escolhido na janela; define a hora do agendamento. */
  readonly slotSelecionado = signal<JanelaSlotDisponivel | null>(null);

  readonly form = this.fb.group({
    dataAgendamento: ['', Validators.required],
    transportadoraId: [null as number | null],
    observacao: [''],
  });

  constructor() {
    effect(() => {
      if (!this.aberto()) {
        untracked(() => void this.realtime.disconnect());
        return;
      }
      untracked(() => {
        this.resetForm();
        void this.realtime.connect();
      });
    });
  }

  /** Host cobre a viewport só enquanto algum overlay deste modal está ativo. */
  overlayAtivo(): boolean {
    return this.aberto() || this.frotaModalAberto();
  }

  private resetForm(): void {
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
  }

  fechar(): void {
    this.frotaModalAberto.set(false);
    this.fechado.emit();
  }

  todasPlacasComMotorista(): boolean {
    const lista = this.placasSelecionadas();
    return lista.length > 0 && lista.every((p) => !!p.motoristaId && p.motoristaId > 0);
  }

  /** Excede a capacidade do horário selecionado (aviso UI; bloqueia no salvar). */
  placasExcedemVagas(): boolean {
    const slot = this.slotSelecionado();
    if (!slot) return false;
    return this.placasSelecionadas().length > slot.disponiveis;
  }

  labelMotorista(p: AgendamentoPlacaSelecionada): string {
    const nome = (p.motoristaNome || '').trim();
    if (nome) return nome;
    if (p.motoristaId && p.motoristaId > 0) return `Motorista #${p.motoristaId}`;
    return '';
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
  }

  onTransportadoraNomeChange(nome: string): void {
    if (!this.podeEscolherTransportadora()) return;
    this.transportadoraFormNome.set(nome || '');
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
    this.placasSelecionadas.set(lista.map((p) => ({ ...p })));
    this.frotaModalAberto.set(false);
  }

  removerPlacaSelecionada(veiculoId: number): void {
    this.placasSelecionadas.update((lista) => lista.filter((p) => p.id !== veiculoId));
  }

  formatPlaca(placa: string | null | undefined): string {
    return formatPlacaDisplay(placa) || placa || '—';
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Informe a data do agendamento.');
      return;
    }

    const tid =
      !this.podeEscolherTransportadora() && this.auth.isTransportadoraRole() && !this.auth.isAdmin()
        ? this.auth.resolveTransportadoraId()
        : Number(this.form.controls.transportadoraId.value) || null;

    if (!tid) {
      this.toast.error('Selecione a transportadora.');
      return;
    }

    const selecionados = this.placasSelecionadas();
    if (!selecionados.length) {
      this.toast.error('Selecione ao menos uma placa cadastrada.');
      return;
    }

    if (!this.todasPlacasComMotorista()) {
      this.toast.error('Defina o motorista de cada placa em Veículos e motoristas.');
      this.abrirFrotaModal();
      return;
    }

    const slot = this.slotSelecionado();
    if (!slot) {
      this.toast.error('Selecione o horário do agendamento.');
      return;
    }
    if (selecionados.length > slot.disponiveis) {
      this.toast.error(
        `O horário ${slot.label} tem ${slot.disponiveis} vaga(s) disponível(is); remova placas para continuar.`
      );
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

    this.salvando.set(true);
    // Sequencial: evita corrida de vagas ao gravar N placas no mesmo horário.
    from(selecionados)
      .pipe(
        concatMap((veiculo) =>
          this.resolverPayloadPlaca(
            veiculo,
            tid,
            dataAgendamento,
            observacao,
            isTransportadora,
            isAdmin
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

  private resolverPayloadPlaca(
    veiculo: AgendamentoPlacaSelecionada,
    transportadoraId: number,
    dataAgendamento: string,
    observacao: string | null,
    isTransportadora: boolean,
    isAdmin: boolean
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
