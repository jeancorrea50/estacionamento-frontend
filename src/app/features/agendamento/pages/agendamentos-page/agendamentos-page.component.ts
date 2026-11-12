import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { TransportadoraService } from '../../../cadastro/services/transportadora.service';
import { VeiculoService } from '../../../cadastro/services/veiculo.service';
import { EstacionamentoService } from '../../../cadastro/services/estacionamento.service';
import { TransportadoraListItemDTO } from '../../../cadastro/models/transportadora.dto';
import { VeiculoListItemDTO } from '../../../cadastro/models/veiculo.dto';
import { formatPlacaDisplay, normalizePlaca, placaCompleta } from '../../../cadastro/utils/placa-br';
import { EstSummaryMetricComponent } from '../../../cadastro/components/est-summary-metric/est-summary-metric.component';
import {
  CadastroConfirmDialogComponent,
  CadastroConfirmDialogData,
} from '../../../cadastro/components/cadastro-confirm-dialog/cadastro-confirm-dialog.component';
import { AGENDAMENTO_ROUTE } from '../../agendamento-rotas';
import { AgendamentoService } from '../../services/agendamento.service';
import { PortariaAlertasStore } from '../../../movimentos/services/portaria-alertas.store';
import {
  AgendamentoPostInput,
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
import { AgendamentoDataHoraPickerComponent } from './agendamento-data-hora-picker/agendamento-data-hora-picker.component';
import { datetimeLocalInputToApiIso, toDateTimeLocalInputValue } from '../../../../shared/utils/local-iso-datetime';
import {
  VagaReservaDialogComponent,
  type VagaReservaDialogData,
} from '../../components/vaga-reserva-dialog/vaga-reserva-dialog.component';

@Component({
  selector: 'app-agendamentos-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    EstSummaryMetricComponent,
    PeriodoDataPickerComponent,
    AgendamentoDataHoraPickerComponent,
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
  private readonly portariaAlertas = inject(PortariaAlertasStore);
  private readonly transportadoraService = inject(TransportadoraService);
  private readonly veiculoService = inject(VeiculoService);
  private readonly estacionamentoService = inject(EstacionamentoService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly isAdmin = this.auth.isAdmin();
  readonly isTransportadora = this.auth.isTransportadoraRole();

  get canVisualizar(): boolean {
    return (
      this.sessionAccess.canAccessRoute(this.router.url) ||
      this.sessionAccess.canAccessRoute(AGENDAMENTO_ROUTE)
    );
  }

  /** POST /Agendamento — claim `agendamento.gravar` (Visualizar sozinho não cria). */
  get podeCriar(): boolean {
    return this.canVisualizar && this.permissions.allows('agendamento', 'gravar');
  }

  /** PATCH cancelar — claim `agendamentos.alterar` (API) / alias singular. */
  get podeCancelar(): boolean {
    return (
      this.canVisualizar &&
      (this.permissions.allows('agendamento', 'alterar') ||
        this.permissions.allows('agendamento', 'excluir'))
    );
  }

  get podeOperarPatio(): boolean {
    return this.canVisualizar && !this.isTransportadora;
  }

  /** PATCH confirmar-entrada — claim `agendamento.alterar` + operação de pátio. */
  get podeConfirmarEntrada(): boolean {
    return this.podeOperarPatio && this.permissions.allows('agendamento', 'alterar');
  }

  readonly loadingList = signal(false);
  readonly jaBuscou = signal(false);
  readonly erroList = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly showForm = signal(false);
  readonly loadingFrota = signal(false);
  readonly frotaVeiculos = signal<VeiculoListItemDTO[]>([]);
  readonly placasSelecionadasIds = signal<number[]>([]);
  /** Busca local na lista de placas do modal. */
  readonly filtroPlacaFrota = signal('');
  readonly placasDropdownAberto = signal(false);
  /** Transportadora do modal (signal para UI zoneless). */
  readonly transportadoraFormId = signal<number | null>(null);

  readonly frotaVeiculosFiltrados = computed(() => {
    const termo = normalizePlaca(this.filtroPlacaFrota());
    const lista = this.frotaVeiculos();
    if (!termo) return lista;
    return lista.filter((v) => normalizePlaca(v.placa).includes(termo));
  });

  readonly items = signal<AgendamentoSearchItem[]>([]);
  readonly totalCount = signal(0);
  readonly numeroPagina = signal(1);
  readonly tamanhoPagina = signal(20);
  readonly transportadoras = signal<TransportadoraListItemDTO[]>([]);

  /** Placa, nome do motorista ou CPF. */
  filtroBusca = '';
  filtroDataInicial = '';
  filtroDataFinal = '';
  filtroTransportadoraId: number | null = null;
  readonly gerandoReciboId = signal<number | null>(null);

  form = this.fb.group({
    dataAgendamento: ['', Validators.required],
    transportadoraId: [null as number | null],
    observacao: [''],
  });

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

    if (this.podeOperarPatio) {
      this.carregarTransportadoras();
    }

    this.onBuscar();
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
  }

  onPeriodoChange(periodo: PeriodoDataSelecionado): void {
    this.filtroDataInicial = periodo.ativo ? periodo.dataInicial : '';
    this.filtroDataFinal = periodo.ativo ? periodo.dataFinal : '';
  }

  onDataHoraChange(value: string): void {
    this.form.controls.dataAgendamento.setValue(value);
    this.form.controls.dataAgendamento.markAsDirty();
  }

  onTransportadoraFormChange(): void {
    const tid = Number(this.form.controls.transportadoraId.value);
    this.transportadoraFormId.set(Number.isFinite(tid) && tid > 0 ? tid : null);
    this.placasSelecionadasIds.set([]);
    this.filtroPlacaFrota.set('');
    this.placasDropdownAberto.set(false);
    this.carregarFrota();
  }

  onFiltroPlacaFrotaChange(valor: string): void {
    this.filtroPlacaFrota.set(valor ?? '');
  }

  togglePlacasDropdown(event?: MouseEvent): void {
    event?.stopPropagation();
    if (!this.transportadoraFormId() || this.frotaVeiculos().length === 0) return;
    this.placasDropdownAberto.update((v) => !v);
    if (this.placasDropdownAberto()) {
      this.filtroPlacaFrota.set('');
      // Garante que a lista abaixo do campo fique visível (rola o body do modal).
      queueMicrotask(() => {
        const panel = document.querySelector('.ag-placa-combo__panel');
        panel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  }

  @HostListener('document:click')
  fecharPlacasDropdown(): void {
    if (this.placasDropdownAberto()) {
      this.placasDropdownAberto.set(false);
    }
  }

  labelPlacasSelecionadas(): string {
    const ids = this.placasSelecionadasIds();
    if (!ids.length) return 'Selecione as placas';
    if (ids.length === 1) {
      const unico = this.frotaVeiculos().find((v) => v.id === ids[0]);
      return unico ? this.formatPlaca(unico.placa) : '1 placa selecionada';
    }
    return `${ids.length} placas selecionadas`;
  }

  placaSelecionada(veiculoId: number): boolean {
    return this.placasSelecionadasIds().includes(veiculoId);
  }

  togglePlaca(veiculoId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.aplicarSelecaoPlaca(veiculoId, checked);
  }

  private aplicarSelecaoPlaca(veiculoId: number, checked: boolean): void {
    this.placasSelecionadasIds.update((ids) => {
      if (checked) {
        return ids.includes(veiculoId) ? ids : [...ids, veiculoId];
      }
      return ids.filter((id) => id !== veiculoId);
    });
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
    this.dialog.open(VagaReservaDialogComponent, {
      width: 'min(960px, 96vw)',
      maxWidth: '96vw',
      autoFocus: false,
      panelClass: 'vaga-reserva-dialog-panel',
      data: {
        transportadoras: this.transportadoras(),
        podeGerenciar:
          this.podeCriar || this.permissions.allows('agendamento', 'alterar'),
      } satisfies VagaReservaDialogData,
    });
  }

  abrirNovo(): void {
    if (!this.podeCriar) return;
    const tid =
      this.isTransportadora && !this.isAdmin ? this.auth.resolveTransportadoraId() : null;
    this.form.reset({
      dataAgendamento: toDateTimeLocalInputValue(),
      transportadoraId: tid,
      observacao: '',
    });
    this.transportadoraFormId.set(tid && tid > 0 ? tid : null);
    this.placasSelecionadasIds.set([]);
    this.filtroPlacaFrota.set('');
    this.placasDropdownAberto.set(false);
    this.frotaVeiculos.set([]);
    this.showForm.set(true);
    this.carregarFrota();
  }

  fecharForm(): void {
    this.placasDropdownAberto.set(false);
    this.showForm.set(false);
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

  salvar(): void {
    if (!this.podeCriar) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Informe a data/hora do agendamento.');
      return;
    }

    const tid =
      this.isTransportadora && !this.isAdmin
        ? this.auth.resolveTransportadoraId()
        : Number(this.form.controls.transportadoraId.value) || null;

    if (!tid) {
      this.toast.error('Selecione a transportadora.');
      return;
    }

    const selecionados = this.frotaVeiculos().filter((v) =>
      this.placasSelecionadasIds().includes(v.id)
    );
    if (!selecionados.length) {
      this.toast.error('Selecione ao menos uma placa cadastrada.');
      return;
    }

    const dataAgendamento = datetimeLocalInputToApiIso(
      String(this.form.controls.dataAgendamento.value ?? '')
    );
    if (!dataAgendamento) {
      this.toast.error('Data/hora inválida.');
      return;
    }

    const observacao = (this.form.controls.observacao.value ?? '').trim() || null;

    this.salvando.set(true);
    forkJoin(
      selecionados.map((veiculo) =>
        this.resolverPayloadPlaca(veiculo, tid, dataAgendamento, observacao).pipe(
          switchMap((payload) => {
            if (!payload) {
              return of({
                success: false as const,
                placa: veiculo.placa,
                message: 'Veículo sem motorista vinculado ou placa inválida.',
              });
            }
            return this.api.gravar(payload).pipe(
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
      )
    )
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: (results) => {
          const ok = results.filter((r) => r.success);
          const falhas = results.filter((r) => !r.success);

          if (ok.length) {
            const transportadoraLabel =
              this.transportadoras().find((t) => t.id === tid)?.razaoSocial?.trim() ||
              this.transportadoras().find((t) => t.id === tid)?.nomeFantasia?.trim() ||
              '—';
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
              ok.length === 1
                ? 'Agendamento criado.'
                : `${ok.length} agendamentos criados.`
            );
            this.fecharForm();
            this.carregar();
            return;
          }

          if (ok.length && falhas.length) {
            this.toast.error(
              `${ok.length} criados, ${falhas.length} falharam (${falhas
                .map((f) => formatPlacaDisplay(f.placa) || f.placa)
                .join(', ')}).`
            );
            this.carregar();
            return;
          }

          this.toast.error(falhas[0]?.message || 'Não foi possível criar o agendamento.');
        },
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
          this.carregar();
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
          this.carregar();
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

  private resolverPayloadPlaca(
    veiculo: VeiculoListItemDTO,
    transportadoraId: number,
    dataAgendamento: string,
    observacao: string | null
  ) {
    const placa = normalizePlaca(veiculo.placa);
    if (!placaCompleta(placa)) {
      return of(null);
    }

    const motoristaLista =
      veiculo.motoristas?.find((m) => m.principal) || veiculo.motoristas?.[0] || null;

    return this.api.obterPorPlaca(placa).pipe(
      map((agg) => {
        const motoristaId = agg?.motoristaId && agg.motoristaId > 0 ? agg.motoristaId : motoristaLista?.id;
        if (!motoristaId || motoristaId <= 0) return null;

        if (
          this.isTransportadora &&
          !this.isAdmin &&
          agg?.transportadoraId &&
          agg.transportadoraId !== transportadoraId
        ) {
          return null;
        }

        const payload: AgendamentoPostInput = {
          dataAgendamento,
          observacao,
          transportadoraId,
          motorista: {
            id: motoristaId,
            cpf: agg?.motoristaCpf || motoristaLista?.cpf || null,
            nome: agg?.motoristaNome || motoristaLista?.nome || null,
          },
          veiculo: {
            id: agg?.veiculoId || veiculo.id,
            placa,
          },
        };
        return payload;
      }),
      catchError(() => {
        if (!motoristaLista?.id) return of(null);
        const payload: AgendamentoPostInput = {
          dataAgendamento,
          observacao,
          transportadoraId,
          motorista: {
            id: motoristaLista.id,
            cpf: motoristaLista.cpf || null,
            nome: motoristaLista.nome || null,
          },
          veiculo: { id: veiculo.id, placa },
        };
        return of(payload);
      })
    );
  }

  private carregarFrota(): void {
    const tid = this.transportadoraFormId();
    if (!tid) {
      this.frotaVeiculos.set([]);
      return;
    }

    this.loadingFrota.set(true);
    this.veiculoService
      .buscar({
        TransportadoraId: tid,
        NumeroPagina: 1,
        TamanhoPagina: 200,
      })
      .pipe(finalize(() => this.loadingFrota.set(false)))
      .subscribe({
        next: (res) => {
          const ativos = (res.items ?? []).filter((v) => v.ativo !== false);
          this.frotaVeiculos.set(this.dedupeVeiculosPorPlaca(ativos));
        },
        error: () => {
          this.frotaVeiculos.set([]);
          this.toast.error('Não foi possível carregar as placas da transportadora.');
        },
      });
  }

  /** Remove veículos com a mesma placa (mantém o primeiro). */
  private dedupeVeiculosPorPlaca(lista: VeiculoListItemDTO[]): VeiculoListItemDTO[] {
    const vistos = new Set<string>();
    const unicos: VeiculoListItemDTO[] = [];
    for (const item of lista) {
      const chave = normalizePlaca(item.placa);
      if (!chave || vistos.has(chave)) continue;
      vistos.add(chave);
      unicos.push(item);
    }
    return unicos;
  }

  private isStatusAgendado(item: AgendamentoSearchItem): boolean {
    return parseEntradaSaidaStatus(item.status) === EntradaSaidaStatus.Agendado;
  }

  private carregarTransportadoras(): void {
    this.transportadoraService.buscar({ NumeroPagina: 1, TamanhoPagina: 200 }).subscribe({
      next: (res) => {
        this.transportadoras.set(res.items ?? []);
      },
      error: () => {
        this.transportadoras.set([]);
      },
    });
  }
}
