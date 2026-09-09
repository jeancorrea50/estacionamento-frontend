import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { VeiculoService } from '../../../cadastro/services/veiculo.service';
import { TransportadoraService } from '../../../cadastro/services/transportadora.service';
import { TransportadoraListItemDTO } from '../../../cadastro/models/transportadora.dto';
import { normalizePlaca, formatPlacaDisplay, placaCompleta } from '../../../cadastro/utils/placa-br';
import { EstSummaryMetricComponent } from '../../../cadastro/components/est-summary-metric/est-summary-metric.component';
import {
  CadastroConfirmDialogComponent,
  CadastroConfirmDialogData,
} from '../../../cadastro/components/cadastro-confirm-dialog/cadastro-confirm-dialog.component';
import { PlacaFormatDirective } from '../../../cadastro/directives/placa-format.directive';
import { AgendamentoService } from '../../services/agendamento.service';
import {
  AgendamentoSearchItem,
  entradaSaidaStatusLabel,
} from '../../models/agendamento.models';

@Component({
  selector: 'app-agendamentos-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    EstSummaryMetricComponent,
    PlacaFormatDirective,
  ],
  templateUrl: './agendamentos-page.component.html',
  styleUrls: ['./agendamentos-page.component.scss'],
})
export class AgendamentosPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AgendamentoService);
  private readonly veiculoService = inject(VeiculoService);
  private readonly transportadoraService = inject(TransportadoraService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly isAdmin = this.auth.isAdmin();
  readonly isTransportadora = this.auth.isTransportadoraRole();
  readonly podeOperar = this.isAdmin || this.isTransportadora;

  loadingList = false;
  jaBuscou = false;
  erroList: string | null = null;
  salvando = false;
  lookingUp = false;
  showForm = false;

  items: AgendamentoSearchItem[] = [];
  totalCount = 0;
  numeroPagina = 1;
  tamanhoPagina = 20;
  transportadoras: TransportadoraListItemDTO[] = [];

  filtroPlaca = '';
  filtroDataInicial = '';
  filtroDataFinal = '';
  filtroTransportadoraId: number | null = null;

  form = this.fb.group({
    dataAgendamento: ['', Validators.required],
    placa: ['', Validators.required],
    transportadoraId: [null as number | null],
    observacao: [''],
    veiculoId: [null as number | null],
    motoristaId: [null as number | null],
    motoristaNome: [{ value: '', disabled: true }],
    motoristaCpf: [''],
  });

  ngOnInit(): void {
    if (!this.podeOperar) return;

    if (this.isTransportadora && !this.isAdmin) {
      this.filtroTransportadoraId = this.auth.resolveTransportadoraId();
    }

    if (this.isAdmin) {
      this.carregarTransportadoras();
    }

    this.onBuscar();
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.tamanhoPagina));
  }

  get intervaloLista(): { de: number; ate: number } {
    if (this.totalCount === 0) return { de: 0, ate: 0 };
    const de = (this.numeroPagina - 1) * this.tamanhoPagina + 1;
    const ate = Math.min(this.numeroPagina * this.tamanhoPagina, this.totalCount);
    return { de, ate };
  }

  onBuscar(): void {
    this.numeroPagina = 1;
    this.carregar();
  }

  carregar(): void {
    if (!this.podeOperar) return;

    this.loadingList = true;
    this.erroList = null;
    this.jaBuscou = true;

    this.api
      .buscar({
        placa: this.filtroPlaca.trim() || undefined,
        dataInicial: this.filtroDataInicial || this.filtroDataFinal || undefined,
        dataFinal: this.filtroDataFinal || this.filtroDataInicial || undefined,
        transportadoraId: this.isAdmin ? this.filtroTransportadoraId ?? undefined : undefined,
        numeroPagina: this.numeroPagina,
        tamanhoPagina: this.tamanhoPagina,
      })
      .subscribe({
        next: (res) => {
          this.items = res.items;
          this.totalCount = res.totalCount;
          this.loadingList = false;
        },
        error: () => {
          this.loadingList = false;
          this.erroList = 'Não foi possível carregar os agendamentos.';
          this.toast.error(this.erroList);
        },
      });
  }

  abrirNovo(): void {
    this.form.reset({
      dataAgendamento: this.defaultDateTimeLocal(),
      placa: '',
      transportadoraId: this.isTransportadora && !this.isAdmin ? this.auth.resolveTransportadoraId() : null,
      observacao: '',
      veiculoId: null,
      motoristaId: null,
      motoristaNome: '',
      motoristaCpf: '',
    });
    this.showForm = true;
  }

  fecharForm(): void {
    this.showForm = false;
  }

  onPlacaBlur(): void {
    const raw = this.form.get('placa')?.value ?? '';
    const placa = normalizePlaca(raw);
    this.form.patchValue({ placa: formatPlacaDisplay(placa) || raw }, { emitEvent: false });
    if (!placaCompleta(placa)) return;

    this.lookingUp = true;
    this.veiculoService.obterPorPlaca(placa).subscribe({
      next: (agg) => {
        this.lookingUp = false;
        if (!agg?.veiculoId) {
          this.toast.error('Veículo não encontrado para a placa informada.');
          this.form.patchValue({ veiculoId: null, motoristaId: null, motoristaNome: '', motoristaCpf: '' });
          return;
        }

        const sessaoTid = this.auth.resolveTransportadoraId();
        if (this.isTransportadora && !this.isAdmin && sessaoTid && agg.transportadoraId !== sessaoTid) {
          this.toast.error('Este veículo não pertence à transportadora da sessão.');
          return;
        }

        this.form.patchValue({
          veiculoId: agg.veiculoId,
          motoristaId: agg.motoristaId > 0 ? agg.motoristaId : null,
          motoristaNome: agg.motoristaNome || '',
          motoristaCpf: agg.motoristaCpf || '',
          transportadoraId: this.isAdmin ? agg.transportadoraId || this.form.value.transportadoraId : this.form.value.transportadoraId,
        });

        if (!(agg.motoristaId > 0)) {
          this.toast.error('Veículo sem motorista vinculado. Cadastre o vínculo antes de agendar.');
        }
      },
      error: () => {
        this.lookingUp = false;
        this.toast.error('Falha ao consultar a placa.');
      },
    });
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Preencha data/hora e placa.');
      return;
    }

    const v = this.form.getRawValue();
    const placa = normalizePlaca(v.placa ?? '');
    if (!placaCompleta(placa)) {
      this.toast.error('Informe a placa completa.');
      return;
    }
    if (!v.veiculoId || !v.motoristaId) {
      this.toast.error('Consulte a placa para carregar veículo e motorista.');
      return;
    }

    const tid =
      this.isTransportadora && !this.isAdmin
        ? this.auth.resolveTransportadoraId()
        : Number(v.transportadoraId) || null;

    if (!tid) {
      this.toast.error('Selecione a transportadora.');
      return;
    }

    this.salvando = true;
    this.api
      .gravar({
        dataAgendamento: this.toLocalIso(String(v.dataAgendamento ?? '')),
        observacao: (v.observacao ?? '').trim() || null,
        transportadoraId: tid,
        motorista: {
          id: Number(v.motoristaId),
          cpf: v.motoristaCpf || null,
          nome: v.motoristaNome || null,
        },
        veiculo: { id: Number(v.veiculoId), placa },
      })
      .subscribe({
        next: (res) => {
          this.salvando = false;
          if (!res.success) {
            this.toast.error(res.message || 'Não foi possível criar o agendamento.');
            return;
          }
          this.toast.success(res.message || 'Agendamento criado.');
          this.fecharForm();
          this.carregar();
        },
        error: () => {
          this.salvando = false;
          this.toast.error('Não foi possível criar o agendamento.');
        },
      });
  }

  confirmarEntrada(item: AgendamentoSearchItem): void {
    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      data: {
        titulo: 'Confirmar entrada',
        mensagem: `Confirmar entrada do veículo ${this.formatPlaca(item.placaVeiculo)} no pátio?`,
        confirmLabel: 'Confirmar entrada',
        confirmColor: 'primary',
      } satisfies CadastroConfirmDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.confirmarEntrada(item.id).subscribe({
        next: (res) => {
          if (!res.success) {
            this.toast.error(res.message || 'Não foi possível confirmar a entrada.');
            return;
          }
          this.toast.success(res.message || 'Entrada confirmada.');
          this.carregar();
        },
        error: () => this.toast.error('Não foi possível confirmar a entrada.'),
      });
    });
  }

  cancelar(item: AgendamentoSearchItem): void {
    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      data: {
        titulo: 'Cancelar agendamento',
        mensagem: `Cancelar o agendamento de ${this.formatPlaca(item.placaVeiculo)}?`,
        confirmLabel: 'Cancelar agendamento',
        confirmColor: 'warn',
      } satisfies CadastroConfirmDialogData,
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.cancelar(item.id).subscribe({
        next: (res) => {
          if (!res.success) {
            this.toast.error(res.message || 'Não foi possível cancelar.');
            return;
          }
          this.toast.success(res.message || 'Agendamento cancelado.');
          this.carregar();
        },
        error: () => this.toast.error('Não foi possível cancelar.'),
      });
    });
  }

  irParaPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.numeroPagina = p;
    this.carregar();
  }

  statusLabel(value: AgendamentoSearchItem['status']): string {
    return entradaSaidaStatusLabel(value) || '—';
  }

  formatPlaca(placa: string | null | undefined): string {
    return formatPlacaDisplay(placa) || placa || '—';
  }

  formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR');
  }

  private carregarTransportadoras(): void {
    this.transportadoraService.buscar({ NumeroPagina: 1, TamanhoPagina: 200 }).subscribe({
      next: (res) => {
        this.transportadoras = res.items ?? [];
      },
      error: () => {
        this.transportadoras = [];
      },
    });
  }

  private defaultDateTimeLocal(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  private toLocalIso(value: string): string {
    const v = value.trim();
    if (!v) return v;
    if (v.length === 16) return `${v}:00`;
    return v;
  }
}
