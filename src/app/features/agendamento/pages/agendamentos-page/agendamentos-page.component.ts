import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { EstacionamentoService } from '../../../cadastro/services/estacionamento.service';
import { formatPlacaDisplay } from '../../../cadastro/utils/placa-br';
import { EstSummaryMetricComponent } from '../../../cadastro/components/est-summary-metric/est-summary-metric.component';
import { TransportadoraLookupFieldComponent } from '../../../movimentos/entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
import {
  CadastroConfirmDialogComponent,
  CadastroConfirmDialogData,
} from '../../../cadastro/components/cadastro-confirm-dialog/cadastro-confirm-dialog.component';
import { AGENDAMENTO_PAINEL_ROUTE, JANELAS_ROUTE } from '../../agendamento-rotas';
import { AgendamentoService } from '../../services/agendamento.service';
import {
  AgendamentoSearchItem,
  EntradaSaidaStatus,
  entradaSaidaStatusLabel,
  parseEntradaSaidaStatus,
} from '../../models/agendamento.models';
import { baixarPdfReciboAgendamento } from '../../recibo/agendamento-recibo-pdf';
import {
  PeriodoDataPickerComponent,
  PeriodoDataSelecionado,
} from '../../../../shared/ui/periodo-data-picker/periodo-data-picker.component';
import { AgendamentoNovoModalComponent } from '../../components/agendamento-novo-modal/agendamento-novo-modal.component';
import {
  VagaReservaDialogComponent,
  type VagaReservaDialogData,
} from '../../components/vaga-reserva-dialog/vaga-reserva-dialog.component';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import { JanelaDisponibilidadeRealtimeService } from '../../services/janela-disponibilidade-realtime.service';
import {
  formatIsoDateBr,
  mapTimelineSlots,
  modalidadeApi,
  resolverKpiJanelasDia,
  toIsoDateLocal,
  type AgendamentoModalidadeUi,
  type AgendamentoTimelineSlot,
} from './agendamento-dashboard.util';
import { AgendamentoDiaTimelineComponent } from './agendamento-dia-timeline/agendamento-dia-timeline.component';
import {
  exportarPainelAgendamentosExcel,
  exportarPainelAgendamentosPdf,
} from './agendamento-painel-export';

