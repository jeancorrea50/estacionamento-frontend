import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  PeriodoDataPickerComponent,
  type PeriodoDataSelecionado,
} from '../../../../shared/ui/periodo-data-picker/periodo-data-picker.component';
import { TransportadoraLookupFieldComponent } from '../../../movimentos/entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    PeriodoDataPickerComponent,
    TransportadoraLookupFieldComponent,
  ],
  templateUrl: './vaga-reserva-panel.component.html',
  styleUrls: ['./vaga-reserva-panel.component.scss'],
})
export class VagaReservaPanelComponent implements OnInit, OnChanges {
  private readonly api = inject(VagaDisponibilidadeService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  @Input() podeGerenciar = false;
  /** Quando true, omite título externo (uso dentro de modal). */
  @Input() embedded = false;

  readonly loading = signal(false);
  readonly salvando = signal(false);
  readonly resumo = signal<VagaDisponibilidadeResumo | null>(null);
  readonly reservas = signal<VagaReservaTransportadoraItem[]>([]);
  /** Lista de reservas expansível (somente UI). */
  readonly reservasAbertas = signal(true);
  /** Dia de consulta dos totalizadores (`YYYY-MM-DD`). */
  readonly dataConsulta = signal(toIsoDateLocal());
  readonly transportadoraFormId = signal<number | null>(null);
  readonly transportadoraFormNome = signal('');
  private readonly cancelarCarregar$ = new Subject<void>();
  private geracaoCarregar = 0;

  readonly modalidades: { value: ModalidadeVagaAgendamento; label: string }[] = [
    { value: 1, label: 'Estacionamento' },
    { value: 2, label: 'Limpeza' },
    { value: 3, label: 'Ambos' },
  ];
  /**
   * Recorrência no contrato atual (`periodicidade`):
   * 1=Diario, 2=Semanal, 3=Mensal, 4=Periodo.
   */
  readonly recorrencias: { value: PeriodicidadeVagaReserva; label: string; hint: string }[] = [
    { value: 1, label: 'Todos os dias', hint: 'Repete todos os dias na vigência.' },
    { value: 2, label: 'Toda semana', hint: 'Repete a cada semana na vigência.' },
    { value: 3, label: 'Todo mês', hint: 'Repete a cada mês na vigência.' },
    { value: 4, label: 'Período contínuo', hint: 'Sem repetição por dia/semana/mês.' },
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
      if (avulso) {
        this.limparTransportadoraSelecionada();
      }
    });
    // Prefill vigência da nova destinação com o dia consultado.
    this.form.controls.dataInicio.setValue(this.dataConsulta(), { emitEvent: false });
    this.form.controls.dataFim.setValue(this.dataConsulta(), { emitEvent: false });
    this.carregar();
  }

  onTransportadoraIdChange(id: number | null): void {
    this.transportadoraFormId.set(id);
    this.form.controls.transportadoraId.setValue(id && id > 0 ? id : 0);
    this.form.controls.transportadoraId.markAsDirty();
    if (id && id > 0 && this.form.controls.avulso.value) {
      this.form.controls.avulso.setValue(false, { emitEvent: false });
    }
  }

  onTransportadoraNomeChange(nome: string): void {
    this.transportadoraFormNome.set(nome || '');
  }

  private limparTransportadoraSelecionada(): void {
    this.transportadoraFormId.set(null);
    this.transportadoraFormNome.set('');
    this.form.controls.transportadoraId.setValue(0, { emitEvent: false });
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
      if (!this.form.controls.dataFim.dirty) {
        this.form.controls.dataFim.setValue(iso, { emitEvent: false });
      }
    }
    this.carregar();
  }

  onFiltroPeriodoChange(periodo: PeriodoDataSelecionado): void {
    if (!periodo.ativo || !periodo.dataInicial) return;
    this.onDataConsultaChange(periodo.dataInicial);
  }

  /** Vigência (`dataInicio`/`dataFim`) via calendário — contrato inalterado. */
  onVigenciaPeriodoChange(periodo: PeriodoDataSelecionado): void {
    if (!periodo.ativo || !periodo.dataInicial) {
      this.form.patchValue({ dataInicio: '', dataFim: '' });
      this.form.controls.dataInicio.markAsDirty();
      this.form.controls.dataFim.markAsDirty();
      return;
    }
    const fim = periodo.dataFinal || periodo.dataInicial;
    this.form.patchValue({
      dataInicio: periodo.dataInicial,
      dataFim: fim,
    });
    this.form.controls.dataInicio.markAsDirty();
    this.form.controls.dataFim.markAsDirty();
  }

  recorrenciaHint(): string {
    const atual = this.form.controls.periodicidade.value;
    return this.recorrencias.find((r) => r.value === atual)?.hint ?? '';
  }

  toggleReservas(): void {
    this.reservasAbertas.update((v) => !v);
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

    const dataInicio = (raw.dataInicio || '').trim().slice(0, 10);
    const dataFim = (raw.dataFim || '').trim().slice(0, 10) || null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio)) {
      this.toast.error('Selecione o período de vigência no calendário.');
      return;
    }
    if (dataFim && dataFim < dataInicio) {
      this.toast.error('A data fim deve ser igual ou posterior à data início.');
      return;
    }
    // Recorrência dia/semana/mês precisa de intervalo (fim) para fazer sentido na vigência.
    if (raw.periodicidade !== 4 && !dataFim) {
      this.toast.error('Informe o fim da vigência para a recorrência escolhida.');
      return;
    }

    this.salvando.set(true);
    this.api
      .criarReserva({
        transportadoraId: raw.avulso ? 0 : raw.transportadoraId,
        modalidade: raw.modalidade,
        quantidade: raw.quantidade,
        dataInicio,
        dataFim,
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
          const dia = this.dataConsulta();
          this.form.patchValue({
            quantidade: 1,
            dataInicio: dia,
            dataFim: dia,
            periodoDia: null,
            avulso: false,
            periodicidade: 1,
          });
          this.limparTransportadoraSelecionada();
          this.form.controls.dataInicio.markAsPristine();
          this.form.controls.dataFim.markAsPristine();
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
