import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ToastService } from '../../../../core/api/services/toast.service';
import type { TransportadoraListItemDTO } from '../../../cadastro/models/transportadora.dto';
import { VagaDisponibilidadeService } from '../../services/vaga-disponibilidade.service';
import type {
  ModalidadeVagaAgendamento,
  PeriodicidadeVagaReserva,
  PeriodoDiaVaga,
  VagaDisponibilidadeResumo,
  VagaReservaTransportadoraItem,
} from '../../models/vaga-disponibilidade.models';

/**
 * Painel do operador/pátio: destina vagas (estacionamento/limpeza) para transportadoras.
 */
@Component({
  selector: 'app-vaga-reserva-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
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
    this.carregar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['podeGerenciar'] && !this.podeGerenciar) {
      this.form.disable({ emitEvent: false });
    } else if (changes['podeGerenciar'] && this.podeGerenciar) {
      this.form.enable({ emitEvent: false });
    }
  }

  carregar(): void {
    this.loading.set(true);
    forkJoin({
      resumo: this.api.resumoParaTransportadora().pipe(catchError(() => of(null))),
      reservas: this.api.listarReservas().pipe(catchError(() => of([] as VagaReservaTransportadoraItem[]))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ resumo, reservas }) => {
          this.resumo.set(resumo);
          this.reservas.set(reservas?.length ? reservas : resumo?.reservas ?? []);
        },
        error: () => {
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
}
