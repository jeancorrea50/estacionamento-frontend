import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, from, of } from 'rxjs';
import { catchError, finalize, map, mergeMap, takeUntil, toArray } from 'rxjs/operators';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { TransportadoraLookupFieldComponent } from '../../../movimentos/entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
import { DESTINACAO_ROUTE } from '../../agendamento-rotas';
import type { AgendamentoSearchItem } from '../../models/agendamento.models';
import type { JanelaSlotDisponivel } from '../../models/janela-agendamento.models';
import type {
  ModalidadeVagaAgendamento,
  VagaReservaTransportadoraItem,
} from '../../models/vaga-disponibilidade.models';
import { AgendamentoService } from '../../services/agendamento.service';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import { VagaDisponibilidadeService } from '../../services/vaga-disponibilidade.service';
import {
  type CalendarioVisao,
  type DiaCalendarioVm,
  addMonths,
  buildMonthGrid,
  daysInMonthIso,
  extrairHoraDeDataHora,
  formatDiaBr,
  horaNoIntervalo,
  labelMesAno,
  livreTom,
  modalidadeBate,
  normHora,
  parseIsoDateLocal,
  reservaCobreDiaCalendario,
  toIsoDateLocal,
  weekDaysIso,
} from './destinacao-calendario.util';

interface TransportadoraSlotVm {
  id: number;
  nome: string;
  destinadas: number;
  utilizadas: number;
  restantes: number;
}

interface SlotDiaVm {
  key: string;
  horaInicio: string;
  horaFim: string;
  label: string;
  capacidade: number;
  ocupadas: number;
  disponiveis: number;
  destinadas: number;
  expandido: boolean;
  transportadoras: TransportadoraSlotVm[];
}

/**
 * Calendário expansivo de destinação — composição dos endpoints existentes
 * (resumo/dia, disponibilidade de janelas, reservas, agendamentos).
 */
