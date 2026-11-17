import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { ToastService } from '../../../../core/api/services/toast.service';
import type { TransportadoraListItemDTO } from '../../../cadastro/models/transportadora.dto';
import { AgendamentoDataHoraPickerComponent } from '../../pages/agendamentos-page/agendamento-data-hora-picker/agendamento-data-hora-picker.component';
import { VagaDisponibilidadeService } from '../../services/vaga-disponibilidade.service';
import type {
  ModalidadeVagaAgendamento,
  PeriodicidadeVagaReserva,
  PeriodoDiaVaga,
  VagaDisponibilidadeResumo,
  VagaReservaTransportadoraItem,
} from '../../models/vaga-disponibilidade.models';

function toIsoDateLocal(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIsoDateLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

/**
 * Painel do operador/pátio: destina vagas (estacionamento/limpeza) para transportadoras.
 */
@Component({
  selector: 'app-vaga-reserva-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, AgendamentoDataHoraPickerComponent],
  templateUrl: './vaga-reserva-panel.component.html',
  styleUrls: ['./vaga-reserva-panel.component.scss'],
})
export class VagaReservaPanelComponent implements OnInit, OnChanges {
  private readonly api = inject(VagaDisponibilidadeService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  @Input() transportadoras: TransportadoraListItemDTO[] = [];
  @Input() podeGerenciar = false;
  /** Quando true, omite título externo (uso dentro de modal). */
  @Input() embedded = false;

  readonly loading = signal(false);
  readonly salvando = signal(false);
  readonly resumo = signal<VagaDisponibilidadeResumo | null>(null);
  readonly reservas = signal<VagaReservaTransportadoraItem[]>([]);
  /** Dia de consulta dos totalizadores (`YYYY-MM-DD`). */
  readonly dataConsulta = signal(toIsoDateLocal());
  private readonly cancelarCarregar$ = new Subject<void>();
  private geracaoCarregar = 0;

  readonly modalidades: { value: ModalidadeVagaAgendamento; label: string }[] = [
    { value: 1, label: 'Estacionamento' },
    { value: 2, label: 'Limpeza' },
    { value: 3, label: 'Ambos' },
  ];
  readonly periodicidades: { value: PeriodicidadeVagaReserva; label: string }[] = [
    { value: 1, label: 'Diário' },
    { value: 2, label: 'Semanal' },
    { value: 3, label: 'Mensal' },
    { value: 4, label: 'Período' },
  ];
  readonly periodosDia: { value: PeriodoDiaVaga; label: string }[] = [
    { value: 1, label: 'Matutino' },
    { value: 2, label: 'Vespertino' },
    { value: 3, label: 'Noturno' },
  ];

  readonly form = this.fb.nonNullable.group({
    transportadoraId: [0, [Validators.min(1)]],
    modalidade: [1 as ModalidadeVagaAgendamento, Validators.required],
    quantidade: [1, [Validators.required, Validators.min(1)]],
    dataInicio: ['', Validators.required],
    dataFim: [''],
    periodicidade: [1 as PeriodicidadeVagaReserva, Validators.required],
    periodoDia: [null as PeriodoDiaVaga],
    avulso: [false],
  });

  ngOnInit(): void {
    this.form.controls.avulso.valueChanges.subscribe((avulso) => {
      const ctrl = this.form.controls.transportadoraId;
      if (avulso) {
        ctrl.setValue(0, { emitEvent: false });
        ctrl.disable({ emitEvent: false });
      } else {
        ctrl.enable({ emitEvent: false });
      }
    });
    // Prefill início da nova destinação com o dia consultado.
    this.form.controls.dataInicio.setValue(this.dataConsulta(), { emitEvent: false });
    this.carregar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['podeGerenciar'] && !this.podeGerenciar) {
      this.form.disable({ emitEvent: false });
    } else if (changes['podeGerenciar'] && this.podeGerenciar) {
      this.form.enable({ emitEvent: false });
    }
  }

  onDataConsultaChange(value: string): void {
    const iso = (value || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    if (iso === this.dataConsulta()) return;
    this.dataConsulta.set(iso);
    // Ajuda o operador: nova destinação começa no dia filtrado.
    if (!this.form.controls.dataInicio.dirty) {
      this.form.controls.dataInicio.setValue(iso, { emitEvent: false });
    }
    this.carregar();
  }

  irParaHoje(): void {
    this.onDataConsultaChange(toIsoDateLocal());
  }

  dataConsultaLabel(): string {
    const d = parseIsoDateLocal(this.dataConsulta());
    if (!d) return this.dataConsulta();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  carregar(): void {
    this.cancelarCarregar$.next();
    const geracao = ++this.geracaoCarregar;
    const data = this.dataConsulta();
    this.loading.set(true);
    forkJoin({
      resumo: this.api.resumoParaTransportadora(data).pipe(catchError(() => of(null))),
      reservas: this.api.listarReservas().pipe(catchError(() => of([] as VagaReservaTransportadoraItem[]))),
    })
      .pipe(
        takeUntil(this.cancelarCarregar$),
        finalize(() => {
          if (geracao === this.geracaoCarregar) this.loading.set(false);
        })
      )
      .subscribe({
        next: ({ resumo, reservas }) => {
          if (geracao !== this.geracaoCarregar || data !== this.dataConsulta()) return;
          this.resumo.set(resumo);
          // Lista completa para gestão; KPIs já vêm filtrados pelo dia.
          this.reservas.set(reservas?.length ? reservas : resumo?.reservas ?? []);
        },
        error: () => {
          if (geracao !== this.geracaoCarregar || data !== this.dataConsulta()) return;
          this.resumo.set(null);
          this.reservas.set([]);
        },
      });
  }

  salvar(): void {
    if (!this.podeGerenciar) return;
    const raw = this.form.getRawValue();
    if (!raw.avulso && (!raw.transportadoraId || raw.transportadoraId <= 0)) {
      this.toast.error('Selecione a transportadora.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Preencha os campos obrigatórios da reserva.');
      return;
    }

    this.salvando.set(true);
    this.api
      .criarReserva({
        transportadoraId: raw.avulso ? 0 : raw.transportadoraId,
        modalidade: raw.modalidade,
        quantidade: raw.quantidade,
        dataInicio: raw.dataInicio,
        dataFim: raw.dataFim || null,
        periodicidade: raw.periodicidade,
        periodoDia: raw.periodoDia,
        avulso: raw.avulso,
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: (criada) => {
          if (!criada) {
            this.toast.error('Não foi possível criar a reserva.');
            return;
          }
          this.toast.success('Reserva de vaga criada.');
          this.form.patchValue({ quantidade: 1, dataFim: '', periodoDia: null, avulso: false });
          this.form.controls.dataInicio.markAsPristine();
          this.carregar();
        },
        error: () => this.toast.error('Falha ao criar reserva de vaga.'),
      });
  }

  inativar(id: number): void {
    if (!this.podeGerenciar) return;
    this.api.inativarReserva(id).subscribe({
      next: (ok) => {
        if (!ok) {
          this.toast.error('Não foi possível inativar a reserva.');
          return;
        }
        this.toast.success('Reserva inativada.');
        this.carregar();
      },
      error: () => this.toast.error('Falha ao inativar reserva.'),
    });
  }

  /** Percentual disponível (0–100) para a barra dos KPIs. */
  pctDisponivel(disponiveis: number | null | undefined, capacidade: number | null | undefined): number {
    const cap = Number(capacidade);
    const disp = Number(disponiveis);
    if (!Number.isFinite(cap) || cap <= 0) return 0;
    if (!Number.isFinite(disp) || disp <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((disp / cap) * 100)));
  }
}
