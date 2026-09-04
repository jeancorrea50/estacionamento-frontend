import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { VeiculoService } from '../../services/veiculo.service';
import { TransportadoraService } from '../../services/transportadora.service';
import { MotoristaService } from '../../services/motorista.service';
import { VeiculoDTO, VeiculoListItemDTO } from '../../models/veiculo.dto';
import { TransportadoraListItemDTO } from '../../models/transportadora.dto';
import { PlacaFormatDirective } from '../../directives/placa-format.directive';
import { ToastService } from '../../../../core/api/services/toast.service';
import { EstSummaryMetricComponent } from '../../components/est-summary-metric/est-summary-metric.component';
import { EstStatusPillEstacionamentoComponent } from '../../components/est-status-pill-estacionamento/est-status-pill-estacionamento.component';
import { ModalBuscaMotoristaComponent } from '../../../movimentos/entrada-saida/components/modal-busca-motorista/modal-busca-motorista.component';
import { PaginatedSearchItem } from '../../../../shared/models/paginated-search.models';
import { formatPlacaDisplay, normalizePlaca, placaCompleta } from '../../utils/placa-br';
import { splitMarcaModelo } from '../../utils/marca-modelo';
import { parseTipoCarga, TIPO_CARGA_OPCOES, tipoCargaLabel } from '../../../../shared/models/tipo-carga';
import { formatCpf } from '../../directives/cpf-format.directive';

type VeiculoSearchField = 'geral' | 'placa';

type MotoristaVinculoUi = {
  id: number;
  nome: string;
  cnh?: string;
  validadeCnh?: string;
  principal: boolean;
};

