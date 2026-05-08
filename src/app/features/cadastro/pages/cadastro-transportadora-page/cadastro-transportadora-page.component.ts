import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef, isDevMode } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, map, switchMap } from 'rxjs';
import { TransportadoraService } from '../../services/transportadora.service';
import { VeiculoService } from '../../services/veiculo.service';
import { ViacepService } from '../../services/viacep.service';
import { CnpjLookupResult, CnpjService } from '../../services/cnpj.service';
import { TransportadoraListItemDTO } from '../../models/transportadora.dto';
import { VeiculoDTO, VeiculoListItemDTO } from '../../models/veiculo.dto';
import { CnpjFormValue } from '../../models/brasilapi-cnpj.model';
import { CnpjFormatDirective, formatCnpj } from '../../directives/cnpj-format.directive';
import { CpfFormatDirective, formatCpf } from '../../directives/cpf-format.directive';
import { TelefoneFormatDirective } from '../../directives/telefone-format.directive';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  MotoristaDTO,
  MotoristaListItemDTO
} from '../../models/motorista.dto';
import { MotoristaService } from '../../services/motorista.service';
import {
  montarPayloadTransportadoraApi,
  TransportadoraFormRawValue
} from '../../mappers/transportadora-payload.mapper';
import { ModalBuscaMotoristaComponent } from '../../../movimentos/entrada-saida/components/modal-busca-motorista/modal-busca-motorista.component';
import { PaginatedSearchItem } from '../../../../shared/models/paginated-search.models';
import { EstSummaryMetricComponent } from '../../components/est-summary-metric/est-summary-metric.component';
import { EstStatusPillEstacionamentoComponent } from '../../components/est-status-pill-estacionamento/est-status-pill-estacionamento.component';

export type TransportadoraTab = 'cadastro' | 'frota' | 'motoristas';
type ModalFrotaTab = 'veiculo' | 'motoristasVinculados';
type TransportadoraSearchField = 'geral' | 'cnpj' | 'razaoSocial' | 'nomeFantasia' | 'email' | 'id';

