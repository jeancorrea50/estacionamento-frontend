import { Component, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ApiError } from '../../../../core/api/models';
import { reservaCobreDia } from '../../pages/agendamentos-page/agendamento-dashboard.util';
import {
  JanelaSlotDisponivel,
  MODALIDADE_AGENDAMENTO_OPCOES,
  ModalidadeAgendamento,
  parseModalidadeAgendamento,
} from '../../models/janela-agendamento.models';
import type { VagaReservaTransportadoraItem } from '../../models/vaga-disponibilidade.models';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import { JanelaDisponibilidadeRealtimeService } from '../../services/janela-disponibilidade-realtime.service';
import { VagaDisponibilidadeService } from '../../services/vaga-disponibilidade.service';

/** Chave estável do slot (mesmo horário pode existir em janelas diferentes). */
function slotKey(s: JanelaSlotDisponivel): string {
  return `${s.janelaAgendamentoId}|${s.horaInicio}|${s.horaFim}`;
}

function normHora(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
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
  const inicioMin = Math.floor(inicio.getTime() / 60_000);
  const agoraMin = Math.floor(agora.getTime() / 60_000);
  return inicioMin >= agoraMin;
}

export interface DestinacaoSlotPrefill {
  ativa: boolean;
  modalidades: ModalidadeAgendamento[];
  quantidadeTotal: number;
  temCif: boolean;
  temFob: boolean;
}