@Component({
  selector: 'app-cadastro-veiculos-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PlacaFormatDirective,
    ModalBuscaMotoristaComponent,
    EstSummaryMetricComponent,
    EstStatusPillEstacionamentoComponent,
  ],
  templateUrl: './cadastro-veiculos-page.component.html',
  styleUrls: ['./cadastro-veiculos-page.component.scss'],
})
export class CadastroVeiculosPageComponent implements OnInit {
  private veiculoService = inject(VeiculoService);
  private transportadoraService = inject(TransportadoraService);
  private motoristaService = inject(MotoristaService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  veiculos: VeiculoListItemDTO[] = [];
  transportadoras: TransportadoraListItemDTO[] = [];
  loadingList = false;
  erroList: string | null = null;
  jaBuscou = false;
  termoBusca = '';
  campoBusca: VeiculoSearchField = 'geral';
  numeroPagina = 1;
  totalCount = 0;
  tamanhoPaginaLista = 25;
  readonly opcoesTamanhoPaginaLista: number[] = [10, 25, 50];

  showVeiculoForm = false;
  veiculoForm!: FormGroup;
  veiculoEditId: number | null = null;
  salvandoVeiculo = false;
  placaFrotaValida = false;
  modalFrotaTab: 'veiculo' | 'motoristasVinculados' = 'veiculo';
  frotaMotoristaModalAberto = false;
  frotaMotoristaTexto = '';
  motoristasVinculadosFrota: MotoristaVinculoUi[] = [];
  readonly tipoCargaOpcoes = TIPO_CARGA_OPCOES;
  readonly eixosOpcoes: number[] = [2, 3, 4, 5, 6, 7, 8, 9];

  showImportarFrota = false;
  fileFrota: File | null = null;
  importandoFrota = false;
  baixandoModeloFrota = false;
  importTransportadoraId: number | null = null;

  private bloquearFecharModalAte = 0;

  ngOnInit(): void {
    this.criarFormVeiculo();
    this.carregarTransportadoras();
    this.onBuscar();
  }

  get searchPlaceholder(): string {
    return this.campoBusca === 'placa' ? 'Digite a placa' : 'Pesquisar por placa, marca ou modelo...';
  }

  get totalPaginasLista(): number {
    if (this.tamanhoPaginaLista <= 0) return 1;
    return Math.max(1, Math.ceil(this.totalCount / this.tamanhoPaginaLista));
  }

  get intervaloLista(): { de: number; ate: number } {
    if (this.totalCount <= 0) return { de: 0, ate: 0 };
    const de = (this.numeroPagina - 1) * this.tamanhoPaginaLista + 1;
    const ate = Math.min(this.numeroPagina * this.tamanhoPaginaLista, this.totalCount);
    return { de, ate };
  }

  get countAtivosPagina(): number {
    return this.veiculos.filter((i) => i.ativo).length;
  }

  get countInativosPagina(): number {
    return this.veiculos.filter((i) => !i.ativo).length;
  }

  get resumoListaPaginaHint(): string | null {
    return this.totalPaginasLista > 1 ? 'Nesta página' : null;
  }

  get modalFrotaTabAtual(): 'veiculo' | 'motoristasVinculados' {
    return this.modalFrotaTab === 'motoristasVinculados' ? 'motoristasVinculados' : 'veiculo';
  }

  get transportadoraIdForm(): number | null {
    const v = Number(this.veiculoForm?.get('transportadoraId')?.value);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  onBuscar(): void {
    this.numeroPagina = 1;
    this.carregarLista();
  }

  carregarLista(): void {
    this.jaBuscou = true;
    this.loadingList = true;
    this.erroList = null;
    const termo = (this.termoBusca ?? '').trim();
    const placa = this.campoBusca === 'placa' ? normalizePlaca(termo) : undefined;
    this.veiculoService
      .buscar({
        Termo: this.campoBusca === 'geral' ? termo || undefined : undefined,
        Placa: placa && placa.length >= 7 ? placa : undefined,
        NumeroPagina: this.numeroPagina,
        TamanhoPagina: this.tamanhoPaginaLista,
      })
      .subscribe({
        next: (paged) => {
          this.veiculos = paged.items;
          this.totalCount = paged.totalCount;
          this.loadingList = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.erroList = 'Erro ao carregar a lista de veículos.';
          this.loadingList = false;
          this.cdr.markForCheck();
        },
      });
  }

  onTamanhoPaginaListaChange(size: number | string): void {
    const n = Number(size);
    if (!Number.isFinite(n) || n <= 0) return;
    this.tamanhoPaginaLista = n;
    this.numeroPagina = 1;
    if (this.jaBuscou) this.carregarLista();
  }

  irParaPaginaLista(pagina: number): void {
    const p = Math.max(1, Math.min(pagina, this.totalPaginasLista));
    if (p === this.numeroPagina) return;
    this.numeroPagina = p;
    this.carregarLista();
  }

  irPrimeiraPaginaLista(): void {
    this.irParaPaginaLista(1);
  }

  irUltimaPaginaLista(): void {
    this.irParaPaginaLista(this.totalPaginasLista);
  }

  formatPlacaFrotaGrid(placa: string | null | undefined): string {
    return formatPlacaDisplay(placa) || '—';
  }

  labelTipoCarga(valor: number | string | null | undefined): string {
    return tipoCargaLabel(valor) || '—';
  }

  formatCpfCondutor(cpf: string): string {
    const d = (cpf ?? '').replace(/\D/g, '');
    if (!d) return '—';
    return d.length === 11 ? formatCpf(d) : cpf || '—';
  }

  private carregarTransportadoras(): void {
    this.transportadoraService.listarTransportadoras({ NumeroPagina: 1, TamanhoPagina: 500 }).subscribe({
      next: (res) => {
        this.transportadoras = res.items;
        this.cdr.markForCheck();
      },
      error: () => {
        this.transportadoras = [];
        this.cdr.markForCheck();
      },
    });
  }

  transportadoraLabel(id: number | null | undefined): string {
    if (id == null || id <= 0) return '—';
    const t = this.transportadoras.find((x) => x.id === id);
    return t?.nomeFantasia?.trim() || t?.razaoSocial?.trim() || `ID ${id}`;
  }

  criarFormVeiculo(): void {
    this.veiculoForm = this.fb.group({
      id: [null as number | null],
      placa: ['', [Validators.required, Validators.minLength(7)]],
      motoristaId: [null as number | null],
      veiculoModeloId: [null as number | null],
      marca: [''],
      modelo: [''],
      marcaModelo: [''],
      cor: [''],
      anoFabricacao: [null as number | null],
      anoModelo: [null as number | null],
      tipoCarga: [null as number | null],
      quantidadeEixos: [''],
      transportadoraId: [null as number | null, Validators.required],
      centroCusto: [''],
      ativo: [true],
    });
  }

  abrirNovoVeiculo(): void {
    this.veiculoEditId = null;
    this.modalFrotaTab = 'veiculo';
    this.frotaMotoristaModalAberto = false;
    this.frotaMotoristaTexto = '';
    this.motoristasVinculadosFrota = [];
    this.veiculoForm.reset({
      id: null,
      placa: '',
      motoristaId: null,
      veiculoModeloId: null,
      marca: '',
      modelo: '',
      marcaModelo: '',
      cor: '',
      anoFabricacao: null,
      anoModelo: null,
      tipoCarga: null,
      quantidadeEixos: '',
      transportadoraId: null,
      centroCusto: '',
      ativo: true,
    });
    this.atualizarPlacaFrotaValida('');
    this.agendarAbrirModalVeiculo();
  }

  editarVeiculo(v: VeiculoListItemDTO): void {
    const { marca, modelo } = splitMarcaModelo(v.marcaModelo);
    this.veiculoEditId = v.id;
    this.motoristasVinculadosFrota = [];
    const placaLista = formatPlacaDisplay(v.placa);
    this.veiculoForm.patchValue({
      id: v.id,
      placa: placaLista,
      motoristaId: null,
      marca,
      modelo,
      marcaModelo: v.marcaModelo ?? '',
      cor: v.cor ?? '',
      anoFabricacao: v.anoFabricacao ?? null,
      anoModelo: v.anoModelo ?? null,
      tipoCarga: v.tipoCarga ?? null,
      transportadoraId: v.transportadoraId ?? null,
      ativo: v.ativo ?? true,
    });
    this.atualizarPlacaFrotaValida(placaLista);
    this.modalFrotaTab = 'veiculo';
    this.agendarAbrirModalVeiculo();

    this.veiculoService.obterPorId(v.id).subscribe((dto) => {
      if (!dto) return;
      const parsed = this.resolveMarcaModeloForm(dto);
      const placaFinal = formatPlacaDisplay(dto.placa);
      this.veiculoEditId = dto.id ?? null;
      this.veiculoForm.patchValue({
        id: dto.id,
        placa: placaFinal,
        motoristaId: dto.motoristaId ?? null,
        veiculoModeloId: dto.veiculoModeloId ?? null,
        marca: parsed.marca,
        modelo: parsed.modelo,
        marcaModelo: dto.marcaModelo,
        cor: dto.cor ?? '',
        anoFabricacao: dto.anoFabricacao ?? null,
        anoModelo: dto.anoModelo ?? null,
        tipoCarga: dto.tipoCarga ?? null,
        quantidadeEixos: dto.quantidadeEixos != null ? String(dto.quantidadeEixos) : '',
        transportadoraId: dto.transportadoraId ?? v.transportadoraId ?? null,
        centroCusto: dto.centroCusto ?? '',
        ativo: dto.ativo ?? true,
      });
      this.atualizarPlacaFrotaValida(placaFinal);
      this.aplicarVinculosMotoristasDoVeiculoDto(dto);
      this.cdr.markForCheck();
    });
  }

  excluirVeiculo(veiculo: VeiculoListItemDTO): void {
    if (!confirm('Excluir este veículo?')) return;
    if (veiculo.id <= 0) return;
    this.veiculoService.excluir(veiculo.id).subscribe({
      next: () => {
        this.toast.success('Veículo excluído com sucesso.');
        this.carregarLista();
      },
      error: () => this.toast.error('Erro ao excluir veículo.'),
    });
  }

  salvarVeiculo(): void {
    const placa = this.placaFrotaNormalizada;
    if (!placaCompleta(placa)) {
      this.veiculoForm.get('placa')?.markAsTouched();
      this.setModalFrotaTab('veiculo');
      this.toast.error('Informe a placa completa no padrão Mercosul (ex.: ABC-1D23).');
      return;
    }
    const transportadoraId = this.transportadoraIdForm;
    if (transportadoraId == null) {
      this.toast.error('Selecione a transportadora.');
      return;
    }
    const v = this.veiculoForm.getRawValue();
    const marcaDescricao = String(v.marca ?? '').trim() || undefined;
    const modeloDescricao = String(v.modelo ?? '').trim() || undefined;
    const marcaModelo =
      [marcaDescricao, modeloDescricao].filter(Boolean).join(' ').trim() || undefined;
    const tipoCarga = parseTipoCarga(v.tipoCarga);
    const idSalvar =
      v.id != null && Number(v.id) > 0
        ? Number(v.id)
        : this.veiculoEditId != null && this.veiculoEditId > 0
          ? this.veiculoEditId
          : undefined;
    const dto: VeiculoDTO = {
      id: idSalvar,
      transportadoraId,
      placa,
      motoristas: this.motoristasVinculadosFrota.map((m) => ({
        id: m.id,
        principal: m.principal,
      })),
      veiculoModeloId: v.veiculoModeloId || undefined,
      marcaDescricao,
      modeloDescricao,
      marcaModelo: marcaModelo ?? (String(v.marcaModelo ?? '').trim() || undefined),
      cor: String(v.cor ?? '').trim() || undefined,
      anoFabricacao:
        v.anoFabricacao != null && Number(v.anoFabricacao) > 0 ? Number(v.anoFabricacao) : undefined,
      anoModelo: v.anoModelo != null && Number(v.anoModelo) > 0 ? Number(v.anoModelo) : undefined,
      tipoCarga: tipoCarga ?? undefined,
      ativo: v.ativo !== false,
    };
    this.salvandoVeiculo = true;
    const obs = idSalvar != null ? this.veiculoService.alterar(dto) : this.veiculoService.gravar(dto);
    obs.subscribe({
      next: () => {
        this.salvandoVeiculo = false;
        this.showVeiculoForm = false;
        this.veiculoEditId = null;
        this.toast.success(idSalvar ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.');
        if (this.jaBuscou) this.carregarLista();
        this.cdr.markForCheck();
      },
      error: () => {
        this.salvandoVeiculo = false;
        this.toast.error('Não foi possível salvar o veículo.');
        this.cdr.markForCheck();
      },
    });
  }

  formatarPlacaFrota(value: string): void {
    const formatted = formatPlacaDisplay(value);
    this.veiculoForm.patchValue({ placa: formatted }, { emitEvent: false });
    this.atualizarPlacaFrotaValida(formatted);
  }

  onPlacaBlur(): void {
    if (this.veiculoEditId != null) return;
    const placa = normalizePlaca(this.veiculoForm.get('placa')?.value);
    if (!placaCompleta(placa)) return;
    this.veiculoService.buscar({ Placa: placa, NumeroPagina: 1, TamanhoPagina: 5 }).subscribe({
      next: (paged) => {
        if (paged.items.length === 0) return;
        this.editarVeiculo(paged.items[0]);
      },
    });
  }

  setModalFrotaTab(tab: 'veiculo' | 'motoristasVinculados'): void {
    this.modalFrotaTab = tab;
    this.cdr.markForCheck();
  }

  abrirBuscaMotoristaFrota(): void {
    if (!this.transportadoraIdForm) {
      this.toast.error('Selecione a transportadora antes de vincular motoristas.');
      return;
    }
    this.frotaMotoristaModalAberto = true;
  }

  onFrotaMotoristaSelecionado(item: PaginatedSearchItem): void {
    const existente = this.motoristasVinculadosFrota.some((m) => m.id === item.id);
    if (existente) {
      this.toast.error('Este motorista já está vinculado.');
      this.frotaMotoristaModalAberto = false;
      return;
    }
    const nome = (item.titulo ?? '').trim() || `Motorista ${item.id}`;
    const cnhRaw = String(item.campo3 ?? '').trim();
    const cnh = cnhRaw && cnhRaw !== '—' ? cnhRaw : undefined;
    const semPrincipal = this.motoristasVinculadosFrota.every((m) => !m.principal);
    this.motoristasVinculadosFrota = [
      ...this.motoristasVinculadosFrota,
      { id: item.id, nome, cnh, principal: false },
    ];
    if (semPrincipal) this.definirMotoristaPrincipal(item.id, nome);
    this.frotaMotoristaModalAberto = false;
    this.cdr.markForCheck();
  }

  definirVinculoPrincipal(id: number): void {
    const escolhido = this.motoristasVinculadosFrota.find((m) => m.id === id);
    if (!escolhido) return;
    this.definirMotoristaPrincipal(escolhido.id, escolhido.nome);
    this.cdr.markForCheck();
  }

  removerVinculoMotorista(id: number): void {
    const alvo = this.motoristasVinculadosFrota.find((m) => m.id === id);
    this.motoristasVinculadosFrota = this.motoristasVinculadosFrota.filter((m) => m.id !== id);
    if (alvo?.principal) {
      const novoPrincipal = this.motoristasVinculadosFrota[0];
      if (novoPrincipal) {
        this.definirMotoristaPrincipal(novoPrincipal.id, novoPrincipal.nome);
      } else {
        this.veiculoForm.patchValue({ motoristaId: null });
        this.frotaMotoristaTexto = '';
      }
    }
    this.cdr.markForCheck();
  }

  motoristaIniciais(nome: string): string {
    const partes = String(nome ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (partes.length === 0) return 'M';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return `${partes[0][0] ?? ''}${partes[1][0] ?? ''}`.toUpperCase();
  }

  fecharModalFrota(event?: Event): void {
    if (event && Date.now() < this.bloquearFecharModalAte) return;
    this.showVeiculoForm = false;
    this.frotaMotoristaModalAberto = false;
    this.modalFrotaTab = 'veiculo';
  }

  onBackdropVeiculoClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    this.fecharModalFrota(event);
  }

  abrirImportarFrota(): void {
    this.fileFrota = null;
    this.importTransportadoraId = null;
    this.showImportarFrota = true;
  }

  fecharImportarFrota(): void {
    if (this.importandoFrota) return;
    this.showImportarFrota = false;
    this.fileFrota = null;
  }

  onFileFrotaChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileFrota = input.files?.[0] ?? null;
  }

  importarFrota(): void {
    if (!this.fileFrota || this.importTransportadoraId == null || this.importandoFrota) return;
    this.importandoFrota = true;
    this.veiculoService.importarDadosExcel(this.importTransportadoraId, this.fileFrota).subscribe({
      next: (r) => {
        this.importandoFrota = false;
        if (!r.ok) {
          this.toast.error(r.message ?? 'Falha na importação da frota.');
          this.cdr.markForCheck();
          return;
        }
        this.toast.success(
          r.message ||
            `Frota: ${r.sucesso ?? 0} ok, ${r.falha ?? 0} falha(s), ${r.ignorado ?? 0} ignorada(s).`
        );
        this.fecharImportarFrota();
        if (this.jaBuscou) this.carregarLista();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.importandoFrota = false;
        this.toast.error(err?.message ?? 'Falha ao importar frota.');
        this.cdr.markForCheck();
      },
    });
  }

  downloadModeloFrota(): void {
    if (this.baixandoModeloFrota) return;
    this.baixandoModeloFrota = true;
    this.veiculoService.downloadModeloImportacao().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modelo-importacao-frota.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        this.baixandoModeloFrota = false;
        this.toast.success('Modelo de frota baixado.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.baixandoModeloFrota = false;
        this.toast.error(err?.message ?? 'Não foi possível baixar o modelo de frota.');
        this.cdr.markForCheck();
      },
    });
  }

