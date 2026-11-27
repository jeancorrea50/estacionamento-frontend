import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridOptions,
  type IsFullWidthRowParams,
  type ValueGetterParams,
} from 'ag-grid-community';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  CadastroConfirmDialogComponent,
  CadastroConfirmDialogData,
} from '../../../cadastro/components/cadastro-confirm-dialog/cadastro-confirm-dialog.component';
import { formatPlacaDisplay } from '../../../cadastro/utils/placa-br';
import { AGENDAR_ROUTE } from '../../agendamento-rotas';
import {
  AgendamentoNovoModalComponent,
  SERVICO_INFO,
  ServicoAgendamento,
} from '../../components/agendamento-novo-modal/agendamento-novo-modal.component';
import {
  AgendamentoSearchItem,
  EntradaSaidaStatus,
  parseEntradaSaidaStatus,
} from '../../models/agendamento.models';
import type { ModalidadeAgendamento } from '../../models/janela-agendamento.models';
import { AgendamentoService } from '../../services/agendamento.service';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import { JanelaDisponibilidadeRealtimeService } from '../../services/janela-disponibilidade-realtime.service';
import {
  AgendarGridActionsRenderer,
  type AgendarGridActionsContext,
} from './agendar-grid-actions.renderer';

ModuleRegistry.registerModules([AllCommunityModule]);

type Periodo = 'proximos' | 'hoje' | 'mes' | 'todos';
type Situacao = 'agendado' | 'no_patio' | 'concluido' | 'cancelado';
type Frete = 'CIF' | 'FOB';

interface Linha {
  id: number;
  data: string; // yyyy-MM-dd
  hora: string; // HH:mm
  placa: string;
  motorista: string;
  transportadora: string;
  transportadoraId: number | null;
  servicos: ServicoAgendamento[];
  modalidade: ModalidadeAgendamento;
  frete: Frete;
  pagadorNome: string | null;
  situacao: Situacao;
  observacao: string | null;
}

interface Grupo {
  data: string;
  titulo: string;
  itens: Linha[];
}

/** Linha de dados ou cabeçalho de dia no AG Grid. */
type GridRow = Linha | { __grupo: true; id: string; data: string; titulo: string; count: number };

function ehGrupo(row: GridRow | undefined | null): row is Extract<GridRow, { __grupo: true }> {
  return !!row && '__grupo' in row && row.__grupo === true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SITUACAO: Record<Situacao, { label: string; icon: string; tone: string; ajuda: string }> = {
  agendado: {
    label: 'Agendado',
    icon: 'event',
    tone: 'info',
    ajuda: 'Vaga reservada. O veículo ainda não chegou.',
  },
  no_patio: {
    label: 'No pátio',
    icon: 'local_shipping',
    tone: 'ok',
    ajuda: 'O veículo já entrou e está ocupando a vaga.',
  },
  concluido: {
    label: 'Concluído',
    icon: 'task_alt',
    tone: 'neutral',
    ajuda: 'O veículo já saiu. Agendamento encerrado.',
  },
  cancelado: {
    label: 'Cancelado',
    icon: 'cancel',
    tone: 'danger',
    ajuda: 'Agendamento cancelado. A vaga foi liberada.',
  },
};

const pad = (n: number) => String(n).padStart(2, '0');
const isoDe = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const somarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDe(d);
};
/** Máximo trazido por consulta (a lista agrupa por dia no navegador). */
const LIMITE = 200;

function situacaoDe(raw: AgendamentoSearchItem['status']): Situacao {
  switch (parseEntradaSaidaStatus(raw)) {
    case EntradaSaidaStatus.Agendado:
      return 'agendado';
    case EntradaSaidaStatus.Cancelado:
      return 'cancelado';
    case EntradaSaidaStatus.Saida:
      return 'concluido';
    default:
      return 'no_patio'; // Entrada / Suspenso
  }
}

function servicosDe(mod: ModalidadeAgendamento): ServicoAgendamento[] {
  return mod === 3 ? ['estacionamento', 'limpeza'] : mod === 2 ? ['limpeza'] : ['estacionamento'];
}

