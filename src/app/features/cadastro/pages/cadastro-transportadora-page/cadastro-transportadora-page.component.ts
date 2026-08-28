import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef, isDevMode } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, filter, map, switchMap, of, catchError, finalize, Subject } from 'rxjs';
import { TransportadoraService } from '../../services/transportadora.service';
import { VeiculoService } from '../../services/veiculo.service';
import { ViacepService } from '../../services/viacep.service';
import { CnpjLookupResult, CnpjService } from '../../services/cnpj.service';
import { TransportadoraListItemDTO } from '../../models/transportadora.dto';
import { VeiculoDTO, VeiculoListItemDTO, VeiculoMotoristaVinculoDTO } from '../../models/veiculo.dto';
import { CnpjFormValue } from '../../models/brasilapi-cnpj.model';
import { ImportacaoTransportadoraConsulta } from '../../models/importacao-transportadora.models';
import { CnpjFormatDirective, formatCnpj } from '../../directives/cnpj-format.directive';
import { TelefoneFormatDirective, formatTelefone } from '../../directives/telefone-format.directive';
import { CpfFormatDirective, formatCpf } from '../../directives/cpf-format.directive';
import { PlacaFormatDirective } from '../../directives/placa-format.directive';
import { ToastService } from '../../../../core/api/services/toast.service';
import { ApiError } from '../../../../core/api/models';
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
import { CadastroConfirmDialogComponent } from '../../components/cadastro-confirm-dialog/cadastro-confirm-dialog.component';
import { PaginatedSearchItem } from '../../../../shared/models/paginated-search.models';
import { EstSummaryMetricComponent } from '../../components/est-summary-metric/est-summary-metric.component';
import { EstStatusPillEstacionamentoComponent } from '../../components/est-status-pill-estacionamento/est-status-pill-estacionamento.component';
import { TransportadoraViewDialogComponent } from '../../components/transportadora-view-dialog/transportadora-view-dialog.component';
import { formatPlacaDisplay, normalizePlaca, placaCompleta, stripPlacaAlnum } from '../../utils/placa-br';
import { splitMarcaModelo } from '../../utils/marca-modelo';
import { parseTipoCarga, TIPO_CARGA_OPCOES, tipoCargaLabel } from '../../../../shared/models/tipo-carga';
import { cpfCompletoValidator, celularCompletoValidator } from '../../validators/cpf-celular.validator';

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
    PlacaFormatDirective,
    ModalBuscaMotoristaComponent,
    EstSummaryMetricComponent,
    EstStatusPillEstacionamentoComponent,
    MatDialogModule,
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
  private dialog = inject(MatDialog);

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
  tamanhoPaginaLista = 25;
  readonly opcoesTamanhoPaginaLista: number[] = [10, 25, 50];
  transportadoraForm!: FormGroup;
  salvando = false;
  erroForm: string | null = null;
  /** Busca automática CNPJ (BrasilAPI): loading e mensagem de erro abaixo do campo. */
  cnpjLoading = false;
  cnpjError: string | null = null;
  cnpjSuccess: string | null = null;
  private ultimoCnpjConsultado = '';
  /** Oferta de importação da rede (Central) após consulta local→central. */
  importacaoRede: ImportacaoTransportadoraConsulta | null = null;
  importacaoRedeLoading = false;
  importacaoEnfileirando = false;
  importacaoJobId: number | null = null;
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
  /**
   * Único critério de habilitação do botão "Salvar veículo" (app zoneless):
   * placa BR com 7 caracteres. Demais campos do modal são opcionais.
   */
  placaFrotaValida = false;
  modalFrotaTab: ModalFrotaTab = 'veiculo';
  /** Ids de linhas da grade de frota com expansor aberto. */
  frotaLinhasExpandidas = new Set<number>();
  /** Ids em carregamento de detalhe de motoristas no expansor. */
  frotaExpandLoadingIds = new Set<number>();
  /** Ids cujo detalhe de motoristas já foi buscado (evita GET repetido). */
  frotaExpandFetchedIds = new Set<number>();
  /** Lookup de motorista no modal frota (mesmo padrão da tela Entrada/saída). */
  frotaMotoristaModalAberto = false;
  frotaMotoristaTexto = '';
  frotaMotoristaLookupContext: 'veiculo' | 'vinculo' = 'veiculo';
  motoristasVinculadosFrota: Array<{
    id: number;
    nome: string;
    cnh?: string;
    validadeCnh?: string;
    principal: boolean;
  }> = [];
  /** Opções para quantidade de eixos (modal frota). */
  eixosOpcoes: number[] = [2, 3, 4, 5, 6, 7, 8, 9];
  /** Opções do enum `TipoCarga` do backend. */
  readonly tipoCargaOpcoes = TIPO_CARGA_OPCOES;
  /** Modal Importar frota (Excel). */
  showImportarFrota = false;
  fileFrota: File | null = null;
  importandoFrota = false;
  baixandoModeloFrota = false;

  /** Modal Importar transportadoras (Excel modelo padrão). */
  showImportarDados = false;
  fileDados: File | null = null;
  importandoDados = false;
  baixandoModelo = false;

  // --- Aba Motoristas ---
  condutores: MotoristaListItemDTO[] = [];
  loadingCondutores = false;
  showCondutorForm = false;
  motoristaForm!: FormGroup;
  condutorEditId: number | null = null;
  salvandoMotorista = false;
  /** Lookup por CPF no modal de novo motorista. */
  motoristaCpfBuscando = false;
  motoristaJaCadastradoEncontrado = false;
  /** CPF encontrado já vinculado à transportadora em edição. */
  motoristaJaVinculadoNesta = false;
  /** CPF encontrado vinculado a outra transportadora (transferência permitida ao confirmar). */
  motoristaVinculoOutraTransportadora = false;
  motoristaAceitouVinculo = false;
  private motoristaEncontradoCache: MotoristaListItemDTO | null = null;
  private ultimoCpfMotoristaConsultado = '';
  private ignorarProximaConsultaCpf = false;
  private readonly cpfMotoristaLookup$ = new Subject<string>();
  showImportarCondutores = false;
  fileCondutores: File | null = null;
  importandoCondutores = false;
  baixandoModeloCondutores = false;
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
    if (tab === 'frota') this.carregarVeiculos();
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
    /** Em edição, Status/ativo vem exclusivamente de GET /api/Transportadora/{id}. */
    const editandoTransportadora = this.transportadoraId != null && this.transportadoraId > 0;

    if (value.razaoSocial && isEmpty(pessoa?.get('razaoSocial')?.value)) {
      pessoa?.get('razaoSocial')?.setValue(value.razaoSocial, { emitEvent: false });
    }
    if (value.nomeFantasia && isEmpty(pessoa?.get('nomeFantasia')?.value)) {
      pessoa?.get('nomeFantasia')?.setValue(value.nomeFantasia, { emitEvent: false });
    }
    if (!editandoTransportadora) {
      const ativoControl = pessoa?.get('ativo');
      if (ativoControl?.pristine) {
        ativoControl.setValue(value.ativo, { emitEvent: false });
      }
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
      this.consultarImportacaoRede(result.normalizedCnpj);
      return;
    }

    if (result.normalizedCnpj?.length === 14) {
      this.consultarImportacaoRede(result.normalizedCnpj);
    } else {
      this.importacaoRede = null;
    }

    if (result.status === 'incomplete') {
      if (this.transportadoraForm.get('pessoa.cnpj')?.touched) {
        this.cnpjError = result.message;
      }
      return;
    }

    this.cnpjError = result.message;
  }

  /** Após BrasilAPI (ou CNPJ válido), verifica se já existe no tenant ou na rede central. */
  private consultarImportacaoRede(cnpjDigits: string): void {
    if (this.transportadoraId != null && this.transportadoraId > 0) {
      this.importacaoRede = null;
      return;
    }
    if (!cnpjDigits || cnpjDigits.length !== 14) {
      this.importacaoRede = null;
      return;
    }

    this.importacaoRedeLoading = true;
    this.cdr.markForCheck();
    this.transportadoraService.consultarImportacaoRede(cnpjDigits).subscribe({
      next: (consulta) => {
        this.importacaoRedeLoading = false;
        this.importacaoRede = consulta;
        if (consulta?.podeImportar && consulta.nomeRazaoSocial) {
          const pessoa = this.transportadoraForm.get('pessoa');
          const isEmpty = (v: unknown) => v == null || String(v).trim() === '';
          if (isEmpty(pessoa?.get('razaoSocial')?.value)) {
            pessoa?.get('razaoSocial')?.setValue(consulta.nomeRazaoSocial, { emitEvent: false });
          }
          if (consulta.fantasia && isEmpty(pessoa?.get('nomeFantasia')?.value)) {
            pessoa?.get('nomeFantasia')?.setValue(consulta.fantasia, { emitEvent: false });
          }
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.importacaoRedeLoading = false;
        this.importacaoRede = null;
        this.cdr.markForCheck();
      }
    });
  }

  /** Enfileira importação assíncrona (workers + notificação ao usuário). */
  importarDaRede(): void {
    const cnpj = String(this.transportadoraForm.get('pessoa.cnpj')?.value ?? '').replace(/\D/g, '');
    if (!this.importacaoRede?.podeImportar || cnpj.length !== 14 || this.importacaoEnfileirando) return;

    this.importacaoEnfileirando = true;
    this.cdr.markForCheck();
    this.transportadoraService.enfileirarImportacaoRede(cnpj).subscribe({
      next: (res) => {
        this.importacaoEnfileirando = false;
        if (res.ok) {
          this.importacaoJobId = res.data?.id ?? null;
          this.toast.success(
            res.message ||
              'Importação enfileirada. Você será avisado no sino quando cadastro, frota e motoristas forem copiados.'
          );
          this.importacaoRede = this.importacaoRede
            ? { ...this.importacaoRede, podeImportar: false, mensagem: 'Importação em andamento…' }
            : null;
        } else {
          this.toast.error(res.message || 'Não foi possível enfileirar a importação.');
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.importacaoEnfileirando = false;
        this.toast.error('Não foi possível enfileirar a importação.');
        this.cdr.markForCheck();
      }
    });
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

  /** Telefone da listagem (`responsavelTelefone` / `contato`). */
  formatTelefoneLista(raw: string | null | undefined): string {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) return '—';
    return formatTelefone(digits);
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
        this.transportadoraForm.patchValue(
          {
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
          },
          { emitEvent: false }
        );
        // Evita reconsulta CNPJ sobrescrever Status após hidratar de /Transportadora/{id}.
        this.ultimoCnpjConsultado = this.cnpjService.normalizeCnpj(dto.cnpj);
        // Cada aba carrega o próprio endpoint (Frota ≠ Motoristas).
        if (this.activeTab === 'frota') this.carregarVeiculos();
        if (this.activeTab === 'motoristas') this.carregarCondutores();
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
        if (this.activeTab === 'frota') this.carregarVeiculos();
        if (this.activeTab === 'motoristas') this.carregarCondutores();
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

  /** Visualização somente leitura (mesmo padrão do modal de Config. Cobrança). */
  visualizarTransportadora(item: TransportadoraListItemDTO): void {
    if (!item?.id) return;
    const ref = this.dialog.open(TransportadoraViewDialogComponent, {
      width: '480px',
      maxWidth: '96vw',
      panelClass: 'trn-view-dialog-panel',
      data: { item }
    });
    ref.afterClosed().subscribe((result) => {
      if (result === 'edit') {
        void this.router.navigate(['/app/cadastro/transportadora/editar', item.id]);
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
      this.frotaLinhasExpandidas.clear();
      this.frotaExpandFetchedIds.clear();
      this.frotaExpandLoadingIds.clear();
      this.loadingVeiculos = false;
      this.cdr.markForCheck();
      return;
    }
    this.loadingVeiculos = true;
    this.frotaLinhasExpandidas.clear();
    this.frotaExpandFetchedIds.clear();
    this.frotaExpandLoadingIds.clear();
    this.veiculoService
      .buscar({
        TransportadoraId: this.transportadoraId,
        NumeroPagina: 1,
        TamanhoPagina: 200
      })
      .subscribe({
        next: (paged) => {
          this.veiculos = paged.items;
          this.enriquecerMotoristasFrotaComCondutores();
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

  /** Expande/recolhe motoristas vinculados na linha da frota. */
  toggleFrotaLinhaExpandida(v: VeiculoListItemDTO, event?: Event): void {
    event?.stopPropagation();
    const id = v.id;
    if (id <= 0) return;
    if (this.frotaLinhasExpandidas.has(id)) {
      this.frotaLinhasExpandidas.delete(id);
      this.cdr.markForCheck();
      return;
    }
    this.frotaLinhasExpandidas.add(id);
    this.garantirDetalheMotoristasFrota(v);
    this.cdr.markForCheck();
  }

  isFrotaLinhaExpandida(id: number): boolean {
    return this.frotaLinhasExpandidas.has(id);
  }

  isFrotaExpandLoading(id: number): boolean {
    return this.frotaExpandLoadingIds.has(id);
  }

  /**
   * Completa CPF/nome a partir da lista local de motoristas da transportadora
   * e, se ainda faltar vínculo/CPF, busca o detalhe do veículo uma vez.
   */
  private garantirDetalheMotoristasFrota(v: VeiculoListItemDTO): void {
    this.enriquecerMotoristasFrotaComCondutores();
    const atual = this.veiculos.find((x) => x.id === v.id) ?? v;
    const lista = atual.motoristas ?? [];
    const precisaDetalhe =
      lista.length === 0 || lista.some((m) => !String(m.cpf ?? '').trim());
    if (
      !precisaDetalhe ||
      this.frotaExpandFetchedIds.has(v.id) ||
      this.frotaExpandLoadingIds.has(v.id)
    ) {
      return;
    }

    this.frotaExpandLoadingIds.add(v.id);
    this.veiculoService.obterPorId(v.id).subscribe({
      next: (dto) => {
        this.frotaExpandLoadingIds.delete(v.id);
        this.frotaExpandFetchedIds.add(v.id);
        if (dto?.motoristasVinculos?.length) {
          this.atualizarMotoristasNaLinhaFrota(v.id, dto.motoristasVinculos);
        }
        this.enriquecerMotoristasFrotaComCondutores();
        this.cdr.markForCheck();
      },
      error: () => {
        this.frotaExpandLoadingIds.delete(v.id);
        this.frotaExpandFetchedIds.add(v.id);
        this.cdr.markForCheck();
      }
    });
  }

  private atualizarMotoristasNaLinhaFrota(
    veiculoId: number,
    vinculos: VeiculoMotoristaVinculoDTO[]
  ): void {
    this.veiculos = this.veiculos.map((row) => {
      if (row.id !== veiculoId) return row;
      const atuais = row.motoristas ?? [];
      const byId = new Map<number, VeiculoMotoristaVinculoDTO>();
      for (const prev of atuais) {
        if (prev.id > 0) byId.set(prev.id, { ...prev });
      }
      for (const vinc of vinculos) {
        if (vinc.id <= 0) continue;
        const prev = byId.get(vinc.id);
        byId.set(vinc.id, {
          ...prev,
          ...vinc,
          cpf: vinc.cpf || prev?.cpf,
          nome: vinc.nome || prev?.nome || `Motorista ${vinc.id}`,
          principal: vinc.principal ?? prev?.principal
        });
      }
      return { ...row, motoristas: [...byId.values()] };
    });
  }

  /** Preenche CPF/nome dos vínculos da frota com a lista de motoristas da transportadora. */
  private enriquecerMotoristasFrotaComCondutores(): void {
    if (this.veiculos.length === 0 || this.condutores.length === 0) return;
    this.veiculos = this.veiculos.map((row) => {
      const motoristas = row.motoristas;
      if (!motoristas?.length) return row;
      let changed = false;
      const next = motoristas.map((m) => {
        const c = this.condutores.find((x) => x.id === m.id);
        if (!c) return m;
        const cpf = m.cpf || String(c.cpf ?? '').replace(/\D/g, '') || undefined;
        const nome =
          m.nome && !m.nome.startsWith('Motorista ')
            ? m.nome
            : c.nomeCompleto || m.nome;
        if (cpf === m.cpf && nome === m.nome) return m;
        changed = true;
        return { ...m, cpf, nome };
      });
      return changed ? { ...row, motoristas: next } : row;
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
      tipoCarga: [null as number | null],
      quantidadeEixos: [''],
      transportadoraId: [null as number | null],
      centroCusto: [''],
      ativo: [true]
    });
  }

  /** Formata placa Mercosul/antiga com hífen e atualiza flag do botão Salvar (zoneless). */
  formatarPlacaFrota(value: string): void {
    const formatted = formatPlacaDisplay(value);
    this.veiculoForm.patchValue({ placa: formatted }, { emitEvent: false });
    this.atualizarPlacaFrotaValida(formatted);
  }

  /** Atualiza flag do botão Salvar (zoneless não reavalia getter sozinho sem markForCheck). */
  private atualizarPlacaFrotaValida(placa?: string): void {
    this.placaFrotaValida = placaCompleta(placa ?? this.veiculoForm?.get('placa')?.value);
    this.cdr.markForCheck();
  }

  /**
   * Ao sair do campo placa: busca no backend por essa placa.
   * Se encontrar um veículo, preenche o formulário com os dados do backend (modo edição).
   */
  onPlacaBlur(): void {
    if (this.veiculoEditId != null) return;
    if (this.transportadoraId == null) return;
    const placa = normalizePlaca(this.veiculoForm.get('placa')?.value);
    if (!placaCompleta(placa)) return;
    this.veiculoService
      .buscar({ Placa: placa, NumeroPagina: 1, TamanhoPagina: 5 })
      .subscribe({
        next: (paged) => {
          if (paged.items.length === 0) return;
          const primeiro = paged.items[0];
          this.veiculoService.obterPorId(primeiro.id).subscribe((dto) => {
            if (!dto) return;
            const { marca, modelo } = this.resolveMarcaModeloForm(dto);
            this.veiculoEditId = dto.id ?? null;
            this.veiculoForm.patchValue({
              id: dto.id,
              placa: formatPlacaDisplay(dto.placa),
              motoristaId: dto.motoristaId ?? null,
              veiculoModeloId: dto.veiculoModeloId,
              marca,
              modelo,
              marcaModelo: dto.marcaModelo,
              cor: dto.cor,
              anoFabricacao: dto.anoFabricacao,
              anoModelo: dto.anoModelo,
              tipoCarga: dto.tipoCarga ?? null,
              quantidadeEixos: dto.quantidadeEixos != null ? String(dto.quantidadeEixos) : '',
              transportadoraId: dto.transportadoraId ?? this.transportadoraId,
              centroCusto: dto.centroCusto,
              ativo: dto.ativo
            });
            this.atualizarPlacaFrotaValida(dto.placa);
            this.aplicarVinculosMotoristasDoVeiculoDto(dto);
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
    this.frotaMotoristaLookupContext = 'veiculo';
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
      transportadoraId: this.transportadoraId,
      centroCusto: '',
      ativo: true
    });
    this.atualizarPlacaFrotaValida('');
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
    const { marca, modelo } = this.resolveMarcaModeloForm({ marcaModelo: v.marcaModelo });
    this.veiculoEditId = v.id ?? null;
    this.motoristasVinculadosFrota = [];
    const placaLista = formatPlacaDisplay(v.placa);
    this.veiculoForm.patchValue({
      id: v.id ?? null,
      placa: placaLista,
      motoristaId: null,
      veiculoModeloId: null,
      marca,
      modelo,
      marcaModelo: v.marcaModelo ?? '',
      cor: v.cor ?? '',
      anoFabricacao: v.anoFabricacao ?? null,
      anoModelo: v.anoModelo ?? null,
      tipoCarga: v.tipoCarga ?? null,
      quantidadeEixos: '',
      transportadoraId: v.transportadoraId ?? this.transportadoraId,
      centroCusto: v.centroCusto ?? '',
      ativo: v.ativo ?? true
    });
    this.veiculoForm.markAsPristine();
    this.veiculoForm.markAsUntouched();
    this.veiculoForm.get('placa')?.updateValueAndValidity({ emitEvent: false });
    this.atualizarPlacaFrotaValida(placaLista);
    this.modalFrotaTab = 'veiculo';
    this.ensureTransportadoraListForFrota();
    this.agendarAbrirModalVeiculo();

    this.veiculoService.obterPorId(v.id).subscribe((dto) => {
      if (dto) {
        const parsed = this.resolveMarcaModeloForm(dto);
        this.veiculoEditId = dto.id ?? null;
        const placaAtual = this.placaFrotaNormalizada;
        const placaDto = stripPlacaAlnum(dto.placa);
        const placaFinal = formatPlacaDisplay(placaDto.length > 0 ? placaDto : placaAtual);
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
          transportadoraId: dto.transportadoraId ?? this.transportadoraId,
          centroCusto: dto.centroCusto ?? '',
          ativo: dto.ativo ?? true
        });
        this.veiculoForm.get('placa')?.updateValueAndValidity({ emitEvent: false });
        this.atualizarPlacaFrotaValida(placaFinal);
        this.aplicarVinculosMotoristasDoVeiculoDto(dto);
        this.cdr.markForCheck();
      }
    }, () => {
      this.toast.error('Não foi possível carregar todos os dados do veículo para edição.');
      this.cdr.markForCheck();
    });
  }

  /** Prefere campos explícitos do GET; senão faz split seguro de `marcaModelo` (` / ` ou espaço). */
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

  salvarVeiculo(): void {
    const placa = this.placaFrotaNormalizada;
    if (!placaCompleta(placa)) {
      this.veiculoForm.get('placa')?.markAsTouched();
      this.veiculoForm.get('placa')?.updateValueAndValidity({ emitEvent: false });
      this.setModalFrotaTab('veiculo');
      this.atualizarPlacaFrotaValida(placa);
      this.toast.error('Informe a placa completa no padrão Mercosul (ex.: ABC-1D23).');
      return;
    }
    this.veiculoForm.patchValue({ placa: formatPlacaDisplay(placa) }, { emitEvent: false });
    const v = this.veiculoForm.getRawValue();
    const transportadoraId = this.transportadoraId;
    if (transportadoraId == null) {
      this.toast.error('Salve primeiro o cadastro da transportadora para vincular a frota.');
      return;
    }
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
        principal: m.principal
      })),
      veiculoModeloId: v.veiculoModeloId || undefined,
      marcaDescricao,
      modeloDescricao,
      marcaModelo: marcaModelo ?? (String(v.marcaModelo ?? '').trim() || undefined),
      cor: String(v.cor ?? '').trim() || undefined,
      anoFabricacao: v.anoFabricacao != null && Number(v.anoFabricacao) > 0 ? Number(v.anoFabricacao) : undefined,
      anoModelo: v.anoModelo != null && Number(v.anoModelo) > 0 ? Number(v.anoModelo) : undefined,
      tipoCarga: tipoCarga ?? undefined,
      ativo: v.ativo !== false
    };
    this.salvandoVeiculo = true;
    const obs = idSalvar != null ? this.veiculoService.alterar(dto) : this.veiculoService.gravar(dto);
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
  }

  setModalFrotaTab(tab: ModalFrotaTab): void {
    this.modalFrotaTab = tab;
    this.cdr.markForCheck();
  }

  get modalFrotaTabAtual(): ModalFrotaTab {
    return this.modalFrotaTab === 'motoristasVinculados' ? 'motoristasVinculados' : 'veiculo';
  }

  private get placaFrotaNormalizada(): string {
    return normalizePlaca(this.veiculoForm?.get('placa')?.value);
  }

  /** Placa formatada (Mercosul/antiga) para a grade principal de frota. */
  formatPlacaFrotaGrid(placa: string | null | undefined): string {
    const formatted = formatPlacaDisplay(placa);
    return formatted || '—';
  }

  /** Label amigável do enum TipoCarga para a grade de frota. */
  labelTipoCarga(valor: number | string | null | undefined): string {
    return tipoCargaLabel(valor) || '—';
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
      this.adicionarMotoristaVinculadoDaBusca(item);
    } else {
      this.veiculoForm.patchValue({ motoristaId: item.id });
      this.frotaMotoristaTexto = item.titulo;
      this.definirMotoristaPrincipal(item.id, item.titulo);
    }
    this.frotaMotoristaModalAberto = false;
    this.cdr.markForCheck();
  }

  /** Termo inicial da modal conforme o contexto (aba vínculos vs. demais usos). */
  get termoCampoModalBuscaMotorista(): string {
    return this.frotaMotoristaLookupContext === 'vinculo' ? '' : this.frotaMotoristaTexto;
  }

  private adicionarMotoristaVinculadoDaBusca(item: PaginatedSearchItem): void {
    const existente = this.motoristasVinculadosFrota.some((m) => m.id === item.id);
    if (existente) {
      this.toast.error('Este motorista já está vinculado.');
      return;
    }
    const nome = (item.titulo ?? '').trim() || `Motorista ${item.id}`;
    const cnhRaw = String(item.campo3 ?? '').trim();
    const cnh = cnhRaw && cnhRaw !== '—' ? cnhRaw : undefined;
    const semPrincipal = this.motoristasVinculadosFrota.every((m) => !m.principal);
    this.motoristasVinculadosFrota = [
      ...this.motoristasVinculadosFrota,
      { id: item.id, nome, cnh, principal: false }
    ];
    if (semPrincipal) {
      this.definirMotoristaPrincipal(item.id, nome);
    }
    this.cdr.markForCheck();
  }

  /** Hidrata grade de vínculos a partir do GET do veículo (listas paralelas ou motorista único). */
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
        principal: x.id === principalId
      }));
      const p = this.motoristasVinculadosFrota.find((m) => m.principal);
      if (p) {
        this.veiculoForm.patchValue({ motoristaId: p.id }, { emitEvent: false });
        this.frotaMotoristaTexto = p.nome;
      }
      return;
    }
    this.motoristasVinculadosFrota = [];
    this.aplicarTextoMotoristaFrota(dto);
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

  motoristaIniciais(nome: string): string {
    const partes = String(nome ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (partes.length === 0) return 'M';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return `${partes[0][0] ?? ''}${partes[1][0] ?? ''}`.toUpperCase();
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
  abrirImportarDados(): void {
    this.fileDados = null;
    this.showImportarDados = true;
  }

  fecharImportarDados(): void {
    if (this.importandoDados) return;
    this.showImportarDados = false;
    this.fileDados = null;
  }

  onFileDadosChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileDados = input.files?.[0] ?? null;
  }

  downloadModeloTransportadora(): void {
    if (this.baixandoModelo) return;
    this.baixandoModelo = true;
    this.transportadoraService.downloadModeloImportacao().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modelo-importacao-transportadora.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        this.baixandoModelo = false;
        this.toast.success('Modelo baixado.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.baixandoModelo = false;
        this.toast.error(err?.message ?? 'Não foi possível baixar o modelo.');
        this.cdr.markForCheck();
      }
    });
  }

  importarDadosExcel(): void {
    if (!this.fileDados || this.importandoDados) return;
    this.importandoDados = true;
    this.transportadoraService.importarDadosExcel(this.fileDados).subscribe({
      next: (r) => {
        this.importandoDados = false;
        if (!r.ok) {
          this.toast.error(r.message ?? 'Falha na importação.');
          this.cdr.markForCheck();
          return;
        }
        this.toast.success(
          r.message ||
            `Importação: ${r.sucesso ?? 0} ok, ${r.falha ?? 0} falha(s), ${r.ignorado ?? 0} ignorada(s).`
        );
        this.fecharImportarDados();
        this.carregarLista();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.importandoDados = false;
        this.toast.error(err?.message ?? 'Falha ao importar planilha.');
        this.cdr.markForCheck();
      }
    });
  }

  abrirImportarFrota(): void {
    if (this.transportadoraId == null) {
      this.toast.error('Salve a transportadora antes de importar a frota.');
      return;
    }
    this.fileFrota = null;
    this.showImportarFrota = true;
  }

  fecharImportarFrota(): void {
    if (this.importandoFrota) return;
    this.showImportarFrota = false;
    this.fileFrota = null;
  }

  /** Abre modal de importação de condutores por Excel. */
  abrirImportarCondutores(): void {
    if (this.transportadoraId == null) {
      this.toast.error('Salve a transportadora antes de importar motoristas.');
      return;
    }
    this.fileCondutores = null;
    this.showImportarCondutores = true;
    this.cdr.markForCheck();
  }

  fecharImportarCondutores(): void {
    if (this.importandoCondutores) return;
    this.showImportarCondutores = false;
    this.fileCondutores = null;
    this.cdr.markForCheck();
  }

  onFileFrotaChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileFrota = input.files?.[0] ?? null;
  }

  /** Importar frota por Excel (vinculada à transportadora aberta). */
  importarFrota(): void {
    if (!this.fileFrota || this.transportadoraId == null || this.importandoFrota) return;
    this.importandoFrota = true;
    this.veiculoService.importarDadosExcel(this.transportadoraId, this.fileFrota).subscribe({
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
        this.carregarVeiculos();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.importandoFrota = false;
        this.toast.error(err?.message ?? 'Falha ao importar frota.');
        this.cdr.markForCheck();
      }
    });
  }

  /** Download do modelo Excel de frota (report). */
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
      }
    });
  }

  // ---------- Aba Motoristas ----------
  criarFormMotorista(): void {
    this.motoristaForm = this.fb.group({
      id: [null as number | null],
      transportadoraId: [null as number | null],
      nomeCompleto: ['', Validators.required],
      cpf: ['', [cpfCompletoValidator()]],
      email: ['', Validators.email],
      celular: ['', [celularCompletoValidator()]],
      cnh: [''],
      vencimentoCnh: [''],
      ativo: [true]
    });
    this.motoristaForm.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cdr.markForCheck());

    this.motoristaForm
      .get('cpf')
      ?.valueChanges.pipe(
        takeUntilDestroyed(this.destroyRef),
        map((v) => String(v ?? '').replace(/\D/g, '')),
        distinctUntilChanged(),
        debounceTime(400)
      )
      .subscribe((cpf) => {
        if (cpf.length < 11) {
          if (this.ultimoCpfMotoristaConsultado || this.motoristaJaCadastradoEncontrado) {
            this.ultimoCpfMotoristaConsultado = '';
            this.motoristaEncontradoCache = null;
            this.motoristaJaCadastradoEncontrado = false;
            this.motoristaJaVinculadoNesta = false;
            this.motoristaVinculoOutraTransportadora = false;
            this.motoristaAceitouVinculo = false;
            this.cdr.markForCheck();
          }
          return;
        }
        this.consultarMotoristaPorCpf();
      });

    this.cpfMotoristaLookup$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((cpfDigits) => {
          this.motoristaCpfBuscando = true;
          this.cdr.markForCheck();
          return this.motoristaService.obterPorCpf(cpfDigits).pipe(
            switchMap((dto) => {
              if (!dto || !dto.id) {
                return of({ cpfDigits, dto: null as MotoristaListItemDTO | null });
              }
              // GET por CPF costuma vir incompleto; detalhe por id traz email/celular/CNH.
              return this.motoristaService.obterPorId(dto.id).pipe(
                map((full) => ({
                  cpfDigits,
                  dto: this.mesclarMotoristaLookup(dto, full)
                })),
                catchError(() =>
                  of({
                    cpfDigits,
                    dto: this.mesclarMotoristaLookup(dto, null)
                  })
                )
              );
            }),
            catchError((err: unknown) => {
              const status =
                err && typeof err === 'object' && 'status' in err
                  ? Number((err as { status?: unknown }).status)
                  : 0;
              // 404 já vira null no service; se ainda chegar aqui, não assusta o usuário.
              if (status === 404 || status === 204) {
                return of({
                  cpfDigits,
                  dto: null as MotoristaListItemDTO | null
                });
              }
              this.toast.error('Não foi possível consultar o CPF do motorista.');
              return of({
                cpfDigits,
                dto: null as MotoristaListItemDTO | null,
                falhou: true as const
              });
            }),
            finalize(() => {
              this.motoristaCpfBuscando = false;
              this.cdr.markForCheck();
            })
          );
        })
      )
      .subscribe((resultado) => {
        if (!this.showCondutorForm || this.ignorarProximaConsultaCpf) return;
        const cpfAtual = String(this.motoristaForm?.get('cpf')?.value ?? '').replace(/\D/g, '');
        if (cpfAtual !== resultado.cpfDigits) return;
        if ('falhou' in resultado && resultado.falhou) {
          this.ultimoCpfMotoristaConsultado = '';
          this.cdr.markForCheck();
          return;
        }
        if (!resultado.dto) {
          this.motoristaEncontradoCache = null;
          this.motoristaJaCadastradoEncontrado = false;
          this.motoristaJaVinculadoNesta = false;
          this.motoristaVinculoOutraTransportadora = false;
          this.motoristaAceitouVinculo = false;
          this.cdr.markForCheck();
          return;
        }
        this.perguntarVinculoMotoristaExistente(resultado.dto);
      });
  }

  abrirNovoCondutor(): void {
    if (!this.motoristaForm) {
      this.criarFormMotorista();
    }
    this.limparEstadoLookupMotorista();
    this.condutorEditId = null;
    this.ignorandoConsultaTemporaria(() => {
      this.motoristaForm.reset({
        id: null,
        transportadoraId: this.transportadoraId,
        nomeCompleto: '',
        cpf: '',
        email: '',
        celular: '',
        cnh: '',
        vencimentoCnh: '',
        ativo: true
      });
    });
    this.showCondutorForm = true;
    this.cdr.detectChanges();
  }

  /** Fecha o modal Motorista (Fechar, X ou clique fora). */
  fecharModalCondutor(): void {
    this.showCondutorForm = false;
    this.limparEstadoLookupMotorista();
  }

  onCpfMotoristaBlur(): void {
    this.consultarMotoristaPorCpf();
  }

  reperguntarVinculoMotorista(): void {
    const dto = this.motoristaEncontradoCache;
    if (!dto) return;
    this.perguntarVinculoMotoristaExistente(dto);
  }

  private limparEstadoLookupMotorista(): void {
    this.motoristaCpfBuscando = false;
    this.motoristaJaCadastradoEncontrado = false;
    this.motoristaJaVinculadoNesta = false;
    this.motoristaVinculoOutraTransportadora = false;
    this.motoristaAceitouVinculo = false;
    this.motoristaEncontradoCache = null;
    this.ultimoCpfMotoristaConsultado = '';
  }

  private ignorandoConsultaTemporaria(fn: () => void): void {
    this.ignorarProximaConsultaCpf = true;
    fn();
    queueMicrotask(() => {
      this.ignorarProximaConsultaCpf = false;
    });
  }

  private mesclarMotoristaLookup(
    base: MotoristaDTO,
    detalhe: MotoristaDTO | null
  ): MotoristaListItemDTO {
    const src = detalhe ?? base;
    const tidVinculo = src.transportadoraId ?? base.transportadoraId;
    return {
      id: Number(src.id ?? base.id) || 0,
      transportadoraId: tidVinculo != null && tidVinculo > 0 ? tidVinculo : undefined,
      transportadoraNome: src.transportadoraNome ?? base.transportadoraNome,
      nomeCompleto: (src.nomeCompleto || base.nomeCompleto || '').trim(),
      cpf: src.cpf || base.cpf || '',
      email: (src.email || base.email || '').trim() || undefined,
      celular: (src.celular || base.celular || '').trim() || undefined,
      cnh: (src.cnh || base.cnh || '').trim() || undefined,
      vencimentoCnh: (src.vencimentoCnh || base.vencimentoCnh || '').trim() || undefined,
      ativo: src.ativo !== false && base.ativo !== false,
      pessoaId: src.pessoaId ?? base.pessoaId,
      pessoaFisicaId: src.pessoaFisicaId ?? base.pessoaFisicaId,
      primeiroEnderecoId: src.primeiroEnderecoId ?? base.primeiroEnderecoId,
      primeiroContatoId: src.primeiroContatoId ?? base.primeiroContatoId
    };
  }

  private consultarMotoristaPorCpf(): void {
    if (!this.showCondutorForm || this.ignorarProximaConsultaCpf) return;
    const cpfDigits = String(this.motoristaForm?.get('cpf')?.value ?? '').replace(/\D/g, '');
    if (cpfDigits.length !== 11) return;
    if (cpfDigits === this.ultimoCpfMotoristaConsultado) return;

    this.ultimoCpfMotoristaConsultado = cpfDigits;
    this.cpfMotoristaLookup$.next(cpfDigits);
  }

  private perguntarVinculoMotoristaExistente(dto: MotoristaListItemDTO): void {
    if (!this.showCondutorForm) return;

    const jaNesta =
      this.transportadoraId != null &&
      dto.transportadoraId != null &&
      dto.transportadoraId === this.transportadoraId;

    const vinculadoEmOutra =
      dto.transportadoraId != null &&
      dto.transportadoraId > 0 &&
      this.transportadoraId != null &&
      dto.transportadoraId !== this.transportadoraId;

    // Hidrata sempre. Sem exibir nome/CNPJ da outra transportadora.
    this.aplicarMotoristaEncontrado(dto, jaNesta);

    if (jaNesta) {
      this.motoristaJaVinculadoNesta = true;
      this.motoristaVinculoOutraTransportadora = false;
      this.motoristaAceitouVinculo = true;
      this.condutorEditId = dto.id > 0 ? dto.id : null;
      this.cdr.markForCheck();
      return;
    }

    this.motoristaJaVinculadoNesta = false;
    this.motoristaVinculoOutraTransportadora = vinculadoEmOutra;

    const mensagem = vinculadoEmOutra
      ? 'Encontramos este CPF no banco (já vinculado a outra transportadora) e carregamos os dados.\n\nDeseja vincular à transportadora em edição? Ao salvar, o vínculo anterior será desfeito.'
      : 'Encontramos este CPF no banco e carregamos os dados do cadastro.\n\nDeseja vincular este motorista à transportadora em edição?';

    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      width: '460px',
      autoFocus: 'dialog',
      panelClass: 'cfg-form-dialog-panel',
      data: {
        titulo: 'Motorista já cadastrado',
        mensagem,
        cancelLabel: 'Não',
        confirmLabel: 'Sim, vincular',
        confirmColor: 'primary'
      }
    });

    ref.afterClosed().subscribe((ok) => {
      if (!ok) {
        this.motoristaAceitouVinculo = false;
        this.motoristaJaVinculadoNesta = false;
        this.toast.warning('Vínculo não confirmado. Confirme o vínculo para salvar ou altere o CPF.');
        this.cdr.markForCheck();
        return;
      }
      this.motoristaAceitouVinculo = true;
      this.motoristaJaVinculadoNesta = false;
      this.condutorEditId = dto.id > 0 ? dto.id : null;
      this.cdr.markForCheck();
    });
  }

  private aplicarMotoristaEncontrado(dto: MotoristaListItemDTO, aceitouVinculo: boolean): void {
    this.motoristaEncontradoCache = dto;
    this.motoristaJaCadastradoEncontrado = true;
    this.motoristaAceitouVinculo = aceitouVinculo;
    this.condutorEditId = dto.id > 0 ? dto.id : null;
    this.ignorandoConsultaTemporaria(() => {
      this.motoristaForm.patchValue({
        id: dto.id,
        transportadoraId: this.transportadoraId,
        nomeCompleto: dto.nomeCompleto ?? '',
        cpf: dto.cpf ? formatCpf(String(dto.cpf)) : this.motoristaForm.get('cpf')?.value,
        email: dto.email ?? '',
        celular: dto.celular ? formatTelefone(String(dto.celular)) : '',
        cnh: dto.cnh ?? '',
        vencimentoCnh: dto.vencimentoCnh ?? '',
        ativo: dto.ativo !== false
      });
    });
    this.cdr.markForCheck();
  }

  salvarMotorista(): void {
    if (this.motoristaForm.invalid) {
      this.motoristaForm.markAllAsTouched();
      const cpfCtrl = this.motoristaForm.get('cpf');
      const celularCtrl = this.motoristaForm.get('celular');
      if (cpfCtrl?.errors?.['required']) {
        this.toast.error('Informe o CPF do motorista.');
      } else if (cpfCtrl?.errors?.['cpfIncompleto']) {
        this.toast.error('Informe o CPF completo (11 dígitos).');
      } else if (celularCtrl?.errors?.['celularIncompleto'] || celularCtrl?.errors?.['celularInvalido']) {
        this.toast.error('Informe o celular completo com DDD e o 9 (11 dígitos).');
      }
      return;
    }
    if (this.transportadoraId == null) {
      this.toast.error('Salve primeiro o cadastro da transportadora para vincular motoristas.');
      return;
    }
    if (this.motoristaEncontradoCache && !this.motoristaAceitouVinculo) {
      this.toast.error('Confirme o vínculo do motorista encontrado ou altere o CPF.');
      return;
    }
    const v = this.motoristaForm.value;
    const cpfDigits = String(v.cpf ?? '').replace(/\D/g, '');
    const celularDigits = String(v.celular ?? '').replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      this.toast.error('Informe o CPF completo (11 dígitos).');
      return;
    }
    if (celularDigits.length > 0 && (celularDigits.length !== 11 || celularDigits[2] !== '9')) {
      this.toast.error('Informe o celular completo com DDD e o 9 (11 dígitos).');
      return;
    }
    const tid = this.transportadoraId;
    const editSrc =
      this.condutorEditId != null && this.condutorEditId > 0
        ? this.condutores.find((x) => x.id === this.condutorEditId) ?? this.motoristaEncontradoCache ?? undefined
        : this.motoristaEncontradoCache ?? undefined;
    const transferindoVinculo =
      this.motoristaAceitouVinculo &&
      this.motoristaVinculoOutraTransportadora &&
      this.condutorEditId != null &&
      this.condutorEditId > 0;

    const dtoBase: MotoristaDTO = {
      id: this.condutorEditId != null && this.condutorEditId > 0 ? this.condutorEditId : undefined,
      // PUT com novo transportadoraId desfaz o vínculo anterior e aplica o atual.
      transportadoraId: tid,
      nomeCompleto: v.nomeCompleto,
      cpf: cpfDigits,
      email: v.email || undefined,
      celular: celularDigits || undefined,
      cnh: v.cnh || undefined,
      vencimentoCnh: v.vencimentoCnh || undefined,
      ativo: v.ativo !== false,
      pessoaId: editSrc?.pessoaId,
      pessoaFisicaId: editSrc?.pessoaFisicaId,
      primeiroEnderecoId: editSrc?.primeiroEnderecoId,
      primeiroContatoId: editSrc?.primeiroContatoId
    };

    this.salvandoMotorista = true;

    // Garante ids de pessoa no body (sem isso a API pode tratar como novo CPF e bloquear).
    const preparar$ =
      dtoBase.id != null &&
      dtoBase.id > 0 &&
      (dtoBase.pessoaId == null || dtoBase.pessoaId <= 0 || dtoBase.pessoaFisicaId == null || dtoBase.pessoaFisicaId <= 0)
        ? this.motoristaService.obterPorId(dtoBase.id).pipe(
            map((full) =>
              full
                ? {
                    ...dtoBase,
                    pessoaId: full.pessoaId ?? dtoBase.pessoaId,
                    pessoaFisicaId: full.pessoaFisicaId ?? dtoBase.pessoaFisicaId,
                    primeiroEnderecoId: full.primeiroEnderecoId ?? dtoBase.primeiroEnderecoId,
                    primeiroContatoId: full.primeiroContatoId ?? dtoBase.primeiroContatoId,
                    transportadoraNome: full.transportadoraNome ?? dtoBase.transportadoraNome
                  }
                : dtoBase
            ),
            catchError(() => of(dtoBase))
          )
        : of(dtoBase);

    preparar$
      .pipe(
        switchMap((dto) => {
          if (transferindoVinculo) {
            return this.motoristaService.transferirVinculo(dto);
          }
          return dto.id ? this.motoristaService.alterar(dto) : this.motoristaService.gravar(dto);
        })
      )
      .subscribe({
        next: () => {
          this.salvandoMotorista = false;
          this.showCondutorForm = false;
          this.condutorEditId = null;
          this.limparEstadoLookupMotorista();
          this.carregarCondutores();
          this.toast.success(
            transferindoVinculo
              ? 'Motorista vinculado com sucesso. O vínculo anterior foi desfeito.'
              : dtoBase.id
                ? 'Motorista atualizado com sucesso.'
                : 'Motorista cadastrado com sucesso.'
          );
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.salvandoMotorista = false;
          this.toast.error(this.mensagemErroApi(err, 'Erro ao salvar motorista.'));
          this.cdr.markForCheck();
        }
      });
  }

  editarCondutor(c: MotoristaListItemDTO): void {
    if (!this.motoristaForm) {
      this.criarFormMotorista();
    }
    this.limparEstadoLookupMotorista();
    this.condutorEditId = c.id;
    this.ultimoCpfMotoristaConsultado = String(c.cpf ?? '').replace(/\D/g, '');
    this.ignorandoConsultaTemporaria(() => {
      this.motoristaForm.patchValue({
        id: c.id,
        transportadoraId: c.transportadoraId ?? null,
        nomeCompleto: c.nomeCompleto,
        cpf: c.cpf ? formatCpf(String(c.cpf)) : '',
        email: c.email,
        celular: c.celular ? formatTelefone(String(c.celular)) : '',
        cnh: c.cnh,
        vencimentoCnh: c.vencimentoCnh,
        ativo: c.ativo
      });
    });
    this.showCondutorForm = true;
    this.cdr.detectChanges();

    // Complementa celular/e-mail pelo detalhe quando a listagem não trouxer o contato completo.
    this.motoristaService.obterPorId(c.id).subscribe({
      next: (dto) => {
        if (!dto || this.condutorEditId !== c.id) return;
        this.ignorandoConsultaTemporaria(() => {
          this.motoristaForm.patchValue({
            email: dto.email ?? this.motoristaForm.get('email')?.value,
            celular: dto.celular
              ? formatTelefone(String(dto.celular))
              : this.motoristaForm.get('celular')?.value,
            cnh: dto.cnh || this.motoristaForm.get('cnh')?.value,
            vencimentoCnh: dto.vencimentoCnh || this.motoristaForm.get('vencimentoCnh')?.value
          });
        });
        // Atualiza ids de merge na lista em memória para o PUT.
        const idx = this.condutores.findIndex((x) => x.id === c.id);
        if (idx >= 0) {
          this.condutores[idx] = {
            ...this.condutores[idx],
            email: dto.email ?? this.condutores[idx].email,
            celular: dto.celular ?? this.condutores[idx].celular,
            pessoaId: dto.pessoaId ?? this.condutores[idx].pessoaId,
            pessoaFisicaId: dto.pessoaFisicaId ?? this.condutores[idx].pessoaFisicaId,
            primeiroEnderecoId: dto.primeiroEnderecoId ?? this.condutores[idx].primeiroEnderecoId,
            primeiroContatoId: dto.primeiroContatoId ?? this.condutores[idx].primeiroContatoId
          };
        }
        this.cdr.markForCheck();
      }
    });
  }

  formatCpfCondutor(cpf: string): string {
    const d = (cpf ?? '').replace(/\D/g, '');
    if (!d) return '—';
    return d.length === 11 ? formatCpf(d) : cpf || '—';
  }

  formatTelefoneCondutor(telefone: string | null | undefined): string {
    const raw = String(telefone ?? '').trim();
    if (!raw) return '—';
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '—';
    return formatTelefone(digits);
  }

  onFileCondutores(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileCondutores = input.files?.[0] ?? null;
  }

  importarCondutores(): void {
    if (!this.fileCondutores || this.transportadoraId == null || this.importandoCondutores) return;
    this.importandoCondutores = true;
    this.motoristaService.importarDadosExcel(this.transportadoraId, this.fileCondutores).subscribe({
      next: (r) => {
        this.importandoCondutores = false;
        if (!r.ok) {
          this.toast.error(r.message ?? 'Falha na importação de motoristas.');
          this.cdr.markForCheck();
          return;
        }
        this.toast.success(
          r.message ||
            `Motoristas: ${r.sucesso ?? 0} ok, ${r.falha ?? 0} falha(s), ${r.ignorado ?? 0} ignorada(s).`
        );
        this.fecharImportarCondutores();
        this.carregarCondutores();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.importandoCondutores = false;
        this.toast.error(err?.message ?? 'Falha ao importar motoristas.');
        this.cdr.markForCheck();
      }
    });
  }

  downloadModeloCondutores(): void {
    if (this.baixandoModeloCondutores) return;
    this.baixandoModeloCondutores = true;
    this.motoristaService.downloadModeloImportacao().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modelo-importacao-motorista.xlsx';
        a.click();
        URL.revokeObjectURL(url);
        this.baixandoModeloCondutores = false;
        this.toast.success('Modelo de motoristas baixado.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.baixandoModeloCondutores = false;
        this.toast.error(err?.message ?? 'Não foi possível baixar o modelo de motoristas.');
        this.cdr.markForCheck();
      }
    });
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
          this.enriquecerMotoristasFrotaComCondutores();
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
    if (condutor.id <= 0) return;

    const nome = (condutor.nomeCompleto || '').trim() || 'este motorista';
    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      width: '420px',
      autoFocus: 'dialog',
      data: {
        titulo: 'Excluir motorista',
        mensagem: `Confirma a exclusão de "${nome}"? Esta ação não pode ser desfeita.`,
        confirmLabel: 'Excluir',
        confirmColor: 'warn'
      }
    });

    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.motoristaService.excluir(condutor.id).subscribe({
        next: () => {
          this.carregarCondutores();
          this.toast.success('Motorista excluído com sucesso.');
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.toast.error(this.mensagemErroApi(err, 'Erro ao excluir motorista.'));
          this.cdr.markForCheck();
        }
      });
    });
  }

  /** Preferência: message do ApiError (já com notifications) → fallback. Sem nome/CNPJ de transportadora. */
  private mensagemErroApi(err: unknown, fallback: string): string {
    let raw = '';
    if (err && typeof err === 'object') {
      const api = err as ApiError & {
        error?: {
          notifications?: unknown;
          Notifications?: unknown;
          message?: string;
          Message?: string;
        };
        notifications?: unknown;
        Notifications?: unknown;
      };
      const notes =
        api.notifications ??
        api.Notifications ??
        api.error?.notifications ??
        api.error?.Notifications;
      if (Array.isArray(notes) && notes.length) {
        const text = notes.filter((n): n is string => typeof n === 'string').join(' ').trim();
        if (text) raw = text;
      }
      if (!raw && typeof api.message === 'string' && api.message.trim()) raw = api.message.trim();
      if (!raw) {
        const nestedMsg = api.error?.message ?? api.error?.Message;
        if (typeof nestedMsg === 'string' && nestedMsg.trim()) raw = nestedMsg.trim();
      }
    }
    if (!raw && err instanceof Error && err.message.trim()) raw = err.message.trim();
    if (!raw) return fallback;
    return this.sanitizarMensagemMotoristaSemTransportadora(raw) || fallback;
  }

  /** Remove CNPJ/nome de transportadora de mensagens da API (privacidade na UI). */
  private sanitizarMensagemMotoristaSemTransportadora(message: string): string {
    const text = String(message ?? '').trim();
    if (!text) return text;
    if (/já cadastrado.*transportadora|não é permitido vincular/i.test(text)) {
      return 'Não foi possível transferir o vínculo deste motorista. Tente salvar novamente.';
    }
    return text
      .replace(/\bCNPJ\s*[:\-]?\s*\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/gi, '')
      .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '')
      .replace(/\bna transportadora\b[^.]*/gi, 'em outra transportadora')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+\./g, '.')
      .trim();
  }

}