@Component({
  selector: 'app-destinacao-calendario-panel',
  standalone: true,
  imports: [CommonModule, DatePipe, TransportadoraLookupFieldComponent],
  templateUrl: './destinacao-calendario-panel.component.html',
  styleUrls: ['./destinacao-calendario-panel.component.scss'],
})
export class DestinacaoCalendarioPanelComponent implements OnInit, OnDestroy {
  private readonly vagasApi = inject(VagaDisponibilidadeService);
  private readonly janelasApi = inject(JanelaAgendamentoService);
  private readonly agendamentosApi = inject(AgendamentoService);
  private readonly permissions = inject(PermissionCacheService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private geracaoMes = 0;
  private geracaoDia = 0;

  readonly visao = signal<CalendarioVisao>('mes');
  readonly modalidade = signal<1 | 2>(1);
  readonly ano = signal(new Date().getFullYear());
  readonly mes0 = signal(new Date().getMonth());
  readonly diaSelecionado = signal(toIsoDateLocal());
  readonly dias = signal<DiaCalendarioVm[]>([]);
  readonly loadingMes = signal(false);
  readonly loadingDia = signal(false);
  readonly slots = signal<SlotDiaVm[]>([]);
  readonly slotAtivoKey = signal<string | null>(null);
  readonly transportadoraFiltroId = signal<number | null>(null);
  readonly transportadoraFiltroNome = signal('');
  readonly transportadoraDetalheId = signal<number | null>(null);
  readonly agendamentosDetalhe = signal<AgendamentoSearchItem[]>([]);
  readonly loadingAgendamentos = signal(false);
  readonly reservas = signal<VagaReservaTransportadoraItem[]>([]);
  readonly capacidadeRef = signal<number | null>(null);

  readonly mesLabel = computed(() => labelMesAno(this.ano(), this.mes0()));
  readonly diaSelecionadoLabel = computed(() => formatDiaBr(this.diaSelecionado()));
  readonly podeVerAgendamentos = computed(
    () =>
      this.permissions.allows('agendamentos', 'visualizar') ||
      this.permissions.allows('agendar', 'visualizar')
  );

  readonly diasVisiveis = computed(() => {
    const v = this.visao();
    const all = this.dias();
    if (v === 'mes') return all;
    if (v === 'semana') {
      const week = new Set(weekDaysIso(this.diaSelecionado()));
      return all.filter((d) => week.has(d.iso));
    }
    return all.filter((d) => d.iso === this.diaSelecionado());
  });

  ngOnInit(): void {
    this.recarregarMes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  livreTom = livreTom;

  setVisao(v: CalendarioVisao): void {
    this.visao.set(v);
    if (v === 'semana' || v === 'dia') this.garantirDiaNoContexto();
  }

  setModalidade(m: 1 | 2): void {
    if (this.modalidade() === m) return;
    this.modalidade.set(m);
    this.recarregarMes();
  }

  mesAnterior(): void {
    const n = addMonths(this.ano(), this.mes0(), -1);
    this.ano.set(n.ano);
    this.mes0.set(n.mes0);
    this.recarregarMes();
  }

  mesProximo(): void {
    const n = addMonths(this.ano(), this.mes0(), 1);
    this.ano.set(n.ano);
    this.mes0.set(n.mes0);
    this.recarregarMes();
  }

  onFiltroTransportadoraId(id: number | null): void {
    this.transportadoraFiltroId.set(id);
    this.carregarDia(this.diaSelecionado());
  }

  onFiltroTransportadoraNome(nome: string): void {
    this.transportadoraFiltroNome.set(nome || '');
  }

  selecionarDia(iso: string): void {
    if (!iso) return;
    this.diaSelecionado.set(iso);
    this.slotAtivoKey.set(null);
    this.transportadoraDetalheId.set(null);
    this.agendamentosDetalhe.set([]);
    const d = parseIsoDateLocal(iso);
    if (d && (d.getFullYear() !== this.ano() || d.getMonth() !== this.mes0())) {
      this.ano.set(d.getFullYear());
      this.mes0.set(d.getMonth());
      this.recarregarMes(false);
    }
    this.carregarDia(iso);
  }

  toggleSlot(key: string): void {
    const atual = this.slotAtivoKey();
    if (atual === key) {
      this.slotAtivoKey.set(null);
      this.slots.update((list) => list.map((s) => ({ ...s, expandido: false })));
      this.transportadoraDetalheId.set(null);
      this.agendamentosDetalhe.set([]);
      return;
    }
    this.slotAtivoKey.set(key);
    this.slots.update((list) =>
      list.map((s) => ({
        ...s,
        expandido: s.key === key,
        transportadoras:
          s.key === key ? this.montarTransportadorasDoSlot(s.horaInicio, s.horaFim) : s.transportadoras,
      }))
    );
    this.transportadoraDetalheId.set(null);
    this.agendamentosDetalhe.set([]);
    queueMicrotask(() => this.rolarSlotAberto(key));
  }

  abrirTransportadora(t: TransportadoraSlotVm, slot: SlotDiaVm): void {
    if (!this.podeVerAgendamentos()) return;
    this.transportadoraDetalheId.set(t.id);
    this.carregarAgendamentos(t.id, slot.horaInicio, slot.horaFim);
    queueMicrotask(() => this.rolarSlotAberto(slot.key));
  }

  private rolarSlotAberto(key: string): void {
    const el = document.querySelector(`.dcal__slot[data-slot-key="${CSS.escape(key)}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  novaDestinacao(): void {
    void this.router.navigateByUrl(DESTINACAO_ROUTE, { replaceUrl: true });
  }

  private garantirDiaNoContexto(): void {
    const iso = this.diaSelecionado();
    const d = parseIsoDateLocal(iso);
    if (!d) return;
    if (d.getFullYear() !== this.ano() || d.getMonth() !== this.mes0()) {
      this.ano.set(d.getFullYear());
      this.mes0.set(d.getMonth());
      this.recarregarMes(false);
    }
  }

  private recarregarMes(selecionarPrimeiro = true): void {
    const geracao = ++this.geracaoMes;
    const grid = buildMonthGrid(this.ano(), this.mes0());
    this.dias.set(grid);
    this.loadingMes.set(true);

    const diasMes = daysInMonthIso(this.ano(), this.mes0());
    if (selecionarPrimeiro) {
      const hoje = toIsoDateLocal();
      const noMes = diasMes.includes(hoje)
        ? hoje
        : diasMes[0] ?? hoje;
      this.diaSelecionado.set(noMes);
    }

    forkJoin({
      reservas: this.vagasApi
        .listarReservas()
        .pipe(catchError(() => of([] as VagaReservaTransportadoraItem[]))),
      dias: from(diasMes).pipe(
        mergeMap(
          (iso) =>
            forkJoin({
              resumo: this.vagasApi.resumoParaTransportadora(iso).pipe(catchError(() => of(null))),
              disp: this.janelasApi.disponibilidade(iso, this.modalidade()).pipe(
                catchError(() => of(null))
              ),
            }).pipe(
              map(({ resumo, disp }) => {
                const slots = disp?.slots ?? [];
                // Vagas das janelas no dia (= faixas × vagas/horário, ex.: 12×10 = 120).
                const totalCap = Number(disp?.totalCapacidade);
                const janelas =
                  Number.isFinite(totalCap) && totalCap >= 0
                    ? Math.trunc(totalCap)
                    : slots.reduce((acc, s) => acc + Math.max(0, Math.trunc(Number(s.capacidade) || 0)), 0);
                // Agendados = contrato BE `ocupadas` / `totalOcupadas` (igual ao Painel).
                const totalOcup = Number(disp?.totalOcupadas);
                const agendados =
                  Number.isFinite(totalOcup) && totalOcup >= 0
                    ? Math.trunc(totalOcup)
                    : slots.reduce((acc, s) => acc + Math.max(0, Math.trunc(Number(s.ocupadas) || 0)), 0);
                return { iso, resumo, janelas, agendados };
              })
            ),
          4
        ),
        toArray()
      ),
    })
      .pipe(
        finalize(() => {
          if (geracao === this.geracaoMes) this.loadingMes.set(false);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: ({ reservas, dias }) => {
          if (geracao !== this.geracaoMes) return;
          this.reservas.set(reservas ?? []);
          const mapa = new Map(dias.map((r) => [r.iso, r]));
          const mod = this.modalidade();
          let capRef: number | null = null;
          this.dias.update((cells) =>
            cells.map((c) => {
              if (c.foraDoMes) return { ...c, loading: false };
              const row = mapa.get(c.iso);
              const resumo = row?.resumo ?? null;
              const reservadas =
                mod === 1
                  ? (resumo?.vagasReservadasEstacionamento ?? 0)
                  : (resumo?.vagasReservadasLimpeza ?? 0);
              const disponiveis =
                mod === 1
                  ? (resumo?.vagasDisponiveisEstacionamento ?? null)
                  : (resumo?.vagasDisponiveisLimpeza ?? null);
              const cap =
                mod === 1
                  ? (resumo?.capacidadeEstacionamento ?? null)
                  : (resumo?.capacidadeLimpeza ?? null);
              if (cap != null && capRef == null) capRef = cap;
              return {
                ...c,
                loading: false,
                reservadas,
                disponiveis,
                janelas: row?.janelas ?? 0,
                agendados: row?.agendados ?? 0,
              };
            })
          );
          this.capacidadeRef.set(capRef);
          this.carregarDia(this.diaSelecionado());
        },
      });
  }

  private carregarDia(iso: string): void {
    const geracao = ++this.geracaoDia;
    this.loadingDia.set(true);
    this.slots.set([]);
    this.slotAtivoKey.set(null);
    this.transportadoraDetalheId.set(null);
    this.agendamentosDetalhe.set([]);

    const modalidade = this.modalidade() as ModalidadeVagaAgendamento;
    const transportadoraId = this.transportadoraFiltroId();

    this.janelasApi
      .disponibilidade(iso, modalidade, transportadoraId)
      .pipe(
        catchError(() =>
          of({
            data: iso,
            modalidade,
            usouDestinacao: false,
            slots: [] as JanelaSlotDisponivel[],
            totalCapacidade: null,
            totalOcupadas: null,
            totalDisponiveis: null,
          })
        ),
        finalize(() => {
          if (geracao === this.geracaoDia) this.loadingDia.set(false);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (disp) => {
          if (geracao !== this.geracaoDia) return;
          const slots: SlotDiaVm[] = (disp.slots ?? []).map((s) => {
            const horaInicio = normHora(s.horaInicio);
            const horaFim = normHora(s.horaFim);
            const destinadas = this.somaDestinadasSlot(iso, horaInicio, horaFim);
            return {
              key: `${horaInicio}|${horaFim}`,
              horaInicio,
              horaFim,
              label: `${horaInicio} – ${horaFim}`,
              capacidade: Number(s.capacidade) || 0,
              ocupadas: Number(s.ocupadas) || 0,
              disponiveis: Number(s.disponiveis) || 0,
              destinadas,
              expandido: false,
              transportadoras: [],
            };
          });
          this.slots.set(slots);
          if (disp.totalCapacidade != null) {
            // não sobrescreve capacidade diária do pátio; é capacidade agregada de slots
          }
        },
      });
  }

  private reservasDoDiaSlot(
    iso: string,
    horaInicio: string,
    horaFim: string
  ): VagaReservaTransportadoraItem[] {
    const mod = this.modalidade();
    const filtroId = this.transportadoraFiltroId();
    return this.reservas().filter((r) => {
      if (!reservaCobreDiaCalendario(r, iso)) return false;
      if (!modalidadeBate(r.modalidade, mod)) return false;
      if (filtroId != null && filtroId > 0 && Number(r.transportadoraId) !== filtroId) return false;
      const hi = normHora(r.horaInicio);
      const hf = normHora(r.horaFim);
      if (!hi || !hf) return false;
      return hi === horaInicio && hf === horaFim;
    });
  }

  private somaDestinadasSlot(iso: string, horaInicio: string, horaFim: string): number {
    return this.reservasDoDiaSlot(iso, horaInicio, horaFim).reduce(
      (acc, r) => acc + Math.max(0, Math.trunc(Number(r.quantidade) || 0)),
      0
    );
  }

  private montarTransportadorasDoSlot(horaInicio: string, horaFim: string): TransportadoraSlotVm[] {
    const iso = this.diaSelecionado();
    const mapa = new Map<number, TransportadoraSlotVm>();
    for (const r of this.reservasDoDiaSlot(iso, horaInicio, horaFim)) {
      const id = Number(r.transportadoraId) || 0;
      if (id <= 0 && !r.avulso) continue;
      const key = id > 0 ? id : -1;
      const atual = mapa.get(key) ?? {
        id: key,
        nome: r.avulso && id <= 0 ? 'Avulso' : r.transportadoraNome || `Transportadora #${id}`,
        destinadas: 0,
        utilizadas: 0,
        restantes: 0,
      };
      atual.destinadas += Math.max(0, Math.trunc(Number(r.quantidade) || 0));
      mapa.set(key, atual);
    }
    return [...mapa.values()]
      .map((t) => ({
        ...t,
        utilizadas: 0,
        restantes: t.destinadas,
      }))
      .sort((a, b) => b.destinadas - a.destinadas || a.nome.localeCompare(b.nome));
  }

  private carregarAgendamentos(transportadoraId: number, horaInicio: string, horaFim: string): void {
    if (transportadoraId <= 0) {
      this.agendamentosDetalhe.set([]);
      return;
    }
    const iso = this.diaSelecionado();
    this.loadingAgendamentos.set(true);
    this.agendamentosApi
      .buscar({
        numeroPagina: 1,
        tamanhoPagina: 100,
        dataInicial: iso,
        dataFinal: iso,
        transportadoraId,
      })
      .pipe(
        catchError(() =>
          of({
            items: [] as AgendamentoSearchItem[],
            totalCount: 0,
            numeroPagina: 1,
            tamanhoPagina: 100,
          })
        ),
        finalize(() => this.loadingAgendamentos.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (page) => {
          const itens = (page.items ?? []).filter((a) => {
            const h = extrairHoraDeDataHora(a.dataHoraEntrada);
            return horaNoIntervalo(h, horaInicio, horaFim);
          });
          this.agendamentosDetalhe.set(itens);
          // Atualiza utilizadas/restantes na transportadora expandida
          this.slots.update((list) =>
            list.map((s) => {
              if (!s.expandido) return s;
              return {
                ...s,
                transportadoras: s.transportadoras.map((t) => {
                  if (t.id !== transportadoraId) return t;
                  const utilizadas = itens.length;
                  return {
                    ...t,
                    utilizadas,
                    restantes: Math.max(0, t.destinadas - utilizadas),
                  };
                }),
              };
            })
          );
        },
      });
  }
}