function linhaDe(item: AgendamentoSearchItem): Linha {
  const dt = new Date(item.dataHoraEntrada);
  const valida = !Number.isNaN(dt.getTime());
  const mod = (item.modalidadeAgendamento ?? 1) as ModalidadeAgendamento;
  const fob = Number(item.tipoPagador) === 2;
  return {
    id: item.id,
    data: valida ? isoDe(dt) : String(item.dataHoraEntrada || '').slice(0, 10),
    hora: valida ? `${pad(dt.getHours())}:${pad(dt.getMinutes())}` : '—',
    placa: item.placaVeiculo || '',
    motorista: item.nomeMotorista || '',
    transportadora: item.nomeTransportadora || '',
    transportadoraId: item.transportadoraId > 0 ? item.transportadoraId : null,
    servicos: servicosDe(mod),
    modalidade: mod,
    frete: fob ? 'FOB' : 'CIF',
    pagadorNome: fob ? item.pagadorNome || null : null,
    situacao: situacaoDe(item.status),
    observacao: item.observacao || null,
  };
}

/**
 * Tela Agendar (`/app/agendar`) — "Meus agendamentos" da transportadora: painel dela
 * (próxima vaga, hoje, próximos 7 dias, CIF × FOB) + lista agrupada por dia.
 * Claims `agendar.*` (distintas de `agendamentos.*` do Pátio).
 */
