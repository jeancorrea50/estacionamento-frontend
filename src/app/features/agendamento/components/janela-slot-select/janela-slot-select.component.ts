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
 * Só permite slots cujo início ainda não passou (hora local do navegador).
 * Datas futuras: todos; data de hoje: a partir de agora; datas passadas: nenhum.
 */
function slotAindaNoFuturo(dataIso: string, horaInicio: string, agora = new Date()): boolean {
  const dia = String(dataIso ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const [yy, mm, dd] = dia.split('-').map((n) => Number(n));
  const partes = String(horaInicio ?? '')
    .trim()
    .split(':')
    .map((n) => Number(n));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  const h = Number.isFinite(partes[0]) ? partes[0] : NaN;
  const min = Number.isFinite(partes[1]) ? partes[1] : 0;
  const sec = Number.isFinite(partes[2]) ? partes[2] : 0;
  if (!Number.isFinite(h)) return false;
  const inicio = new Date(yy, mm - 1, dd, h, min, sec, 0);
  // Compara em minutos para evitar flutuação de segundos no meio do segundo atual.
  const inicioMin = Math.floor(inicio.getTime() / 60_000);
  const agoraMin = Math.floor(agora.getTime() / 60_000);
  return inicioMin >= agoraMin;
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
            {{
              soHorariosPassados()
                ? 'Todos os horários desta data já passaram. Escolha outra data.'
                : 'Nenhum horário disponível para esta data e modalidade. Escolha outra data ou verifique as Janelas configuradas.'
            }}
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
  /** API trouxe slots, mas todos já passaram (hoje). */
  readonly soHorariosPassados = signal(false);

  private sub?: Subscription;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  /** Snapshot bruto da última resposta (para refiltrar sem novo GET a cada minuto). */
  private ultimoBruto: JanelaSlotDisponivel[] = [];
  private ultimaData = '';

  constructor() {
    effect((onCleanup) => {
      const ativo = this.ativo();
      const data = this.data();
      const modalidade = this.modalidade();
      const transportadoraId = this.transportadoraId();
      this.realtime.versao(); // dependência: refaz o GET quando alguma janela mudar
      onCleanup(() => {
        this.sub?.unsubscribe();
        this.pararTick();
      });
      untracked(() => {
        if (!ativo || !data) {
          this.limpar();
          return;
        }
        this.carregar(data, modalidade, transportadoraId);
        this.iniciarTickSeHoje(data);
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
    this.soHorariosPassados.set(false);
    this.ultimoBruto = [];
    this.ultimaData = '';
    this.pararTick();
  }

  private iniciarTickSeHoje(data: string): void {
    this.pararTick();
    const hoje = this.hojeIsoLocal();
    if (data !== hoje) return;
    // A cada minuto remove slots que acabaram de passar sem novo round-trip.
    this.tickTimer = setInterval(() => this.aplicarFiltroFuturo(this.ultimaData, this.ultimoBruto), 60_000);
  }

  private pararTick(): void {
    if (this.tickTimer != null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private hojeIsoLocal(): string {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, '0');
    const d = String(n.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private aplicarFiltroFuturo(data: string, bruto: JanelaSlotDisponivel[]): void {
    if (!data) {
      this.slots.set([]);
      this.soHorariosPassados.set(false);
      return;
    }
    const agora = new Date();
    const futuros = bruto.filter((s) => slotAindaNoFuturo(data, s.horaInicio, agora));
    this.soHorariosPassados.set(bruto.length > 0 && futuros.length === 0);
    this.slots.set(futuros);
    const atual = this.slot();
    if (atual && !futuros.some((s) => slotKey(s) === slotKey(atual))) {
      this.slot.set(null);
    }
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
          this.ultimoBruto = res.slots ?? [];
          this.ultimaData = data;
          this.aplicarFiltroFuturo(data, this.ultimoBruto);
          // Mantém a escolha só se o slot continua disponível e ainda não passou.
          const mantido = anterior
            ? this.slots().find((s) => slotKey(s) === slotKey(anterior))
            : undefined;
          this.slot.set(mantido ?? null);
        },
        error: (err: ApiError) => {
          this.ultimoBruto = [];
          this.ultimaData = '';
          this.slots.set([]);
          this.slot.set(null);
          this.soHorariosPassados.set(false);
          this.erro.set(err?.message || 'Não foi possível consultar os horários disponíveis.');
        },
      });
  }
}
