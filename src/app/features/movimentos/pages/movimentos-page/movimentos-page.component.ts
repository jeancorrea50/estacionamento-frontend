import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EntradaSaidaService } from '../../entrada-saida/entrada-saida.service';
import {
  EntradaSaidaFiltro,
  EntradaSaidaOutput,
  EntradaSaidaPagedResult,
  EntradaSaidaPermanenciaInput,
  EntradaSaidaSearchOutput
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
import { forkJoin, map, of } from 'rxjs';
import { EntradaSaidaPostInput } from '../../models/entrada-saida.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { SignalrDashboardService } from '../../../../core/services/signalr-dashboard.service';
import { DashboardAtualizadoPayload } from '../../../../core/models/dashboard.models';

type PermanenciaAcao = 'suspender' | 'retornar' | 'finalizar';
type StatusMonitoramento = 'entrada' | 'saida' | 'aberto';

interface MonitoramentoItemVm {
  id: number;
  horario: string;
  placa: string;
  motorista: string;
  transportadora: string;
  status: StatusMonitoramento;
}

interface AlertaItemVm {
  id: number;
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
export class MovimentosPageComponent implements OnInit {
  private readonly service = inject(EntradaSaidaService);
  private readonly signalrDashboardService = inject(SignalrDashboardService);
  private readonly transportadoraService = inject(TransportadoraService);
  private readonly motoristaService = inject(MotoristaService);
  private readonly toast = inject(ToastService);
  private readonly permissionCache = inject(PermissionCacheService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly canVisualizar = this.permissionCache.has('entradasaida.visualizar') || this.permissionCache.hasAny(['*']);
  readonly canGravar = this.permissionCache.has('entradasaida.gravar') || this.permissionCache.hasAny(['*']);
  readonly canAlterar = this.permissionCache.has('entradasaida.alterar') || this.permissionCache.hasAny(['*']);
  readonly canExcluir = this.permissionCache.has('entradasaida.excluir') || this.permissionCache.hasAny(['*']);

  /** Limite para textos livres no registro rápido (nome, razão social, observação etc.). */
  readonly registroRapidoMaxTexto = 100;
  /** Limite visual para telefone com máscara BR `(00) 00000-0000` (15 caracteres). */
  readonly registroRapidoMaxTelefone = 15;

  filtro = { descricao: '', somenteEmAberto: true };

  registros: EntradaSaidaSearchOutput[] = [];
  movimentacoesTempoReal: EntradaSaidaSearchOutput[] = [];
  dashboardTempoReal: DashboardAtualizadoPayload | null = null;
  numeroPagina = 1;
  tamanhoPagina = 20;
  totalCount = 0;
  loading = false;

  permanenciaOpen = false;
  permanenciaAcao: PermanenciaAcao = 'suspender';
  registroSelecionado: EntradaSaidaOutput | null = null;
  permanenciaDataHora = '';
  processandoRegistroRapido = false;
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

  /** Opções comuns para tipo de carga / tipo de equipamento rodoviário. */
  readonly tipoCargaOpcoes = [
    'Graneleiro',
    'Bitrem',
    'Rodotrem',
    'Caçamba',
    'Sider',
    'Tanque',
    'Porta contêiner',
    'Frigorífico'
  ] as const;

  ngOnInit(): void {
    if (!this.canVisualizar) return;
    void this.signalrDashboardService.connect();
    this.assinarEventosTempoReal();
  }

  buscar(): void {
    this.loading = true;
    this.service.buscar({
      placa: this.filtro.descricao || undefined,
      somenteEmAberto: this.filtro.somenteEmAberto,
      numeroPagina: this.numeroPagina,
      tamanhoPagina: this.tamanhoPagina
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
      this.permanenciaAcao = acao;
      this.permanenciaDataHora = '';
      this.service.getById(item.id).subscribe((detalhe) => {
        this.registroSelecionado = detalhe;
        this.permanenciaOpen = true;
      });
    }
  }

  confirmarPermanencia(): void {
    const item = this.registroSelecionado;
    if (!item) return;
    const isoData = this.toIsoOrUndefined(this.permanenciaDataHora);
    if (this.permanenciaAcao === 'finalizar') {
      this.service.finalizarPermanencia(item.id, isoData).subscribe({
        next: () => this.finalizarAcaoPermanencia('Permanência finalizada com sucesso.'),
        error: (err: ApiError) => this.handleApiError(err, 'Erro ao finalizar permanência.')
      });
      return;
    }
    const payload: EntradaSaidaPermanenciaInput = {
      retornarAoPatio: this.permanenciaAcao === 'retornar',
      dataHoraEvento: isoData
    };
    this.service.suspenderPermanencia(item.id, payload).subscribe({
      next: () =>
        this.finalizarAcaoPermanencia(
          payload.retornarAoPatio ? 'Retorno ao pátio realizado.' : 'Permanência suspensa com sucesso.'
        ),
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

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.tamanhoPagina));
  }

  irParaPagina(pagina: number): void {
    const p = Math.min(this.totalPaginas, Math.max(1, pagina));
    if (p === this.numeroPagina) return;
    this.numeroPagina = p;
    this.buscar();
  }

  statusLabel(item: EntradaSaidaSearchOutput): 'Em aberto' | 'Finalizado' {
    return item.dataHoraSaida ? 'Finalizado' : 'Em aberto';
  }

  entradasHoje(): number {
    if (typeof this.dashboardTempoReal?.['entradasHoje'] === 'number') {
      return Number(this.dashboardTempoReal['entradasHoje']) || 0;
    }
    const hoje = this.hojeIso();
    return this.fonteDadosTempoReal().filter((item) => this.extrairDataIso(item.dataHoraEntrada) === hoje).length;
  }

  saidasHoje(): number {
    if (typeof this.dashboardTempoReal?.['saidasHoje'] === 'number') {
      return Number(this.dashboardTempoReal['saidasHoje']) || 0;
    }
    const hoje = this.hojeIso();
    return this.fonteDadosTempoReal().filter((item) => this.extrairDataIso(item.dataHoraSaida) === hoje).length;
  }

  emAberto(): number {
    if (typeof this.dashboardTempoReal?.['emAberto'] === 'number') {
      return Number(this.dashboardTempoReal['emAberto']) || 0;
    }
    return this.fonteDadosTempoReal().filter((item) => !item.dataHoraSaida).length;
  }

  tempoMedioPatio(): string {
    if (typeof this.dashboardTempoReal?.['tempoMedioPatio'] === 'string') {
      const raw = String(this.dashboardTempoReal['tempoMedioPatio']).trim();
      if (raw) {
        return raw.replace(':', 'h ').concat(raw.includes('h') ? '' : 'm');
      }
    }

    const tempos = this.fonteDadosTempoReal()
      .map((item) => this.minutosNoPatio(item))
      .filter((m): m is number => m != null && m > 0);
    if (tempos.length === 0) {
      return '00h 00m';
    }
    const media = Math.round(tempos.reduce((acc, m) => acc + m, 0) / tempos.length);
    const horas = Math.floor(media / 60);
    const minutos = media % 60;
    return `${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}m`;
  }

  monitoramentoItens(): MonitoramentoItemVm[] {
    return this.fonteDadosTempoReal().slice(0, 5).map((item) => ({
      id: item.id,
      horario: this.formatarHorario(item.dataHoraSaida || item.dataHoraEntrada),
      placa: item.placaVeiculo || '—',
      motorista: item.nomeMotorista || '—',
      transportadora: item.nomeTransportadora || '—',
      status: item.dataHoraSaida ? 'saida' : 'entrada'
    }));
  }

  ultimosAlertas(): AlertaItemVm[] {
    return this.fonteDadosTempoReal().slice(0, 5).map((item) => ({
      id: item.id,
      titulo: item.dataHoraSaida ? 'Saída registrada com sucesso' : 'Movimentação em andamento',
      descricao: `Placa ${item.placaVeiculo || 'não informada'} - ${item.nomeTransportadora || 'transportadora'}`,
      tempoRelativo: this.tempoRelativo(item.dataHoraSaida || item.dataHoraEntrada)
    }));
  }

  classeStatusMonitoramento(status: StatusMonitoramento): string {
    if (status === 'saida') return 'status-dot status-dot--saida';
    if (status === 'aberto') return 'status-dot status-dot--aberto';
    return 'status-dot status-dot--entrada';
  }

  /**
   * Registro rápido de entrada: valida campos obrigatórios preenchidos e envia POST `/EntradaSaida`.
   */
  abrirRegistroEntradaRapida(): void {
    if (!this.canGravar || this.processandoRegistroRapido) return;
    const erroObrigatorios = this.mensagemValidacaoCamposObrigatoriosEntrada();
    if (erroObrigatorios) {
      this.toast.error(erroObrigatorios);
      return;
    }
    this.processandoRegistroRapido = true;
    this.postEntradaSaidaAposValidacao();
  }

  /** POST `EntradaSaida` — chamado somente após `mensagemValidacaoCamposObrigatoriosEntrada()` retornar null. */
  private postEntradaSaidaAposValidacao(): void {
    this.montarPayloadEntradaSaidaAtualizado().subscribe({
      next: (payload) => {
        this.service.create(payload).subscribe({
          next: () => {
            this.processandoRegistroRapido = false;
            this.toast.success('Entrada registrada com sucesso.');
            this.buscar();
            this.limparRegistroRapido();
          },
          error: (err: ApiError) => {
            this.processandoRegistroRapido = false;
            this.toast.error(err?.message ?? 'Erro ao registrar entrada.');
          }
        });
      },
      error: () => {
        this.processandoRegistroRapido = false;
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
        status: 0,
        dataHoraEntrada: new Date().toISOString(),
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
          tipoCarga: this.mapearTipoCargaParaEnum(this.registroRapido.tipoCarga)
        }
      } satisfies EntradaSaidaPostInput))
    );
  }

  private mapearTipoCargaParaEnum(valor: string | null | undefined): 1 | 2 | 3 | 4 | 5 | undefined {
    const key = String(valor ?? '').trim().toLowerCase();
    if (!key) return undefined;
    const mapa: Record<string, 1 | 2 | 3 | 4 | 5> = {
      graneleiro: 1,
      bitrem: 2,
      rodotrem: 3,
      caçamba: 4,
      cacamba: 4,
      sider: 5
    };
    return mapa[key];
  }

  private mapearTipoCargaEnumParaLabel(valor: string | null | undefined): string | undefined {
    const raw = String(valor ?? '').trim();
    if (!raw) return undefined;

    const byText = raw.toLowerCase();
    const mapaTexto: Record<string, string> = {
      graneleiro: 'Graneleiro',
      bitrem: 'Bitrem',
      rodotrem: 'Rodotrem',
      caçamba: 'Caçamba',
      cacamba: 'Caçamba',
      sider: 'Sider'
    };
    if (mapaTexto[byText]) return mapaTexto[byText];

    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    const mapaEnum: Record<number, string> = {
      1: 'Graneleiro',
      2: 'Bitrem',
      3: 'Rodotrem',
      4: 'Caçamba',
      5: 'Sider'
    };
    return mapaEnum[n];
  }

  registrarSaidaRapida(): void {
    if (!this.canGravar || this.processandoRegistroRapido) return;
    const placaNorm = normalizePlaca(this.registroRapido.placa);
    if (!placaCompleta(placaNorm)) {
      this.toast.error('Informe uma placa válida para registrar saída.');
      return;
    }
    const aberto = this.registros.find(
      (item) => !item.dataHoraSaida && normalizePlaca(item.placaVeiculo) === placaNorm
    );
    const finalizar = (id: number) => {
      this.service.finalizarPermanencia(id, new Date().toISOString()).subscribe({
        next: () => {
          this.processandoRegistroRapido = false;
          this.toast.success('Saída registrada com sucesso.');
          this.buscar();
          this.limparRegistroRapido();
        },
        error: (err: ApiError) => {
          this.processandoRegistroRapido = false;
          this.toast.error(err?.message ?? 'Erro ao registrar saída.');
        }
      });
    };
    this.processandoRegistroRapido = true;
    if (aberto?.id) {
      finalizar(aberto.id);
      return;
    }
    this.service.buscar({
      placa: placaNorm,
      somenteEmAberto: true,
      numeroPagina: 1,
      tamanhoPagina: 1
    }).subscribe({
      next: (paged) => {
        const item = paged.items[0];
        if (!item?.id) {
          this.processandoRegistroRapido = false;
          this.toast.error('Não há movimento em aberto para esta placa.');
          return;
        }
        finalizar(item.id);
      },
      error: (err: ApiError) => {
        this.processandoRegistroRapido = false;
        this.toast.error(err?.message ?? 'Erro ao buscar movimento em aberto.');
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
  }

  formatarMinutos(minutos?: number | null): string {
    if (minutos == null || minutos <= 0) return '0 min';
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  }

  podeSuspenderOuRetornar(): boolean {
    if (!this.registroSelecionado) return false;
    return !this.registroSelecionado.finalizado;
  }

  podeFinalizar(): boolean {
    if (!this.registroSelecionado) return false;
    return !this.registroSelecionado.finalizado;
  }

  placaSelecionada(): string {
    const veiculo = this.registroSelecionado?.veiculo as { placa?: string } | undefined;
    return veiculo?.placa ?? '—';
  }

  private finalizarAcaoPermanencia(msg: string): void {
    this.toast.success(msg);
    this.permanenciaOpen = false;
    this.buscar();
  }

  private assinarEventosTempoReal(): void {
    this.signalrDashboardService.dashboardAtualizado$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload) => {
        this.dashboardTempoReal = payload;
      });

    this.signalrDashboardService.movimentacaoAtualizada$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload) => {
        this.movimentacoesTempoReal = payload
          .map((item, index) => this.mapMovimentacaoHubParaSearchOutput(item, index))
          .filter((item): item is EntradaSaidaSearchOutput => item != null);
      });
  }

  private fonteDadosTempoReal(): EntradaSaidaSearchOutput[] {
    return this.movimentacoesTempoReal;
  }

  private applyPagedResult(paged: EntradaSaidaPagedResult<EntradaSaidaSearchOutput>): void {
    this.loading = false;
    this.registros = paged.items;
    this.totalCount = paged.totalCount;
    this.numeroPagina = paged.numeroPagina;
    this.tamanhoPagina = paged.tamanhoPagina;
  }

  private handleApiError(err: ApiError, fallback: string, extra?: () => void): void {
    this.loading = false;
    extra?.();
    this.toast.error(err?.message ?? fallback);
  }

  private hojeIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private extrairDataIso(valor: string | null | undefined): string {
    if (!valor?.trim()) return '';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
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

  private minutosNoPatio(item: EntradaSaidaSearchOutput): number | null {
    const entrada = new Date(item.dataHoraEntrada).getTime();
    if (Number.isNaN(entrada)) return null;
    const saida = item.dataHoraSaida ? new Date(item.dataHoraSaida).getTime() : Date.now();
    if (Number.isNaN(saida) || saida < entrada) return null;
    return Math.round((saida - entrada) / 60000);
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
  }

  private limparCamposDetalheTransportadoraRegistroRapido(): void {
    this.registroRapido.transportadoraRazaoSocial = '';
    this.registroRapido.transportadoraResponsavelNome = '';
    this.registroRapido.transportadoraResponsavelTelefone = '';
  }

  private aplicarRespostaEntradaPorPlacaNaTela(entrada: EntradaSaidaOutput): void {
    const pickAny = (objs: Array<Record<string, unknown> | undefined>, ...keys: string[]): string => {
      for (const obj of objs) {
        if (!obj) continue;
        for (const key of keys) {
          const val = obj[key] ?? obj[key.charAt(0).toUpperCase() + key.slice(1)];
          if (val == null) continue;
          const s = String(val).trim();
          if (s) return s;
        }
      }
      return '';
    };
    const root = entrada as unknown as Record<string, unknown>;
    const motorista =
      entrada.motorista && typeof entrada.motorista === 'object'
        ? (entrada.motorista as Record<string, unknown>)
        : undefined;
    const transportadora =
      entrada.transportadora && typeof entrada.transportadora === 'object'
        ? (entrada.transportadora as Record<string, unknown>)
        : undefined;
    const veiculo =
      entrada.veiculo && typeof entrada.veiculo === 'object'
        ? (entrada.veiculo as Record<string, unknown>)
        : undefined;

    const placa = pickAny([veiculo, root], 'placa', 'placaVeiculo');
    if (placa) {
      this.registroRapido.placa = formatPlacaDisplay(normalizePlaca(placa));
    }
    const nomeMotorista = pickAny(
      [motorista, root],
      'nome',
      'nomeCompleto',
      'nomeRazaoSocial',
      'descricao',
      'nomeMotorista'
    );
    if (nomeMotorista) {
      this.registroRapido.motorista = this.encurtarTextoLivre(nomeMotorista);
    }
    const cpfMotorista = pickAny([motorista, root], 'cpf', 'documento', 'cpfMotorista');
    if (cpfMotorista) {
      this.registroRapido.motoristaCpf = this.aplicarMascaraCpf(cpfMotorista);
    }
    const razaoSocial = pickAny(
      [transportadora, root],
      'razaoSocial',
      'nomeFantasia',
      'nomeRazaoSocial',
      'nomeTransportadora'
    );
    if (razaoSocial) {
      this.registroRapido.transportadoraRazaoSocial = this.encurtarTextoLivre(razaoSocial);
    }
    const cnpj = pickAny([transportadora, root], 'cnpj', 'documento', 'cnpjTransportadora');
    if (String(cnpj).replace(/\D/g, '').length > 0) {
      this.registroRapido.transportadoraCnpj = this.aplicarMascaraCnpj(cnpj);
    }
    const responsavelNome = pickAny(
      [transportadora, root],
      'responsavelLegal',
      'nomeResponsavel',
      'responsavelNome',
      'transportadoraResponsavelNome'
    );
    if (responsavelNome) {
      this.registroRapido.transportadoraResponsavelNome = this.encurtarTextoLivre(responsavelNome);
    }
    const responsavelTelefone = pickAny(
      [transportadora, root],
      'responsavelTelefone',
      'telefoneResponsavel',
      'telefone',
      'transportadoraResponsavelTelefone'
    );
    if (responsavelTelefone) {
      this.registroRapido.transportadoraResponsavelTelefone = this.formatarTelefoneRegistroRapido(
        responsavelTelefone
      );
    }
    const tipoCargaRaw = pickAny([veiculo, root], 'tipoCarga', 'tipoCargaDescricao');
    const tipoCargaLabel = this.mapearTipoCargaEnumParaLabel(tipoCargaRaw);
    if (tipoCargaLabel) {
      this.registroRapido.tipoCarga = tipoCargaLabel;
    }
    this.existeEntradaEmAbertoPorPlaca =
      Boolean(root['existeEntradaEmAberto'] ?? root['ExisteEntradaEmAberto']) === true;
    this.camposBloqueadosPorPlaca = true;
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
    if (!value?.trim()) return undefined;
    return new Date(value).toISOString();
  }

  private mapMovimentacaoHubParaSearchOutput(
    source: unknown,
    index: number
  ): EntradaSaidaSearchOutput | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const row = source as Record<string, unknown>;
    const motorista =
      row['motorista'] && typeof row['motorista'] === 'object'
        ? (row['motorista'] as Record<string, unknown>)
        : undefined;
    const transportadora =
      row['transportadora'] && typeof row['transportadora'] === 'object'
        ? (row['transportadora'] as Record<string, unknown>)
        : undefined;
    const veiculo =
      row['veiculo'] && typeof row['veiculo'] === 'object'
        ? (row['veiculo'] as Record<string, unknown>)
        : undefined;
    const entrada = row['entrada'] && typeof row['entrada'] === 'object'
      ? (row['entrada'] as Record<string, unknown>)
      : undefined;

    const pick = (obj: Record<string, unknown> | undefined, key: string): unknown => {
      if (!obj) return undefined;
      return obj[key] ?? obj[key.charAt(0).toUpperCase() + key.slice(1)];
    };

    const getRaw = (...keys: string[]): unknown => {
      for (const key of keys) {
        const candidates = [
          pick(row, key),
          pick(motorista, key),
          pick(transportadora, key),
          pick(veiculo, key),
          pick(entrada, key)
        ];
        for (const candidate of candidates) {
          if (candidate != null && String(candidate).trim() !== '') {
            return candidate;
          }
        }
      }
      return undefined;
    };

    const getNumber = (...keys: string[]): number => {
      const value = getRaw(...keys);
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    };
    const getString = (...keys: string[]): string => {
      const value = getRaw(...keys);
      return typeof value === 'string' ? value : '';
    };
    const getNullableString = (...keys: string[]): string | null => {
      const value = getString(...keys);
      return value || null;
    };

    return {
      id: getNumber('id', 'entradaSaidaId', 'movimentacaoId') || index + 1,
      descricao: getString('descricao', 'description'),
      motoristaId: getNumber('motoristaId'),
      nomeMotorista: getString('nomeMotorista', 'motoristaNome', 'nome', 'nomeCompleto', 'motorista'),
      transportadoraId: getNumber('transportadoraId'),
      nomeTransportadora: getString(
        'nomeTransportadora',
        'transportadoraNome',
        'razaoSocial',
        'nomeFantasia',
        'transportadora'
      ),
      veiculoId: getNumber('veiculoId'),
      placaVeiculo: getString('placaVeiculo', 'placa', 'veiculo'),
      dataHoraEntrada: getString('dataHoraEntrada', 'entradaEm', 'dataEntrada', 'horario'),
      dataHoraSaida: getNullableString('dataHoraSaida', 'saidaEm', 'dataSaida')
    };
  }
}