@Component({
  selector: 'app-agendar-page',
  standalone: true,
  imports: [FormsModule, DatePipe, MatMenuModule, AgGridAngular, AgendamentoNovoModalComponent],
  templateUrl: './agendar-page.component.html',
  styleUrls: ['./agendar-page.component.scss'],
})
export class AgendarPageComponent implements OnInit {
  private readonly api = inject(AgendamentoService);
  private readonly janelasApi = inject(JanelaAgendamentoService);
  private readonly realtime = inject(JanelaDisponibilidadeRealtimeService);
  private readonly auth = inject(AuthService);
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly permissions = inject(PermissionCacheService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly SITUACAO = SITUACAO;
  readonly SERVICO_INFO = SERVICO_INFO;
  readonly situacoes = Object.keys(SITUACAO) as Situacao[];
  readonly periodos: ReadonlyArray<{ id: Periodo; label: string }> = [
    { id: 'proximos', label: 'Próximos' },
    { id: 'hoje', label: 'Hoje' },
    { id: 'mes', label: 'Este mês' },
    { id: 'todos', label: 'Todos' },
  ];

  readonly hoje = isoDe(new Date());
  emitidoEm = new Date();

  // ─── Estado ───────────────────────────────────────────────────────────
  readonly loading = signal(false);
  readonly erro = signal<string | null>(null);
  readonly linhas = signal<Linha[]>([]);
  readonly totalCount = signal(0);
  /** Hoje + próximos 7 dias (painel), independente do período da lista. */
  readonly linhasSemana = signal<Linha[]>([]);
  readonly proximaVaga = signal<{
    data: string;
    vagas: number;
    vagasMes: number;
    destinada: boolean;
  } | null>(null);
  readonly carregandoVaga = signal(false);
  readonly nomeTransportadora = signal('');

  // ─── Filtros ──────────────────────────────────────────────────────────
  readonly periodo = signal<Periodo>('proximos');
  readonly situacao = signal<Situacao | 'todas'>('todas');
  readonly frete = signal<Frete | 'todos'>('todos');
  readonly busca = signal('');
  readonly filtrosAbertos = signal(false);
  readonly filtrosAtivos = computed(
    () => Number(this.situacao() !== 'todas') + Number(this.frete() !== 'todos'),
  );

  // ─── Modal ────────────────────────────────────────────────────────────
  readonly showForm = signal(false);
  readonly novoDia = signal<string | null>(null);
  readonly novoPlacas = signal<string[]>([]);
  readonly novoModalidade = signal<ModalidadeAgendamento | null>(null);
  readonly novoTransportadora = signal<{ id: number; nome: string } | null>(null);

  private readonly carregar$ = new Subject<void>();

  get canVisualizar(): boolean {
    return (
      this.sessionAccess.canAccessRoute(AGENDAR_ROUTE) ||
      this.permissions.allows('agendar', 'visualizar') ||
      this.permissions.allows('agendamentos', 'visualizar')
    );
  }

  get podeCriar(): boolean {
    return (
      this.canVisualizar &&
      (this.permissions.allows('agendar', 'gravar') ||
        this.permissions.allows('agendamentos', 'gravar'))
    );
  }

  get podeCancelar(): boolean {
    return (
      this.canVisualizar &&
      (this.permissions.allows('agendar', 'alterar') ||
        this.permissions.allows('agendar', 'excluir') ||
        this.permissions.allows('agendamentos', 'alterar') ||
        this.permissions.allows('agendamentos', 'excluir'))
    );
  }

  get podeEscolherTransportadora(): boolean {
    return this.auth.isAdmin() || !this.auth.isTransportadoraRole();
  }

  private get transportadoraSessao(): number | null {
    if (this.podeEscolherTransportadora) return null;
    const id = this.auth.resolveTransportadoraId();
    return id && id > 0 ? id : null;
  }

  // ─── Painel ───────────────────────────────────────────────────────────
  readonly hojeResumo = computed(() => {
    const h = this.linhasSemana().filter((a) => a.data === this.hoje);
    return {
      chegando: h.filter((a) => a.situacao === 'agendado').length,
      noPatio: h.filter((a) => a.situacao === 'no_patio').length,
      concluidos: h.filter((a) => a.situacao === 'concluido').length,
    };
  });

  readonly proximos7 = computed(() => {
    const fim = somarDias(this.hoje, 7);
    return this.linhasSemana().filter(
      (a) => a.situacao === 'agendado' && a.data >= this.hoje && a.data <= fim,
    ).length;
  });

  /** CIF × FOB dos agendamentos do período (sem cancelados). */
  readonly freteResumo = computed(() => {
    const ativos = this.filtradosSemFrete().filter((a) => a.situacao !== 'cancelado');
    const cif = ativos.filter((a) => a.frete === 'CIF').length;
    const fob = ativos.length - cif;
    const total = ativos.length;
    return {
      cif,
      fob,
      total,
      pCif: total ? (cif / total) * 100 : 0,
      pFob: total ? (fob / total) * 100 : 0,
    };
  });

  // ─── Lista ────────────────────────────────────────────────────────────
  private readonly filtradosSemFrete = computed(() => {
    const p = this.periodo();
    const termo = this.busca().trim().toUpperCase();
    const termoPlaca = termo.replace(/[^A-Z0-9]/g, '');
    return this.linhas()
      .filter((a) => (p === 'proximos' ? a.situacao !== 'concluido' : true))
      .filter((a) => this.situacao() === 'todas' || a.situacao === this.situacao())
      .filter(
        (a) =>
          !termo ||
          (!!termoPlaca && a.placa.toUpperCase().includes(termoPlaca)) ||
          a.motorista.toUpperCase().includes(termo),
      );
  });

  readonly filtrados = computed(() => {
    const asc = this.periodo() !== 'todos';
    return this.filtradosSemFrete()
      .filter((a) => this.frete() === 'todos' || a.frete === this.frete())
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora) * (asc ? 1 : -1));
  });

  /** Agrupado por dia: "Hoje", "Amanhã", "Qua, 02/12". */
  readonly grupos = computed<Grupo[]>(() => {
    const m = new Map<string, Linha[]>();
    for (const a of this.filtrados()) m.set(a.data, [...(m.get(a.data) ?? []), a]);
    return [...m.entries()].map(([data, itens]) => ({ data, titulo: this.tituloDia(data), itens }));
  });

  /** Linhas do AG Grid: cabeçalho de dia + itens. */
  readonly gridRows = computed<GridRow[]>(() => {
    const rows: GridRow[] = [];
    for (const g of this.grupos()) {
      rows.push({
        __grupo: true,
        id: `g-${g.data}`,
        data: g.data,
        titulo: g.titulo,
        count: g.itens.length,
      });
      rows.push(...g.itens);
    }
    return rows;
  });

  readonly gridContext = computed<AgendarGridActionsContext>(() => ({
    podeCriar: this.podeCriar,
    podeCancelar: this.podeCancelar,
    formatPlaca: (placa) => this.formatPlaca(placa),
    agendarDeNovo: (row) => this.agendarDeNovo(row as Linha),
    cancelar: (row) => this.cancelar(row as Linha),
  }));

  readonly columnDefs = computed<ColDef<GridRow>[]>(() => [
    {
      headerName: 'Horário',
      field: 'hora',
      width: 96,
      minWidth: 88,
      cellClass: 'ma-grid__hora',
      valueGetter: (p: ValueGetterParams<GridRow>) =>
        ehGrupo(p.data) ? '' : ((p.data as Linha | undefined)?.hora ?? ''),
    },
    {
      headerName: 'Placa',
      field: 'placa',
      minWidth: 120,
      flex: 0.8,
      cellClass: 'ma-grid__placa',
      valueGetter: (p: ValueGetterParams<GridRow>) => {
        if (ehGrupo(p.data)) return '';
        return this.formatPlaca((p.data as Linha | undefined)?.placa ?? '');
      },
    },
    {
      headerName: 'Transportadora',
      field: 'transportadora',
      minWidth: 160,
      flex: 1.2,
      valueGetter: (p: ValueGetterParams<GridRow>) => {
        if (ehGrupo(p.data)) return '';
        const nome = (p.data as Linha | undefined)?.transportadora?.trim();
        return nome || '—';
      },
    },
    {
      headerName: 'Motorista',
      field: 'motorista',
      minWidth: 140,
      flex: 1,
      valueGetter: (p: ValueGetterParams<GridRow>) => {
        if (ehGrupo(p.data)) return '';
        return (p.data as Linha | undefined)?.motorista?.trim() || '—';
      },
    },
    {
      headerName: 'Serviço',
      colId: 'servico',
      minWidth: 140,
      flex: 1,
      valueGetter: (p: ValueGetterParams<GridRow>) => {
        if (ehGrupo(p.data)) return '';
        const servicos = (p.data as Linha | undefined)?.servicos ?? [];
        return servicos.map((s) => SERVICO_INFO[s].label).join(' + ');
      },
      cellRenderer: (p: { data?: GridRow }) => {
        if (ehGrupo(p.data)) return '';
        const servicos = (p.data as Linha | undefined)?.servicos ?? [];
        if (!servicos.length) return '—';
        return `<span class="servico">${servicos
          .map(
            (s, i) =>
              `<span class="servico__item"><span class="material-symbols-outlined" aria-hidden="true">${SERVICO_INFO[s].icon}</span>${SERVICO_INFO[s].label}</span>${
                i < servicos.length - 1 ? '<span class="servico__mais" aria-hidden="true">+</span>' : ''
              }`,
          )
          .join('')}</span>`;
      },
    },
    {
      headerName: 'Modalidade',
      field: 'frete',
      minWidth: 120,
      flex: 0.9,
      cellRenderer: (p: { data?: GridRow }) => {
        if (ehGrupo(p.data)) return '';
        const a = p.data as Linha | undefined;
        if (!a) return '—';
        const title =
          a.frete === 'FOB'
            ? `Fatura para ${a.pagadorNome || 'terceiro'}`
            : 'A própria transportadora paga';
        const pagador =
          a.frete === 'FOB' && a.pagadorNome
            ? `<span class="frete__pagador">${escapeHtml(a.pagadorNome)}</span>`
            : '';
        return `<span class="frete" data-frete="${a.frete}" title="${escapeHtml(title)}">${a.frete}</span>${pagador}`;
      },
    },
    {
      headerName: 'Situação',
      field: 'situacao',
      minWidth: 130,
      flex: 0.9,
      cellRenderer: (p: { data?: GridRow }) => {
        if (ehGrupo(p.data)) return '';
        const a = p.data as Linha | undefined;
        if (!a) return '—';
        const s = SITUACAO[a.situacao];
        return `<span class="pill" data-tone="${s.tone}"><span class="material-symbols-outlined" aria-hidden="true">${s.icon}</span>${s.label}</span>`;
      },
    },
    {
      headerName: '',
      colId: 'acoes',
      width: 56,
      maxWidth: 64,
      sortable: false,
      filter: false,
      resizable: false,
      cellClass: 'ma-grid__acoes no-print',
      cellRenderer: AgendarGridActionsRenderer,
    },
  ]);

  readonly defaultColDef: ColDef = {
    sortable: false,
    filter: false,
    resizable: true,
    suppressMovable: true,
  };

  readonly gridOptions: GridOptions<GridRow> = {
    animateRows: false,
    suppressCellFocus: true,
    headerHeight: 40,
    rowHeight: 48,
    getRowHeight: (p) => (ehGrupo(p.data) ? 40 : 48),
    getRowId: (p) => String(p.data?.id ?? ''),
    getRowClass: (p) => {
      if (ehGrupo(p.data)) {
        return p.data.data === this.hoje ? 'ma-grid__grupo is-hoje' : 'ma-grid__grupo';
      }
      return (p.data as Linha | undefined)?.situacao === 'cancelado' ? 'is-cancel' : undefined;
    },
    isFullWidthRow: (p: IsFullWidthRowParams<GridRow>) => ehGrupo(p.rowNode.data),
    fullWidthCellRenderer: (p: { data?: GridRow }) => {
      if (!ehGrupo(p.data)) return '';
      const g = p.data;
      const dataBr = g.data.split('-').reverse().join('/');
      return `<div class="ma-grid__grupo-cell">${escapeHtml(g.titulo)} <span class="muted">· ${escapeHtml(dataBr)} · ${g.count} ${
        g.count === 1 ? 'agendamento' : 'agendamentos'
      }</span></div>`;
    },
  };

  readonly limitado = computed(() => this.totalCount() > this.linhas().length);

  constructor() {
    this.carregar$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.erro.set(null);
          return this.api
            .buscar({
              ...this.intervaloDoPeriodo(),
              incluirTodosStatus: true,
              numeroPagina: 1,
              tamanhoPagina: LIMITE,
            })
            .pipe(
              map((p) => ({
                itens: p.items ?? [],
                total: p.totalCount ?? 0,
                erro: null as string | null,
              })),
              catchError(() =>
                of({
                  itens: [] as AgendamentoSearchItem[],
                  total: 0,
                  erro: 'Não foi possível carregar seus agendamentos.',
                }),
              ),
              finalize(() => this.loading.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ itens, total, erro }) => {
        if (erro) this.toast.error('Falha ao carregar agendamentos.');
        this.erro.set(erro);
        this.linhas.set(itens.map(linhaDe));
        this.totalCount.set(total);
        this.lembrarNome(itens);
      });
  }

  ngOnInit(): void {
    if (!this.canVisualizar) {
      this.erro.set(
        'Sem permissão para Agendar. Libere o menu /app/agendar e a claim agendar.visualizar no perfil.',
      );
      return;
    }
    if (this.auth.needsEstacionamentoSelection()) {
      this.erro.set('Selecione o estacionamento da sessão antes de continuar.');
      return;
    }
    this.atualizarTudo();
  }

  atualizarTudo(): void {
    this.carregar$.next();
    this.carregarSemana();
    this.carregarProximaVaga();
  }

  setPeriodo(p: Periodo): void {
    if (this.periodo() === p) return;
    this.periodo.set(p);
    this.carregar$.next();
  }

  private intervaloDoPeriodo(): { dataInicial?: string; dataFinal?: string } {
    const h = this.hoje;
    switch (this.periodo()) {
      case 'hoje':
        return { dataInicial: h, dataFinal: h };
      case 'mes': {
        const d = new Date(`${h}T12:00:00`);
        return {
          dataInicial: isoDe(new Date(d.getFullYear(), d.getMonth(), 1)),
          dataFinal: isoDe(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
        };
      }
      case 'proximos':
        return { dataInicial: h, dataFinal: somarDias(h, 90) };
      default:
        return {};
    }
  }

  private carregarSemana(): void {
    this.api
      .buscar({
        dataInicial: this.hoje,
        dataFinal: somarDias(this.hoje, 7),
        incluirTodosStatus: true,
        numeroPagina: 1,
        tamanhoPagina: LIMITE,
      })
      .pipe(catchError(() => of(null)))
      .subscribe((p) => {
        const itens = p?.items ?? [];
        this.linhasSemana.set(itens.map(linhaDe));
        this.lembrarNome(itens);
      });
  }

  /** Primeiro dia com vaga (Estacionamento) nos próximos 60 dias, para a transportadora. */
  private carregarProximaVaga(): void {
    const tid = this.transportadoraSessao;
    if (!tid) {
      this.proximaVaga.set(null);
      return;
    }
    this.carregandoVaga.set(true);
    this.janelasApi
      .disponibilidadePeriodo(this.hoje, somarDias(this.hoje, 59), 1, tid)
      .pipe(
        catchError(() => of([])),
        finalize(() => this.carregandoVaga.set(false)),
      )
      .subscribe((dias) => {
        const d = dias.find((x) => x.totalDisponiveis > 0);
        if (!d) {
          this.proximaVaga.set(null);
          return;
        }
        const mes = d.data.slice(0, 7);
        this.proximaVaga.set({
          data: d.data,
          vagas: d.totalDisponiveis,
          vagasMes: dias
            .filter((x) => x.data.startsWith(mes))
            .reduce((s, x) => s + x.totalDisponiveis, 0),
          destinada: d.usouDestinacao,
        });
      });
  }

  private lembrarNome(itens: AgendamentoSearchItem[]): void {
    if (this.nomeTransportadora() || this.podeEscolherTransportadora) return;
    const nome = itens.find((i) => i.nomeTransportadora)?.nomeTransportadora;
    if (nome) this.nomeTransportadora.set(nome);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────
  tituloDia(iso: string): string {
    if (iso === this.hoje) return 'Hoje';
    if (iso === somarDias(this.hoje, 1)) return 'Amanhã';
    if (iso === somarDias(this.hoje, -1)) return 'Ontem';
    const s = new Date(`${iso}T12:00:00`)
      .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
      .replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  diaLongo(iso: string): string {
    const s = new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  formatPlaca(p: string): string {
    return formatPlacaDisplay(p) || p || '—';
  }

  plural(n: number, um: string, varios: string): string {
    return `${n} ${n === 1 ? um : varios}`;
  }

  limparFiltros(): void {
    this.situacao.set('todas');
    this.frete.set('todos');
    this.busca.set('');
    this.setPeriodo('todos');
  }

  // ─── Ações ────────────────────────────────────────────────────────────
  abrirNovo(
    extra: {
      dia?: string;
      placas?: string[];
      modalidade?: ModalidadeAgendamento;
      transportadora?: { id: number; nome: string } | null;
    } = {},
  ): void {
    if (!this.podeCriar) {
      this.toast.error('Sem permissão para criar agendamento (agendar.gravar).');
      return;
    }
    this.novoDia.set(extra.dia ?? null);
    this.novoPlacas.set(extra.placas ?? []);
    this.novoModalidade.set(extra.modalidade ?? null);
    this.novoTransportadora.set(extra.transportadora ?? null);
    this.showForm.set(true);
  }

  agendarProximaVaga(): void {
    const p = this.proximaVaga();
    this.abrirNovo(p ? { dia: p.data, modalidade: 1 } : {});
  }

  agendarDeNovo(a: Linha): void {
    this.abrirNovo({
      placas: [a.placa],
      modalidade: a.modalidade,
      transportadora: a.transportadoraId
        ? { id: a.transportadoraId, nome: a.transportadora }
        : null,
    });
  }

  fecharForm(): void {
    this.showForm.set(false);
  }

  onNovoSalvo(): void {
    this.realtime.notifyLocal();
    this.atualizarTudo();
  }

  cancelar(a: Linha): void {
    if (!this.podeCancelar || a.situacao !== 'agendado') return;
    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      width: '420px',
      maxWidth: '96vw',
      autoFocus: 'dialog',
      panelClass: 'cad-confirm-dialog-panel',
      data: {
        titulo: 'Cancelar este agendamento?',
        mensagem: `Placa ${this.formatPlaca(a.placa)} · ${this.tituloDia(a.data)} às ${a.hora}. A vaga volta a ficar livre.`,
        confirmLabel: 'Cancelar agendamento',
        confirmColor: 'warn',
      } satisfies CadastroConfirmDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.cancelar(a.id).subscribe((res) => {
        if (!res.success) {
          if (!res.toastShown) this.toast.error(res.message || 'Não foi possível cancelar.');
        } else {
          this.toast.success('Agendamento cancelado. A vaga foi liberada.');
        }
        this.atualizarTudo();
      });
    });
  }

  imprimir(): void {
    this.emitidoEm = new Date();
    // Estilos @media print deixam só o relatório (sem menu, filtros e botões).
    setTimeout(() => window.print());
  }

  /** Excel: CSV com ";" e BOM (abre certo no Excel pt-BR, com acentos). Só o que está filtrado. */
  exportarExcel(): void {
    const cab = [
      'Data',
      'Dia',
      'Horário',
      'Placa',
      'Transportadora',
      'Motorista',
      'Serviço',
      'Modalidade',
      'Pagador',
      'Situação',
      'Observação',
    ];
    const linhas = this.filtrados().map((a) => [
      a.data.split('-').reverse().join('/'),
      this.tituloDia(a.data),
      a.hora,
      this.formatPlaca(a.placa),
      a.transportadora || '',
      a.motorista,
      a.servicos.map((s) => SERVICO_INFO[s].label).join(' + '),
      a.frete,
      a.frete === 'FOB' ? a.pagadorNome || 'Terceiro' : 'A própria transportadora',
      SITUACAO[a.situacao].label,
      a.observacao ?? '',
    ]);
    if (!linhas.length) {
      this.toast.warning('Nada para exportar com os filtros atuais.');
      return;
    }
    const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = '﻿' + [cab, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `agendamentos-${this.hoje}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast.success(
      `Planilha gerada com ${this.plural(linhas.length, 'agendamento', 'agendamentos')}.`,
    );
  }
}