@Component({
  selector: 'app-cadastro-transportadora-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    CnpjFormatDirective,
    CpfFormatDirective,
    TelefoneFormatDirective,
    ModalBuscaMotoristaComponent,
    EstSummaryMetricComponent,
    EstStatusPillEstacionamentoComponent,
  ],
  templateUrl: './cadastro-transportadora-page.component.html',
  styleUrls: ['./cadastro-transportadora-page.component.scss']
})
export class CadastroTransportadoraPageComponent implements OnInit {
  private transportadoraService = inject(TransportadoraService);
  private veiculoService = inject(VeiculoService);
  private viacep = inject(ViacepService);
  private cnpjService = inject(CnpjService);
  private motoristaService = inject(MotoristaService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  activeTab: TransportadoraTab = 'cadastro';

  // --- Aba Cadastro (Transportadora) ---
  listView = true;
  transportadoraList: TransportadoraListItemDTO[] = [];
  /** Alias somente leitura: mesmos dados exibidos na tabela (`transportadoraList`). */
  get transportadoras(): TransportadoraListItemDTO[] {
    return this.transportadoraList;
  }
  loadingList = false;
  erroList: string | null = null;
  jaBuscou = false;
  termoBusca = '';
  campoBusca: TransportadoraSearchField = 'geral';
  numeroPagina = 1;
  totalCount = 0;
  /** Itens por página na grade (enviado ao GET Buscar). */
  tamanhoPaginaLista = 10;
  readonly opcoesTamanhoPaginaLista: number[] = [10, 25, 50];
  transportadoraForm!: FormGroup;
  salvando = false;
  erroForm: string | null = null;
  /** Busca automática CNPJ (BrasilAPI): loading e mensagem de erro abaixo do campo. */
  cnpjLoading = false;
  cnpjError: string | null = null;
  cnpjSuccess: string | null = null;
  private ultimoCnpjConsultado = '';
  /** ID da transportadora em edição (usado na Frota e Motoristas). */
  transportadoraId: number | null = null;

  /** Corpo bruto do GET /api/Transportadora/{id} para merge correto no PUT (datas, ids). */
  private transportadoraMergeRaw: Record<string, unknown> | null = null;

  /** Accordion Endereço (campos do grupo `endereco`). */
  complementaresOpen = false;

  /** Accordion Contatos complementares (RL já está no card superior; aqui só complementares). */
  contatosOpen = true;

  // --- Aba Frota (Veículos) ---
  veiculos: VeiculoListItemDTO[] = [];
  loadingVeiculos = false;
  showVeiculoForm = false;
  veiculoForm!: FormGroup;
  veiculoEditId: number | null = null;
  salvandoVeiculo = false;
  modalFrotaTab: ModalFrotaTab = 'veiculo';
  /** Lookup de motorista no modal frota (mesmo padrão da tela Entrada/saída). */
  frotaMotoristaModalAberto = false;
  frotaMotoristaTexto = '';
  frotaMotoristaVinculoBusca = '';
  frotaMotoristaLookupContext: 'veiculo' | 'vinculo' = 'veiculo';
  motoristasVinculadosFrota: Array<{ id: number; nome: string; principal: boolean }> = [];
  motoristaSelecionadoParaVinculo: { id: number; nome: string } | null = null;
  frotaSelectorOpen = false;
  frotaSelectorTermo = '';
  frotaSelectorPagina = 1;
  frotaSelectorPageSize = 5;
  motoristasSelecionadosTemp: number[] = [];
  /** Resultado da busca global por CPF (GET /Motorista sem TransportadoraId). */
  frotaSelectorMotoristasLista: MotoristaListItemDTO[] = [];
  frotaSelectorMotoristasLoading = false;
  /** Opções para quantidade de eixos (modal frota). */
  eixosOpcoes: number[] = [2, 3, 4, 5, 6, 7, 8, 9];
  /** Opções para veículo leve/pesado. */
  tipoPesoOpcoes: { value: string; label: string }[] = [
    { value: 'leve', label: 'Leve' },
    { value: 'pesado', label: 'Pesado' }
  ];
  /** Modal Importar frota (Excel). */
  showImportarFrota = false;
  fileFrota: File | null = null;

  // --- Aba Motoristas ---
  condutores: MotoristaListItemDTO[] = [];
  loadingCondutores = false;
  showCondutorForm = false;
  motoristaForm!: FormGroup;
  condutorEditId: number | null = null;
  salvandoMotorista = false;
  showImportarCondutores = false;
  fileCondutores: File | null = null;
  private bloquearFecharModalAte = 0;

  ngOnInit(): void {
    this.criarFormTransportadora();
    this.setupCnpjBuscaAutomatica();
    this.criarFormVeiculo();
    this.criarFormMotorista();

    this.route.paramMap
      .pipe(
        map((pm) => pm.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((idStr) => {
        if (!idStr) return;
        const id = Number(idStr);
        if (!Number.isFinite(id) || id <= 0) return;
        this.listView = false;
        this.carregarTransportadoraParaEdicao(id);
      });

    const forceTab = this.route.snapshot.data['forceTab'];
    if (forceTab === 'motoristas') {
      this.setTab('motoristas');
    }
  }

  /**
   * Obrigatórios ainda pendentes no painel lateral: validadores do formulário (PJ + e-mail)
   * e endereço principal com o mesmo critério do preenchimento (%).
   */
  get cadastroObrigatoriosPendentesLabels(): string[] {
    if (!this.transportadoraForm) return [];
    const f = this.transportadoraForm;
    const p: string[] = [];
    if (f.get('pessoa.razaoSocial')?.invalid) p.push('Razão social');
    const cnpjOk = String(f.get('pessoa.cnpj')?.value ?? '').replace(/\D/g, '').length === 14;
    if (!cnpjOk) p.push('CNPJ');
    const eg = f.get('endereco') as FormGroup;
    const cep = String(eg?.get('cep')?.value ?? '').replace(/\D/g, '');
    const log = String(eg?.get('logradouro')?.value ?? '').trim();
    const cid = String(eg?.get('cidade')?.value ?? '').trim();
    if (cep.length < 8) p.push('CEP do endereço');
    if (log.length < 2) p.push('Logradouro do endereço');
    if (cid.length < 2) p.push('Cidade do endereço');
    return p;
  }

  /** Progresso do preenchimento (0–100) para o painel lateral — espelha a lógica do cadastro estacionamento. */
  get cadastroFillProgressPercent(): number {
    if (!this.transportadoraForm) return 0;
    const f = this.transportadoraForm;
    let ok = 0;
    const total = 9;
    const doc = String(f.get('pessoa.cnpj')?.value ?? '').replace(/\D/g, '');
    if (doc.length === 14) ok++;
    if (String(f.get('pessoa.razaoSocial')?.value ?? '').trim().length >= 2) ok++;
    if (String(f.get('responsavelLegal.nome')?.value ?? '').trim().length >= 2) ok++;
    const cpf = String(f.get('responsavelLegal.cpf')?.value ?? '').replace(/\D/g, '');
    if (cpf.length === 11) ok++;
    const tel = String(f.get('responsavelLegal.telefone')?.value ?? '').replace(/\D/g, '');
    if (tel.length >= 10) ok++;
    if (String(f.get('pessoa.nomeFantasia')?.value ?? '').trim().length > 0) ok++;
    const eg = f.get('endereco') as FormGroup;
    const cep = String(eg?.get('cep')?.value ?? '').replace(/\D/g, '');
    const log = String(eg?.get('logradouro')?.value ?? '').trim();
    const cid = String(eg?.get('cidade')?.value ?? '').trim();
    if (cep.length >= 8 && log.length >= 2 && cid.length >= 2) ok += 3;
    return Math.min(100, Math.round((ok / total) * 100));
  }

  resumoCnpjFormatado(): string {
    const raw = String(this.transportadoraForm?.get('pessoa.cnpj')?.value ?? '');
    return formatCnpj(raw);
  }

  toggleComplementares(): void {
    this.complementaresOpen = !this.complementaresOpen;
  }

  toggleContatos(): void {
    this.contatosOpen = !this.contatosOpen;
  }

  setTab(tab: TransportadoraTab): void {
    this.activeTab = tab;
    if (tab === 'frota') {
      this.carregarVeiculos();
      this.carregarCondutores();
    }
    if (tab === 'motoristas') this.carregarCondutores();
  }

  // ---------- Aba Cadastro ----------
  criarFormTransportadora(): void {
    this.transportadoraForm = this.fb.group({
      id: [null as number | null],
      pessoa: this.fb.group({
        razaoSocial: ['', [Validators.required, Validators.minLength(2)]],
        nomeFantasia: [''],
        cnpj: ['', [Validators.required]],
        inscricaoEstadual: [''],
        ativo: [true]
      }),
      responsavelLegal: this.fb.group({
        nome: [''],
        cpf: [''],
        telefone: [''],
        email: ['', Validators.email],
        cargo: ['']
      }),
      contatosComplementares: this.fb.array([] as FormGroup[]),
      endereco: this.fb.group({
        cep: [''],
        logradouro: [''],
        numero: [''],
        bairro: [''],
        cidade: [''],
        estado: [''],
        complemento: ['']
      })
    });
  }

  get contatosComplementares(): FormArray {
    return this.transportadoraForm.get('contatosComplementares') as FormArray;
  }

  private criarGrupoContatoComplementar(values?: {
    nome?: string;
    cpf?: string;
    telefone?: string;
    email?: string;
  }): FormGroup {
    return this.fb.group({
      nome: [values?.nome ?? ''],
      cpf: [values?.cpf ?? ''],
      telefone: [values?.telefone ?? ''],
      email: [values?.email ?? '', Validators.email]
    });
  }

  adicionarContatoComplementar(): void {
    this.contatosComplementares.push(this.criarGrupoContatoComplementar());
    this.cdr.markForCheck();
  }

  removerContatoComplementar(index: number): void {
    this.contatosComplementares.removeAt(index);
    this.cdr.markForCheck();
  }

  /**
   * Busca automática por CNPJ: debounce + distinct + switchMap.
   * Blur permanece como reforço para garantir consulta ao sair do campo.
   */
  private setupCnpjBuscaAutomatica(): void {
    const cnpjControl = this.transportadoraForm.get('pessoa.cnpj');
    if (!cnpjControl) return;
    cnpjControl.valueChanges
      .pipe(
        map((v) => this.cnpjService.normalizeCnpj(v)),
        debounceTime(700),
        distinctUntilChanged(),
        filter((v) => v.length > 0),
        switchMap((v) => {
          this.cnpjLoading = true;
          this.cnpjError = null;
          this.cnpjSuccess = null;
          this.cdr.markForCheck();
          return this.cnpjService.consultarCnpj(v);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          this.cnpjLoading = false;
          this.handleConsultaCnpjResult(result);
          this.cdr.markForCheck();
        },
        error: () => {
          this.cnpjLoading = false;
          this.cnpjError = 'Não foi possível consultar os dados do CNPJ no momento.';
          this.cnpjSuccess = null;
          this.cdr.markForCheck();
        }
      });
  }

  /** Aplica dados da consulta de CNPJ ao formulário apenas em campos vazios (não sobrescreve alterações do usuário). */
  private applyCnpjToForm(value: CnpjFormValue): void {
    const form = this.transportadoraForm;
    const pessoa = form.get('pessoa');
    const responsavel = form.get('responsavelLegal');
    const isEmpty = (v: unknown) => v == null || String(v).trim() === '';

    if (value.razaoSocial && isEmpty(pessoa?.get('razaoSocial')?.value)) {
      pessoa?.get('razaoSocial')?.setValue(value.razaoSocial, { emitEvent: false });
    }
    if (value.nomeFantasia && isEmpty(pessoa?.get('nomeFantasia')?.value)) {
      pessoa?.get('nomeFantasia')?.setValue(value.nomeFantasia, { emitEvent: false });
    }
    const ativoControl = pessoa?.get('ativo');
    if (ativoControl?.pristine) {
      ativoControl.setValue(value.ativo, { emitEvent: false });
    }
    if (value.inscricaoEstadual != null && value.inscricaoEstadual.trim() && isEmpty(pessoa?.get('inscricaoEstadual')?.value)) {
      pessoa?.get('inscricaoEstadual')?.setValue(value.inscricaoEstadual.trim(), { emitEvent: false });
    }
    if (value.email != null && value.email.trim() && isEmpty(pessoa?.get('email')?.value)) {
      pessoa?.get('email')?.setValue(value.email.trim(), { emitEvent: false });
    }
    if (value.telefone != null && value.telefone.trim() && isEmpty(responsavel?.get('telefone')?.value)) {
      responsavel?.get('telefone')?.setValue(value.telefone.trim(), { emitEvent: false });
    }

    if (value.endereco) {
      const end = form.get('endereco');
      if (end) {
        if (value.endereco.logradouro && isEmpty(end.get('logradouro')?.value)) {
          end.get('logradouro')?.setValue(value.endereco.logradouro, { emitEvent: false });
        }
        if (value.endereco.numero && isEmpty(end.get('numero')?.value)) {
          end.get('numero')?.setValue(value.endereco.numero, { emitEvent: false });
        }
        if (value.endereco.complemento && isEmpty(end.get('complemento')?.value)) {
          end.get('complemento')?.setValue(value.endereco.complemento, { emitEvent: false });
        }
        if (value.endereco.bairro && isEmpty(end.get('bairro')?.value)) {
          end.get('bairro')?.setValue(value.endereco.bairro, { emitEvent: false });
        }
        if (value.endereco.cidade && isEmpty(end.get('cidade')?.value)) {
          end.get('cidade')?.setValue(value.endereco.cidade, { emitEvent: false });
        }
        if (value.endereco.estado && isEmpty(end.get('estado')?.value)) {
          end.get('estado')?.setValue(value.endereco.estado, { emitEvent: false });
        }
        if (value.endereco.cep && isEmpty(end.get('cep')?.value)) {
          end.get('cep')?.setValue(value.endereco.cep, { emitEvent: false });
        }
      }
    }
  }

  /** Dispara busca por CNPJ ao sair do campo (blur). */
  onCnpjBlur(): void {
    this.buscarCnpj();
  }

  buscarCnpj(): void {
    const cnpjControl = this.transportadoraForm.get('pessoa.cnpj');
    cnpjControl?.markAsTouched();
    const cnpjRaw = cnpjControl?.value ?? '';
    const normalized = this.cnpjService.normalizeCnpj(cnpjRaw);
    if (this.cnpjLoading) return;
    if (normalized && normalized === this.ultimoCnpjConsultado && !this.cnpjError) return;

    this.cnpjLoading = true;
    this.cnpjError = null;
    this.cnpjSuccess = null;
    this.cdr.markForCheck();

    this.cnpjService.consultarCnpj(cnpjRaw).subscribe({
      next: (result) => {
        this.cnpjLoading = false;
        this.handleConsultaCnpjResult(result);
        this.cdr.markForCheck();
      },
      error: () => {
        this.cnpjLoading = false;
        this.cnpjError = 'Não foi possível consultar os dados do CNPJ no momento.';
        this.cnpjSuccess = null;
        this.cdr.markForCheck();
      }
    });
  }

  private handleConsultaCnpjResult(result: CnpjLookupResult): void {
    this.ultimoCnpjConsultado = result.normalizedCnpj;
    this.cnpjError = null;
    this.cnpjSuccess = null;

    if (result.status === 'success' && result.data) {
      this.applyCnpjToForm(result.data);
      this.cnpjSuccess = result.message;
      return;
    }

    if (result.status !== 'incomplete') {
      this.cnpjError = result.message;
      return;
    }

    if (this.transportadoraForm.get('pessoa.cnpj')?.touched) {
      this.cnpjError = result.message;
    }
  }

  /** Listagem via GET /api/Transportadora?... */
  carregarLista(): void {
    this.jaBuscou = true;
    this.loadingList = true;
    this.erroList = null;
    const termo = this.normalizeSearchTerm(this.termoBusca, this.campoBusca);
    const propriedade = this.resolveSearchProperty(this.campoBusca);
    this.transportadoraService
      .listarTransportadoras({
        Termo: termo || undefined,
        Propriedade: propriedade,
        NumeroPagina: this.numeroPagina,
        TamanhoPagina: this.tamanhoPaginaLista
      })
      .subscribe({
        next: (paged) => {
          this.transportadoraList = paged.items;
          if (isDevMode()) {
            console.log('LISTA USADA NA TABELA', this.transportadoras);
          }
          this.totalCount = paged.totalCount;
          this.loadingList = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.erroList = 'Erro ao carregar a lista.';
          this.loadingList = false;
          this.cdr.markForCheck();
        }
      });
  }

  onBuscar(): void {
    this.numeroPagina = 1;
    this.carregarLista();
  }

  get searchPlaceholder(): string {
    switch (this.campoBusca) {
      case 'cnpj':
        return 'Digite o CNPJ';
      case 'razaoSocial':
        return 'Digite a razão social';
      case 'nomeFantasia':
        return 'Digite o nome fantasia';
      case 'email':
        return 'Digite o e-mail';
      case 'id':
        return 'Digite o ID';
      default:
        return 'Pesquisar por razão social, nome fantasia, CNPJ ou e-mail...';
    }
  }

  /** Total de páginas da listagem atual. */
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

  get countAtivasPagina(): number {
    return this.transportadoraList.filter((i) => i.ativo).length;
  }

  get countInativasPagina(): number {
    return this.transportadoraList.filter((i) => !i.ativo).length;
  }

  get resumoListaPaginaHint(): string | null {
    return this.totalPaginasLista > 1 ? 'Nesta página' : null;
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

  /** Exibe data/hora na coluna Atualização; tolera ISO ou string não parseável. */
  formatDataAtualizacaoLista(raw: string | null | undefined): string {
    if (raw == null || String(raw).trim() === '') return '—';
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    }
    return String(raw).trim();
  }

  private resolveSearchProperty(field: TransportadoraSearchField): string | undefined {
    switch (field) {
      case 'cnpj':
        return 'Cnpj';
      case 'razaoSocial':
        return 'RazaoSocial';
      case 'nomeFantasia':
        return 'NomeFantasia';
      case 'email':
        return 'Email';
      case 'id':
        return 'Id';
      default:
        return undefined;
    }
  }

  private normalizeSearchTerm(raw: string, field: TransportadoraSearchField): string {
    const base = (raw ?? '').trim();
    if (!base) return '';
    if (field === 'cnpj' || field === 'id') return base.replace(/\D/g, '');
    return base;
  }

  novoTransportadora(): void {
    this.listView = false;
    this.transportadoraId = null;
    this.transportadoraMergeRaw = null;
    this.contatosComplementares.clear();
    this.transportadoraForm.reset({
      id: null,
      pessoa: {
        razaoSocial: '',
        nomeFantasia: '',
        cnpj: '',
        inscricaoEstadual: '',
        ativo: true
      },
      responsavelLegal: {
        nome: '',
        cpf: '',
        telefone: '',
        email: '',
        cargo: ''
      },
      endereco: {
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        complemento: ''
      }
    });
    this.erroForm = null;
    this.cnpjError = null;
    this.veiculos = [];
    this.condutores = [];
  }

  /** Preenche o formulário a partir do GET /api/Transportadora/{id} (rota `editar/:id` ou recarga). */
  private carregarTransportadoraParaEdicao(id: number): void {
    this.erroForm = null;
    this.cnpjError = null;
    this.transportadoraService.obterTransportadoraPorIdComCorpo(id).subscribe((det) => {
      if (det?.dto) {
        const dto = det.dto;
        this.transportadoraMergeRaw = det.raw;
        this.transportadoraId = dto.id != null && dto.id > 0 ? dto.id : id;
        this.contatosComplementares.clear();
        for (const c of dto.contatosComplementares ?? []) {
          this.contatosComplementares.push(this.criarGrupoContatoComplementar(c));
        }
        this.transportadoraForm.patchValue({
          id: dto.id,
          pessoa: {
            razaoSocial: dto.razaoSocial,
            nomeFantasia: dto.nomeFantasia ?? '',
            cnpj: dto.cnpj,
            inscricaoEstadual: dto.inscricaoEstadual ?? '',
            ativo: dto.ativo
          },
          responsavelLegal: {
            nome: dto.responsavelNome ?? '',
            cpf: dto.responsavelCpf ?? '',
            telefone: dto.responsavelCelular ?? dto.telefone ?? '',
            email: dto.responsavelEmail ?? '',
            cargo: dto.responsavelCargo ?? ''
          },
          endereco: dto.endereco
            ? {
                cep: dto.endereco.cep ?? '',
                logradouro: dto.endereco.logradouro ?? '',
                numero: dto.endereco.numero ?? '',
                bairro: dto.endereco.bairro ?? '',
                cidade: dto.endereco.cidade ?? '',
                estado: dto.endereco.estado ?? '',
                complemento: dto.endereco.complemento ?? ''
              }
            : { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', estado: '', complemento: '' }
        });
        this.carregarCondutores();
      } else {
        this.erroForm = 'Não foi possível carregar os dados da transportadora.';
        this.toast.error(this.erroForm);
      }
      this.cdr.markForCheck();
    });
  }

  voltarLista(): void {
    this.listView = true;
    this.activeTab = 'cadastro';
    void this.router.navigate(['/app/cadastro/transportadora']);
    this.carregarLista();
  }

  buscarCep(): void {
    const cep = this.transportadoraForm.get('endereco.cep')?.value?.replace(/\D/g, '') ?? '';
    if (cep.length !== 8) return;
    this.viacep.buscarPorCep(cep).subscribe((end) => {
      if (end) {
        this.transportadoraForm.get('endereco')?.patchValue({
          logradouro: end.logradouro,
          bairro: end.bairro,
          cidade: end.cidade,
          estado: end.estado
        });
        this.cdr.markForCheck();
      }
    });
  }

  salvarTransportadora(): void {
    if (this.transportadoraForm.invalid) {
      this.transportadoraForm.markAllAsTouched();
      return;
    }
    const formId = Number(this.transportadoraForm.get('id')?.value) || 0;
    if (formId > 0 && !this.transportadoraMergeRaw) {
      this.salvando = true;
      this.erroForm = null;
      this.transportadoraService.obterTransportadoraPorIdComCorpo(formId).subscribe({
        next: (det) => {
          if (det?.raw) {
            this.transportadoraMergeRaw = det.raw;
          }
          this.salvando = false;
          this.executarRequisicaoSalvarTransportadora();
          this.cdr.markForCheck();
        },
        error: () => {
          this.salvando = false;
          this.erroForm = 'Não foi possível recarregar o cadastro para salvar. Tente novamente.';
          this.cdr.markForCheck();
        }
      });
      return;
    }
    this.executarRequisicaoSalvarTransportadora();
  }

  private executarRequisicaoSalvarTransportadora(): void {
    const rawForm = this.transportadoraForm.getRawValue() as TransportadoraFormRawValue;
    const nowIso = new Date().toISOString();
    const payload = montarPayloadTransportadoraApi(rawForm, this.transportadoraMergeRaw, nowIso);
    const idPayload = Number(payload['id']) || 0;
    const wasEdit = idPayload > 0;

    this.salvando = true;
    this.erroForm = null;
    const obs = wasEdit
      ? this.transportadoraService.atualizarTransportadora(payload)
      : this.transportadoraService.criarTransportadora(payload);
    obs.subscribe({
      next: (saved) => {
        this.transportadoraId = saved.id ?? null;
        this.transportadoraForm.patchValue({ id: saved.id ?? null }, { emitEvent: false });
        const sid = saved.id;
        if (sid) {
          this.transportadoraService.obterTransportadoraPorIdComCorpo(sid).subscribe((det) => {
            if (det?.raw) {
              this.transportadoraMergeRaw = det.raw;
            }
            this.cdr.markForCheck();
          });
        }
        this.salvando = false;
        this.carregarVeiculos();
        this.carregarCondutores();
        this.toast.success(wasEdit ? 'Transportadora atualizada com sucesso.' : 'Transportadora cadastrada com sucesso.');
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        if (isDevMode()) {
          console.error('Erro ao salvar transportadora', { payload, err });
        }
        this.erroForm = this.mensagemDetalheErroSalvar(err);
        this.salvando = false;
        this.cdr.markForCheck();
      }
    });
  }

  private mensagemDetalheErroSalvar(err: unknown): string {
    const fallback = this.getMensagemAmigavelErroSalvar(err as { status?: number });
    const e = err as { error?: unknown };
    const body = e.error;
    if (typeof body === 'string' && body.trim()) {
      return body.trim();
    }
    if (body && typeof body === 'object') {
      const o = body as Record<string, unknown>;
      if (typeof o['detail'] === 'string' && o['detail'].trim()) {
        return String(o['detail']).trim();
      }
      if (typeof o['title'] === 'string' && o['title'].trim()) {
        return String(o['title']).trim();
      }
      const errs = o['errors'];
      if (errs && typeof errs === 'object') {
        const parts: string[] = [];
        for (const v of Object.values(errs as Record<string, unknown[]>)) {
          if (Array.isArray(v)) {
            parts.push(...v.map((x) => String(x)));
          }
        }
        if (parts.length) {
          return parts.join(' ');
        }
      }
    }
    return fallback;
  }

  private onlyDigits(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '');
  }

  private getMensagemAmigavelErroSalvar(err: { status?: number; message?: string } | null | undefined): string {
    const status = err?.status;
    if (status === 400) return 'Não foi possível salvar a transportadora. Verifique os campos obrigatórios.';
    if (status === 401 || status === 403) return 'Sessão expirada. Faça login novamente.';
    if (status === 0) return 'Não foi possível conectar ao servidor.';
    if (status != null && status >= 500) return 'Erro interno ao processar o cadastro. Verifique o contrato da API.';
    return 'Não foi possível salvar a transportadora. Tente novamente.';
  }

  excluirTransportadora(): void {
    const id = this.transportadoraForm.get('id')?.value;
    if (!id) return;
    if (!confirm('Confirma a exclusão desta transportadora?')) return;
    this.transportadoraService.excluirTransportadora(id).subscribe({
      next: () => {
        this.transportadoraId = null;
        this.voltarLista();
        this.cdr.markForCheck();
      },
      error: () => {
        this.erroForm = 'Erro ao excluir.';
        this.cdr.markForCheck();
      }
    });
  }

  /** Exclusão a partir da tabela de consulta (lista). */
  excluirTransportadoraLista(item: TransportadoraListItemDTO): void {
    const id = item?.id;
    if (!id || id <= 0) return;
    if (!confirm('Confirma a exclusão desta transportadora?')) return;
    this.transportadoraService.excluirTransportadora(id).subscribe({
      next: () => {
        this.toast.success('Transportadora excluída com sucesso.');
        this.carregarLista();
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Erro ao excluir transportadora.');
        this.cdr.markForCheck();
      }
    });
  }

  formatCnpjList(doc: string): string {
    const d = (doc ?? '').replace(/\D/g, '');
    return d.length === 14 ? formatCnpj(d) : doc ?? '';
  }

  // ---------- Aba Frota (Veículos) ----------
  carregarVeiculos(): void {
    if (this.transportadoraId == null) {
      this.veiculos = [];
      this.loadingVeiculos = false;
      this.cdr.markForCheck();
      return;
    }
    this.loadingVeiculos = true;
    this.veiculoService
      .buscar({
        TransportadoraId: this.transportadoraId,
        NumeroPagina: 1,
        TamanhoPagina: 200
      })
      .subscribe({
        next: (paged) => {
          this.veiculos = paged.items;
          this.loadingVeiculos = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.veiculos = [];
          this.loadingVeiculos = false;
          this.cdr.markForCheck();
        }
      });
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
      tipoVeiculo: [''],
      quantidadeEixos: [''],
      tipoPeso: [''],
      transportadoraId: [null as number | null],
      centroCusto: [''],
      ativo: [true]
    });
  }

  /** Formata placa: só letras e números, maiúsculo, máx. 7 caracteres (padrão do modal Entrada). */
  formatarPlacaFrota(value: string): void {
    const formatted = (value || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 7);
    this.veiculoForm.patchValue({ placa: formatted }, { emitEvent: false });
  }

  /**
   * Ao sair do campo placa: busca no backend por essa placa.
   * Se encontrar um veículo, preenche o formulário com os dados do backend (modo edição).
   */
  onPlacaBlur(): void {
    if (this.veiculoEditId != null) return;
    if (this.transportadoraId == null) return;
    const placa = (this.veiculoForm.get('placa')?.value ?? '').replace(/\s/g, '').toUpperCase();
    if (placa.length < 7) return;
    this.veiculoService
      .buscar({ Placa: placa, NumeroPagina: 1, TamanhoPagina: 5 })
      .subscribe({
        next: (paged) => {
          if (paged.items.length === 0) return;
          const primeiro = paged.items[0];
          this.veiculoService.obterPorId(primeiro.id).subscribe((dto) => {
            if (!dto) return;
            const marcaModelo = (dto.marcaModelo ?? '').trim();
            const idx = marcaModelo.indexOf(' ');
            const marca = idx >= 0 ? marcaModelo.slice(0, idx) : marcaModelo;
            const modelo = idx >= 0 ? marcaModelo.slice(idx + 1) : '';
            this.veiculoEditId = dto.id ?? null;
            this.veiculoForm.patchValue({
              id: dto.id,
              placa: dto.placa,
              motoristaId: dto.motoristaId ?? null,
              veiculoModeloId: dto.veiculoModeloId,
              marca,
              modelo,
              marcaModelo: dto.marcaModelo,
              cor: dto.cor,
              anoFabricacao: dto.anoFabricacao,
              anoModelo: dto.anoModelo,
              tipoVeiculo: dto.tipoVeiculo,
              quantidadeEixos: dto.quantidadeEixos != null ? String(dto.quantidadeEixos) : '',
              tipoPeso: dto.tipoPeso ?? '',
              transportadoraId: dto.transportadoraId ?? this.transportadoraId,
              centroCusto: dto.centroCusto,
              ativo: dto.ativo
            });
            this.aplicarTextoMotoristaFrota(dto);
            this.cdr.markForCheck();
          });
        }
      });
  }

  abrirNovoVeiculo(event?: Event): void {
    event?.stopPropagation();
    if (!this.veiculoForm) {
      this.criarFormVeiculo();
    }
    this.veiculoEditId = null;
    this.modalFrotaTab = 'veiculo';
    this.frotaMotoristaModalAberto = false;
    this.frotaMotoristaTexto = '';
    this.frotaMotoristaVinculoBusca = '';
    this.frotaMotoristaLookupContext = 'veiculo';
    this.motoristasVinculadosFrota = [];
    this.motoristaSelecionadoParaVinculo = null;
    this.frotaSelectorOpen = false;
    this.frotaSelectorTermo = '';
    this.frotaSelectorPagina = 1;
    this.motoristasSelecionadosTemp = [];
    this.frotaSelectorMotoristasLista = [];
    this.frotaSelectorMotoristasLoading = false;
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
      tipoVeiculo: '',
      quantidadeEixos: '',
      tipoPeso: '',
      transportadoraId: this.transportadoraId,
      centroCusto: '',
      ativo: true
    });
    this.ensureTransportadoraListForFrota();
    this.agendarAbrirModalVeiculo();
  }

  /** Backdrop: fecha só se o clique foi no overlay (não no card). */
  onBackdropVeiculoClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    this.fecharModalFrota(event);
  }

  /** Mesmo padrão dos outros modais da página (Importar / Motorista): flag + detecção síncrona. */
  private agendarAbrirModalVeiculo(): void {
    this.bloquearFecharModalAte = Date.now() + 500;
    this.showVeiculoForm = true;
    this.cdr.detectChanges();
  }

  /** Garante lista de transportadoras para o select do modal (carrega se vazia). */
  private ensureTransportadoraListForFrota(): void {
    if (this.transportadoraList.length === 0) {
      this.loadingList = true;
      this.transportadoraService.listarTransportadoras({ NumeroPagina: 1, TamanhoPagina: 100 }).subscribe({
        next: (res) => {
          this.transportadoraList = res.items;
          this.loadingList = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingList = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  editarVeiculo(v: VeiculoListItemDTO, event?: Event): void {
    event?.stopPropagation();
    if (!this.veiculoForm) {
      this.criarFormVeiculo();
    }
    const patchMarcaModelo = (marcaModelo: string | undefined) => {
      const s = (marcaModelo ?? '').trim();
      const idx = s.indexOf(' ');
      return idx >= 0 ? { marca: s.slice(0, idx), modelo: s.slice(idx + 1).trim() } : { marca: s, modelo: '' };
    };
    const { marca, modelo } = patchMarcaModelo(v.marcaModelo);
    this.veiculoEditId = v.id ?? null;
    this.veiculoForm.patchValue({
      id: v.id ?? null,
      placa: v.placa ?? '',
      motoristaId: null,
      veiculoModeloId: null,
      marca,
      modelo,
      marcaModelo: v.marcaModelo ?? '',
      cor: v.cor ?? '',
      anoFabricacao: v.anoFabricacao ?? null,
      anoModelo: v.anoModelo ?? null,
      tipoVeiculo: v.tipoVeiculo ?? '',
      quantidadeEixos: '',
      tipoPeso: '',
      transportadoraId: v.transportadoraId ?? this.transportadoraId,
      centroCusto: v.centroCusto ?? '',
      ativo: v.ativo ?? true
    });
    this.modalFrotaTab = 'veiculo';
    this.frotaSelectorOpen = false;
    this.frotaSelectorTermo = '';
    this.frotaSelectorPagina = 1;
    this.motoristasSelecionadosTemp = [];
    this.frotaSelectorMotoristasLista = [];
    this.frotaSelectorMotoristasLoading = false;
    this.ensureTransportadoraListForFrota();
    this.agendarAbrirModalVeiculo();

    this.veiculoService.obterPorId(v.id).subscribe((dto) => {
      if (dto) {
        const parsed = patchMarcaModelo(dto.marcaModelo);
        this.veiculoEditId = dto.id ?? null;
        this.veiculoForm.patchValue({
          id: dto.id,
          placa: dto.placa,
          motoristaId: dto.motoristaId ?? null,
          veiculoModeloId: dto.veiculoModeloId,
          marca: parsed.marca,
          modelo: parsed.modelo,
          marcaModelo: dto.marcaModelo,
          cor: dto.cor,
          anoFabricacao: dto.anoFabricacao,
          anoModelo: dto.anoModelo,
          tipoVeiculo: dto.tipoVeiculo,
          quantidadeEixos: dto.quantidadeEixos != null ? String(dto.quantidadeEixos) : '',
          tipoPeso: dto.tipoPeso ?? '',
          transportadoraId: dto.transportadoraId ?? this.transportadoraId,
          centroCusto: dto.centroCusto,
          ativo: dto.ativo
        });
        this.aplicarTextoMotoristaFrota(dto);
        this.hidratarVinculosComMotoristaPrincipal();
        this.cdr.markForCheck();
      }
    }, () => {
      this.toast.error('Não foi possível carregar todos os dados do veículo para edição.');
      this.cdr.markForCheck();
    });
  }

  salvarVeiculo(): void {
    if (this.veiculoForm.invalid) {
      this.veiculoForm.markAllAsTouched();
      return;
    }
    const v = this.veiculoForm.value;
    const transportadoraId = this.transportadoraId;
    if (transportadoraId == null) {
      this.toast.error('Salve primeiro o cadastro da transportadora para vincular a frota.');
      return;
    }
    const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(' ').trim() || undefined;
    const motoristaId =
      v.motoristaId != null && Number(v.motoristaId) > 0 ? Number(v.motoristaId) : undefined;
    const dto: VeiculoDTO = {
      id: v.id && v.id > 0 ? v.id : undefined,
      transportadoraId,
      placa: (v.placa ?? '').replace(/\s/g, '').toUpperCase(),
      motoristaId,
      veiculoModeloId: v.veiculoModeloId || undefined,
      marcaModelo: marcaModelo ?? v.marcaModelo,
      cor: v.cor,
      anoFabricacao: v.anoFabricacao,
      anoModelo: v.anoModelo,
      tipoVeiculo: v.tipoVeiculo,
      centroCusto: v.centroCusto,
      ativo: v.ativo
    };
    this.salvandoVeiculo = true;
    const obs = dto.id ? this.veiculoService.alterar(dto) : this.veiculoService.gravar(dto);
    obs.subscribe({
      next: () => {
        this.salvandoVeiculo = false;
        this.veiculoEditId = null;
        this.showVeiculoForm = false;
        this.carregarVeiculos();
        this.toast.success(dto.id ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.');
        this.cdr.markForCheck();
      },
      error: () => {
        this.salvandoVeiculo = false;
        this.toast.error('Não foi possível salvar o veículo.');
        this.cdr.markForCheck();
      }
    });
  }

  excluirVeiculo(veiculo: VeiculoListItemDTO): void {
    if (!confirm('Excluir este veículo?')) return;
    if (veiculo.id <= 0) return;
    this.veiculoService.excluir(veiculo.id).subscribe({
      next: () => this.carregarVeiculos(),
      error: () => this.cdr.markForCheck()
    });
  }

  /** Fecha o modal Cadastrar frota (Fechar, X ou clique fora). */
  fecharModalFrota(event?: Event): void {
    if (event && Date.now() < this.bloquearFecharModalAte) {
      return;
    }
    this.showVeiculoForm = false;
    this.frotaMotoristaModalAberto = false;
    this.modalFrotaTab = 'veiculo';
    this.frotaSelectorOpen = false;
    this.frotaSelectorMotoristasLista = [];
    this.frotaSelectorMotoristasLoading = false;
  }

  setModalFrotaTab(tab: ModalFrotaTab): void {
    this.modalFrotaTab = tab;
    this.cdr.markForCheck();
  }

  get modalFrotaTabAtual(): ModalFrotaTab {
    return this.modalFrotaTab === 'motoristasVinculados' ? 'motoristasVinculados' : 'veiculo';
  }

  abrirBuscaMotoristaFrota(contexto: 'veiculo' | 'vinculo' = 'veiculo'): void {
    this.frotaMotoristaLookupContext = contexto;
    this.frotaMotoristaModalAberto = true;
  }

  onFrotaMotoristaCampoInput(ev: Event): void {
    const val = (ev.target as HTMLInputElement).value;
    this.frotaMotoristaTexto = val;
    this.veiculoForm.patchValue({ motoristaId: null }, { emitEvent: false });
  }

  onFrotaMotoristaSelecionado(item: PaginatedSearchItem): void {
    if (this.frotaMotoristaLookupContext === 'vinculo') {
      this.motoristaSelecionadoParaVinculo = { id: item.id, nome: item.titulo };
      this.frotaMotoristaVinculoBusca = item.titulo;
    } else {
      this.veiculoForm.patchValue({ motoristaId: item.id });
      this.frotaMotoristaTexto = item.titulo;
      this.definirMotoristaPrincipal(item.id, item.titulo);
    }
    this.frotaMotoristaModalAberto = false;
    this.cdr.markForCheck();
  }

  limparMotoristaFrota(): void {
    this.veiculoForm.patchValue({ motoristaId: null });
    this.frotaMotoristaTexto = '';
    this.motoristasVinculadosFrota = this.motoristasVinculadosFrota.map((m) => ({ ...m, principal: false }));
  }

  /** Preenche o texto do lookup com nome vindo do GET ou GET /Motorista/{id}. */
  private aplicarTextoMotoristaFrota(dto: VeiculoDTO): void {
    this.frotaMotoristaTexto = dto.motoristaNome ?? '';
    const mid = dto.motoristaId;
    if ((this.frotaMotoristaTexto ?? '').trim()) {
      this.cdr.markForCheck();
      return;
    }
    if (mid == null || mid <= 0) {
      this.cdr.markForCheck();
      return;
    }
    this.motoristaService.obterPorId(mid).subscribe({
      next: (m) => {
        this.frotaMotoristaTexto = m?.nomeCompleto ?? '';
        this.hidratarVinculosComMotoristaPrincipal();
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck()
    });
  }

  vincularMotoristaSelecionado(): void {
    const selecionado = this.motoristaSelecionadoParaVinculo;
    if (!selecionado) return;
    const existente = this.motoristasVinculadosFrota.some((m) => m.id === selecionado.id);
    if (existente) {
      this.toast.error('Este motorista já está vinculado.');
      return;
    }
    const semPrincipal = this.motoristasVinculadosFrota.every((m) => !m.principal);
    this.motoristasVinculadosFrota = [
      ...this.motoristasVinculadosFrota,
      { id: selecionado.id, nome: selecionado.nome, principal: semPrincipal }
    ];
    if (semPrincipal) {
      this.veiculoForm.patchValue({ motoristaId: selecionado.id });
      this.frotaMotoristaTexto = selecionado.nome;
    }
    this.motoristaSelecionadoParaVinculo = null;
    this.frotaMotoristaVinculoBusca = '';
    this.cdr.markForCheck();
  }

  /**
   * Motoristas retornados pela API global (sem filtro de transportadora),
   * restritos ao CPF informado (11 dígitos).
   */
  get motoristasFiltradosParaSelecao(): MotoristaListItemDTO[] {
    const cpfBusca = this.frotaSelectorCpfDigits;
    if (cpfBusca.length !== 11) return [];
    return this.frotaSelectorMotoristasLista.filter(
      (m) => String(m.cpf ?? '').replace(/\D/g, '') === cpfBusca
    );
  }

  get motoristasPaginaAtualParaSelecao(): MotoristaListItemDTO[] {
    const ini = (this.frotaSelectorPagina - 1) * this.frotaSelectorPageSize;
    return this.motoristasFiltradosParaSelecao.slice(ini, ini + this.frotaSelectorPageSize);
  }

  get totalPaginasSelecaoMotoristas(): number {
    return Math.max(1, Math.ceil(this.motoristasFiltradosParaSelecao.length / this.frotaSelectorPageSize));
  }

  get totalSelecionadosTemp(): number {
    return this.motoristasSelecionadosTemp.length;
  }

  get frotaSelectorCpfDigits(): string {
    return String(this.frotaSelectorTermo ?? '').replace(/\D/g, '');
  }

  get frotaSelectorCpfCompleto(): boolean {
    return this.frotaSelectorCpfDigits.length === 11;
  }

  onFrotaSelectorTermoInput(value: string): void {
    const cpfAntes = this.frotaSelectorCpfDigits;
    this.frotaSelectorTermo = formatCpf(value);
    this.frotaSelectorPagina = 1;
    if (this.frotaSelectorCpfDigits !== cpfAntes) {
      this.frotaSelectorMotoristasLista = [];
      this.motoristasSelecionadosTemp = [];
    }
    this.cdr.markForCheck();
  }

  /** Busca motoristas em todo o cadastro pelo CPF (sem TransportadoraId). */
  abrirSelectorMotoristasFrota(): void {
    this.frotaSelectorOpen = true;
    if (this.frotaSelectorCpfCompleto) {
      this.carregarMotoristasSelecaoFrotaGlobal();
    } else {
      this.frotaSelectorMotoristasLista = [];
      this.frotaSelectorMotoristasLoading = false;
    }
    this.cdr.markForCheck();
  }

  /**
   * GET /api/Motorista com Termo = CPF (somente dígitos). Sem TransportadoraId para incluir todas as transportadoras.
   */
  private carregarMotoristasSelecaoFrotaGlobal(): void {
    const cpf = this.frotaSelectorCpfDigits;
    if (cpf.length !== 11) {
      this.frotaSelectorMotoristasLista = [];
      return;
    }
    this.frotaSelectorMotoristasLoading = true;
    this.motoristaService
      .buscar({
        Termo: cpf,
        NumeroPagina: 1,
        TamanhoPagina: 500
      })
      .subscribe({
        next: (paged) => {
          const digitos = cpf;
          this.frotaSelectorMotoristasLista = (paged.items ?? []).filter(
            (m) => String(m.cpf ?? '').replace(/\D/g, '') === digitos
          );
          this.frotaSelectorMotoristasLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.frotaSelectorMotoristasLista = [];
          this.frotaSelectorMotoristasLoading = false;
          this.toast.error('Não foi possível buscar motoristas pelo CPF.');
          this.cdr.markForCheck();
        }
      });
  }

  fecharSelectorMotoristasFrota(): void {
    this.frotaSelectorOpen = false;
    this.cdr.markForCheck();
  }

  toggleSelecaoMotoristaTemp(id: number): void {
    if (this.motoristasSelecionadosTemp.includes(id)) {
      this.motoristasSelecionadosTemp = this.motoristasSelecionadosTemp.filter((x) => x !== id);
    } else {
      this.motoristasSelecionadosTemp = [...this.motoristasSelecionadosTemp, id];
    }
    this.cdr.markForCheck();
  }

  isMotoristaSelecionadoTemp(id: number): boolean {
    return this.motoristasSelecionadosTemp.includes(id);
  }

  aplicarSelecaoMotoristasTemp(): void {
    if (this.motoristasSelecionadosTemp.length === 0) return;
    const existentes = new Set(this.motoristasVinculadosFrota.map((m) => m.id));
    const novos = this.motoristasFiltradosParaSelecao
      .filter((m) => this.motoristasSelecionadosTemp.includes(m.id) && !existentes.has(m.id))
      .map((m) => ({ id: m.id, nome: m.nomeCompleto ?? `Motorista ${m.id}`, principal: false }));
    this.motoristasVinculadosFrota = [...this.motoristasVinculadosFrota, ...novos];
    if (!this.motoristasVinculadosFrota.some((m) => m.principal) && this.motoristasVinculadosFrota[0]) {
      this.definirMotoristaPrincipal(this.motoristasVinculadosFrota[0].id, this.motoristasVinculadosFrota[0].nome);
    }
    this.motoristasSelecionadosTemp = [];
    this.frotaSelectorOpen = false;
    this.cdr.markForCheck();
  }

  selecionarPaginaAnteriorMotoristas(): void {
    this.frotaSelectorPagina = Math.max(1, this.frotaSelectorPagina - 1);
    this.cdr.markForCheck();
  }

  selecionarProximaPaginaMotoristas(): void {
    this.frotaSelectorPagina = Math.min(this.totalPaginasSelecaoMotoristas, this.frotaSelectorPagina + 1);
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

  isVinculoPrincipal(id: number): boolean {
    return this.motoristasVinculadosFrota.some((v) => v.id === id && v.principal);
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

  definirVinculoPrincipal(id: number): void {
    const escolhido = this.motoristasVinculadosFrota.find((m) => m.id === id);
    if (!escolhido) return;
    this.definirMotoristaPrincipal(escolhido.id, escolhido.nome);
    this.cdr.markForCheck();
  }

  private definirMotoristaPrincipal(id: number, nome: string): void {
    this.motoristasVinculadosFrota = this.motoristasVinculadosFrota.map((m) => ({
      ...m,
      principal: m.id === id
    }));
    if (!this.motoristasVinculadosFrota.some((m) => m.id === id)) {
      this.motoristasVinculadosFrota = [
        ...this.motoristasVinculadosFrota,
        { id, nome, principal: true }
      ];
    }
    this.veiculoForm.patchValue({ motoristaId: id }, { emitEvent: false });
    this.frotaMotoristaTexto = nome;
  }

  private hidratarVinculosComMotoristaPrincipal(): void {
    const id = Number(this.veiculoForm.get('motoristaId')?.value ?? 0);
    const nome = String(this.frotaMotoristaTexto ?? '').trim();
    if (!id || !nome) return;
    this.definirMotoristaPrincipal(id, nome);
  }

  /** Abre modal de importação de frota por Excel. */
  abrirImportarFrota(): void {
    this.fileFrota = null;
    this.showImportarFrota = true;
  }

  fecharImportarFrota(): void {
    this.showImportarFrota = false;
    this.fileFrota = null;
  }

  /** Abre modal de importação de condutores por Excel. */
  abrirImportarCondutores(): void {
    this.fileCondutores = null;
    this.showImportarCondutores = true;
    this.cdr.markForCheck();
  }

  fecharImportarCondutores(): void {
    this.showImportarCondutores = false;
    this.cdr.markForCheck();
  }

  onFileFrotaChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileFrota = input.files?.[0] ?? null;
  }

  /** Importar frota por Excel. TODO: integrar com endpoint quando disponível. */
  importarFrota(): void {
    if (!this.fileFrota || this.transportadoraId == null) return;
    // TODO: chamar endpoint de importação de frota quando disponível no backend
    alert('Importação de frota: integrar com backend quando o endpoint estiver disponível.');
  }

  /** Download do modelo da planilha para importação de frota. */
  downloadModeloFrota(): void {
    // TODO: gerar ou servir arquivo modelo quando disponível
    window.open('#', '_blank');
  }

  // ---------- Aba Motoristas ----------
  criarFormMotorista(): void {
    this.motoristaForm = this.fb.group({
      id: [null as number | null],
      transportadoraId: [null as number | null],
      nomeCompleto: ['', Validators.required],
      cpf: ['', Validators.required],
      email: ['', Validators.email],
      cnh: [''],
      vencimentoCnh: [''],
      ativo: [true]
    });
  }

  abrirNovoCondutor(): void {
    if (!this.motoristaForm) {
      this.criarFormMotorista();
    }
    this.condutorEditId = null;
    this.motoristaForm.reset({
      id: null,
      transportadoraId: this.transportadoraId,
      nomeCompleto: '',
      cpf: '',
      email: '',
      cnh: '',
      vencimentoCnh: '',
      ativo: true
    });
    this.showCondutorForm = true;
    this.cdr.detectChanges();
  }

  /** Fecha o modal Motorista (Fechar, X ou clique fora). */
  fecharModalCondutor(): void {
    this.showCondutorForm = false;
  }

  salvarMotorista(): void {
    if (this.motoristaForm.invalid) {
      this.motoristaForm.markAllAsTouched();
      return;
    }
    if (this.transportadoraId == null) {
      this.toast.error('Salve primeiro o cadastro da transportadora para vincular motoristas.');
      return;
    }
    const v = this.motoristaForm.value;
    const tid = this.transportadoraId;
    const dto: MotoristaDTO = {
      id: this.condutorEditId != null && this.condutorEditId > 0 ? this.condutorEditId : undefined,
      transportadoraId: tid,
      nomeCompleto: v.nomeCompleto,
      cpf: v.cpf,
      email: v.email || undefined,
      cnh: v.cnh || undefined,
      vencimentoCnh: v.vencimentoCnh || undefined,
      ativo: v.ativo !== false
    };

    this.salvandoMotorista = true;
    const request$ = dto.id ? this.motoristaService.alterar(dto) : this.motoristaService.gravar(dto);
    request$.subscribe({
      next: () => {
        this.salvandoMotorista = false;
        this.showCondutorForm = false;
        this.condutorEditId = null;
        this.carregarCondutores();
        this.toast.success(dto.id ? 'Motorista atualizado com sucesso.' : 'Motorista cadastrado com sucesso.');
        this.cdr.markForCheck();
      },
      error: () => {
        this.salvandoMotorista = false;
        this.toast.error('Erro ao salvar motorista.');
        this.cdr.markForCheck();
      }
    });
  }

  editarCondutor(c: MotoristaListItemDTO): void {
    if (!this.motoristaForm) {
      this.criarFormMotorista();
    }
    this.condutorEditId = c.id;
    this.motoristaForm.patchValue({
      id: c.id,
      transportadoraId: c.transportadoraId ?? null,
      nomeCompleto: c.nomeCompleto,
      cpf: c.cpf,
      email: c.email,
      cnh: c.cnh,
      vencimentoCnh: c.vencimentoCnh,
      ativo: c.ativo
    });
    this.showCondutorForm = true;
    this.cdr.detectChanges();
  }

  formatCpfCondutor(cpf: string): string {
    const d = (cpf ?? '').replace(/\D/g, '');
    return d.length === 11 ? formatCpf(d) : cpf ?? '';
  }

  onFileCondutores(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileCondutores = input.files?.[0] ?? null;
  }

  importarCondutores(): void {
    if (!this.fileCondutores || this.transportadoraId == null) return;
    this.fecharImportarCondutores();
  }

  downloadModeloCondutores(): void {
    window.open('#', '_blank');
  }

  carregarCondutores(): void {
    if (this.transportadoraId == null) {
      this.condutores = [];
      this.loadingCondutores = false;
      this.cdr.markForCheck();
      return;
    }
    this.loadingCondutores = true;
    this.motoristaService
      .buscar({
        TransportadoraId: this.transportadoraId,
        NumeroPagina: 1,
        TamanhoPagina: 200
      })
      .subscribe({
        next: (paged) => {
          this.condutores = paged.items;
          this.loadingCondutores = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.condutores = [];
          this.loadingCondutores = false;
          this.cdr.markForCheck();
        }
      });
  }

  excluirCondutor(condutor: MotoristaListItemDTO): void {
    if (!confirm('Excluir este motorista?')) return;
    if (condutor.id <= 0) return;
    this.motoristaService.excluir(condutor.id).subscribe({
      next: () => this.carregarCondutores(),
      error: () => this.toast.error('Erro ao excluir motorista.')
    });
  }

}

