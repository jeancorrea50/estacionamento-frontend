import { CommonModule } from '@angular/common';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/api/services/toast.service';
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
}

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
})
export class AgendamentoNovoModalComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AgendamentoService);
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

  private resetForm(): void {
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
    this.form.controls.transportadoraId.setValue(id);
    this.form.controls.transportadoraId.markAsDirty();
    this.transportadoraFormId.set(id);
    this.transportadoraFormNome.set((item.titulo || '').trim());
    this.placasSelecionadas.set([]);
    this.buscaTransportadoraAberta.set(false);
  }

  limparTransportadoraForm(): void {
    if (!this.podeEscolherTransportadora()) return;
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

    this.placasSelecionadas.update((lista) => [
      ...lista,
      {
        id,
        placa,
        marcaModelo: item.campo2 && item.campo2 !== '—' ? item.campo2 : undefined,
      },
    ]);
    this.buscaPlacaAberta.set(false);
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
    veiculo: { id: number; placa: string },
    transportadoraId: number,
    dataAgendamento: string,
    observacao: string | null,
    isTransportadora: boolean,
    isAdmin: boolean
  ) {
    const placa = normalizePlaca(veiculo.placa);
    if (!placaCompleta(placa)) {
      return of(null);
    }

    return this.api.obterPorPlaca(placa).pipe(
      map((agg) => {
        const motoristaId = agg?.motoristaId && agg.motoristaId > 0 ? agg.motoristaId : null;
        if (!motoristaId || motoristaId <= 0) return null;

        if (
          isTransportadora &&
          !isAdmin &&
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
            cpf: agg?.motoristaCpf || null,
            nome: agg?.motoristaNome || null,
          },
          veiculo: {
            id: agg?.veiculoId || veiculo.id,
            placa,
          },
        };
        return payload;
      }),
      catchError(() => of(null))
    );
  }
}