  private agendarAbrirModalVeiculo(): void {
    this.bloquearFecharModalAte = Date.now() + 500;
    this.showVeiculoForm = true;
    this.cdr.detectChanges();
  }

  private get placaFrotaNormalizada(): string {
    return normalizePlaca(this.veiculoForm?.get('placa')?.value);
  }

  private atualizarPlacaFrotaValida(placa?: string): void {
    this.placaFrotaValida = placaCompleta(placa ?? this.veiculoForm?.get('placa')?.value);
    this.cdr.markForCheck();
  }

  private resolveMarcaModeloForm(source: {
    marcaDescricao?: string | null;
    modeloDescricao?: string | null;
    marcaModelo?: string | null;
  }): { marca: string; modelo: string } {
    const marca = String(source.marcaDescricao ?? '').trim();
    const modelo = String(source.modeloDescricao ?? '').trim();
    if (marca || modelo) return { marca, modelo };
    return splitMarcaModelo(source.marcaModelo);
  }

  private aplicarVinculosMotoristasDoVeiculoDto(dto: VeiculoDTO): void {
    const vinc = dto.motoristasVinculos;
    if (vinc && vinc.length > 0) {
      const comFlagPrincipal = vinc.some((x) => x.principal === true);
      const principalId = comFlagPrincipal
        ? vinc.find((x) => x.principal === true)!.id
        : dto.motoristaId != null && vinc.some((x) => x.id === dto.motoristaId)
          ? dto.motoristaId!
          : vinc[0].id;
      this.motoristasVinculadosFrota = vinc.map((x) => ({
        id: x.id,
        nome: x.nome,
        cnh: x.cnh,
        validadeCnh: x.validadeCnh,
        principal: x.id === principalId,
      }));
      const p = this.motoristasVinculadosFrota.find((m) => m.principal);
      if (p) {
        this.veiculoForm.patchValue({ motoristaId: p.id }, { emitEvent: false });
        this.frotaMotoristaTexto = p.nome;
      }
      return;
    }
    this.motoristasVinculadosFrota = [];
    const mid = dto.motoristaId;
    if (mid != null && mid > 0) {
      this.motoristaService.obterPorId(mid).subscribe({
        next: (m) => {
          if (m?.nomeCompleto) {
            this.definirMotoristaPrincipal(mid, m.nomeCompleto);
            this.cdr.markForCheck();
          }
        },
      });
    }
  }

  private definirMotoristaPrincipal(id: number, nome: string): void {
    this.motoristasVinculadosFrota = this.motoristasVinculadosFrota.map((m) => ({
      ...m,
      principal: m.id === id,
    }));
    if (!this.motoristasVinculadosFrota.some((m) => m.id === id)) {
      this.motoristasVinculadosFrota = [...this.motoristasVinculadosFrota, { id, nome, principal: true }];
    }
    this.veiculoForm.patchValue({ motoristaId: id }, { emitEvent: false });
    this.frotaMotoristaTexto = nome;
  }
}
