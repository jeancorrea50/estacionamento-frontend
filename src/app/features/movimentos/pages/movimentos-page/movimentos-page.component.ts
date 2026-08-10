import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { EntradaSaidaService } from '../../entrada-saida/entrada-saida.service';
import {
  EntradaSaidaFiltro,
  EntradaSaidaOutput,
  EntradaSaidaPagedResult,
  EntradaSaidaPermanenciaInput,
  EntradaSaidaSearchOutput,
  EntradaSaidaStatus,
  entradaSaidaStatusLabel,
  ModoRecibo,
  parseEntradaSaidaStatus,
  TipoTarifaEstacionamento
} from '../../models/entrada-saida.models';
import { ToastService } from '../../../../core/api/services/toast.service';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { ApiError } from '../../../../core/api/models';
import { CameraPreviewComponent } from '../../components/camera-preview/camera-preview.component';
import {
  TelefoneFormatDirective,
  formatTelefone
} from '../../../cadastro/directives/telefone-format.directive';
import { TransportadoraService } from '../../../cadastro/services/transportadora.service';
import { MotoristaService } from '../../../cadastro/services/motorista.service';
import { formatPlacaDisplay, normalizePlaca, placaCompleta } from '../../../cadastro/utils/placa-br';
import { Subject, forkJoin, map, of, throwError } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { EntradaSaidaPostInput } from '../../models/entrada-saida.models';
import { SignalrDashboardService } from '../../../../core/services/signalr-dashboard.service';
import { MovimentacaoAtualizadaItem } from '../../../../core/models/dashboard.models';
import {
  datetimeLocalInputToApiIso,
  toDateTimeLocalInputValue,
  toLocalIsoDateTime
} from '../../../../shared/utils/local-iso-datetime';
import { mapBuscarPorPlacaParaRegistroRapido } from '../../mappers/entrada-saida-buscar-por-placa.mapper';
import {
  mapearTipoCargaParaEnum as toTipoCargaEnum,
  TIPO_CARGA_LABELS
} from '../../../../shared/models/tipo-carga';
import {
  formatarBrl,
  parseBrl
} from '../../../financeiro/pages/faturamento-page/config-cobranca/config-cobranca-moeda.util';
import {
  calcularQuantidadeUnidades,
  calcularTotalDiarias
} from '../../utils/calcular-diarias';

type PermanenciaAcao = 'suspender' | 'retornar' | 'finalizar';
type StatusMonitoramento = 'entrada' | 'saida' | 'aberto';

/** Item do hub `movimentacaoAtualizada` já normalizado para a UI. */
interface MovimentacaoTempoRealVm {
  /** Guid do hub (ou fallback estável por índice). */
  id: string;
  horario: string;
  /** Epoch ms para ordenação (mais recente primeiro). */
  horarioSortMs: number;
  placa: string;
  motorista: string;
  transportadora: string;
  status: StatusMonitoramento;
  statusLabel: string;
  dataHoraEntrada: string;
  dataHoraSaida: string | null;
}

interface MonitoramentoItemVm {
  id: string;
  horario: string;
  placa: string;
  motorista: string;
  transportadora: string;
  status: StatusMonitoramento;
}

interface AlertaItemVm {
  id: string;
  titulo: string;
  descricao: string;
  tempoRelativo: string;
}

