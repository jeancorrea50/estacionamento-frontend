import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import { catchError, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { VeiculoService } from '../../../cadastro/services/veiculo.service';
import { formatPlacaDisplay, normalizePlaca, placaCompleta } from '../../../cadastro/utils/placa-br';
import { ModalBuscaTransportadoraComponent } from '../../../movimentos/entrada-saida/components/modal-busca-transportadora/modal-busca-transportadora.component';
import { ModalBuscaVeiculoComponent } from '../../../movimentos/entrada-saida/components/modal-busca-veiculo/modal-busca-veiculo.component';
import { PortariaAlertasStore } from '../../../movimentos/services/portaria-alertas.store';
import { PaginatedSearchItem } from '../../../../shared/models/paginated-search.models';
import { datetimeLocalInputToApiIso, toDateTimeLocalInputValue } from '../../../../shared/utils/local-iso-datetime';
import { AgendamentoDataHoraPickerComponent } from '../../pages/agendamentos-page/agendamento-data-hora-picker/agendamento-data-hora-picker.component';
import { AgendamentoPostInput } from '../../models/agendamento.models';
import { AgendamentoService } from '../../services/agendamento.service';

interface AgendamentoPlacaSelecionada {
  id: number;
  placa: string;
  marcaModelo?: string;
  motoristaId?: number | null;
  motoristaNome?: string | null;
  motoristaCpf?: string | null;
}

type ResolvePlacaResult =
  | { ok: true; payload: AgendamentoPostInput }
  | { ok: false; message: string };

/**
 * Modal compartilhado de criação de agendamento (Pátio e Agendar/transportadora).
 */
@Component({
  selector: 'app-agendamento-novo-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AgendamentoDataHoraPickerComponent,
    ModalBuscaTransportadoraComponent,
    ModalBuscaVeiculoComponent,
  ],
  templateUrl: './agendamento-novo-modal.component.html',
  styleUrls: ['./agendamento-novo-modal.component.scss'],
  host: {
    '[class.ag-novo-modal--ativo]': 'overlayAtivo()',
    '[attr.aria-hidden]': 'overlayAtivo() ? null : "true"',
  },
})
export class AgendamentoNovoModalComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AgendamentoService);
  private readonly veiculoApi = inject(VeiculoService);
  private readonly toast = inject(ToastService);
  private readonly portariaAlertas = inject(PortariaAlertasStore);
  private readonly fb = inject(FormBuilder);

  /** Quando true, exibe o modal e reinicia o formulário. */
  readonly aberto = input(false);
  /** Operador de pátio escolhe transportadora; transportadora usa a da sessão. */
  readonly podeEscolherTransportadora = input(false);

  readonly fechado = output<void>();
  readonly salvo = output<void>();

  readonly salvando = signal(false);
  readonly transportadoraFormId = signal<number | null>(null);
  readonly transportadoraFormNome = signal('');
  readonly placasSelecionadas = signal<AgendamentoPlacaSelecionada[]>([]);
  readonly buscaTransportadoraAberta = signal(false);
  readonly buscaPlacaAberta = signal(false);

  /** Cancela resoluções de placa em voo (troca de transportadora / fechar modal). */
  private readonly cancelarResolucaoPlaca$ = new Subject<void>();
  private geracaoSelecaoPlaca = 0;

  readonly form = this.fb.group({
    dataAgendamento: ['', Validators.required],
    transportadoraId: [null as number | null],
    observacao: [''],
  });

  constructor() {
    effect(() => {
      if (!this.aberto()) return;
      untracked(() => this.resetForm());
    });
  }

  private invalidarResolucoesPendentes(): void {
    this.geracaoSelecaoPlaca += 1;
    this.cancelarResolucaoPlaca$.next();
  }

  /** Host cobre a viewport só enquanto algum overlay deste modal está ativo. */
  overlayAtivo(): boolean {
    return this.aberto() || this.buscaTransportadoraAberta() || this.buscaPlacaAberta();
  }

  private resetForm(): void {
    this.invalidarResolucoesPendentes();
    const tid =
      !this.podeEscolherTransportadora() && this.auth.isTransportadoraRole() && !this.auth.isAdmin()
        ? this.auth.resolveTransportadoraId()
        : null;
    this.form.reset({
      dataAgendamento: toDateTimeLocalInputValue(),
      transportadoraId: tid,
      observacao: '',
    });
    this.transportadoraFormId.set(tid && tid > 0 ? tid : null);
    this.transportadoraFormNome.set('');
    this.placasSelecionadas.set([]);
    this.buscaTransportadoraAberta.set(false);
    this.buscaPlacaAberta.set(false);
  }

  fechar(): void {
    this.invalidarResolucoesPendentes();
    this.buscaTransportadoraAberta.set(false);
    this.buscaPlacaAberta.set(false);
    this.fechado.emit();
  }

  onDataHoraChange(value: string): void {
    this.form.controls.dataAgendamento.setValue(value);
    this.form.controls.dataAgendamento.markAsDirty();
  }

  abrirBuscaTransportadora(): void {
    if (!this.podeEscolherTransportadora()) return;
    this.buscaTransportadoraAberta.set(true);
  }

  fecharBuscaTransportadora(): void {
    this.buscaTransportadoraAberta.set(false);
  }

  onTransportadoraBuscaSelecionada(item: PaginatedSearchItem): void {
    const id = Number(item.id);
    if (!Number.isFinite(id) || id <= 0) return;
    this.invalidarResolucoesPendentes();
    this.form.controls.transportadoraId.setValue(id);
    this.form.controls.transportadoraId.markAsDirty();
    this.transportadoraFormId.set(id);
    this.transportadoraFormNome.set((item.titulo || '').trim());
    this.placasSelecionadas.set([]);
    this.buscaTransportadoraAberta.set(false);
  }

  limparTransportadoraForm(): void {
    if (!this.podeEscolherTransportadora()) return;
    this.invalidarResolucoesPendentes();
    this.form.controls.transportadoraId.setValue(null);
    this.transportadoraFormId.set(null);
    this.transportadoraFormNome.set('');
    this.placasSelecionadas.set([]);
  }

  abrirBuscaPlaca(): void {
    const tid = this.transportadoraFormId();
    if (!tid) {
      this.toast.error('Selecione a transportadora antes de buscar placas.');
      return;
    }
    this.buscaPlacaAberta.set(true);
  }

  fecharBuscaPlaca(): void {
    this.buscaPlacaAberta.set(false);
  }

  onPlacaBuscaSelecionada(item: PaginatedSearchItem): void {
    const id = Number(item.id);
    const placa = String(item.titulo || '').trim();
    if (!Number.isFinite(id) || id <= 0 || !placa) return;

    if ((item.campo5 || '').trim().toLowerCase() === 'não') {
      this.toast.error('Esta placa está inativa e não pode ser agendada.');
      return;
    }

    const placaNorm = normalizePlaca(placa);
    const jaExiste = this.placasSelecionadas().some(
      (p) => p.id === id || normalizePlaca(p.placa) === placaNorm
    );
    if (jaExiste) {
      this.toast.warning(`A placa ${formatPlacaDisplay(placa) || placa} já está na lista.`);
      this.buscaPlacaAberta.set(false);
      return;
    }

    const metaMotoristaId = Number(item.meta?.['motoristaId'] ?? 0);
    const metaNome =
      item.meta?.['motoristaNome'] != null ? String(item.meta['motoristaNome']) : null;
    const metaCpf =
      item.meta?.['motoristaCpf'] != null ? String(item.meta['motoristaCpf']) : null;

    const base: AgendamentoPlacaSelecionada = {
      id,
      placa,
      marcaModelo: item.campo2 && item.campo2 !== '—' ? item.campo2 : undefined,
      motoristaId: metaMotoristaId > 0 ? metaMotoristaId : null,
      motoristaNome: metaNome,
      motoristaCpf: metaCpf,
    };

    this.buscaPlacaAberta.set(false);

    const geracao = ++this.geracaoSelecaoPlaca;
    const tidEsperada = this.transportadoraFormId() ?? 0;

    // Confirma/enriquece motorista via por-placa (e fallback CRUD) antes de fixar o chip.
    this.resolverMotoristaDaPlaca(base, tidEsperada)
      .pipe(takeUntil(this.cancelarResolucaoPlaca$))
      .subscribe({
        next: (resolved) => {
          if (!this.aberto() || geracao !== this.geracaoSelecaoPlaca) return;
          if (tidEsperada !== (this.transportadoraFormId() ?? 0)) return;
          if (!resolved.motoristaId || resolved.motoristaId <= 0) {
            this.toast.error(
              `A placa ${formatPlacaDisplay(placa) || placa} não possui motorista vinculado. Vincule um motorista no cadastro do veículo.`
            );
            return;
          }
          this.placasSelecionadas.update((lista) => [...lista, resolved]);
        },
        error: () => {
          if (!this.aberto() || geracao !== this.geracaoSelecaoPlaca) return;
          if (tidEsperada !== (this.transportadoraFormId() ?? 0)) return;
          if (base.motoristaId && base.motoristaId > 0) {
            this.placasSelecionadas.update((lista) => [...lista, base]);
            return;
          }
          this.toast.error(
            `Não foi possível validar o motorista da placa ${formatPlacaDisplay(placa) || placa}.`
          );
        },
      });
  }

  removerPlacaSelecionada(veiculoId: number): void {
    this.placasSelecionadas.update((lista) => lista.filter((p) => p.id !== veiculoId));
  }

  formatPlaca(placa: string | null | undefined): string {
    return formatPlacaDisplay(placa) || placa || '—';
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Informe a data/hora do agendamento.');
      return;
    }

    const tid =
      !this.podeEscolherTransportadora() && this.auth.isTransportadoraRole() && !this.auth.isAdmin()
        ? this.auth.resolveTransportadoraId()
        : Number(this.form.controls.transportadoraId.value) || null;

    if (!tid) {
      this.toast.error('Selecione a transportadora.');
      return;
    }

    const selecionados = this.placasSelecionadas();
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
    const isTransportadora = this.auth.isTransportadoraRole();
    const isAdmin = this.auth.isAdmin();

    this.salvando.set(true);
    forkJoin(
      selecionados.map((veiculo) =>
        this.resolverPayloadPlaca(veiculo, tid, dataAgendamento, observacao, isTransportadora, isAdmin).pipe(
          switchMap((resolved) => {
            if (!resolved.ok) {
              return of({
                success: false as const,
                placa: veiculo.placa,
                message: resolved.message,
              });
            }
            return this.api.gravar(resolved.payload).pipe(
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
            const transportadoraLabel = this.transportadoraFormNome().trim() || '—';
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
              ok.length === 1 ? 'Agendamento criado.' : `${ok.length} agendamentos criados.`
            );
            this.fechar();
            this.salvo.emit();
            return;
          }

          if (ok.length && falhas.length) {
            this.toast.warning(
              `${ok.length} criado(s); ${falhas.length} falha(s): ${falhas
                .map((f) => formatPlacaDisplay(f.placa) || f.placa)
                .join(', ')}`
            );
            this.salvo.emit();
            return;
          }

          this.toast.error(falhas[0]?.message || 'Não foi possível criar o agendamento.');
        },
      });
  }

  private resolverPayloadPlaca(
    veiculo: AgendamentoPlacaSelecionada,
    transportadoraId: number,
    dataAgendamento: string,
    observacao: string | null,
    isTransportadora: boolean,
    isAdmin: boolean
  ): Observable<ResolvePlacaResult> {
    const placa = normalizePlaca(veiculo.placa);
    if (!placaCompleta(placa)) {
      return of({
        ok: false,
        message: `Placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa} inválida.`,
      });
    }

    return this.resolverMotoristaDaPlaca(veiculo, transportadoraId).pipe(
      map((resolved) => {
        const motoristaId = resolved.motoristaId && resolved.motoristaId > 0 ? resolved.motoristaId : null;
        if (!motoristaId) {
          return {
            ok: false as const,
            message: `A placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa} não possui motorista vinculado. Vincule um motorista no cadastro do veículo.`,
          };
        }

        return {
          ok: true as const,
          payload: {
            dataAgendamento,
            observacao,
            transportadoraId,
            motorista: {
              id: motoristaId,
              cpf: resolved.motoristaCpf || null,
              nome: resolved.motoristaNome || null,
            },
            veiculo: {
              id: resolved.id,
              placa,
            },
          } satisfies AgendamentoPostInput,
        };
      }),
      switchMap((result) => {
        if (!result.ok) return of(result);
        if (!(isTransportadora && !isAdmin)) return of(result);

        // Garante que a placa pertence à transportadora da sessão.
        return this.api.obterPorPlaca(placa).pipe(
          map((agg) => {
            if (!agg) {
              return {
                ok: false as const,
                message: `Não foi possível validar a placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa}.`,
              };
            }
            if (agg.transportadoraId && agg.transportadoraId !== transportadoraId) {
              return {
                ok: false as const,
                message: `A placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa} não pertence à transportadora da sessão.`,
              };
            }
            return result;
          }),
          catchError(() =>
            of({
              ok: false as const,
              message: `Não foi possível validar a placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa}.`,
            })
          )
        );
      }),
      catchError(() =>
        of({
          ok: false as const,
          message: `Não foi possível validar a placa ${formatPlacaDisplay(veiculo.placa) || veiculo.placa}.`,
        })
      )
    );
  }

  /**
   * Resolve motorista: chip/meta → GET Agendamento/por-placa → GET Veiculo por id.
   */
  private resolverMotoristaDaPlaca(
    veiculo: AgendamentoPlacaSelecionada,
    transportadoraId: number
  ): Observable<AgendamentoPlacaSelecionada> {
    if (veiculo.motoristaId && veiculo.motoristaId > 0) {
      return of(veiculo);
    }

    const placa = normalizePlaca(veiculo.placa);
    return this.api.obterPorPlaca(placa).pipe(
      switchMap((agg) => {
        if (agg?.motoristaId && agg.motoristaId > 0) {
          return of({
            ...veiculo,
            id: agg.veiculoId > 0 ? agg.veiculoId : veiculo.id,
            motoristaId: agg.motoristaId,
            motoristaNome: agg.motoristaNome || veiculo.motoristaNome || null,
            motoristaCpf: agg.motoristaCpf || veiculo.motoristaCpf || null,
          });
        }

        if (!(transportadoraId > 0 && veiculo.id > 0)) {
          return of(veiculo);
        }

        return this.veiculoApi.obterPorId(veiculo.id, transportadoraId).pipe(
          map((detalhe) => {
            if (!detalhe) return veiculo;
            const vinculo =
              detalhe.motoristasVinculos?.find((m) => m.principal === true) ??
              detalhe.motoristasVinculos?.[0];
            const mid =
              (detalhe.motoristaId && detalhe.motoristaId > 0 ? detalhe.motoristaId : null) ??
              (vinculo && vinculo.id > 0 ? vinculo.id : null);
            if (!mid) return veiculo;
            return {
              ...veiculo,
              motoristaId: mid,
              motoristaNome: detalhe.motoristaNome || vinculo?.nome || veiculo.motoristaNome || null,
              motoristaCpf: vinculo?.cpf || veiculo.motoristaCpf || null,
            };
          }),
          catchError(() => of(veiculo))
        );
      }),
      catchError(() => of(veiculo))
    );
  }
}
