import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, inject, OnInit, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../../core/api/services/toast.service';
import { PermissionCacheService } from '../../../core/services/permission-cache.service';
import { ApiError } from '../../../core/api/models';
import { PaginatedSearchItem } from '../../../shared/models/paginated-search.models';
import { VeiculoService } from '../../cadastro/services/veiculo.service';
import { MotoristaPorPlacaAggregateVm } from '../../cadastro/models/motorista-por-placa.vm';
import { formatPlacaDisplay, normalizePlaca, placaCompleta } from '../../cadastro/utils/placa-br';
import { EntradaSaidaService } from './entrada-saida.service';
import { EntradaSaidaOutput } from '../models/entrada-saida.models';
import {
  buildEntradaSaidaPostPayload,
  mapEntradaSaidaOutputToDetailVm
} from './entrada-saida-form.mapper';
import { EntradaSaidaFormDetailVm } from './entrada-saida-form.models';
import { ModalBuscaMotoristaComponent } from './components/modal-busca-motorista/modal-busca-motorista.component';
import { ModalBuscaTransportadoraComponent } from './components/modal-busca-transportadora/modal-busca-transportadora.component';
import { ModalBuscaVeiculoComponent } from './components/modal-busca-veiculo/modal-busca-veiculo.component';
import { datetimeLocalInputToApiIso } from '../../../shared/utils/local-iso-datetime';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  merge,
  of,
  switchMap,
  tap
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-entrada-saida-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalBuscaMotoristaComponent,
    ModalBuscaTransportadoraComponent,
    ModalBuscaVeiculoComponent
  ],
  templateUrl: './entrada-saida-form.component.html',
  styleUrl: './entrada-saida-form.component.scss'
})
export class EntradaSaidaFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(EntradaSaidaService);
  private readonly veiculoService = inject(VeiculoService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly permissionCache = inject(PermissionCacheService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly motoristaInputRef = viewChild<ElementRef<HTMLInputElement>>('motoristaInput');
  private readonly placaInputRef = viewChild<ElementRef<HTMLInputElement>>('placaInput');
  private readonly blurBuscaPlaca$ = new Subject<void>();

  readonly canGravar = this.permissionCache.has('entradasaida.gravar') || this.permissionCache.hasAny(['*']);
  readonly canAlterar = this.permissionCache.has('entradasaida.alterar') || this.permissionCache.hasAny(['*']);

  carregandoRegistro = false;
  salvando = false;
  consultandoPlaca = false;
  placaSemRegistro = false;
  /** Campos exibidos bloqueados após GET por placa (somente vínculo automático). */
  readonlyPorAutofill = false;

  motoristaModalAberto = false;
  transportadoraModalAberto = false;
  veiculoModalAberto = false;

  /** Termos dos modais de busca (sincronizados com nome/placa quando aplicável). */
  motoristaTexto = '';
  transportadoraTexto = '';
  veiculoTexto = '';

  /** Detalhes exibidos nos cartões (motorista → veículo → transportadora). */
  detalhe: EntradaSaidaFormDetailVm = this.createDetalheVazio();

  readonly form = this.fb.group(
    {
      id: [0],
      placaVeiculo: [''],
      motoristaId: [null as number | null, [Validators.required, Validators.min(1)]],
      transportadoraId: [null as number | null, [Validators.min(1)]],
      veiculoId: [null as number | null, [Validators.required, Validators.min(1)]],
      dataHoraEntrada: ['', Validators.required],
      dataHoraSaida: [''],
      observacao: ['']
    },
    { validators: [this.dataSaidaMaiorOuIgualValidator] }
  );

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const editId = idParam && /^\d+$/.test(idParam) ? Number(idParam) : null;

    if (editId != null) {
      if (!this.canAlterar) {
        this.toast.error('Sem permissão para alterar entrada/saída.');
        void this.router.navigate([''], { relativeTo: this.route.parent });
        return;
      }
      this.carregarRegistro(editId);
    } else {
      if (!this.canGravar) {
        this.toast.error('Sem permissão para incluir entrada/saída.');
        void this.router.navigate([''], { relativeTo: this.route.parent });
        return;
      }
      this.configurarBuscaPorPlaca();
      this.focusCampoPrincipal();
    }
  }

  tituloPagina(): string {
    return this.form.controls.id.value ? 'Editar entrada / saída' : 'Nova entrada / saída';
  }

  modoNovo(): boolean {
    return !Number(this.form.controls.id.value);
  }

  autoFillAtivo(): boolean {
    return this.readonlyPorAutofill;
  }

  abrirMotorista(): void {
    this.motoristaModalAberto = true;
  }

  abrirTransportadora(): void {
    this.transportadoraModalAberto = true;
  }

  abrirVeiculo(): void {
    this.veiculoModalAberto = true;
  }

  onCampoMotoristaNome(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.motoristaTexto = v;
    this.detalhe.motoristaTexto = v;
    this.form.patchValue({ motoristaId: null }, { emitEvent: false });
    this.readonlyPorAutofill = false;
  }

  onCampoMotoristaCpf(ev: Event): void {
    this.detalhe.motoristaCpf = (ev.target as HTMLInputElement).value;
    this.form.patchValue({ motoristaId: null }, { emitEvent: false });
    this.readonlyPorAutofill = false;
  }

  onCampoMotoristaTel(ev: Event): void {
    this.detalhe.motoristaTelefone = (ev.target as HTMLInputElement).value;
    this.form.patchValue({ motoristaId: null }, { emitEvent: false });
    this.readonlyPorAutofill = false;
  }

  onCampoMotoristaCnh(ev: Event): void {
    this.detalhe.motoristaCnh = (ev.target as HTMLInputElement).value;
    this.form.patchValue({ motoristaId: null }, { emitEvent: false });
    this.readonlyPorAutofill = false;
  }

  onCampoVeiculoModelo(ev: Event): void {
    this.detalhe.veiculoModelo = (ev.target as HTMLInputElement).value;
    this.form.patchValue({ veiculoId: null }, { emitEvent: false });
    this.readonlyPorAutofill = false;
  }

  onCampoVeiculoMarca(ev: Event): void {
    this.detalhe.veiculoMarca = (ev.target as HTMLInputElement).value;
    this.form.patchValue({ veiculoId: null }, { emitEvent: false });
    this.readonlyPorAutofill = false;
  }

  onCampoVeiculoAno(ev: Event): void {
    this.detalhe.veiculoAno = (ev.target as HTMLInputElement).value;
    this.form.patchValue({ veiculoId: null }, { emitEvent: false });
    this.readonlyPorAutofill = false;
  }

  onCampoTransportadoraNome(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.transportadoraTexto = v;
    this.detalhe.transportadoraTexto = v;
    this.form.patchValue({ transportadoraId: null }, { emitEvent: false });
    this.readonlyPorAutofill = false;
  }

  onCampoTransportadoraCnpj(ev: Event): void {
    this.detalhe.transportadoraCnpj = (ev.target as HTMLInputElement).value;
    this.form.patchValue({ transportadoraId: null }, { emitEvent: false });
    this.readonlyPorAutofill = false;
  }

  onCampoTransportadoraContato(ev: Event): void {
    this.detalhe.transportadoraContato = (ev.target as HTMLInputElement).value;
    this.form.patchValue({ transportadoraId: null }, { emitEvent: false });
    this.readonlyPorAutofill = false;
  }

  onMotoristaSelecionado(item: PaginatedSearchItem): void {
    this.form.patchValue({ motoristaId: item.id });
    this.motoristaTexto = item.titulo;
    this.detalhe.motoristaTexto = item.titulo;
    this.motoristaModalAberto = false;
    this.readonlyPorAutofill = false;
  }

  onTransportadoraSelecionada(item: PaginatedSearchItem): void {
    this.form.patchValue({ transportadoraId: item.id });
    this.transportadoraTexto = item.titulo;
    this.detalhe.transportadoraTexto = item.titulo;
    this.transportadoraModalAberto = false;
    this.readonlyPorAutofill = false;
  }

  onVeiculoSelecionado(item: PaginatedSearchItem): void {
    this.form.patchValue({ veiculoId: item.id });
    this.veiculoTexto = item.titulo;
    this.detalhe.veiculoTexto = item.titulo;
    const placaFmt = formatPlacaDisplay(normalizePlaca(item.titulo));
    this.form.patchValue({ placaVeiculo: placaFmt }, { emitEvent: false });
    this.veiculoModalAberto = false;
    this.readonlyPorAutofill = false;
  }

  limparMotorista(): void {
    this.form.patchValue({ motoristaId: null });
    this.motoristaTexto = '';
    this.detalhe.motoristaTexto = '';
    this.detalhe.motoristaCpf = '';
    this.detalhe.motoristaTelefone = '';
    this.detalhe.motoristaCnh = '';
    this.readonlyPorAutofill = false;
  }

  limparTransportadora(): void {
    this.form.patchValue({ transportadoraId: null });
    this.transportadoraTexto = '';
    this.detalhe.transportadoraTexto = '';
    this.detalhe.transportadoraCnpj = '';
    this.detalhe.transportadoraContato = '';
    this.readonlyPorAutofill = false;
  }

  limparVeiculo(): void {
    this.form.patchValue({ veiculoId: null });
    this.veiculoTexto = '';
    this.detalhe.veiculoTexto = '';
    this.detalhe.veiculoModelo = '';
    this.detalhe.veiculoMarca = '';
    this.detalhe.veiculoAno = '';
    if (this.modoNovo()) {
      this.form.patchValue({ placaVeiculo: '' }, { emitEvent: false });
    }
    this.readonlyPorAutofill = false;
  }

  liberarEdicaoAutofill(): void {
    this.readonlyPorAutofill = false;
    this.toast.success('Campos liberados para edição. Os vínculos (IDs) permanecem os mesmos até você limpar ou buscar outra placa.');
  }

  onPlacaInput(): void {
    const raw = String(this.form.controls.placaVeiculo.value ?? '');
    const fmt = formatPlacaDisplay(normalizePlaca(raw));
    if (fmt !== raw) {
      this.form.controls.placaVeiculo.patchValue(fmt, { emitEvent: true });
    }
    this.placaSemRegistro = false;
    if (this.readonlyPorAutofill) {
      this.readonlyPorAutofill = false;
    }
  }

  onPlacaBlurBusca(): void {
    if (!this.modoNovo()) return;
    const p = normalizePlaca(this.form.controls.placaVeiculo.value ?? '');
    if (!placaCompleta(p)) return;
    this.blurBuscaPlaca$.next();
  }

  cancelar(): void {
    void this.router.navigate([''], { relativeTo: this.route.parent });
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = Number(this.form.controls.id.value) || 0;
    if (id > 0 && !this.canAlterar) {
      this.toast.error('Sem permissão para alterar.');
      return;
    }
    if (id === 0 && !this.canGravar) {
      this.toast.error('Sem permissão para incluir.');
      return;
    }

    this.salvando = true;
    const motoristaId = Number(this.form.controls.motoristaId.value);
    const transportadoraId = Number(this.form.controls.transportadoraId.value);
    const veiculoId = Number(this.form.controls.veiculoId.value);
    const payload = buildEntradaSaidaPostPayload({
      motoristaId,
      transportadoraId,
      veiculoId,
      dataHoraEntradaIso: this.toIsoOrEmpty(this.form.controls.dataHoraEntrada.value),
      dataHoraSaidaIso: this.toIsoOrUndefined(this.form.controls.dataHoraSaida.value),
      observacao: this.form.controls.observacao.value ?? ''
    });

    const req$ = id > 0 ? this.service.update(id, payload) : this.service.create(payload);

    req$.subscribe({
      next: () => {
        this.salvando = false;
        this.toast.success(id > 0 ? 'Movimento atualizado com sucesso.' : 'Movimento criado com sucesso.');
        void this.router.navigate([''], { relativeTo: this.route.parent });
      },
      error: (err: ApiError) => {
        this.salvando = false;
        this.toast.error(err?.message ?? 'Erro ao salvar movimento.');
      }
    });
  }

  motoristaInvalido(): boolean {
    const c = this.form.controls.motoristaId;
    return c.touched && c.invalid;
  }

  veiculoInvalido(): boolean {
    const c = this.form.controls.veiculoId;
    return c.touched && c.invalid;
  }

  private createDetalheVazio(): EntradaSaidaFormDetailVm {
    return {
      motoristaTexto: '',
      motoristaCpf: '',
      motoristaTelefone: '',
      motoristaCnh: '',
      transportadoraTexto: '',
      transportadoraCnpj: '',
      transportadoraContato: '',
      veiculoTexto: '',
      veiculoModelo: '',
      veiculoMarca: '',
      veiculoAno: '',
      observacaoTexto: ''
    };
  }

  private configurarBuscaPorPlaca(): void {
    const debounced$ = this.form.controls.placaVeiculo.valueChanges.pipe(
      map((v) => normalizePlaca(String(v ?? ''))),
      debounceTime(500),
      distinctUntilChanged(),
      filter((p) => placaCompleta(p))
    );

    const blur$ = this.blurBuscaPlaca$.pipe(
      map(() => normalizePlaca(this.form.controls.placaVeiculo.value ?? '')),
      filter((p) => placaCompleta(p))
    );

    merge(debounced$, blur$)
      .pipe(
        filter(() => this.modoNovo()),
        distinctUntilChanged(),
        tap(() => {
          this.consultandoPlaca = true;
          this.placaSemRegistro = false;
        }),
        switchMap((placaNorm) =>
          this.executarObterPorPlaca(placaNorm).pipe(finalize(() => (this.consultandoPlaca = false)))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => {
        if (res.erroRede) return;
        if (res.agg) {
          this.aplicarAgregadoPorPlaca(res.agg);
          this.placaSemRegistro = false;
        } else {
          this.placaSemRegistro = true;
          this.limparVinculosAposPlacaNaoEncontrada();
          this.toast.error('Nenhum registro encontrado para a placa informada.');
        }
      });
  }

  private executarObterPorPlaca(
    placaNorm: string
  ): Observable<{ agg: MotoristaPorPlacaAggregateVm | null; erroRede: boolean }> {
    return this.veiculoService.obterPorPlaca(placaNorm).pipe(
      map((agg) => ({ agg, erroRede: false as const })),
      catchError((err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message ?? '')
            : '';
        this.toast.error(msg || 'Erro ao consultar placa.');
        return of({ agg: null, erroRede: true as const });
      })
    );
  }

  private aplicarAgregadoPorPlaca(agg: MotoristaPorPlacaAggregateVm): void {
    const placaFmt = formatPlacaDisplay(normalizePlaca(agg.veiculoPlaca));
    this.form.patchValue(
      {
        motoristaId: agg.motoristaId,
        transportadoraId: agg.transportadoraId,
        veiculoId: agg.veiculoId,
        placaVeiculo: placaFmt
      },
      { emitEvent: false }
    );

    this.detalhe = {
      ...this.detalhe,
      motoristaTexto: agg.motoristaNome,
      motoristaCpf: agg.motoristaCpf,
      motoristaTelefone: agg.motoristaTelefone,
      motoristaCnh: agg.motoristaCnh,
      veiculoTexto: placaFmt,
      veiculoModelo: agg.veiculoModelo,
      veiculoMarca: agg.veiculoMarca,
      veiculoAno: agg.veiculoAno,
      transportadoraTexto: agg.transportadoraNome,
      transportadoraCnpj: agg.transportadoraCnpj,
      transportadoraContato: agg.transportadoraContato
    };

    this.motoristaTexto = agg.motoristaNome;
    this.transportadoraTexto = agg.transportadoraNome;
    this.veiculoTexto = placaFmt;
    this.readonlyPorAutofill = true;
  }

  private limparVinculosAposPlacaNaoEncontrada(): void {
    this.form.patchValue(
      {
        motoristaId: null,
        transportadoraId: null,
        veiculoId: null
      },
      { emitEvent: false }
    );
    this.detalhe = this.createDetalheVazio();
    const placaFmt = this.form.controls.placaVeiculo.value ?? '';
    this.detalhe.veiculoTexto = placaFmt;
    this.motoristaTexto = '';
    this.transportadoraTexto = '';
    this.veiculoTexto = placaFmt;
    this.readonlyPorAutofill = false;
  }

  private carregarRegistro(id: number): void {
    this.carregandoRegistro = true;
    this.service.getById(id).subscribe({
      next: (item) => {
        this.carregandoRegistro = false;
        if (!item) {
          this.toast.error('Registro não encontrado.');
          void this.router.navigate([''], { relativeTo: this.route.parent });
          return;
        }
        this.applyRegistro(item);
      },
      error: (err: ApiError) => {
        this.carregandoRegistro = false;
        this.toast.error(err?.message ?? 'Erro ao carregar registro.');
        void this.router.navigate([''], { relativeTo: this.route.parent });
      }
    });
  }

  private applyRegistro(item: EntradaSaidaOutput): void {
    const labels = mapEntradaSaidaOutputToDetailVm(item);
    this.detalhe = labels;
    this.motoristaTexto = labels.motoristaTexto;
    this.transportadoraTexto = labels.transportadoraTexto;
    this.veiculoTexto = labels.veiculoTexto;
    const placaFmt = formatPlacaDisplay(normalizePlaca(labels.veiculoTexto));
    this.form.patchValue({
      id: item.id,
      placaVeiculo: placaFmt,
      motoristaId: item.motoristaId,
      transportadoraId: item.transportadoraId,
      veiculoId: item.veiculoId,
      dataHoraEntrada: this.toDateTimeLocal(item.dataHoraEntrada),
      dataHoraSaida: this.toDateTimeLocal(item.dataHoraSaida ?? ''),
      observacao: labels.observacaoTexto
    });
    this.readonlyPorAutofill = false;
    this.focusCampoPrincipal();
  }

  /** Nova entrada: foco na placa. Edição: foco no nome do motorista. */
  private focusCampoPrincipal(): void {
    queueMicrotask(() => {
      if (this.modoNovo()) {
        this.placaInputRef()?.nativeElement?.focus();
      } else {
        this.motoristaInputRef()?.nativeElement?.focus();
      }
    });
  }

  private toDateTimeLocal(value: string): string {
    if (!value?.trim()) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private toIsoOrUndefined(value: string | null | undefined): string | undefined {
    const iso = datetimeLocalInputToApiIso(value);
    return iso || undefined;
  }

  private toIsoOrEmpty(value: string | null | undefined): string {
    return datetimeLocalInputToApiIso(value);
  }

  private dataSaidaMaiorOuIgualValidator(control: AbstractControl): ValidationErrors | null {
    const entrada = control.get('dataHoraEntrada')?.value;
    const saida = control.get('dataHoraSaida')?.value;
    if (!entrada || !saida) return null;
    return new Date(saida).getTime() >= new Date(entrada).getTime() ? null : { dataSaidaMenor: true };
  }
}
