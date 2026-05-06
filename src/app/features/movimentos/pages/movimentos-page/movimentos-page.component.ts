import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EntradaSaidaService } from '../../entrada-saida/entrada-saida.service';
import {
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
import { MotoristaPorPlacaAggregateVm } from '../../../cadastro/models/motorista-por-placa.vm';
import { VeiculoService } from '../../../cadastro/services/veiculo.service';
import { formatPlacaDisplay, normalizePlaca, placaCompleta } from '../../../cadastro/utils/placa-br';

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
  private readonly veiculoService = inject(VeiculoService);
  private readonly toast = inject(ToastService);
  private readonly permissionCache = inject(PermissionCacheService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
    this.buscar();
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
    this.registroRapido.motoristaCpf = this.aplicarMascaraCpf(value);
  }

  onTransportadoraCnpjInput(value: string): void {
    this.registroRapido.transportadoraCnpj = this.aplicarMascaraCnpj(value);
  }

  onRegistroRapidoPlacaInput(value: string): void {
    const placaFormatada = formatPlacaDisplay(normalizePlaca(value));
    this.registroRapido.placa = placaFormatada;
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
    const hoje = this.hojeIso();
    return this.registros.filter((item) => this.extrairDataIso(item.dataHoraEntrada) === hoje).length;
  }

  saidasHoje(): number {
    const hoje = this.hojeIso();
    return this.registros.filter((item) => this.extrairDataIso(item.dataHoraSaida) === hoje).length;
  }

  emAberto(): number {
    return this.registros.filter((item) => !item.dataHoraSaida).length;
  }

  tempoMedioPatio(): string {
    const tempos = this.registros
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
    return this.registros.slice(0, 5).map((item) => ({
      id: item.id,
      horario: this.formatarHorario(item.dataHoraSaida || item.dataHoraEntrada),
      placa: item.placaVeiculo || '—',
      motorista: item.nomeMotorista || '—',
      transportadora: item.nomeTransportadora || '—',
      status: item.dataHoraSaida ? 'saida' : 'entrada'
    }));
  }

  ultimosAlertas(): AlertaItemVm[] {
    return this.registros.slice(0, 5).map((item) => ({
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
   * Registro rápido de entrada: consulta veículo por placa, aplica dados na tela,
   * valida todos os campos obrigatórios e só então envia POST `/EntradaSaida`.
   */
  abrirRegistroEntradaRapida(): void {
    if (!this.canGravar || this.processandoRegistroRapido) return;
    const placaNorm = normalizePlaca(this.registroRapido.placa);
    if (!placaCompleta(placaNorm)) {
      this.toast.error('Informe uma placa válida para registrar entrada.');
      return;
    }

    this.processandoRegistroRapido = true;
    this.veiculoService.obterPorPlaca(placaNorm).subscribe({
      next: (agg) => {
        if (!agg) {
          this.processandoRegistroRapido = false;
          this.toast.error('Placa não encontrada para registrar entrada.');
          return;
        }

        this.sincronizarRegistroRapidoComAggregate(agg);

        const erroObrigatorios = this.mensagemValidacaoCamposObrigatoriosEntrada();
        if (erroObrigatorios) {
          this.processandoRegistroRapido = false;
          this.toast.error(erroObrigatorios);
          return;
        }

        this.postEntradaSaidaAposValidacao(agg);
      },
      error: (err: ApiError) => {
        this.processandoRegistroRapido = false;
        this.toast.error(err?.message ?? 'Erro ao consultar placa.');
      }
    });
  }

  /** POST `EntradaSaida` — chamado somente após `mensagemValidacaoCamposObrigatoriosEntrada()` retornar null. */
  private postEntradaSaidaAposValidacao(agg: MotoristaPorPlacaAggregateVm): void {
    this.service
      .create({
        motoristaId: agg.motoristaId,
        transportadoraId: agg.transportadoraId,
        veiculoId: agg.veiculoId,
        dataHoraEntrada: new Date().toISOString(),
        observao: this.observacaoParaApi(this.registroRapido.observacao),
        telefoneResponsavel: this.telefoneSomenteDigitosParaApi(
          this.registroRapido.transportadoraResponsavelTelefone
        )
      })
      .subscribe({
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
    this.ultimaPlacaConsultadaRegistroRapido = '';
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
    this.veiculoService.obterPorPlaca(placaNorm).subscribe({
      next: (agg) => {
        this.buscandoPlacaRegistroRapido = false;
        const placaAtualNorm = normalizePlaca(this.registroRapido.placa);
        if (placaAtualNorm !== placaNorm) {
          return;
        }
        if (!agg) {
          this.limparCamposVinculadosPlacaRegistroRapido();
          return;
        }
        this.aplicarRespostaPlacaNaTela(agg);
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
   * Ordem da primeira falha: placa, motorista, CPF, responsável, telefone, CNPJ.
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
    if (!String(this.registroRapido.transportadoraResponsavelNome ?? '').trim()) {
      return 'Informe o nome do responsável pela transportadora.';
    }
    if (!this.telefoneResponsavelValido(this.registroRapido.transportadoraResponsavelTelefone)) {
      return 'Informe o telefone com DDD ((00) …) — 10 dígitos (fixo) ou 11 (celular).';
    }
    if (!this.cnpjPossui14Digitos(this.registroRapido.transportadoraCnpj)) {
      return 'Informe o CNPJ completo da transportadora (14 dígitos).';
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

  private limparCamposVinculadosPlacaRegistroRapido(): void {
    this.registroRapido.motorista = '';
    this.registroRapido.motoristaCpf = '';
    this.registroRapido.transportadoraRazaoSocial = '';
    this.registroRapido.transportadoraCnpj = '';
    this.registroRapido.transportadoraResponsavelNome = '';
    this.registroRapido.transportadoraResponsavelTelefone = '';
    this.registroRapido.tipoCarga = '';
  }

  private sincronizarRegistroRapidoComAggregate(agg: MotoristaPorPlacaAggregateVm): void {
    this.registroRapido.placa = formatPlacaDisplay(normalizePlaca(agg.veiculoPlaca || this.registroRapido.placa));
    this.registroRapido.motorista = this.encurtarTextoLivre(agg.motoristaNome);
    this.registroRapido.motoristaCpf = this.aplicarMascaraCpf(agg.motoristaCpf);
    this.registroRapido.transportadoraRazaoSocial = this.encurtarTextoLivre(agg.transportadoraRazaoSocial);
    if (String(agg.transportadoraCnpj ?? '').replace(/\D/g, '').length > 0) {
      this.registroRapido.transportadoraCnpj = this.aplicarMascaraCnpj(agg.transportadoraCnpj);
    }
    this.registroRapido.transportadoraResponsavelNome = this.encurtarTextoLivre(agg.transportadoraResponsavelNome);
    this.registroRapido.transportadoraResponsavelTelefone = this.formatarTelefoneRegistroRapido(
      agg.transportadoraResponsavelTelefone
    );
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

  private aplicarRespostaPlacaNaTela(agg: MotoristaPorPlacaAggregateVm): void {
    this.sincronizarRegistroRapidoComAggregate(agg);
  }

  private toIsoOrUndefined(value: string | null | undefined): string | undefined {
    if (!value?.trim()) return undefined;
    return new Date(value).toISOString();
  }
}
