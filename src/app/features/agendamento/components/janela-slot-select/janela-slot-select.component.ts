import { Component, effect, inject, input, model, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ApiError } from '../../../../core/api/models';
import {
  JanelaSlotDisponivel,
  MODALIDADE_AGENDAMENTO_OPCOES,
  ModalidadeAgendamento,
  parseModalidadeAgendamento,
} from '../../models/janela-agendamento.models';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import { JanelaDisponibilidadeRealtimeService } from '../../services/janela-disponibilidade-realtime.service';

/** Chave estável do slot (mesmo horário pode existir em janelas diferentes). */
function slotKey(s: JanelaSlotDisponivel): string {
  return `${s.janelaAgendamentoId}|${s.horaInicio}|${s.horaFim}`;
}

/**
 * Modalidade + horário (slot) do agendamento.
 * Carrega `GET JanelaAgendamento/disponibilidade` ao mudar data/modalidade/transportadora e
 * sempre que `JanelaDisponibilidadeRealtimeService.versao` mudar (hub ou CRUD local).
 * O backend já omite slots com `disponiveis = 0`.
 * Modalidade Ambos (3) exige vaga no mesmo intervalo em Estacionamento e Limpeza.
 */
@Component({
  selector: 'app-janela-slot-select',
  standalone: true,
  host: { class: 'jsl' },
  styleUrl: './janela-slot-select.component.scss',
  template: `
    <div class="jsl__field">
      <label for="jsl-modalidade">Modalidade <span class="required">*</span></label>
      <select
        id="jsl-modalidade"
        class="input-control"
        (change)="modalidade.set(parseModalidade($any($event.target).value))"
      >
        @for (m of modalidades; track m.value) {
          <option [value]="m.value" [selected]="m.value === modalidade()">{{ m.label }}</option>
        }
      </select>
    </div>

    <div class="jsl__field">
      <label for="jsl-slot">Horário <span class="required">*</span></label>
      <div class="jsl__control">
        <select
          id="jsl-slot"
          class="input-control"
          [disabled]="carregando() || slots().length === 0"
          (change)="escolher($any($event.target).value)"
        >
          <option value="" [selected]="!slot()">
            {{ placeholder() }}
          </option>
          @for (s of slots(); track chave(s)) {
            <option [value]="chave(s)" [selected]="slot() && chave(s) === chave(slot()!)">
              {{ s.label }}
            </option>
          }
        </select>
        @if (erro(); as msg) {
          <p class="jsl__msg jsl__msg--erro" role="alert">{{ msg }}</p>
        } @else if (!carregando() && ativo() && data() && slots().length === 0) {
          <p class="jsl__msg">
            Nenhum horário disponível para esta data e modalidade. Escolha outra data ou verifique as
            Janelas configuradas.
          </p>
        } @else if (slot(); as s) {
          <p class="jsl__msg">{{ s.disponiveis }} vaga(s) disponível(is) neste horário.</p>
        }
      </div>
    </div>
  `,
})
export class JanelaSlotSelectComponent {
  private readonly api = inject(JanelaAgendamentoService);
  private readonly realtime = inject(JanelaDisponibilidadeRealtimeService);

  /** Só consulta enquanto o modal está aberto. */
  readonly ativo = input(false);
  /** `yyyy-MM-dd` */
  readonly data = input('');
  /** Destinação por transportadora (operador de pátio); transportadora logada é resolvida no backend. */
  readonly transportadoraId = input<number | null>(null);

  readonly modalidade = model<ModalidadeAgendamento>(1);
  /** Slot escolhido (`null` = nenhum). */
  readonly slot = model<JanelaSlotDisponivel | null>(null);

  readonly modalidades = MODALIDADE_AGENDAMENTO_OPCOES;
  readonly chave = slotKey;
  readonly parseModalidade = parseModalidadeAgendamento;

  readonly slots = signal<JanelaSlotDisponivel[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  private sub?: Subscription;

  constructor() {
    effect((onCleanup) => {
      const ativo = this.ativo();
      const data = this.data();
      const modalidade = this.modalidade();
      const transportadoraId = this.transportadoraId();
      this.realtime.versao(); // dependência: refaz o GET quando alguma janela mudar
      onCleanup(() => this.sub?.unsubscribe());
      untracked(() => {
        if (!ativo || !data) {
          this.limpar();
          return;
        }
        this.carregar(data, modalidade, transportadoraId);
      });
    });
  }

  placeholder(): string {
    if (this.carregando()) return 'Carregando horários…';
    if (!this.data()) return 'Selecione a data';
    return this.slots().length ? 'Selecione o horário' : 'Sem horários disponíveis';
  }

  escolher(key: string): void {
    this.slot.set(this.slots().find((s) => slotKey(s) === key) ?? null);
  }

  private limpar(): void {
    this.slots.set([]);
    this.slot.set(null);
    this.erro.set(null);
    this.carregando.set(false);
  }

  private carregar(
    data: string,
    modalidade: ModalidadeAgendamento,
    transportadoraId: number | null
  ): void {
    const anterior = this.slot();
    this.carregando.set(true);
    this.erro.set(null);
    this.sub = this.api
      .disponibilidade(data, modalidade, transportadoraId)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: (res) => {
          this.slots.set(res.slots);
          // Mantém a escolha só se o slot continua disponível (ex.: após evento do hub).
          const mantido = anterior ? res.slots.find((s) => slotKey(s) === slotKey(anterior)) : undefined;
          this.slot.set(mantido ?? null);
        },
        error: (err: ApiError) => {
          this.slots.set([]);
          this.slot.set(null);
          this.erro.set(err?.message || 'Não foi possível consultar os horários disponíveis.');
        },
      });
  }
}
