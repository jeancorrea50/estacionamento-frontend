import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, of, Subject, switchMap } from 'rxjs';
import { MotoristaService } from '../../services/motorista.service';
import { TransportadoraService } from '../../services/transportadora.service';
import {
  MotoristaDTO,
  MotoristaListItemDTO,
} from '../../models/motorista.dto';
import { TransportadoraListItemDTO } from '../../models/transportadora.dto';
import { CpfFormatDirective, formatCpf } from '../../directives/cpf-format.directive';
import { TelefoneFormatDirective, formatTelefone } from '../../directives/telefone-format.directive';
import { ToastService } from '../../../../core/api/services/toast.service';
import { ApiError } from '../../../../core/api/models';
import { EstSummaryMetricComponent } from '../../components/est-summary-metric/est-summary-metric.component';
import { EstStatusPillEstacionamentoComponent } from '../../components/est-status-pill-estacionamento/est-status-pill-estacionamento.component';
import { CadastroConfirmDialogComponent } from '../../components/cadastro-confirm-dialog/cadastro-confirm-dialog.component';
import { cpfCompletoValidator, celularCompletoValidator } from '../../validators/cpf-celular.validator';

type MotoristaSearchField = 'geral' | 'cpf';

@Component({
  selector: 'app-cadastro-motoristas-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CpfFormatDirective,
    TelefoneFormatDirective,
    EstSummaryMetricComponent,
    EstStatusPillEstacionamentoComponent,
    MatDialogModule,
  ],
  templateUrl: './cadastro-motoristas-page.component.html',
  styleUrls: ['./cadastro-motoristas-page.component.scss'],
})
export class CadastroMotoristasPageComponent implements OnInit {
  private motoristaService = inject(MotoristaService);
  private transportadoraService = inject(TransportadoraService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private dialog = inject(MatDialog);

  condutores: MotoristaListItemDTO[] = [];
  transportadoras: TransportadoraListItemDTO[] = [];
  loadingList = false;
  erroList: string | null = null;
  jaBuscou = false;
  termoBusca = '';
  campoBusca: MotoristaSearchField = 'geral';
  numeroPagina = 1;
  totalCount = 0;
  tamanhoPaginaLista = 25;
  readonly opcoesTamanhoPaginaLista: number[] = [10, 25, 50];

  showCondutorForm = false;
  motoristaForm!: FormGroup;
  condutorEditId: number | null = null;
  salvandoMotorista = false;
  motoristaCpfBuscando = false;
  motoristaJaCadastradoEncontrado = false;
  motoristaJaVinculadoNesta = false;
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
  importTransportadoraId: number | null = null;

  ngOnInit(): void {
    this.criarFormMotorista();
    this.carregarTransportadoras();
  }

  get searchPlaceholder(): string {
    return this.campoBusca === 'cpf' ? 'Digite o CPF' : 'Pesquisar por nome ou CPF...';
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
    return this.condutores.filter((i) => i.ativo).length;
  }

  get countInativosPagina(): number {
    return this.condutores.filter((i) => !i.ativo).length;
  }

  get resumoListaPaginaHint(): string | null {
    return this.totalPaginasLista > 1 ? 'Nesta página' : null;
  }

  get transportadoraIdForm(): number | null {
    const v = Number(this.motoristaForm?.get('transportadoraId')?.value);
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
    const termo = this.normalizeSearchTerm(this.termoBusca, this.campoBusca);
    this.motoristaService
      .buscar({
        Termo: termo || undefined,
        NumeroPagina: this.numeroPagina,
        TamanhoPagina: this.tamanhoPaginaLista,
      })
      .subscribe({
        next: (paged) => {
          this.condutores = paged.items;
          this.totalCount = paged.totalCount;
          this.loadingList = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.erroList = 'Erro ao carregar a lista de motoristas.';
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

  transportadoraLabel(id: number | null | undefined, nome?: string): string {
    if (nome?.trim()) return nome.trim();
    if (id == null || id <= 0) return '—';
    const t = this.transportadoras.find((x) => x.id === id);
    return t?.nomeFantasia?.trim() || t?.razaoSocial?.trim() || `ID ${id}`;
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

  private normalizeSearchTerm(raw: string, field: MotoristaSearchField): string {
    const base = (raw ?? '').trim();
    if (!base) return '';
    if (field === 'cpf') return base.replace(/\D/g, '');
    return base;
  }

  criarFormMotorista(): void {
    this.motoristaForm = this.fb.group({
      id: [null as number | null],
      transportadoraId: [null as number | null, Validators.required],
      nomeCompleto: ['', Validators.required],
      cpf: ['', [cpfCompletoValidator()]],
      email: ['', Validators.email],
      celular: ['', [celularCompletoValidator()]],
      cnh: [''],
      vencimentoCnh: [''],
      ativo: [true],
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
            this.limparEstadoLookupMotorista(false);
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
              if (!dto?.id) return of({ cpfDigits, dto: null as MotoristaListItemDTO | null });
              return this.motoristaService.obterPorId(dto.id).pipe(
                map((full) => ({ cpfDigits, dto: this.mesclarMotoristaLookup(dto, full) })),
                catchError(() => of({ cpfDigits, dto: this.mesclarMotoristaLookup(dto, null) }))
              );
            }),
            catchError((err: unknown) => {
              const status =
                err && typeof err === 'object' && 'status' in err
                  ? Number((err as { status?: unknown }).status)
                  : 0;
              if (status === 404 || status === 204) {
                return of({ cpfDigits, dto: null as MotoristaListItemDTO | null });
              }
              this.toast.error('Não foi possível consultar o CPF do motorista.');
              return of({ cpfDigits, dto: null as MotoristaListItemDTO | null, falhou: true as const });
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
    this.limparEstadoLookupMotorista();
    this.condutorEditId = null;
    this.ignorandoConsultaTemporaria(() => {
      this.motoristaForm.reset({
        id: null,
        transportadoraId: null,
        nomeCompleto: '',
        cpf: '',
        email: '',
        celular: '',
        cnh: '',
        vencimentoCnh: '',
        ativo: true,
      });
    });
    this.showCondutorForm = true;
    this.cdr.detectChanges();
  }

  editarCondutor(c: MotoristaListItemDTO): void {
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
        ativo: c.ativo,
      });
    });
    this.showCondutorForm = true;
    this.cdr.detectChanges();

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
            vencimentoCnh: dto.vencimentoCnh || this.motoristaForm.get('vencimentoCnh')?.value,
            transportadoraId: dto.transportadoraId ?? c.transportadoraId ?? null,
          });
        });
        this.cdr.markForCheck();
      },
    });
  }

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

  salvarMotorista(): void {
    if (this.motoristaForm.invalid) {
      this.motoristaForm.markAllAsTouched();
      return;
    }
    const transportadoraId = this.transportadoraIdForm;
    if (transportadoraId == null) {
      this.toast.error('Selecione a transportadora.');
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
      transportadoraId,
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
      primeiroContatoId: editSrc?.primeiroContatoId,
    };

    this.salvandoMotorista = true;
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
                  }
                : dtoBase
            ),
            catchError(() => of(dtoBase))
          )
        : of(dtoBase);

    preparar$
      .pipe(
        switchMap((dto) => {
          if (transferindoVinculo) return this.motoristaService.transferirVinculo(dto);
          return dto.id ? this.motoristaService.alterar(dto) : this.motoristaService.gravar(dto);
        })
      )
      .subscribe({
        next: () => {
          this.salvandoMotorista = false;
          this.showCondutorForm = false;
          this.condutorEditId = null;
          this.limparEstadoLookupMotorista();
          this.toast.success(
            transferindoVinculo
              ? 'Motorista vinculado com sucesso. O vínculo anterior foi desfeito.'
              : dtoBase.id
                ? 'Motorista atualizado com sucesso.'
                : 'Motorista cadastrado com sucesso.'
          );
          if (this.jaBuscou) this.carregarLista();
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.salvandoMotorista = false;
          this.toast.error(this.mensagemErroApi(err, 'Erro ao salvar motorista.'));
          this.cdr.markForCheck();
        },
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
        confirmColor: 'warn',
      },
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.motoristaService.excluir(condutor.id).subscribe({
        next: () => {
          this.toast.success('Motorista excluído com sucesso.');
          this.carregarLista();
        },
        error: (err: unknown) => {
          this.toast.error(this.mensagemErroApi(err, 'Erro ao excluir motorista.'));
        },
      });
    });
  }

  abrirImportarCondutores(): void {
    this.fileCondutores = null;
    this.importTransportadoraId = null;
    this.showImportarCondutores = true;
  }

  fecharImportarCondutores(): void {
    if (this.importandoCondutores) return;
    this.showImportarCondutores = false;
    this.fileCondutores = null;
  }

  onFileCondutores(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileCondutores = input.files?.[0] ?? null;
  }

  importarCondutores(): void {
    if (!this.fileCondutores || this.importTransportadoraId == null || this.importandoCondutores) return;
    this.importandoCondutores = true;
    this.motoristaService.importarDadosExcel(this.importTransportadoraId, this.fileCondutores).subscribe({
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
        if (this.jaBuscou) this.carregarLista();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.importandoCondutores = false;
        this.toast.error(err?.message ?? 'Falha ao importar motoristas.');
        this.cdr.markForCheck();
      },
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
      },
    });
  }

  private consultarMotoristaPorCpf(): void {
    if (!this.showCondutorForm || this.ignorarProximaConsultaCpf) return;
    const cpfDigits = String(this.motoristaForm?.get('cpf')?.value ?? '').replace(/\D/g, '');
    if (cpfDigits.length !== 11) return;
    if (cpfDigits === this.ultimoCpfMotoristaConsultado) return;
    this.ultimoCpfMotoristaConsultado = cpfDigits;
    this.cpfMotoristaLookup$.next(cpfDigits);
  }

  private limparEstadoLookupMotorista(resetCpf = true): void {
    this.motoristaCpfBuscando = false;
    this.motoristaJaCadastradoEncontrado = false;
    this.motoristaJaVinculadoNesta = false;
    this.motoristaVinculoOutraTransportadora = false;
    this.motoristaAceitouVinculo = false;
    this.motoristaEncontradoCache = null;
    if (resetCpf) this.ultimoCpfMotoristaConsultado = '';
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
      primeiroContatoId: src.primeiroContatoId ?? base.primeiroContatoId,
    };
  }

  private perguntarVinculoMotoristaExistente(dto: MotoristaListItemDTO): void {
    if (!this.showCondutorForm) return;
    const tid = this.transportadoraIdForm;
    const jaNesta = tid != null && dto.transportadoraId != null && dto.transportadoraId === tid;
    const vinculadoEmOutra =
      dto.transportadoraId != null &&
      dto.transportadoraId > 0 &&
      tid != null &&
      dto.transportadoraId !== tid;

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
      ? 'Encontramos este CPF no banco (já vinculado a outra transportadora) e carregamos os dados.\n\nDeseja vincular à transportadora selecionada? Ao salvar, o vínculo anterior será desfeito.'
      : 'Encontramos este CPF no banco e carregamos os dados do cadastro.\n\nDeseja vincular este motorista à transportadora selecionada?';

    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      width: '460px',
      autoFocus: 'dialog',
      panelClass: 'cfg-form-dialog-panel',
      data: {
        titulo: 'Motorista já cadastrado',
        mensagem,
        cancelLabel: 'Não',
        confirmLabel: 'Sim, vincular',
        confirmColor: 'primary',
      },
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
        transportadoraId: this.transportadoraIdForm ?? dto.transportadoraId ?? null,
        nomeCompleto: dto.nomeCompleto ?? '',
        cpf: dto.cpf ? formatCpf(String(dto.cpf)) : this.motoristaForm.get('cpf')?.value,
        email: dto.email ?? '',
        celular: dto.celular ? formatTelefone(String(dto.celular)) : '',
        cnh: dto.cnh ?? '',
        vencimentoCnh: dto.vencimentoCnh ?? '',
        ativo: dto.ativo !== false,
      });
    });
    this.cdr.markForCheck();
  }

  private mensagemErroApi(err: unknown, fallback: string): string {
    let raw = '';
    if (err && typeof err === 'object') {
      const api = err as ApiError & {
        error?: { notifications?: unknown; message?: string };
        notifications?: unknown;
      };
      const notes = api.notifications ?? api.error?.notifications;
      if (Array.isArray(notes) && notes.length) {
        const text = notes.filter((n): n is string => typeof n === 'string').join(' ').trim();
        if (text) raw = text;
      }
      if (!raw && typeof api.message === 'string' && api.message.trim()) raw = api.message.trim();
    }
    if (!raw && err instanceof Error && err.message.trim()) raw = err.message.trim();
    return raw || fallback;
  }
}