/**
 * Modalidade + horário (slot) do agendamento.
 * Com destinação para a transportadora no dia: restringe e pré-preenche modalidade/horário.
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
        [disabled]="modalidadeTravada()"
        (change)="modalidade.set(parseModalidade($any($event.target).value))"
      >
        @for (m of modalidadesOpcoes(); track m.value) {
          <option [value]="m.value" [selected]="m.value === modalidade()">{{ m.label }}</option>
        }
      </select>
      @if (destinacaoAtiva()) {
        <p class="jsl__msg">Opções conforme destinação da transportadora neste dia.</p>
      }
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
                : destinacaoAtiva()
                  ? 'Nenhum horário disponível na destinação desta transportadora para a data/modalidade.'
                  : 'Nenhum horário disponível para esta data e modalidade. Escolha outra data ou verifique as Janelas configuradas.'
            }}
          </p>
        } @else if (slot(); as s) {
          <p class="jsl__msg">
            {{ s.disponiveis }} vaga(s) disponível(is) neste horário
            @if (s.viaDestinacao) {
              (destinadas)
            }
            .
          </p>
        }
      </div>
    </div>
  `,
})
export class JanelaSlotSelectComponent {
  private readonly api = inject(JanelaAgendamentoService);
  private readonly vagasApi = inject(VagaDisponibilidadeService);
  private readonly realtime = inject(JanelaDisponibilidadeRealtimeService);

  readonly ativo = input(false);
  readonly data = input('');
  readonly transportadoraId = input<number | null>(null);

  readonly modalidade = model<ModalidadeAgendamento>(1);
  readonly slot = model<JanelaSlotDisponivel | null>(null);

  /** Resumo da destinação aplicada (pai usa para qty/CIF/FOB). */
  readonly destinacaoChange = output<DestinacaoSlotPrefill>();

  readonly chave = slotKey;
  readonly parseModalidade = parseModalidadeAgendamento;

  readonly modalidadesOpcoes = signal([...MODALIDADE_AGENDAMENTO_OPCOES]);
  readonly modalidadeTravada = signal(false);
  readonly destinacaoAtiva = signal(false);
  readonly slots = signal<JanelaSlotDisponivel[]>([]);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly soHorariosPassados = signal(false);

  private sub?: Subscription;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private ultimoBruto: JanelaSlotDisponivel[] = [];
  private ultimaData = '';
  private reservasDia: VagaReservaTransportadoraItem[] = [];

  constructor() {
    effect((onCleanup) => {
      const ativo = this.ativo();
      const data = this.data();
      const modalidade = this.modalidade();
      const transportadoraId = this.transportadoraId();
      this.realtime.versao();
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
    this.reservasDia = [];
    this.destinacaoAtiva.set(false);
    this.modalidadeTravada.set(false);
    this.modalidadesOpcoes.set([...MODALIDADE_AGENDAMENTO_OPCOES]);
    this.emitDestinacao(false, [], 0, false, false);
    this.pararTick();
  }

  private iniciarTickSeHoje(data: string): void {
    this.pararTick();
    if (data !== this.hojeIsoLocal()) return;
    this.tickTimer = setInterval(
      () => this.aplicarFiltroFuturo(this.ultimaData, this.ultimoBruto),
      60_000
    );
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
    let futuros = bruto.filter((s) => slotAindaNoFuturo(data, s.horaInicio, agora));
    futuros = this.filtrarSlotsPorDestinacao(futuros);
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

    const tid = transportadoraId != null && transportadoraId > 0 ? transportadoraId : null;
    const reservas$ = tid
      ? this.vagasApi.listarReservas().pipe(catchError(() => of([] as VagaReservaTransportadoraItem[])))
      : of([] as VagaReservaTransportadoraItem[]);

    this.sub = forkJoin({
      reservas: reservas$,
      disp: this.api.disponibilidade(data, modalidade, transportadoraId),
    })
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: ({ reservas, disp }) => {
          this.aplicarDestinacao(data, tid, reservas);
          // Se a destinação mudou a modalidade, o effect refaz o GET — evita slot stale.
          if (this.modalidade() !== modalidade) {
            return;
          }
          this.ultimoBruto = disp.slots ?? [];
          this.ultimaData = data;
          this.aplicarFiltroFuturo(data, this.ultimoBruto);
          this.preencherSlot(anterior);
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

  private aplicarDestinacao(
    data: string,
    transportadoraId: number | null,
    reservas: VagaReservaTransportadoraItem[]
  ): void {
    const cobrindo = (reservas ?? []).filter(
      (r) =>
        r.ativo &&
        (!transportadoraId || Number(r.transportadoraId) === transportadoraId) &&
        reservaCobreDia(r, data)
    );
    this.reservasDia = cobrindo;

    if (!transportadoraId || cobrindo.length === 0) {
      this.destinacaoAtiva.set(false);
      this.modalidadeTravada.set(false);
      this.modalidadesOpcoes.set([...MODALIDADE_AGENDAMENTO_OPCOES]);
      this.emitDestinacao(false, [], 0, false, false);
      return;
    }

    const mods = new Set<ModalidadeAgendamento>();
    let qtd = 0;
    let temCif = false;
    let temFob = false;
    for (const r of cobrindo) {
      const m = parseModalidadeAgendamento(r.modalidade);
      mods.add(m);
      qtd += Math.max(0, Math.trunc(Number(r.quantidade) || 0));
      const pagador = Number(r.responsavelFaturamentoId ?? 0);
      if (pagador > 0) temFob = true;
      else temCif = true;
    }

    // Ambos (3) na destinação cobre Estacionamento e Limpeza no cálculo do BE.
    if (mods.has(3)) {
      mods.add(1);
      mods.add(2);
    }

    const lista = MODALIDADE_AGENDAMENTO_OPCOES.filter((o) => mods.has(o.value));
    const opcoes = lista.length ? lista : [...MODALIDADE_AGENDAMENTO_OPCOES];
    this.modalidadesOpcoes.set(opcoes);
    this.destinacaoAtiva.set(true);
    this.modalidadeTravada.set(opcoes.length === 1);

    const atual = this.modalidade();
    if (!opcoes.some((o) => o.value === atual)) {
      const preferida = this.preferirModalidade([...mods]);
      this.modalidade.set(preferida);
    } else if (opcoes.length === 1) {
      this.modalidade.set(opcoes[0].value);
    }

    this.emitDestinacao(true, opcoes.map((o) => o.value), qtd, temCif, temFob);
  }

  private preferirModalidade(mods: ModalidadeAgendamento[]): ModalidadeAgendamento {
    if (mods.includes(3) && mods.length === 1) return 3;
    if (mods.includes(1)) return 1;
    if (mods.includes(2)) return 2;
    if (mods.includes(3)) return 3;
    return 1;
  }

  private filtrarSlotsPorDestinacao(slots: JanelaSlotDisponivel[]): JanelaSlotDisponivel[] {
    if (!this.destinacaoAtiva() || !this.reservasDia.length) return slots;
    const modalidade = this.modalidade();
    const faixas = this.reservasDia
      .filter((r) => {
        const m = parseModalidadeAgendamento(r.modalidade);
        return m === modalidade || m === 3 || modalidade === 3;
      })
      .map((r) => ({
        ini: normHora(r.horaInicio),
        fim: normHora(r.horaFim),
      }))
      .filter((f) => !!f.ini);

    // Destinação sem horário específico → todos os slots da modalidade (já limitados por quota).
    if (!faixas.length) return slots;

    return slots.filter((s) => {
      const ini = normHora(s.horaInicio);
      return faixas.some((f) => {
        if (f.ini && f.fim) return ini >= f.ini && ini < f.fim;
        return ini === f.ini;
      });
    });
  }

  private preencherSlot(anterior: JanelaSlotDisponivel | null): void {
    const disponiveis = this.slots();
    if (!disponiveis.length) {
      this.slot.set(null);
      return;
    }

    const mantido = anterior
      ? disponiveis.find((s) => slotKey(s) === slotKey(anterior))
      : undefined;
    if (mantido) {
      this.slot.set(mantido);
      return;
    }

    // Prefere horário da destinação; se só houver um slot, seleciona automaticamente.
    const preferido = this.slotPreferidoPorDestinacao(disponiveis);
    this.slot.set(preferido ?? (disponiveis.length === 1 ? disponiveis[0] : null));
  }

  private slotPreferidoPorDestinacao(
    slots: JanelaSlotDisponivel[]
  ): JanelaSlotDisponivel | undefined {
    if (!this.destinacaoAtiva()) return undefined;
    const modalidade = this.modalidade();
    const inis = new Set(
      this.reservasDia
        .filter((r) => {
          const m = parseModalidadeAgendamento(r.modalidade);
          return m === modalidade || m === 3 || modalidade === 3;
        })
        .map((r) => normHora(r.horaInicio))
        .filter(Boolean)
    );
    if (!inis.size) return undefined;
    return slots.find((s) => inis.has(normHora(s.horaInicio)));
  }

  private emitDestinacao(
    ativa: boolean,
    modalidades: ModalidadeAgendamento[],
    quantidadeTotal: number,
    temCif: boolean,
    temFob: boolean
  ): void {
    this.destinacaoChange.emit({
      ativa,
      modalidades,
      quantidadeTotal,
      temCif,
      temFob,
    });
  }
}