@Component({
  selector: 'app-movimentos-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CameraPreviewComponent, TelefoneFormatDirective],
  templateUrl: './movimentos-page.component.html',
  styleUrls: ['./movimentos-page.component.scss']
})
export class MovimentosPageComponent implements OnInit, OnDestroy {
  private readonly service = inject(EntradaSaidaService);
  private readonly signalrDashboardService = inject(SignalrDashboardService);
  private readonly transportadoraService = inject(TransportadoraService);
  private readonly motoristaService = inject(MotoristaService);
  private readonly toast = inject(ToastService);
  private readonly permissionCache = inject(PermissionCacheService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  readonly canVisualizar = this.permissionCache.has('entradasaida.visualizar') || this.permissionCache.hasAny(['*']);
  readonly canGravar = this.permissionCache.has('entradasaida.gravar') || this.permissionCache.hasAny(['*']);
  readonly canAlterar = this.permissionCache.has('entradasaida.alterar') || this.permissionCache.hasAny(['*']);
  readonly canExcluir = this.permissionCache.has('entradasaida.excluir') || this.permissionCache.hasAny(['*']);

  /** Limite para textos livres no registro rápido (nome, razão social, observação etc.). */
  readonly registroRapidoMaxTexto = 100;
  /** Limite visual para telefone com máscara BR `(00) 00000-0000` (15 caracteres). */
  readonly registroRapidoMaxTelefone = 15;

  /** KPIs e monitoramento reativos ao hub (zoneless). */
  private readonly dashboardTempoReal = this.signalrDashboardService.dashboardAtualizado;
  /** Lista do socket `movimentacaoAtualizada`, mais recente primeiro (sem mock). */
  private readonly movimentacoesTempoReal = computed(() =>
    this.signalrDashboardService
      .movimentacoes()
      .map((item, index) => this.mapMovimentacaoHubParaVm(item, index))
      .filter((item): item is MovimentacaoTempoRealVm => item != null)
      .sort((a, b) => b.horarioSortMs - a.horarioSortMs)
  );

  filtro = { descricao: '', somenteEmAberto: true };

  /** Histórico via HTTP `/EntradaSaida` — signals para UI zoneless atualizar ao clicar Buscar. */
  readonly registros = signal<EntradaSaidaSearchOutput[]>([]);
  readonly numeroPagina = signal(1);
  readonly tamanhoPagina = signal(20);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.totalCount() / this.tamanhoPagina()))
  );

  permanenciaOpen = signal(false);
  permanenciaAcao: PermanenciaAcao = 'suspender';
  registroSelecionado = signal<EntradaSaidaOutput | null>(null);
  permanenciaDataHora = '';
  /** Valor unitário (hora ou diária — config ou digitado). */
  saidaValorDiaria = signal<number | null>(null);
  /** Valor unitário formatado pt-BR. */
  saidaValorDiariaTexto = signal('');
  /** Quantidade de unidades cobradas (horas ou diárias). */
  saidaQuantidadeDiarias = signal(1);
  /** Tipo de tarifa da cobrança: 1=Hora, 2=Diaria. */
  saidaTipoTarifa = signal<TipoTarifaEstacionamento | null>(null);
  /** Tipo de cobrança exibido (Avulso | Faturado). */
  saidaTipoCobranca = signal('Avulso');
  /** Total do recibo = unitário × quantidade. */
  saidaValor = signal<number | null>(null);
  saidaValorBloqueado = signal(false);
  saidaValorLoading = signal(false);
  saidaProcessando = signal(false);
  /** Quando true, total veio de FaturaItem e não deve ser recalculado pela data. */
  private saidaValorFixoDaFatura = false;

  readonly saidaLabelValorUnitario = computed(() =>
    this.saidaTipoTarifa() === 1 ? 'Valor da hora' : 'Valor da diária'
  );
  readonly saidaLabelQuantidade = computed(() =>
    this.saidaTipoTarifa() === 1 ? 'Quantidade de horas' : 'Quantidade de diárias'
  );
  readonly saidaLabelTipoTarifa = computed(() => {
    const tipo = this.saidaTipoTarifa();
    if (tipo === 1) return 'Por hora';
    if (tipo === 2) return 'Por diária';
    return null;
  });
  readonly saidaHintCobranca = computed(() => {
    const unidade = this.saidaTipoTarifa() === 1 ? 'hora' : 'diária';
    const plural = this.saidaTipoTarifa() === 1 ? 'horas' : 'dias';
    if (this.saidaValorBloqueado()) {
      return `Tarifa por ${unidade} definida pela configuração. O total é ${unidade} × ${plural} desde a entrada.`;
    }
    return `Informe o valor da ${unidade}. O total (${unidade} × ${plural}) será enviado no recibo.`;
  });
  /** Pré-visualização do recibo PDF (object URL sanitizado). */
  readonly reciboPreviewOpen = signal(false);
  readonly reciboPreviewUrl = signal<SafeResourceUrl | null>(null);
  readonly reciboPreviewFileName = signal('recibo.pdf');
  private reciboPreviewBlob: Blob | null = null;
  private reciboPreviewObjectUrl: string | null = null;
  /** Confirmação "imprimir recibo?" centralizada na tabela de histórico. */
  readonly reciboConfirmOpen = signal(false);
  readonly reciboConfirmMensagem = signal('Deseja visualizar o recibo agora?');
  private reciboConfirmResolver: ((aceitar: boolean) => void) | null = null;
  /** Id do movimento com download de recibo em andamento. */
  readonly reciboBaixandoId = signal<number | null>(null);
  /** Id/transportadora do movimento em aberto no registro rápido (para recibo). */
  private registroRapidoEntradaId = 0;
  private registroRapidoTransportadoraId = 0;
  processandoRegistroRapido = signal(false);
  buscandoPlacaRegistroRapido = false;
  camposBloqueadosPorPlaca = false;
  existeEntradaEmAbertoPorPlaca = false;
  buscandoMotoristaPorCpf = false;
  motoristaAutoPreenchidoPorCpf = false;
  buscandoTransportadoraPorCnpj = false;
  transportadoraAutoPreenchidaPorCnpj = false;
  private ultimaConsultaCpfRegistroRapido = '';
  private consultaCpfSequencia = 0;
  private ultimaConsultaCnpjRegistroRapido = '';
  private consultaCnpjSequencia = 0;
  private ultimaPlacaConsultadaRegistroRapido = '';
  /** Cancela GET valor-estacionamento ao fechar/reabrir o modal (evita corrida). */
  private readonly cancelarValorEstacionamento$ = new Subject<void>();
  registroRapido = {
    placa: '',
    motorista: '',
    motoristaCpf: '',
    transportadoraRazaoSocial: '',
    transportadoraCnpj: '',
    transportadoraResponsavelNome: '',
    transportadoraResponsavelTelefone: '',
    tipoCarga: '',
    dataAgendamento: '',
    observacao: ''
  };

  /** Opções do enum `TipoCarga` do backend (Seca, Refrigerada, …). */
  readonly tipoCargaOpcoes = TIPO_CARGA_LABELS;

  ngOnInit(): void {
    if (!this.canVisualizar) return;
    void this.signalrDashboardService.connect();
  }

  ngOnDestroy(): void {
    this.cancelarValorEstacionamento$.next();
    this.cancelarValorEstacionamento$.complete();
    this.fecharReciboConfirm(false);
    this.fecharPreviewRecibo();
  }

  buscar(): void {
    this.loading.set(true);
    this.service.buscar({
      placa: this.filtro.descricao || undefined,
      somenteEmAberto: this.filtro.somenteEmAberto,
      numeroPagina: this.numeroPagina(),
      tamanhoPagina: this.tamanhoPagina()
    }).subscribe({
      next: (paged) => this.applyPagedResult(paged),
      error: (err: ApiError) => this.handleApiError(err, 'Erro ao carregar movimentos.')
    });
  }

  abrirNovo(): void {
    this.toast.success('Use o bloco "Registro Rápido de Movimentação" nesta tela para novos registros.');
  }

  onFiltroPlacaInput(value: string): void {
    this.filtro.descricao = formatPlacaDisplay(normalizePlaca(value));
  }

  onMotoristaCpfInput(value: string): void {
    const masked = this.aplicarMascaraCpf(value);
    this.registroRapido.motoristaCpf = masked;
    const cpfDigits = masked.replace(/\D/g, '');

    if (this.motoristaAutoPreenchidoPorCpf && cpfDigits !== this.ultimaConsultaCpfRegistroRapido) {
      this.motoristaAutoPreenchidoPorCpf = false;
      this.registroRapido.motorista = '';
    }

    if (!this.cpfPossui11Digitos(cpfDigits)) {
      this.ultimaConsultaCpfRegistroRapido = '';
      return;
    }

    if (cpfDigits === this.ultimaConsultaCpfRegistroRapido) {
      return;
    }

    this.ultimaConsultaCpfRegistroRapido = cpfDigits;
    this.buscarMotoristaPorCpfRegistroRapido(cpfDigits);
  }

  onTransportadoraCnpjInput(value: string): void {
    const masked = this.aplicarMascaraCnpj(value);
    this.registroRapido.transportadoraCnpj = masked;
    const cnpjDigits = masked.replace(/\D/g, '');

    if (this.transportadoraAutoPreenchidaPorCnpj && cnpjDigits !== this.ultimaConsultaCnpjRegistroRapido) {
      this.transportadoraAutoPreenchidaPorCnpj = false;
      this.limparCamposDetalheTransportadoraRegistroRapido();
    }

    if (!this.cnpjPossui14Digitos(cnpjDigits)) {
      this.ultimaConsultaCnpjRegistroRapido = '';
      return;
    }

    if (cnpjDigits === this.ultimaConsultaCnpjRegistroRapido) {
      return;
    }

    this.ultimaConsultaCnpjRegistroRapido = cnpjDigits;
    this.buscarTransportadoraPorCnpjRegistroRapido(cnpjDigits);
  }

  onRegistroRapidoPlacaInput(value: string): void {
    const placaFormatada = formatPlacaDisplay(normalizePlaca(value));
    this.registroRapido.placa = placaFormatada;
    this.camposBloqueadosPorPlaca = false;
    this.existeEntradaEmAbertoPorPlaca = false;
    const placaNorm = normalizePlaca(placaFormatada);
    if (!placaCompleta(placaNorm)) {
      this.ultimaPlacaConsultadaRegistroRapido = '';
      this.limparCamposVinculadosPlacaRegistroRapido();
      return;
    }
    if (this.ultimaPlacaConsultadaRegistroRapido === placaNorm) {
      return;
    }
    this.ultimaPlacaConsultadaRegistroRapido = placaNorm;
    this.buscarDadosRegistroRapidoPorPlaca(placaNorm);
  }

  abrirEditar(id: number): void {
    if (!this.canAlterar) return;
    void this.router.navigate([String(id)], { relativeTo: this.route.parent });
  }

  abrirPermanencia(item: EntradaSaidaSearchOutput, acao: PermanenciaAcao): void {
    if (acao === 'finalizar' || acao === 'suspender' || acao === 'retornar') {
      if (!item?.id || item.id <= 0) {
        this.toast.error('Registro sem id válido para atualizar permanência.');
        return;
      }
      this.permanenciaAcao = acao;
      this.permanenciaDataHora = toDateTimeLocalInputValue();
      this.resetSaidaValorState();
      this.service.getById(item.id).subscribe({
        next: (detalhe) => {
          if (!detalhe?.id) {
            this.toast.error('Não foi possível carregar o registro selecionado.');
            return;
          }
          this.registroSelecionado.set(detalhe);
          // Garante "agora" no momento em que o modal abre (após o GET).
          this.permanenciaDataHora = toDateTimeLocalInputValue();
          this.permanenciaOpen.set(true);
          if (acao === 'finalizar') {
            this.carregarValorEstacionamentoParaSaida(detalhe.id);
          }
        },
        error: (err: ApiError) => this.handleApiError(err, 'Erro ao carregar registro.')
      });
    }
  }

  fecharPermanencia(): void {
    this.permanenciaOpen.set(false);
    this.resetSaidaValorState();
  }

  confirmarPermanencia(): void {
    const item = this.registroSelecionado();
    if (!item?.id || item.id <= 0) {
      this.toast.error('Registro sem id válido para atualizar permanência.');
      return;
    }
    const isoData = this.toIsoOrUndefined(this.permanenciaDataHora);
    if (this.permanenciaAcao === 'finalizar') {
      this.confirmarSaidaComRecibo(item);
      return;
    }
    if (this.permanenciaAcao === 'retornar') {
      this.service.finalizarPermanencia(item.id, isoData).subscribe({
        next: () => this.finalizarAcaoPermanencia('Retorno ao pátio realizado.'),
        error: (err: ApiError) => this.handleApiError(err, 'Erro ao finalizar suspensão.')
      });
      return;
    }
    const payload: EntradaSaidaPermanenciaInput = {
      retornarAoPatio: false,
      dataHoraEvento: isoData
    };
    this.service.suspenderPermanencia(item.id, payload).subscribe({
      next: () => this.finalizarAcaoPermanencia('Permanência suspensa com sucesso.'),
      error: (err: ApiError) => this.handleApiError(err, 'Erro ao atualizar permanência.')
    });
  }

  excluir(item: EntradaSaidaSearchOutput): void {
    if (!this.canExcluir || !confirm(`Excluir o registro da placa ${item.placaVeiculo}?`)) return;
    this.service.excluir(item.id).subscribe({
      next: () => {
        this.toast.success('Registro excluído.');
        this.buscar();
      },
      error: (err: ApiError) => this.handleApiError(err, 'Erro ao excluir registro.')
    });
  }

  irParaPagina(pagina: number): void {
    const p = Math.min(this.totalPaginas(), Math.max(1, pagina));
    if (p === this.numeroPagina()) return;
    this.numeroPagina.set(p);
    this.buscar();
  }

  statusLabel(item: EntradaSaidaSearchOutput): string {
    const fromStatus = entradaSaidaStatusLabel(item.status);
    if (fromStatus) return fromStatus;
    return item.dataHoraSaida ? 'Saida' : 'Entrada';
  }

  ehStatusSaida(item: EntradaSaidaSearchOutput): boolean {
    return (
      !!item.dataHoraSaida ||
      parseEntradaSaidaStatus(item.status) === EntradaSaidaStatus.Saida
    );
  }

  /** KPIs só do evento SignalR `dashboard` / `dashboardAtualizado` (sem cálculo local). */
  readonly entradasHoje = computed(() => {
    const value = this.dashboardTempoReal()?.['entradasHoje'];
    return typeof value === 'number' ? value : 0;
  });

  readonly saidasHoje = computed(() => {
    const value = this.dashboardTempoReal()?.['saidasHoje'];
    return typeof value === 'number' ? value : 0;
  });

  readonly emAberto = computed(() => {
    const value = this.dashboardTempoReal()?.['emAberto'];
    return typeof value === 'number' ? value : 0;
  });

  readonly tempoMedioPatio = computed(() => {
    const rawValue = this.dashboardTempoReal()?.['tempoMedioPatio'];
    if (typeof rawValue !== 'string') {
      return '00h 00m';
    }
    const raw = rawValue.trim();
    if (!raw) {
      return '00h 00m';
    }
    const parts = raw.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}h ${parts[1].padStart(2, '0')}m`;
    }
    return raw.includes('h') ? raw : `${raw}m`;
  });

  readonly monitoramentoItens = computed((): MonitoramentoItemVm[] =>
    this.movimentacoesTempoReal()
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        horario: item.horario,
        placa: item.placa || '—',
        motorista: item.motorista || '—',
        transportadora: item.transportadora || '—',
        status: item.status
      }))
  );

  readonly ultimosAlertas = computed((): AlertaItemVm[] =>
    this.movimentacoesTempoReal()
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        titulo:
          item.status === 'saida'
            ? 'Saída registrada com sucesso'
            : item.statusLabel || 'Movimentação em andamento',
        descricao: `Placa ${item.placa || 'não informada'} - ${item.transportadora || 'transportadora'}`,
        tempoRelativo: this.tempoRelativo(item.dataHoraSaida || item.dataHoraEntrada)
      }))
  );

  classeStatusMonitoramento(status: StatusMonitoramento): string {
    if (status === 'saida') return 'status-dot status-dot--saida';
    if (status === 'aberto') return 'status-dot status-dot--aberto';
    return 'status-dot status-dot--entrada';
  }

  /**
   * Registro rápido de entrada: valida campos obrigatórios preenchidos e envia POST `/EntradaSaida`.
   */
  abrirRegistroEntradaRapida(): void {
    if (!this.canGravar || this.processandoRegistroRapido()) return;
    const erroObrigatorios = this.mensagemValidacaoCamposObrigatoriosEntrada();
    if (erroObrigatorios) {
      this.toast.error(erroObrigatorios);
      return;
    }
    this.processandoRegistroRapido.set(true);
    this.postEntradaSaidaAposValidacao();
  }

  /** POST `EntradaSaida` — chamado somente após `mensagemValidacaoCamposObrigatoriosEntrada()` retornar null. */
  private postEntradaSaidaAposValidacao(): void {
    const placaNorm = normalizePlaca(this.registroRapido.placa);
    this.montarPayloadEntradaSaidaAtualizado().subscribe({
      next: (payload) => {
        this.service.create(payload).subscribe({
          next: (criado) => {
            this.processandoRegistroRapido.set(false);
            // Confirmação imediata no retorno do POST (antes de buscar/limpar).
            void this.ofertarReciboAposOperacao({
              id: criado?.id ?? 0,
              modo: ModoRecibo.Entrada,
              placa: placaNorm,
              mensagem: 'Entrada registrada. Deseja visualizar o recibo de entrada?'
            });
            this.toast.success('Entrada registrada com sucesso.');
            this.buscar();
            this.limparRegistroRapido();
          },
          error: (err: ApiError) => {
            this.processandoRegistroRapido.set(false);
            this.toast.error(err?.message ?? 'Erro ao registrar entrada.');
          }
        });
      },
      error: () => {
        this.processandoRegistroRapido.set(false);
        this.toast.error('Erro ao montar payload de entrada.');
      }
    });
  }

  private montarPayloadEntradaSaidaAtualizado() {
    const cpfDigits = String(this.registroRapido.motoristaCpf ?? '').replace(/\D/g, '');
    const cnpjDigits = String(this.registroRapido.transportadoraCnpj ?? '').replace(/\D/g, '');
    const placaNorm = normalizePlaca(this.registroRapido.placa);

    const motorista$ = this.cpfPossui11Digitos(cpfDigits)
      ? this.motoristaService.obterPorCpf(cpfDigits)
      : of(null);
    const transportadora$ = this.cnpjPossui14Digitos(cnpjDigits)
      ? this.transportadoraService.obterTransportadoraPorCnpj(cnpjDigits)
      : of(null);

    return forkJoin({ motorista: motorista$, transportadora: transportadora$ }).pipe(
      map(({ motorista, transportadora }) => ({
        status: EntradaSaidaStatus.Entrada,
        dataHoraEntrada: toLocalIsoDateTime(),
        observacao: this.observacaoParaApi(this.registroRapido.observacao),
        motorista: {
          id: Number(motorista?.id) > 0 ? Number(motorista?.id) : undefined,
          cpf: cpfDigits || undefined,
          nome: String(this.registroRapido.motorista ?? '').trim() || undefined
        },
        transportadora: {
          id: Number(transportadora?.id) > 0 ? Number(transportadora?.id) : undefined,
          cnpj: cnpjDigits || undefined,
          razaoSocial: String(this.registroRapido.transportadoraRazaoSocial ?? '').trim() || undefined,
          responsavelLegal:
            String(this.registroRapido.transportadoraResponsavelNome ?? '').trim() || undefined,
          responsavelTelefone: this.telefoneSomenteDigitosParaApi(
            this.registroRapido.transportadoraResponsavelTelefone
          )
        },
        veiculo: {
          placa: placaNorm || undefined,
          tipoCarga: toTipoCargaEnum(this.registroRapido.tipoCarga)
        }
      } satisfies EntradaSaidaPostInput))
    );
  }

  registrarSaidaRapida(): void {
    if (!this.canGravar || this.processandoRegistroRapido()) return;
    const placaNorm = normalizePlaca(this.registroRapido.placa);
    if (!placaCompleta(placaNorm)) {
      this.toast.error('Informe uma placa válida para registrar saída.');
      return;
    }
    const id = this.registroRapidoEntradaId;
    if (id > 0) {
      this.abrirPermanencia(
        {
          id,
          descricao: '',
          motoristaId: 0,
          nomeMotorista: '',
          transportadoraId: this.registroRapidoTransportadoraId,
          nomeTransportadora: '',
          veiculoId: 0,
          placaVeiculo: placaNorm,
          dataHoraEntrada: '',
          dataHoraSaida: null,
          avulso: true
        },
        'finalizar'
      );
      return;
    }
    this.processandoRegistroRapido.set(true);
    this.service.saida(placaNorm).subscribe({
      next: () => {
        this.processandoRegistroRapido.set(false);
        this.toast.success('Saída registrada com sucesso.');
        this.buscar();
        this.limparRegistroRapido();
      },
      error: (err: ApiError) => {
        this.processandoRegistroRapido.set(false);
        this.toast.error(err?.message ?? 'Erro ao registrar saída.');
      }
    });
  }

  limparRegistroRapido(): void {
    this.registroRapido = {
      placa: '',
      motorista: '',
      motoristaCpf: '',
      transportadoraRazaoSocial: '',
      transportadoraCnpj: '',
      transportadoraResponsavelNome: '',
      transportadoraResponsavelTelefone: '',
      tipoCarga: '',
      dataAgendamento: '',
      observacao: ''
    };
    this.buscandoMotoristaPorCpf = false;
    this.motoristaAutoPreenchidoPorCpf = false;
    this.ultimaConsultaCpfRegistroRapido = '';
    this.consultaCpfSequencia++;
    this.buscandoTransportadoraPorCnpj = false;
    this.transportadoraAutoPreenchidaPorCnpj = false;
    this.ultimaConsultaCnpjRegistroRapido = '';
    this.consultaCnpjSequencia++;
    this.ultimaPlacaConsultadaRegistroRapido = '';
    this.camposBloqueadosPorPlaca = false;
    this.existeEntradaEmAbertoPorPlaca = false;
    this.registroRapidoEntradaId = 0;
    this.registroRapidoTransportadoraId = 0;
  }

  formatarMinutos(minutos?: number | null): string {
    if (minutos == null || minutos <= 0) return '0 min';
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  }

  /** Exibe placa com hífen (ABC-1234 / ABC-1D23). */
  formatarPlaca(placa: string | null | undefined): string {
    return formatPlacaDisplay(placa) || '—';
  }

  podeSuspenderOuRetornar(): boolean {
    const registro = this.registroSelecionado();
    if (!registro) return false;
    return !registro.finalizado;
  }

  podeFinalizar(): boolean {
    const registro = this.registroSelecionado();
    if (!registro) return false;
    if (registro.finalizado) return false;
    if (this.saidaValorLoading() || this.saidaProcessando()) return false;
    const valor = this.saidaValor();
    return valor != null && Number.isFinite(valor) && valor >= 0;
  }

  onPermanenciaDataHoraChange(value: string): void {
    this.permanenciaDataHora = value;
    if (this.permanenciaAcao === 'finalizar') {
      this.recalcularCobrancaSaida();
    }
  }

  onSaidaValorDiariaChange(raw: string | number | null): void {
    if (this.saidaValorBloqueado()) return;
    const texto = raw == null ? '' : String(raw);
    this.saidaValorDiariaTexto.set(texto);
    const n = parseBrl(texto);
    this.saidaValorDiaria.set(n != null && n >= 0 ? n : null);
    this.recalcularCobrancaSaida();
  }

  onSaidaValorDiariaBlur(): void {
    if (this.saidaValorBloqueado()) return;
    const n = this.saidaValorDiaria();
    this.saidaValorDiariaTexto.set(n != null ? formatarBrl(n) : '');
  }

  formatarMoeda(valor: number | null | undefined): string {
    if (valor == null || !Number.isFinite(valor)) return '—';
    return formatarBrl(valor);
  }

  formatarDataHoraEntrada(registro: EntradaSaidaOutput | null | undefined): string {
    const raw = registro?.dataHoraEntrada?.trim();
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /** Recibo disponível após saída registrada. */
  podeVisualizarRecibo(item: EntradaSaidaSearchOutput): boolean {
    return !!item?.id && item.id > 0 && !!item.dataHoraSaida;
  }

  /** Mantido como alias para templates/testes legados. */
  podeBaixarRecibo(item: EntradaSaidaSearchOutput): boolean {
    return this.podeVisualizarRecibo(item);
  }

  reciboEmCarregamento(): boolean {
    return this.reciboBaixandoId() != null;
  }

  abrirReciboHistorico(item: EntradaSaidaSearchOutput): void {
    if (!this.podeVisualizarRecibo(item) || this.reciboEmCarregamento()) return;
    if (!item?.id || item.id <= 0) {
      this.toast.error('Registro sem id válido para gerar o recibo.');
      return;
    }

    this.reciboBaixandoId.set(item.id);
    this.service
      .obterValorEstacionamento(item.id)
      .pipe(catchError((err: ApiError) => this.tratarErroValorEstacionamento(err, item.id)))
      .subscribe({
        next: (res) => {
          this.reciboBaixandoId.set(null);
          const valor =
            res.valor != null && Number.isFinite(Number(res.valor))
              ? Math.round(Number(res.valor) * 100) / 100
              : null;
          if (valor == null) {
            this.toast.error(
              'Não há valor de estacionamento disponível para gerar o recibo.'
            );
            return;
          }
          void this.ofertarReciboAposOperacao({
            id: item.id,
            modo: ModoRecibo.Saida,
            valor,
            placa: item.placaVeiculo || String(item.id),
            mensagem: 'Deseja visualizar o recibo de saída?'
          });
        },
        error: (err: ApiError) => {
          this.reciboBaixandoId.set(null);
          this.handleApiError(err, 'Erro ao consultar valor do estacionamento.');
        }
      });
  }

  /** @deprecated Use {@link abrirReciboHistorico}. */
  baixarReciboHistorico(item: EntradaSaidaSearchOutput): void {
    this.abrirReciboHistorico(item);
  }

  aceitarReciboConfirm(): void {
    this.fecharReciboConfirm(true);
  }

  recusarReciboConfirm(): void {
    this.fecharReciboConfirm(false);
  }

  private fecharReciboConfirm(aceitar: boolean): void {
    this.reciboConfirmOpen.set(false);
    const resolver = this.reciboConfirmResolver;
    this.reciboConfirmResolver = null;
    resolver?.(aceitar);
  }

  private perguntarImprimirRecibo(mensagem: string): Promise<boolean> {
    if (this.reciboConfirmResolver) {
      this.reciboConfirmResolver(false);
      this.reciboConfirmResolver = null;
    }
    this.reciboConfirmMensagem.set(mensagem);
    this.reciboConfirmOpen.set(true);
    return new Promise<boolean>((resolve) => {
      this.reciboConfirmResolver = resolve;
    });
  }

  /**
   * Pergunta imediatamente; só resolve id / chama recibo se o usuário aceitar.
   */
  private async ofertarReciboAposOperacao(opts: {
    id: number;
    modo: ModoRecibo;
    valor?: number | null;
    placa: string;
    mensagem: string;
  }): Promise<void> {
    const aceitar = await this.perguntarImprimirRecibo(opts.mensagem);
    if (!aceitar) return;

    let id = opts.id;
    if ((!id || id <= 0) && opts.placa) {
      id = await this.resolverIdMovimentoPorPlaca(opts.placa);
    }
    if (!id || id <= 0) {
      this.toast.error('Não foi possível identificar o movimento para gerar o recibo.');
      return;
    }

    this.reciboBaixandoId.set(id);
    this.service
      .baixarRecibo(id, opts.modo, opts.modo === ModoRecibo.Saida ? opts.valor : null)
      .pipe(finalize(() => this.reciboBaixandoId.set(null)))
      .subscribe({
        next: (blob) => {
          const prefixo = opts.modo === ModoRecibo.Entrada ? 'ticket-entrada' : 'recibo';
          this.abrirPreviewRecibo(blob, `${prefixo}-${opts.placa || id}.pdf`);
        },
        error: (err: ApiError) => this.handleApiError(err, 'Falha ao gerar o recibo PDF.')
      });
  }

  private resolverIdMovimentoPorPlaca(placa: string): Promise<number> {
    return new Promise((resolve) => {
      this.service
        .buscar({
          placa,
          somenteEmAberto: true,
          numeroPagina: 1,
          tamanhoPagina: 1
        })
        .subscribe({
          next: (paged) => resolve(paged.items[0]?.id ?? 0),
          error: () => resolve(0)
        });
    });
  }

  fecharPreviewRecibo(): void {
    if (this.reciboPreviewObjectUrl) {
      URL.revokeObjectURL(this.reciboPreviewObjectUrl);
      this.reciboPreviewObjectUrl = null;
    }
    this.reciboPreviewBlob = null;
    this.reciboPreviewUrl.set(null);
    this.reciboPreviewOpen.set(false);
  }

  baixarReciboDaPreview(): void {
    const blob = this.reciboPreviewBlob;
    if (!blob) {
      this.toast.error('Recibo indisponível para download.');
      return;
    }
    this.downloadBlob(blob, this.reciboPreviewFileName());
  }

  imprimirReciboDaPreview(): void {
    const blob = this.reciboPreviewBlob;
    if (!blob) {
      this.toast.error('Recibo indisponível para impressão.');
      return;
    }

    // URL própria da impressão: sobrevive ao fechar o modal (não usa o object URL do iframe).
    const printUrl = URL.createObjectURL(blob);
    const printWin = window.open(printUrl, '_blank');
    if (!printWin) {
      URL.revokeObjectURL(printUrl);
      const frame = document.getElementById('recibo-preview-iframe') as HTMLIFrameElement | null;
      if (frame?.contentWindow) {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          return;
        } catch {
          /* fallthrough */
        }
      }
      this.toast.error('Permita pop-ups para imprimir o recibo, ou use Download.');
      return;
    }

    window.setTimeout(() => URL.revokeObjectURL(printUrl), 60_000);

    const tentarPrint = (): void => {
      try {
        printWin.focus();
        printWin.print();
      } catch {
        /* Visualizador nativo: o usuário pode imprimir pelo menu da aba. */
      }
    };
    try {
      printWin.addEventListener('load', tentarPrint);
    } catch {
      /* ignore */
    }
    window.setTimeout(tentarPrint, 400);
  }

  estaSuspenso(item: EntradaSaidaSearchOutput | EntradaSaidaOutput | null | undefined): boolean {
    if (!item) return false;
    if ('permanenciaSuspensa' in item && typeof item.permanenciaSuspensa === 'boolean') {
      return item.permanenciaSuspensa;
    }
    return parseEntradaSaidaStatus((item as EntradaSaidaSearchOutput).status) === EntradaSaidaStatus.Suspenso;
  }

  placaSelecionada(): string {
    const veiculo = this.registroSelecionado()?.veiculo as
      | { placa?: string; Placa?: string }
      | undefined;
    return veiculo?.placa ?? veiculo?.Placa ?? '—';
  }

  private finalizarAcaoPermanencia(msg: string): void {
    this.toast.success(msg);
    this.permanenciaOpen.set(false);
    this.resetSaidaValorState();
    this.buscar();
  }

  private confirmarSaidaComRecibo(item: EntradaSaidaOutput): void {
    const placa = this.placaSelecionada();
    if (!placa || placa === '—') {
      this.toast.error('Placa não encontrada para registrar a saída.');
      return;
    }
    const valor = this.saidaValor();
    if (valor == null || !Number.isFinite(valor) || valor < 0) {
      this.toast.error(
        this.saidaTipoTarifa() === 1
          ? 'Informe o valor da hora para calcular o total do recibo.'
          : 'Informe o valor da diária para calcular o total do recibo.'
      );
      return;
    }
    if (this.saidaProcessando()) return;

    this.saidaProcessando.set(true);
    this.service
      .saida(placa)
      .pipe(finalize(() => this.saidaProcessando.set(false)))
      .subscribe({
        next: () => {
          void this.ofertarReciboAposOperacao({
            id: item.id,
            modo: ModoRecibo.Saida,
            valor,
            placa,
            mensagem: 'Saída registrada. Deseja visualizar o recibo de saída?'
          });
          this.finalizarAcaoPermanencia('Saída registrada com sucesso.');
          this.limparRegistroRapido();
        },
        error: (err: ApiError) => this.handleApiError(err, 'Erro ao registrar saída.')
      });
  }

  private carregarValorEstacionamentoParaSaida(entradaSaidaId: number): void {
    this.cancelarValorEstacionamento$.next();
    if (!entradaSaidaId || entradaSaidaId <= 0) {
      this.aplicarValorEstacionamento(null, false);
      return;
    }
    this.saidaValorLoading.set(true);
    this.service
      .obterValorEstacionamento(entradaSaidaId)
      .pipe(
        takeUntil(this.cancelarValorEstacionamento$),
        catchError((err: ApiError) => this.tratarErroValorEstacionamento(err, entradaSaidaId)),
        finalize(() => this.saidaValorLoading.set(false))
      )
      .subscribe({
        next: (res) => this.aplicarRespostaValorEstacionamento(res),
        error: (err: ApiError) => {
          this.aplicarValorEstacionamento(null, false);
          this.handleApiError(err, 'Erro ao consultar valor do estacionamento.');
        }
      });
  }

  /** 404/204 = sem config ativa (editável). Demais erros sobem para toast. */
  private tratarErroValorEstacionamento(err: ApiError, entradaSaidaId: number) {
    if (err?.status === 404 || err?.status === 204) {
      return of({
        entradaSaidaId,
        estacionamentoId: 0,
        transportadoraId: null,
        configuracaoCobrancaId: null,
        valor: null as number | null,
        origem: 'Indisponivel',
        valorUnitario: null as number | null,
        quantidadeUnidades: null as number | null,
        tipoTarifa: null as TipoTarifaEstacionamento | null,
        tipoCobranca: 'Avulso'
      });
    }
    return throwError(() => err);
  }

  private aplicarRespostaValorEstacionamento(res: {
    valor: number | null;
    valorUnitario: number | null;
    quantidadeUnidades: number | null;
    tipoTarifa: TipoTarifaEstacionamento | null;
    tipoCobranca?: string;
    origem: string;
  }): void {
    this.saidaValorFixoDaFatura = false;
    this.saidaTipoTarifa.set(res.tipoTarifa === 1 || res.tipoTarifa === 2 ? res.tipoTarifa : 2);
    this.saidaTipoCobranca.set(res.tipoCobranca?.trim() || 'Avulso');

    const valorTotal =
      res.valor != null && Number.isFinite(Number(res.valor))
        ? Math.round(Number(res.valor) * 100) / 100
        : null;
    const unitario =
      res.valorUnitario != null && Number.isFinite(Number(res.valorUnitario))
        ? Math.round(Number(res.valorUnitario) * 100) / 100
        : null;
    const qtdApi =
      res.quantidadeUnidades != null &&
      Number.isFinite(Number(res.quantidadeUnidades)) &&
      Number(res.quantidadeUnidades) >= 0
        ? Math.trunc(Number(res.quantidadeUnidades))
        : null;
    const origemFaturaItem = String(res.origem ?? '').toLowerCase() === 'faturaitem';

    if (unitario != null) {
      this.aplicarValorEstacionamento(unitario, true);
      if (qtdApi != null) {
        this.saidaQuantidadeDiarias.set(qtdApi);
        this.saidaValor.set(valorTotal ?? calcularTotalDiarias(unitario, qtdApi));
      }
      return;
    }

    if (valorTotal != null) {
      const qtd = qtdApi ?? Math.max(this.saidaQuantidadeDiarias() || 1, 1);
      const unitarioDerivado =
        qtd > 0 ? Math.round((valorTotal / qtd) * 100) / 100 : valorTotal;
      this.saidaValorFixoDaFatura = origemFaturaItem;
      this.saidaQuantidadeDiarias.set(qtd);
      this.saidaValorDiaria.set(unitarioDerivado);
      this.saidaValorDiariaTexto.set(formatarBrl(unitarioDerivado));
      this.saidaValorBloqueado.set(true);
      this.saidaValor.set(valorTotal);
      return;
    }

    this.aplicarValorEstacionamento(null, false);
  }

  private aplicarValorEstacionamento(valorUnitario: number | null, bloqueado: boolean): void {
    this.saidaValorDiaria.set(valorUnitario);
    this.saidaValorDiariaTexto.set(valorUnitario != null ? formatarBrl(valorUnitario) : '');
    this.saidaValorBloqueado.set(bloqueado);
    this.recalcularCobrancaSaida();
  }

  private recalcularCobrancaSaida(): void {
    if (this.saidaValorFixoDaFatura) return;
    const entrada = this.registroSelecionado()?.dataHoraEntrada;
    const qtd = calcularQuantidadeUnidades(
      entrada,
      this.permanenciaDataHora,
      this.saidaTipoTarifa()
    );
    this.saidaQuantidadeDiarias.set(qtd);
    this.saidaValor.set(calcularTotalDiarias(this.saidaValorDiaria(), qtd));
  }

  private resetSaidaValorState(): void {
    this.cancelarValorEstacionamento$.next();
    this.saidaValorFixoDaFatura = false;
    this.saidaValorDiaria.set(null);
    this.saidaValorDiariaTexto.set('');
    this.saidaQuantidadeDiarias.set(1);
    this.saidaTipoTarifa.set(null);
    this.saidaTipoCobranca.set('Avulso');
    this.saidaValor.set(null);
    this.saidaValorBloqueado.set(false);
    this.saidaValorLoading.set(false);
    this.saidaProcessando.set(false);
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  private abrirPreviewRecibo(blob: Blob, fileName: string): void {
    this.fecharPreviewRecibo();
    const pdfBlob =
      blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    this.reciboPreviewBlob = pdfBlob;
    this.reciboPreviewObjectUrl = URL.createObjectURL(pdfBlob);
    this.reciboPreviewFileName.set(fileName);
    this.reciboPreviewUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(this.reciboPreviewObjectUrl)
    );
    this.reciboPreviewOpen.set(true);
  }

  private applyPagedResult(paged: EntradaSaidaPagedResult<EntradaSaidaSearchOutput>): void {
    this.registros.set(paged.items ?? []);
    this.totalCount.set(paged.totalCount ?? 0);
    this.numeroPagina.set(paged.numeroPagina ?? 1);
    this.tamanhoPagina.set(paged.tamanhoPagina ?? 20);
    this.loading.set(false);
  }

  private handleApiError(err: ApiError, fallback: string, extra?: () => void): void {
    this.loading.set(false);
    extra?.();
    this.toast.error(err?.message ?? fallback);
  }

  private formatarHorario(valor: string | null | undefined): string {
    if (!valor?.trim()) return '--:--';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  private tempoRelativo(valor: string | null | undefined): string {
    if (!valor?.trim()) return 'agora';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return 'agora';
    const diffMs = Math.max(0, Date.now() - d.getTime());
    const minutos = Math.floor(diffMs / 60000);
    if (minutos < 1) return 'agora';
    if (minutos < 60) return `${minutos} min atrás`;
    const horas = Math.floor(minutos / 60);
    return `${horas} h atrás`;
  }

  private buscarDadosRegistroRapidoPorPlaca(placaNorm: string): void {
    this.buscandoPlacaRegistroRapido = true;
    this.service.obterPorPlaca(placaNorm).subscribe({
      next: (entrada) => {
        this.buscandoPlacaRegistroRapido = false;
        const placaAtualNorm = normalizePlaca(this.registroRapido.placa);
        if (placaAtualNorm !== placaNorm) {
          return;
        }
        if (!entrada) {
          this.limparCamposVinculadosPlacaRegistroRapido();
          return;
        }
        this.aplicarRespostaEntradaPorPlacaNaTela(entrada);
      },
      error: () => {
        this.buscandoPlacaRegistroRapido = false;
        this.limparCamposVinculadosPlacaRegistroRapido();
      }
    });
  }

  private aplicarMascaraCpf(value: string | null | undefined): string {
    const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  /**
   * Valida todos os campos obrigatórios do registro rápido.
   * Só retorna null quando pode chamar `postEntradaSaidaAposValidacao` (POST EntradaSaida).
   * Ordem da primeira falha: placa, motorista e CPF.
   */
  private mensagemValidacaoCamposObrigatoriosEntrada(): string | null {
    const placaNorm = normalizePlaca(this.registroRapido.placa);
    if (!placaCompleta(placaNorm)) {
      return 'Informe uma placa válida.';
    }
    if (!String(this.registroRapido.motorista ?? '').trim()) {
      return 'Informe o nome do motorista.';
    }
    if (!this.cpfPossui11Digitos(this.registroRapido.motoristaCpf)) {
      return 'Informe o CPF completo do motorista (11 dígitos).';
    }
    return null;
  }

  private cpfPossui11Digitos(valor: string | null | undefined): boolean {
    const digits = String(valor ?? '').replace(/\D/g, '');
    return digits.length === 11;
  }

  /** Telefone BR com DDD obrigatório: 10 dígitos (fixo) ou 11 (celular com 9). */
  private telefoneResponsavelValido(valor: string | null | undefined): boolean {
    const digits = String(valor ?? '').replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
  }

  /** Somente dígitos para envio à API (sem máscara). */
  private telefoneSomenteDigitosParaApi(valor: string | null | undefined): string | undefined {
    const digits = String(valor ?? '').replace(/\D/g, '');
    if (digits.length !== 10 && digits.length !== 11) return undefined;
    return digits;
  }

  /** Validação do CNPJ no registro rápido (14 dígitos numéricos). */
  private cnpjPossui14Digitos(valor: string | null | undefined): boolean {
    const digits = String(valor ?? '').replace(/\D/g, '');
    return digits.length === 14;
  }

  private aplicarMascaraCnpj(value: string | null | undefined): string {
    const digits = String(value ?? '').replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    }
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  private buscarTransportadoraPorCnpjRegistroRapido(cnpjDigits: string): void {
    const seq = ++this.consultaCnpjSequencia;
    this.buscandoTransportadoraPorCnpj = true;
    this.transportadoraService.obterTransportadoraPorCnpj(cnpjDigits).subscribe({
      next: (dto) => {
        if (seq !== this.consultaCnpjSequencia) return;
        this.buscandoTransportadoraPorCnpj = false;
        const cnpjAtual = String(this.registroRapido.transportadoraCnpj ?? '').replace(/\D/g, '');
        if (cnpjAtual !== cnpjDigits) return;
        if (!dto) {
          this.transportadoraAutoPreenchidaPorCnpj = false;
          return;
        }
        this.registroRapido.transportadoraRazaoSocial = this.encurtarTextoLivre(
          dto.nomeFantasia || dto.razaoSocial || ''
        );
        this.registroRapido.transportadoraResponsavelNome = this.encurtarTextoLivre(dto.responsavelNome ?? '');
        this.registroRapido.transportadoraResponsavelTelefone = this.formatarTelefoneRegistroRapido(
          dto.responsavelCelular ?? dto.telefone ?? ''
        );
        this.transportadoraAutoPreenchidaPorCnpj = true;
      },
      error: () => {
        if (seq !== this.consultaCnpjSequencia) return;
        this.buscandoTransportadoraPorCnpj = false;
        this.transportadoraAutoPreenchidaPorCnpj = false;
      }
    });
  }

  private buscarMotoristaPorCpfRegistroRapido(cpfDigits: string): void {
    const seq = ++this.consultaCpfSequencia;
    this.buscandoMotoristaPorCpf = true;
    this.motoristaService.obterPorCpf(cpfDigits).subscribe({
      next: (dto) => {
        if (seq !== this.consultaCpfSequencia) return;
        this.buscandoMotoristaPorCpf = false;
        const cpfAtual = String(this.registroRapido.motoristaCpf ?? '').replace(/\D/g, '');
        if (cpfAtual !== cpfDigits) return;
        if (!dto) {
          this.motoristaAutoPreenchidoPorCpf = false;
          return;
        }
        this.registroRapido.motoristaCpf = this.aplicarMascaraCpf(dto.cpf || cpfDigits);
        this.registroRapido.motorista = this.encurtarTextoLivre(dto.nomeCompleto ?? '');
        this.motoristaAutoPreenchidoPorCpf = true;
      },
      error: () => {
        if (seq !== this.consultaCpfSequencia) return;
        this.buscandoMotoristaPorCpf = false;
        this.motoristaAutoPreenchidoPorCpf = false;
      }
    });
  }

  private limparCamposVinculadosPlacaRegistroRapido(): void {
    this.registroRapido.motorista = '';
    this.registroRapido.motoristaCpf = '';
    this.motoristaAutoPreenchidoPorCpf = false;
    this.ultimaConsultaCpfRegistroRapido = '';
    this.consultaCpfSequencia++;
    this.registroRapido.transportadoraRazaoSocial = '';
    this.registroRapido.transportadoraCnpj = '';
    this.registroRapido.transportadoraResponsavelNome = '';
    this.registroRapido.transportadoraResponsavelTelefone = '';
    this.registroRapido.tipoCarga = '';
    this.transportadoraAutoPreenchidaPorCnpj = false;
    this.ultimaConsultaCnpjRegistroRapido = '';
    this.consultaCnpjSequencia++;
    this.camposBloqueadosPorPlaca = false;
    this.existeEntradaEmAbertoPorPlaca = false;
    this.registroRapidoEntradaId = 0;
    this.registroRapidoTransportadoraId = 0;
  }

  private limparCamposDetalheTransportadoraRegistroRapido(): void {
    this.registroRapido.transportadoraRazaoSocial = '';
    this.registroRapido.transportadoraResponsavelNome = '';
    this.registroRapido.transportadoraResponsavelTelefone = '';
  }

  private aplicarRespostaEntradaPorPlacaNaTela(entrada: EntradaSaidaOutput): void {
    const campos = mapBuscarPorPlacaParaRegistroRapido(entrada);
    if (campos.placa) {
      this.registroRapido.placa = campos.placa;
    }
    if (campos.motoristaNome) {
      this.registroRapido.motorista = this.encurtarTextoLivre(campos.motoristaNome);
    }
    if (campos.motoristaCpf) {
      this.registroRapido.motoristaCpf = this.aplicarMascaraCpf(campos.motoristaCpf);
    }
    if (campos.transportadoraRazaoSocial) {
      this.registroRapido.transportadoraRazaoSocial = this.encurtarTextoLivre(
        campos.transportadoraRazaoSocial
      );
    }
    if (String(campos.transportadoraCnpj).replace(/\D/g, '').length > 0) {
      this.registroRapido.transportadoraCnpj = this.aplicarMascaraCnpj(campos.transportadoraCnpj);
    }
    if (campos.transportadoraResponsavelNome) {
      this.registroRapido.transportadoraResponsavelNome = this.encurtarTextoLivre(
        campos.transportadoraResponsavelNome
      );
    }
    if (campos.transportadoraResponsavelTelefone) {
      this.registroRapido.transportadoraResponsavelTelefone = campos.transportadoraResponsavelTelefone;
    }
    if (campos.tipoCargaLabel) {
      this.registroRapido.tipoCarga = campos.tipoCargaLabel;
    }
    this.existeEntradaEmAbertoPorPlaca = campos.existeEntradaEmAberto;
    this.camposBloqueadosPorPlaca = true;
    this.registroRapidoEntradaId =
      campos.existeEntradaEmAberto && entrada.id > 0 ? entrada.id : 0;
    this.registroRapidoTransportadoraId =
      entrada.transportadoraId > 0
        ? entrada.transportadoraId
        : Number(entrada.transportadora?.id ?? 0) || 0;
  }

  private formatarTelefoneRegistroRapido(valor: string | null | undefined): string {
    return formatTelefone(String(valor ?? ''));
  }

  private encurtarTextoLivre(valor: string | null | undefined): string {
    return this.cortarAte(String(valor ?? ''), this.registroRapidoMaxTexto);
  }

  private cortarAte(texto: string, max: number): string {
    if (texto.length <= max) return texto;
    return texto.slice(0, max);
  }

  private observacaoParaApi(observacao: string | undefined): string | undefined {
    const t = observacao?.trim();
    if (!t) return undefined;
    return this.cortarAte(t, this.registroRapidoMaxTexto);
  }

  private toIsoOrUndefined(value: string | null | undefined): string | undefined {
    const iso = datetimeLocalInputToApiIso(value);
    return iso || undefined;
  }

  private mapMovimentacaoHubParaVm(
    source: MovimentacaoAtualizadaItem | unknown,
    index: number
  ): MovimentacaoTempoRealVm | null {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return null;
    }

    const row = source as Record<string, unknown>;

    const asText = (value: unknown): string => {
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
      if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
      return '';
    };

    const pickText = (...keys: string[]): string => {
      for (const key of keys) {
        const direct = asText(row[key] ?? row[key.charAt(0).toUpperCase() + key.slice(1)]);
        if (direct) return direct;

        const nested = row[key];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          const obj = nested as Record<string, unknown>;
          const nestedText =
            asText(obj['nome']) ||
            asText(obj['Nome']) ||
            asText(obj['placa']) ||
            asText(obj['Placa']) ||
            asText(obj['razaoSocial']) ||
            asText(obj['RazaoSocial']) ||
            asText(obj['descricao']) ||
            asText(obj['Descricao']);
          if (nestedText) return nestedText;
        }
      }
      return '';
    };

    const horarioIso = pickText('horario', 'dataHoraEntrada', 'entradaEm', 'dataEntrada');
    const saidaIso = pickText('dataHoraSaida', 'saidaEm', 'dataSaida') || null;
    const statusLabel = pickText('status', 'statusDescricao', 'Situacao', 'situacao');
    const status = this.mapStatusHubParaMonitoramento(statusLabel, !!saidaIso);
    const sortIso = saidaIso || horarioIso;
    const horarioSortMs = sortIso ? Date.parse(sortIso) : 0;

    // Backend envia Guid em `id` — não converter para number (NaN quebrava o track do @for).
    const id =
      pickText('id', 'entradaSaidaId', 'movimentacaoId') ||
      `${pickText('veiculo', 'placa') || 'item'}-${horarioIso || index}`;

    return {
      id,
      horario: this.formatarHorario(horarioIso),
      horarioSortMs: Number.isNaN(horarioSortMs) ? 0 : horarioSortMs,
      placa: pickText('veiculo', 'placa', 'placaVeiculo') || '—',
      motorista: pickText('motorista', 'nomeMotorista', 'motoristaNome') || '—',
      transportadora:
        pickText('transportadora', 'nomeTransportadora', 'razaoSocial', 'nomeFantasia') || '—',
      status,
      statusLabel:
        statusLabel || (status === 'saida' ? 'Saída' : status === 'aberto' ? 'Aberto' : 'Entrada'),
      dataHoraEntrada: horarioIso,
      dataHoraSaida: saidaIso
    };
  }

  private mapStatusHubParaMonitoramento(
    statusLabel: string,
    temSaida: boolean
  ): StatusMonitoramento {
    const parsed = parseEntradaSaidaStatus(statusLabel);
    if (parsed === EntradaSaidaStatus.Saida || parsed === EntradaSaidaStatus.Cancelado) {
      return 'saida';
    }
    if (parsed === EntradaSaidaStatus.Agendado || parsed === EntradaSaidaStatus.Suspenso) {
      return 'aberto';
    }
    if (parsed === EntradaSaidaStatus.Entrada) {
      return 'entrada';
    }

    const normalized = statusLabel
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    if (temSaida || normalized.includes('saida')) return 'saida';
    if (normalized.includes('agend') || normalized.includes('aberto') || normalized.includes('patio')) {
      return 'aberto';
    }
    if (normalized.includes('entrada')) return 'entrada';
    return temSaida ? 'saida' : 'entrada';
  }
}