@Component({
  selector: 'app-agendamentos-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    RouterLink,
    EstSummaryMetricComponent,
    PeriodoDataPickerComponent,
    AgendamentoNovoModalComponent,
    TransportadoraLookupFieldComponent,
    AgendamentoDiaTimelineComponent,
  ],
  templateUrl: './agendamentos-page.component.html',
  styleUrls: ['./agendamentos-page.component.scss'],
})
export class AgendamentosPageComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly permissions = inject(PermissionCacheService);
  private readonly router = inject(Router);
  private readonly api = inject(AgendamentoService);
  private readonly estacionamentoService = inject(EstacionamentoService);
  private readonly janelasApi = inject(JanelaAgendamentoService);
  private readonly janelasRealtime = inject(JanelaDisponibilidadeRealtimeService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private timelineSub?: Subscription;

  readonly isAdmin = this.auth.isAdmin();
  readonly isTransportadora = this.auth.isTransportadoraRole();

  get canVisualizar(): boolean {
    return (
      this.sessionAccess.canAccessRoute(this.router.url) ||
      this.sessionAccess.canAccessRoute(AGENDAMENTO_PAINEL_ROUTE) ||
      this.permissions.allows('agendamentos', 'visualizar')
    );
  }

  /**
   * POST /Agendamento — claim da tela Pátio `agendamentos.gravar`
   * (aceita também `agendar.gravar` se o perfil só tiver a outra tela).
   */
  get podeCriar(): boolean {
    return (
      this.canVisualizar &&
      (this.permissions.allows('agendamentos', 'gravar') ||
        this.permissions.allows('agendar', 'gravar'))
    );
  }

  /** PATCH cancelar — claim `agendamentos.alterar|excluir`. */
  get podeCancelar(): boolean {
    return (
      this.canVisualizar &&
      (this.permissions.allows('agendamentos', 'alterar') ||
        this.permissions.allows('agendamentos', 'excluir'))
    );
  }

  get podeOperarPatio(): boolean {
    return this.canVisualizar && !this.isTransportadora;
  }

  readonly janelasRoute = JANELAS_ROUTE;

  /** Atalho para Janelas: operador de pátio com acesso à rota/claim `janelas.visualizar`. */
  get podeVerJanelas(): boolean {
    return (
      this.podeOperarPatio &&
      (this.sessionAccess.canAccessRoute(JANELAS_ROUTE) ||
        this.permissions.allows('janelas', 'visualizar'))
    );
  }

  /** PATCH confirmar-entrada — claim `agendamentos.alterar` + operação de pátio. */
  get podeConfirmarEntrada(): boolean {
    return this.podeOperarPatio && this.permissions.allows('agendamentos', 'alterar');
  }

  readonly loadingList = signal(false);
  readonly jaBuscou = signal(false);
  readonly erroList = signal<string | null>(null);
  readonly showForm = signal(false);

  readonly items = signal<AgendamentoSearchItem[]>([]);
  readonly totalCount = signal(0);
  readonly numeroPagina = signal(1);
  readonly tamanhoPagina = signal(20);
  readonly modalidadeUi = signal<AgendamentoModalidadeUi>('estacionamento');
  readonly dataSelecionadaIso = signal(toIsoDateLocal(new Date()));
  readonly timelineSlots = signal<AgendamentoTimelineSlot[]>([]);
  /** Totais do dia (BE) da modalidade ativa — preferidos aos somatórios parciais da lista. */
  readonly kpiJanelasDia = signal<{ disponiveis: number; ocupados: number }>({
    disponiveis: 0,
    ocupados: 0,
  });
  /** Agendados em janelas de limpeza do dia (card "Limpeza agendada"). */
  readonly kpiLimpezaJanelas = signal(0);
  readonly loadingTimeline = signal(false);
  readonly erroTimeline = signal<string | null>(null);

  readonly dataSelecionadaLabel = computed(() => formatIsoDateBr(this.dataSelecionadaIso()));
  /** Lista filtrada (dia + busca + transportadora) — status Agendado no pátio da sessão. */
  readonly kpiAgendados = computed(() => this.totalCount());
  /**
   * Soma de disponíveis das janelas do dia/modalidade (mesma fonte da timeline).
   * Sem janelas → 0. Não usa capacidade de destinação do pátio.
   * Filtro de transportadora do painel (operador) não altera este KPI — capacidade das janelas.
   */
  readonly kpiDisponiveis = computed(() => this.kpiJanelasDia().disponiveis);
  /** Ocupação nas janelas do dia/modalidade (totais BE ou soma dos slots). */
  readonly kpiOcupados = computed(() => this.kpiJanelasDia().ocupados);
  /** Agendamentos de limpeza nas janelas do dia selecionado. */
  readonly kpiLimpeza = computed(() => this.kpiLimpezaJanelas());

  /** Placa, nome do motorista ou CPF. */
  filtroBusca = '';
  filtroDataInicial = '';
  filtroDataFinal = '';
  filtroTransportadoraId: number | null = null;
  filtroTransportadoraNome = '';
  readonly gerandoReciboId = signal<number | null>(null);
  readonly exportando = signal(false);

  constructor() {
    // Recarrega a timeline ao mudar modalidade/data ou quando janelas mudarem (hub/CRUD).
    effect((onCleanup) => {
      const data = this.dataSelecionadaIso();
      const modalidade = this.modalidadeUi();
      this.janelasRealtime.versao();
      onCleanup(() => this.timelineSub?.unsubscribe());
      untracked(() => {
        if (!this.canVisualizar) return;
        this.carregarTimeline(data, modalidade);
      });
    });
  }

  ngOnInit(): void {
    if (!this.canVisualizar) return;

    if (this.auth.needsEstacionamentoSelection()) {
      const msg = 'Selecione o estacionamento da sessão antes de consultar agendamentos.';
      this.erroList.set(msg);
      this.toast.error(msg);
      return;
    }

    if (this.isTransportadora && !this.isAdmin) {
      this.filtroTransportadoraId = this.auth.resolveTransportadoraId();
    }

    this.aplicarDataSelecionadaNoFiltro(this.dataSelecionadaIso(), false);
    this.onBuscar();
  }

  ngOnDestroy(): void {
    this.timelineSub?.unsubscribe();
  }

  onFiltroTransportadoraId(id: number | null): void {
    this.filtroTransportadoraId = id && id > 0 ? id : null;
  }

  onFiltroTransportadoraNome(nome: string): void {
    this.filtroTransportadoraNome = nome || '';
  }

  selecionarModalidade(ui: AgendamentoModalidadeUi): void {
    this.modalidadeUi.set(ui);
  }

  private aplicarDataSelecionadaNoFiltro(iso: string, buscar: boolean): void {
    this.filtroDataInicial = iso;
    this.filtroDataFinal = iso;
    if (buscar) this.onBuscar();
  }

  private carregarTimeline(dataIso: string, ui: AgendamentoModalidadeUi): void {
    const data = (dataIso || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      this.timelineSlots.set([]);
      this.kpiJanelasDia.set({ disponiveis: 0, ocupados: 0 });
      this.kpiLimpezaJanelas.set(0);
      this.erroTimeline.set(null);
      this.loadingTimeline.set(false);
      return;
    }

    // Transportadora autenticada: backend resolve destinacão; passa id da sessão.
    // Filtro de transportadora do operador NÃO entra aqui — KPIs de vagas = janelas do pátio.
    const transportadoraId =
      this.isTransportadora && !this.isAdmin
        ? this.auth.resolveTransportadoraId()
        : null;

    this.loadingTimeline.set(true);
    this.erroTimeline.set(null);
    this.timelineSub?.unsubscribe();

    const modalidadeAtual = modalidadeApi(ui);
    const atual$ = this.janelasApi.disponibilidade(data, modalidadeAtual, transportadoraId);
    // Card "Limpeza agendada" sempre reflete janelas de limpeza do dia.
    const limpeza$ =
      ui === 'limpeza'
        ? of(null)
        : this.janelasApi.disponibilidade(data, 2, transportadoraId).pipe(
            catchError(() => of(null))
          );

    this.timelineSub = forkJoin({ atual: atual$, limpeza: limpeza$ })
      .pipe(finalize(() => this.loadingTimeline.set(false)))
      .subscribe({
        next: ({ atual, limpeza }) => {
          const slots = mapTimelineSlots(atual.slots ?? []);
          this.timelineSlots.set(slots);
          this.kpiJanelasDia.set(
            resolverKpiJanelasDia({
              totalDisponiveis: atual.totalDisponiveis,
              totalOcupadas: atual.totalOcupadas,
              slots,
            })
          );
          if (ui === 'limpeza') {
            this.kpiLimpezaJanelas.set(
              resolverKpiJanelasDia({
                totalDisponiveis: atual.totalDisponiveis,
                totalOcupadas: atual.totalOcupadas,
                slots,
              }).ocupados
            );
          } else if (limpeza) {
            const limpSlots = mapTimelineSlots(limpeza.slots ?? []);
            this.kpiLimpezaJanelas.set(
              resolverKpiJanelasDia({
                totalDisponiveis: limpeza.totalDisponiveis,
                totalOcupadas: limpeza.totalOcupadas,
                slots: limpSlots,
              }).ocupados
            );
          } else {
            this.kpiLimpezaJanelas.set(0);
          }
          this.erroTimeline.set(null);
        },
        error: (err: { message?: string } | unknown) => {
          this.timelineSlots.set([]);
          this.kpiJanelasDia.set({ disponiveis: 0, ocupados: 0 });
          this.kpiLimpezaJanelas.set(0);
          const msg =
            err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
              ? err.message
              : 'Não foi possível carregar as janelas do dia.';
          this.erroTimeline.set(msg);
        },
      });
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalCount() / this.tamanhoPagina()));
  }

  get intervaloLista(): { de: number; ate: number } {
    const total = this.totalCount();
    if (total === 0) return { de: 0, ate: 0 };
    const de = (this.numeroPagina() - 1) * this.tamanhoPagina() + 1;
    const ate = Math.min(this.numeroPagina() * this.tamanhoPagina(), total);
    return { de, ate };
  }

  onBuscar(): void {
    this.numeroPagina.set(1);
    this.carregar();
    // Ocupação das grades e KPIs de janelas acompanham a busca (novo/cancelamento/confirmação).
    this.carregarTimeline(this.dataSelecionadaIso(), this.modalidadeUi());
  }

  exportarPdf(): void {
    this.executarExportacao('pdf');
  }

  exportarExcel(): void {
    this.executarExportacao('excel');
  }

  private executarExportacao(tipo: 'pdf' | 'excel'): void {
    if (!this.canVisualizar || this.exportando()) return;
    if (this.loadingTimeline() || this.loadingList()) {
      this.toast.error('Aguarde o carregamento dos dados da tela antes de exportar.');
      return;
    }

    const entrada = {
      dataLabel: this.dataSelecionadaLabel(),
      modalidadeLabel: this.modalidadeUi() === 'limpeza' ? 'Limpeza' : 'Estacionamento',
      transportadoraNome: this.filtroTransportadoraNome.trim() || null,
      busca: this.filtroBusca.trim() || null,
      kpis: {
        agendados: this.kpiAgendados(),
        disponiveis: this.kpiDisponiveis(),
        ocupados: this.kpiOcupados(),
        limpeza: this.kpiLimpeza(),
      },
      slots: this.timelineSlots(),
      emitidoEm: new Date(),
    };

    this.exportando.set(true);
    try {
      if (tipo === 'pdf') {
        exportarPainelAgendamentosPdf(entrada);
        this.toast.success('Abra a impressão do navegador e salve como PDF.');
      } else {
        exportarPainelAgendamentosExcel(entrada);
        this.toast.success('Excel gerado.');
      }
    } catch {
      this.toast.error(
        tipo === 'pdf' ? 'Não foi possível gerar o PDF.' : 'Não foi possível gerar o Excel.'
      );
    } finally {
      this.exportando.set(false);
    }
  }

  onPeriodoChange(periodo: PeriodoDataSelecionado): void {
    const diaBruto = periodo.ativo
      ? (periodo.dataInicial || periodo.dataFinal || '').trim()
      : toIsoDateLocal(new Date());
    // Contrato da tela: filtro sempre de um único dia (não intervalo).
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaBruto) ? diaBruto : toIsoDateLocal(new Date());
    this.filtroDataInicial = dia;
    this.filtroDataFinal = dia;
    this.dataSelecionadaIso.set(dia);
    this.onBuscar();
  }

  carregar(): void {
    if (!this.canVisualizar) return;

    if (this.auth.needsEstacionamentoSelection()) {
      const msg = 'Selecione o estacionamento da sessão antes de consultar agendamentos.';
      this.erroList.set(msg);
      this.toast.error(msg);
      this.items.set([]);
      this.totalCount.set(0);
      this.jaBuscou.set(true);
      return;
    }

    this.loadingList.set(true);
    this.erroList.set(null);
    this.jaBuscou.set(true);

    this.api
      .buscar({
        busca: this.filtroBusca.trim() || undefined,
        dataInicial: this.filtroDataInicial || this.filtroDataFinal || undefined,
        dataFinal: this.filtroDataFinal || this.filtroDataInicial || undefined,
        transportadoraId: this.podeOperarPatio ? this.filtroTransportadoraId ?? undefined : undefined,
        numeroPagina: this.numeroPagina(),
        tamanhoPagina: this.tamanhoPagina(),
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.items);
          this.totalCount.set(res.totalCount);
          this.loadingList.set(false);
        },
        error: (err: { message?: string } | unknown) => {
          this.loadingList.set(false);
          this.items.set([]);
          this.totalCount.set(0);
          const msg =
            err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
              ? err.message
              : 'Não foi possível carregar os agendamentos.';
          this.erroList.set(msg);
          this.toast.error(msg);
        },
      });
  }

  abrirDestinarVagas(): void {
    if (!this.podeOperarPatio) return;
    this.dialog
      .open(VagaReservaDialogComponent, {
        width: 'min(960px, 96vw)',
        maxWidth: '96vw',
        autoFocus: false,
        panelClass: 'vaga-reserva-dialog-panel',
        data: {
          podeGerenciar:
            this.podeCriar || this.permissions.allows('agendamentos', 'alterar'),
        } satisfies VagaReservaDialogData,
      })
      .afterClosed()
      .subscribe(() => this.onBuscar());
  }

  abrirNovo(): void {
    if (!this.podeCriar) {
      this.toast.error('Sem permissão para criar agendamento (agendamentos.gravar).');
      return;
    }
    this.showForm.set(true);
  }

  fecharForm(): void {
    this.showForm.set(false);
  }

  onNovoSalvo(): void {
    this.showForm.set(false);
    this.onBuscar();
  }

  podeConfirmarItem(item: AgendamentoSearchItem): boolean {
    return this.podeConfirmarEntrada && this.isStatusAgendado(item);
  }

  podeCancelarItem(item: AgendamentoSearchItem): boolean {
    return this.podeCancelar && this.isStatusAgendado(item);
  }

  temAcoes(item: AgendamentoSearchItem): boolean {
    return this.podeConfirmarItem(item) || this.podeCancelarItem(item) || this.canVisualizar;
  }

  emitirRecibo(item: AgendamentoSearchItem): void {
    if (!this.canVisualizar || !item?.id) return;
    if (this.gerandoReciboId() === item.id) return;

    const session = this.auth.getSessionEstacionamento();
    const estId = this.auth.resolveEstacionamentoId();
    const base = {
      id: item.id,
      placa: item.placaVeiculo,
      dataHoraAgendada: item.dataHoraEntrada,
      motoristaNome: item.nomeMotorista || '—',
      motoristaCpf: item.cpfMotorista || '',
      transportadoraNome: item.nomeTransportadora || null,
      observacao: item.observacao || null,
      estacionamentoNome:
        session?.nome?.trim() ||
        session?.razaoSocial?.trim() ||
        'Estacionamento',
      estacionamentoCnpj: session?.cnpj || null,
      enderecoLinha1: null as string | null,
      enderecoLinha2: null as string | null,
    };

    this.gerandoReciboId.set(item.id);
    const loadEndereco$ =
      estId && estId > 0
        ? this.estacionamentoService.obterPorId(estId, session?.codExportacao).pipe(
            map((det) => {
              if (!det) return base;
              const end = det.enderecos?.[0] as
                | {
                    logradouro?: string;
                    numero?: string;
                    bairro?: string;
                    cidade?: string;
                    estado?: string;
                    uf?: string;
                    cep?: string;
                  }
                | undefined;
              const linha1 = end
                ? [end.logradouro, end.numero].filter(Boolean).join(', ')
                : '';
              const linha2 = end
                ? [end.bairro, end.cidade, end.estado || end.uf, end.cep]
                    .filter(Boolean)
                    .join(' - ')
                : '';
              return {
                ...base,
                estacionamentoNome:
                  det.pessoa?.nomeFantasia?.trim() ||
                  det.pessoa?.nomeRazaoSocial?.trim() ||
                  det.descricao?.trim() ||
                  base.estacionamentoNome,
                estacionamentoCnpj: det.pessoa?.cnpj || base.estacionamentoCnpj,
                enderecoLinha1: linha1 || null,
                enderecoLinha2: linha2 || null,
              };
            }),
            catchError(() => of(base))
          )
        : of(base);

    loadEndereco$.pipe(finalize(() => this.gerandoReciboId.set(null))).subscribe({
      next: (dados) => {
        try {
          baixarPdfReciboAgendamento(dados);
          this.toast.success('Recibo gerado.');
        } catch {
          this.toast.error('Não foi possível gerar o recibo PDF.');
        }
      },
      error: () => this.toast.error('Não foi possível gerar o recibo PDF.'),
    });
  }

  confirmarEntrada(item: AgendamentoSearchItem): void {
    if (!this.podeConfirmarItem(item)) return;
    if (!item.id || item.id <= 0) {
      this.toast.error('Agendamento sem id válido para confirmar a entrada.');
      return;
    }
    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      width: '420px',
      maxWidth: '96vw',
      autoFocus: 'dialog',
      panelClass: 'cad-confirm-dialog-panel',
      data: {
        titulo: 'Confirmar entrada',
        mensagem: `Confirmar entrada do veículo ${this.formatPlaca(item.placaVeiculo)} no pátio?`,
        confirmLabel: 'Confirmar entrada',
        confirmColor: 'primary',
      } satisfies CadastroConfirmDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.confirmarEntrada(item.id).subscribe({
        next: (res) => {
          if (!res.success) {
            if (!res.toastShown) {
              this.toast.error(res.message || 'Não foi possível confirmar a entrada.');
            }
            this.onBuscar();
            return;
          }
          this.toast.success(res.message || 'Entrada confirmada.');
          this.onBuscar();
        },
        error: () => this.toast.error('Não foi possível confirmar a entrada.'),
      });
    });
  }

  cancelar(item: AgendamentoSearchItem): void {
    if (!this.podeCancelarItem(item)) return;
    if (!item.id || item.id <= 0) {
      this.toast.error('Agendamento sem id válido para cancelar.');
      return;
    }
    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      width: '420px',
      maxWidth: '96vw',
      autoFocus: 'dialog',
      panelClass: 'cad-confirm-dialog-panel',
      data: {
        titulo: 'Cancelar agendamento',
        mensagem: `Cancelar o agendamento de ${this.formatPlaca(item.placaVeiculo)}?`,
        confirmLabel: 'Cancelar agendamento',
        confirmColor: 'warn',
      } satisfies CadastroConfirmDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.cancelar(item.id).subscribe({
        next: (res) => {
          if (!res.success) {
            if (!res.toastShown) {
              this.toast.error(res.message || 'Não foi possível cancelar.');
            }
            this.onBuscar();
            return;
          }
          this.toast.success(res.message || 'Agendamento cancelado.');
          this.onBuscar();
        },
        error: () => this.toast.error('Não foi possível cancelar.'),
      });
    });
  }

  irParaPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.numeroPagina.set(p);
    this.carregar();
  }

  statusLabel(value: AgendamentoSearchItem['status']): string {
    return entradaSaidaStatusLabel(value) || '—';
  }

  formatPlaca(placa: string | null | undefined): string {
    return formatPlacaDisplay(placa) || placa || '—';
  }

  formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR');
  }

  private isStatusAgendado(item: AgendamentoSearchItem): boolean {
    return parseEntradaSaidaStatus(item.status) === EntradaSaidaStatus.Agendado;
  }

}
