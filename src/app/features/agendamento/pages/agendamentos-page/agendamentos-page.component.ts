import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { of } from 'rxjs';
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
import { AGENDAMENTO_ROUTE } from '../../agendamento-rotas';
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
import { VagaDisponibilidadeService } from '../../services/vaga-disponibilidade.service';
import type { VagaDisponibilidadeResumo } from '../../models/vaga-disponibilidade.models';
import {
  capacidadeDaModalidade,
  disponiveisDaModalidade,
  formatIsoDateBr,
  montarCalendarioMes,
  montarFaixasHorarias,
  nomeMesAno,
  parseIsoDateLocal,
  reservadasDaModalidade,
  toIsoDateLocal,
  type AgendamentoModalidadeUi,
} from './agendamento-dashboard.util';

@Component({
  selector: 'app-agendamentos-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    EstSummaryMetricComponent,
    PeriodoDataPickerComponent,
    AgendamentoNovoModalComponent,
    TransportadoraLookupFieldComponent,
  ],
  templateUrl: './agendamentos-page.component.html',
  styleUrls: ['./agendamentos-page.component.scss'],
})
export class AgendamentosPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly permissions = inject(PermissionCacheService);
  private readonly router = inject(Router);
  private readonly api = inject(AgendamentoService);
  private readonly estacionamentoService = inject(EstacionamentoService);
  private readonly vagasApi = inject(VagaDisponibilidadeService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly isAdmin = this.auth.isAdmin();
  readonly isTransportadora = this.auth.isTransportadoraRole();

  get canVisualizar(): boolean {
    return (
      this.sessionAccess.canAccessRoute(this.router.url) ||
      this.sessionAccess.canAccessRoute(AGENDAMENTO_ROUTE) ||
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
  readonly vagasResumo = signal<VagaDisponibilidadeResumo | null>(null);
  readonly modalidadeUi = signal<AgendamentoModalidadeUi>('estacionamento');
  readonly dataSelecionadaIso = signal(toIsoDateLocal(new Date()));
  readonly mesCalendario = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  readonly calendarioDias = computed(() =>
    montarCalendarioMes(this.mesCalendario(), this.dataSelecionadaIso())
  );
  readonly mesCalendarioLabel = computed(() => nomeMesAno(this.mesCalendario()));
  readonly dataSelecionadaLabel = computed(() => formatIsoDateBr(this.dataSelecionadaIso()));
  readonly faixasHorarias = computed(() =>
    montarFaixasHorarias({
      isoData: this.dataSelecionadaIso(),
      ui: this.modalidadeUi(),
      resumo: this.vagasResumo(),
      items: this.items(),
    })
  );
  readonly kpiAgendados = computed(() => this.totalCount());
  readonly kpiDisponiveis = computed(() =>
    disponiveisDaModalidade(this.vagasResumo(), this.modalidadeUi())
  );
  readonly kpiOcupados = computed(() => {
    const cap = capacidadeDaModalidade(this.vagasResumo(), this.modalidadeUi());
    const disp = this.kpiDisponiveis();
    return Math.max(0, cap - disp);
  });
  readonly kpiLimpeza = computed(() => reservadasDaModalidade(this.vagasResumo(), 'limpeza'));

  /** Placa, nome do motorista ou CPF. */
  filtroBusca = '';
  filtroDataInicial = '';
  filtroDataFinal = '';
  filtroTransportadoraId: number | null = null;
  filtroTransportadoraNome = '';
  readonly gerandoReciboId = signal<number | null>(null);

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

  onFiltroTransportadoraId(id: number | null): void {
    this.filtroTransportadoraId = id && id > 0 ? id : null;
  }

  onFiltroTransportadoraNome(nome: string): void {
    this.filtroTransportadoraNome = nome || '';
  }

  selecionarModalidade(ui: AgendamentoModalidadeUi): void {
    this.modalidadeUi.set(ui);
  }

  selecionarDiaCalendario(iso: string): void {
    if (!iso) return;
    this.dataSelecionadaIso.set(iso);
    const d = parseIsoDateLocal(iso);
    this.mesCalendario.set(new Date(d.getFullYear(), d.getMonth(), 1));
    this.aplicarDataSelecionadaNoFiltro(iso, true);
  }

  mesAnterior(): void {
    const base = this.mesCalendario();
    this.mesCalendario.set(new Date(base.getFullYear(), base.getMonth() - 1, 1));
  }

  mesSeguinte(): void {
    const base = this.mesCalendario();
    this.mesCalendario.set(new Date(base.getFullYear(), base.getMonth() + 1, 1));
  }

  private aplicarDataSelecionadaNoFiltro(iso: string, buscar: boolean): void {
    this.filtroDataInicial = iso;
    this.filtroDataFinal = iso;
    if (buscar) this.onBuscar();
  }

  private dataDashboardIso(): string {
    const filtro = (this.filtroDataInicial || this.filtroDataFinal || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(filtro)) return filtro;
    return this.dataSelecionadaIso();
  }

  private carregarVagas(dataIso?: string | null): void {
    const data = (dataIso ?? this.dataDashboardIso()).trim();
    this.vagasApi.resumoParaTransportadora(data).subscribe({
      next: (r) => this.vagasResumo.set(r),
      error: () => this.vagasResumo.set(null),
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
    this.carregarVagas();
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
    const d = parseIsoDateLocal(dia);
    this.mesCalendario.set(new Date(d.getFullYear(), d.getMonth(), 1));
    this.onBuscar();
  }

  flexBar(value: number): number {
    return Math.max(0, Number(value) || 0);
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
      .subscribe(() => this.carregarVagas());
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
            this.toast.error(res.message || 'Não foi possível confirmar a entrada.');
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
            this.toast.error(res.message || 'Não foi possível cancelar.');
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
