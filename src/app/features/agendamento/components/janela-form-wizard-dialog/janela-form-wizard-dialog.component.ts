import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { ApiError } from '../../../../core/api/models';
import { ToastService } from '../../../../core/api/services/toast.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  PeriodoDataPickerComponent,
  type PeriodoDataSelecionado,
} from '../../../../shared/ui/periodo-data-picker/periodo-data-picker.component';
import {
  PeriodoHoraPickerComponent,
  type PeriodoHoraSelecionado,
} from '../../../../shared/ui/periodo-hora-picker/periodo-hora-picker.component';
import { EstacionamentoService } from '../../../cadastro/services/estacionamento.service';
import {
  DIAS_SEMANA_OPCOES,
  GranularidadeUnidade,
  JanelaAgendamentoListItem,
  MODALIDADE_JANELA_CRUD_OPCOES,
  ModalidadeJanela,
  PERIODICIDADE_OPCOES,
  PeriodicidadeTipo,
  parseModalidadeJanela,
} from '../../models/janela-agendamento.models';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import {
  ExcecaoForm,
  FaixaForm,
  JanelaFormDialogData,
  JanelaFormDialogResult,
  JanelaFormState,
  PeriodicidadeForm,
  formDeDetalhe,
  formParaPayload,
  formVazio,
  novoUid,
} from '../janela-form-dialog/janela-form.state';
import {
  JanelaFormErro,
  horaParaMinutos,
  validarJanelaForm,
} from '../janela-form-dialog/janela-form.validation';
import { JanelaExcecoesTabComponent } from '../janela-form-dialog/tabs/janela-excecoes-tab.component';
import {
  CapacidadePatio,
  UsoVagasJanelas,
  gerarFaixasHorario,
  somarUsoVagasJanelas,
  validarVagasContraCapacidadePatio,
} from './janela-capacidade.util';

const DURACAO_GERACAO_OPCOES: ReadonlyArray<{ value: number; label: string }> = [
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
];

export interface HorarioLinhaUi {
  uid: number;
  id?: number;
  horaInicio: string;
  horaFim: string;
  /** Espelha `vagasPorSlot` (contrato único). */
  vagas: number | null;
}

/**
 * Modal único de criar/editar janela (layout da imagem).
 * Mesmo payload/API do formulário clássico — sem wizard em etapas.
 */
@Component({
  selector: 'app-janela-form-wizard-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    PeriodoDataPickerComponent,
    PeriodoHoraPickerComponent,
    JanelaExcecoesTabComponent,
  ],
  templateUrl: './janela-form-wizard-dialog.component.html',
  styleUrl: './janela-form-wizard-dialog.component.scss',
})
export class JanelaFormWizardDialogComponent {
  private readonly ref = inject(
    MatDialogRef<JanelaFormWizardDialogComponent, JanelaFormDialogResult | undefined>
  );
  private readonly api = inject(JanelaAgendamentoService);
  private readonly estacionamentos = inject(EstacionamentoService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = inject<JanelaFormDialogData>(MAT_DIALOG_DATA);

  readonly modalidades = MODALIDADE_JANELA_CRUD_OPCOES;
  readonly periodicidadeOpcoes = PERIODICIDADE_OPCOES;
  readonly diasSemanaOpcoes = DIAS_SEMANA_OPCOES;
  readonly duracaoGeracaoOpcoes = DURACAO_GERACAO_OPCOES;
  readonly editando = this.data.mode === 'edit' && !!this.data.janela;

  readonly salvando = signal(false);
  readonly erros = signal<JanelaFormErro[]>([]);
  readonly excecoesAbertas = signal(false);
  readonly capacidadePatio = signal<CapacidadePatio>({ estacionamento: null, limpeza: null });
  readonly usoOutrasJanelas = signal<UsoVagasJanelas>({ estacionamento: 0, limpeza: 0 });

  readonly gerarInicio = signal('06:00');
  readonly gerarFim = signal('18:00');
  readonly gerarDuracaoMin = signal(60);
  readonly gerarVagas = signal<number | null>(null);

  readonly nome = signal('');
  readonly descricao = signal('');
  readonly modalidade = signal<ModalidadeJanela>(1);
  readonly vigenciaInicio = signal('');
  readonly vigenciaFim = signal('');
  readonly ativo = signal(true);
  readonly unidade = signal<GranularidadeUnidade>(1);
  readonly valorSlot = signal<number | null>(1);
  readonly vagasPorSlot = signal<number | null>(null);
  readonly horarios = signal<HorarioLinhaUi[]>([]);
  readonly periodicidades = signal<PeriodicidadeForm[]>([]);
  readonly excecoes = signal<ExcecaoForm[]>([]);

  readonly titulo = computed(() => (this.editando ? 'Editar janela' : 'Nova janela'));
  readonly totalVagasHorarios = computed(() => {
    const v = this.vagasPorSlot();
    if (v == null || this.horarios().length === 0) return 0;
    return v * this.horarios().length;
  });
  readonly errosVisiveis = computed(() => this.erros().slice(0, 6));
  readonly recorrencia = computed(() => this.periodicidades()[0] ?? null);
  readonly recorrenciaTipo = computed(() => this.recorrencia()?.tipo ?? 1);
  readonly mostraDiasSemana = computed(
    () => this.recorrenciaTipo() === 2 || this.recorrenciaTipo() === 3
  );
  readonly mostraDiaMes = computed(
    () => this.recorrenciaTipo() === 4 || this.recorrenciaTipo() === 5
  );
  readonly recorrenciaHint = computed(() => {
    const tipo = this.recorrenciaTipo();
    const vagas = this.vagasPorSlot();
    const dia = this.recorrencia()?.diaMes;
    if (tipo === 1) {
      return 'Diário: os horários e vagas se repetem todos os dias dentro da vigência da recorrência.';
    }
    if (tipo === 4) {
      return dia != null
        ? `Mensal: no dia ${dia} de cada mês, replica os mesmos horários${vagas != null ? ` com ${vagas} vagas` : ''}.`
        : 'Mensal: informe o dia do mês para repetir os mesmos horários e vagas.';
    }
    if (tipo === 2 || tipo === 3) {
      return 'Nos dias da semana selecionados, replica os mesmos horários e vagas.';
    }
    if (tipo === 5) {
      return 'Anual: repete no dia/mês informados, com os mesmos horários e vagas.';
    }
    return 'A recorrência define em quais dias a programação de horários/vagas se aplica.';
  });

  constructor() {
    const base =
      this.editando && this.data.janela
        ? formDeDetalhe(this.data.janela)
        : formVazio(this.data.modalidade);
    this.aplicar(base);
    this.carregarContextoCapacidade();
  }

  onTexto(campo: 'nome' | 'descricao', event: Event): void {
    this[campo].set((event.target as HTMLInputElement).value);
  }

  onModalidade(raw: string): void {
    if (this.editando) return;
    this.modalidade.set(parseModalidadeJanela(raw));
  }

  onVigenciaPeriodo(periodo: PeriodoDataSelecionado): void {
    const prevIni = this.vigenciaInicio();
    const prevFim = this.vigenciaFim();
    if (!periodo.ativo || !periodo.dataInicial) {
      this.vigenciaInicio.set('');
      this.vigenciaFim.set('');
      return;
    }
    this.vigenciaInicio.set(periodo.dataInicial);
    this.vigenciaFim.set(periodo.dataFinal || '');
    // Espelha na recorrência enquanto ela ainda acompanha a vigência da janela.
    this.periodicidades.update((lista) => {
      if (!lista.length) return lista;
      const [primeira, ...rest] = lista;
      const espelhar =
        !primeira.dataInicio ||
        primeira.dataInicio === prevIni ||
        (primeira.dataFim || '') === (prevFim || '');
      if (!espelhar) return lista;
      return [
        {
          ...primeira,
          dataInicio: periodo.dataInicial,
          dataFim: periodo.dataFinal || '',
          diaMes:
            primeira.tipo === 4 || primeira.tipo === 5
              ? this.extrairDiaMes(periodo.dataInicial) ?? primeira.diaMes
              : primeira.diaMes,
        },
        ...rest,
      ];
    });
  }

  onRecorrenciaVigencia(periodo: PeriodoDataSelecionado): void {
    if (!periodo.ativo || !periodo.dataInicial) {
      this.patchRecorrencia({ dataInicio: '', dataFim: '' });
      return;
    }
    const patch: Partial<PeriodicidadeForm> = {
      dataInicio: periodo.dataInicial,
      dataFim: periodo.dataFinal || '',
    };
    const atual = this.recorrencia();
    if (atual && (atual.tipo === 4 || atual.tipo === 5)) {
      patch.diaMes = this.extrairDiaMes(periodo.dataInicial) ?? atual.diaMes;
    }
    this.patchRecorrencia(patch);
  }

  onVagasLinha(uid: number, event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    const n = digits ? Number(digits) : 0;
    const valor = n > 0 ? n : null;
    el.value = valor == null ? '' : String(valor);
    // Contrato API: uma capacidade única (`vagasPorSlot`) — propaga para todas as faixas.
    this.vagasPorSlot.set(valor);
    this.horarios.update((lista) => lista.map((h) => ({ ...h, vagas: valor })));
    this.erros.update((lista) => [
      ...lista.filter((e) => e.aba !== 'capacidade'),
      ...this.errosCapacidadePatio(valor, this.modalidade()),
    ]);
  }

  onPeriodicidadeTipo(raw: string): void {
    const tipo = Number(raw) as PeriodicidadeTipo;
    const tiposValidos: PeriodicidadeTipo[] = [1, 2, 3, 4, 5];
    const t = tiposValidos.includes(tipo) ? tipo : 1;
    this.periodicidades.update((lista) => {
      if (!lista.length) return lista;
      const [primeira, ...rest] = lista;
      const baseData = primeira.dataInicio || this.vigenciaInicio();
      const diaMes =
        t === 4 || t === 5
          ? primeira.diaMes ?? this.extrairDiaMes(baseData)
          : null;
      return [
        {
          ...primeira,
          tipo: t,
          dias: t === 2 || t === 3 ? primeira.dias : [],
          diaMes,
          mes: t === 5 ? primeira.mes : null,
          dataInicio: primeira.dataInicio || this.vigenciaInicio(),
          dataFim: primeira.dataFim || this.vigenciaFim(),
        },
        ...rest,
      ];
    });
  }

  onDiaMesRecorrencia(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    const n = digits ? Number(digits) : 0;
    const dia = n >= 1 && n <= 31 ? n : null;
    el.value = dia == null ? '' : String(dia);
    this.patchRecorrencia({ diaMes: dia });
  }

  alternarDiaSemana(dia: number): void {
    this.periodicidades.update((lista) => {
      if (!lista.length) return lista;
      const [primeira, ...rest] = lista;
      const tem = primeira.dias.includes(dia);
      const dias = tem ? primeira.dias.filter((d) => d !== dia) : [...primeira.dias, dia].sort((a, b) => a - b);
      return [{ ...primeira, dias }, ...rest];
    });
  }

  adicionarHorario(): void {
    const vagas = this.vagasPorSlot() ?? this.gerarVagas();
    this.horarios.update((lista) => [
      ...lista,
      {
        uid: novoUid(),
        horaInicio: '',
        horaFim: '',
        vagas,
      },
    ]);
  }

  removerHorario(uid: number): void {
    this.horarios.update((lista) => lista.filter((h) => h.uid !== uid));
  }

  onGerarPeriodo(periodo: PeriodoHoraSelecionado): void {
    this.gerarInicio.set(periodo.horaInicio);
    this.gerarFim.set(periodo.horaFim);
  }

  onGerarDuracao(raw: string): void {
    const n = Number(raw);
    const ok = this.duracaoGeracaoOpcoes.some((o) => o.value === n);
    this.gerarDuracaoMin.set(ok ? n : 60);
  }

  onGerarVagas(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    const n = digits ? Number(digits) : 0;
    const valor = n > 0 ? n : null;
    el.value = valor == null ? '' : String(valor);
    this.gerarVagas.set(valor);
  }

  /**
   * Gera faixas consecutivas a partir de início, fim, duração e vagas.
   * Substitui a lista atual de horários.
   */
  gerarHorariosAutomaticos(): void {
    const vagas = this.gerarVagas() ?? this.vagasPorSlot();
    if (vagas == null || vagas < 1) {
      this.toast.error('Informe as vagas por horário antes de gerar.');
      return;
    }
    const capErros = this.errosCapacidadePatio(vagas, this.modalidade());
    if (capErros.length) {
      this.erros.set(capErros);
      this.toast.error(capErros[0].mensagem);
      return;
    }

    const { faixas, erro } = gerarFaixasHorario({
      horaInicio: this.gerarInicio(),
      horaFim: this.gerarFim(),
      duracaoMinutos: this.gerarDuracaoMin(),
    });
    if (erro || !faixas.length) {
      this.toast.error(erro || 'Não foi possível gerar os horários.');
      return;
    }

    this.vagasPorSlot.set(vagas);
    // Mantém granularidade alinhada à duração gerada (contrato `granularidadeUnidade/Valor`).
    this.sincronizarGranularidade(this.gerarDuracaoMin());
    this.horarios.set(
      faixas.map((f) => ({
        uid: novoUid(),
        horaInicio: f.horaInicio,
        horaFim: f.horaFim,
        vagas,
      }))
    );
    this.erros.update((lista) => lista.filter((e) => e.aba !== 'capacidade'));
    this.toast.success(`${faixas.length} horários gerados.`);
  }

  /** 30 min → minuto/30; 60 → hora/1; 120 → hora/2. */
  private sincronizarGranularidade(duracaoMinutos: number): void {
    const d = Math.trunc(duracaoMinutos);
    if (d === 30) {
      this.unidade.set(2);
      this.valorSlot.set(30);
      return;
    }
    if (d === 120) {
      this.unidade.set(1);
      this.valorSlot.set(2);
      return;
    }
    this.unidade.set(1);
    this.valorSlot.set(1);
  }

  /**
   * Replica a faixa logo após o fim dela, com a mesma duração e vagas.
   * Ex.: 06:00→07:00 vira 07:00→08:00.
   */
  replicarHorario(uid: number): void {
    const lista = this.horarios();
    const i = lista.findIndex((h) => h.uid === uid);
    if (i < 0) return;
    const origem = lista[i];
    const ini = horaParaMinutos(origem.horaInicio);
    const fim = horaParaMinutos(origem.horaFim);
    if (ini == null || fim == null || fim <= ini) {
      this.toast.error('Informe um horário válido (início e fim) antes de replicar.');
      return;
    }
    const duracao = fim - ini;
    const novoIni = fim;
    const novoFim = fim + duracao;
    if (novoFim > 24 * 60) {
      this.toast.error('A próxima faixa ultrapassa 24:00. Ajuste o horário antes de replicar.');
      return;
    }
    const replica: HorarioLinhaUi = {
      uid: novoUid(),
      horaInicio: this.formatMinutos(novoIni),
      horaFim: this.formatMinutos(novoFim),
      vagas: origem.vagas ?? this.vagasPorSlot(),
    };
    this.horarios.update((atual) => {
      const next = [...atual];
      next.splice(i + 1, 0, replica);
      return next;
    });
  }

  onHorarioPeriodo(uid: number, periodo: PeriodoHoraSelecionado): void {
    this.horarios.update((lista) =>
      lista.map((h) =>
        h.uid === uid
          ? { ...h, horaInicio: periodo.horaInicio, horaFim: periodo.horaFim }
          : h
      )
    );
  }

  alternarExcecoes(): void {
    this.excecoesAbertas.update((v) => !v);
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  salvar(): void {
    if (this.salvando()) return;
    const estado = this.snapshot();
    const erros = [
      ...validarJanelaForm(estado),
      ...this.errosCapacidadePatio(estado.vagasPorSlot, estado.modalidade),
    ];
    this.erros.set(erros);
    if (erros.length) {
      this.toast.error(erros[0].mensagem);
      return;
    }

    const payload = formParaPayload(estado);
    const janela = this.data.janela;
    const request$ =
      this.editando && janela ? this.api.alterar(janela.id, payload) : this.api.gravar(payload);

    this.salvando.set(true);
    request$.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: (salva) => {
        this.toast.success(this.editando ? 'Janela atualizada.' : 'Janela criada.');
        this.ref.close({ saved: true, janela: salva });
      },
      error: (err: ApiError) => {
        if (!err?.toastShown) this.toast.error(err?.message || 'Não foi possível salvar a janela.');
      },
    });
  }

  private errosCapacidadePatio(
    vagasPorSlot: number | null,
    modalidade: ModalidadeJanela
  ): JanelaFormErro[] {
    return validarVagasContraCapacidadePatio({
      vagasPorSlot,
      modalidade,
      capacidade: this.capacidadePatio(),
      usoOutras: this.usoOutrasJanelas(),
    }).map((mensagem) => ({ aba: 'capacidade' as const, mensagem }));
  }

  private carregarContextoCapacidade(): void {
    const estacionamentoId = this.auth.resolveEstacionamentoId();
    if (!estacionamentoId) return;

    const codExportacao = this.auth.resolveCodExportacao();
    const excluirId = this.editando ? this.data.janela?.id ?? null : null;

    forkJoin({
      patio: this.estacionamentos.obterPorId(estacionamentoId, codExportacao).pipe(
        catchError(() => of(null))
      ),
      janelas: this.carregarJanelasParaCapacidade().pipe(catchError(() => of([] as JanelaAgendamentoListItem[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ patio, janelas }) => {
        this.capacidadePatio.set({
          estacionamento: patio?.capacidadeVeiculos ?? null,
          limpeza: patio?.capacidadeVeiculosLimpeza ?? null,
        });
        this.usoOutrasJanelas.set(somarUsoVagasJanelas(janelas, excluirId));
      });
  }

  /** Lista janelas do pátio (todas as páginas) para somar vagas por capacidade. */
  private carregarJanelasParaCapacidade() {
    const tamanhoPagina = 100;
    return this.api.buscar({ numeroPagina: 1, tamanhoPagina }).pipe(
      switchMap((primeira) => {
        const total = primeira.totalCount || primeira.items.length;
        if (total <= primeira.items.length) return of(primeira.items);
        const paginas = Math.ceil(total / tamanhoPagina);
        const restantes = Array.from({ length: paginas - 1 }, (_, i) =>
          this.api.buscar({ numeroPagina: i + 2, tamanhoPagina })
        );
        if (!restantes.length) return of(primeira.items);
        return forkJoin(restantes).pipe(
          map((mais) => [...primeira.items, ...mais.flatMap((p) => p.items)])
        );
      })
    );
  }

  private patchRecorrencia(patch: Partial<PeriodicidadeForm>): void {
    this.periodicidades.update((lista) => {
      if (!lista.length) return lista;
      const [primeira, ...rest] = lista;
      return [{ ...primeira, ...patch }, ...rest];
    });
  }

  private extrairDiaMes(iso: string | null | undefined): number | null {
    const m = String(iso ?? '').match(/^\d{4}-\d{2}-(\d{2})/);
    if (!m) return null;
    const d = Number(m[1]);
    return d >= 1 && d <= 31 ? d : null;
  }

  private formatMinutos(total: number): string {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private aplicar(s: JanelaFormState): void {
    this.nome.set(s.nome);
    this.descricao.set(s.descricao);
    this.modalidade.set(s.modalidade);
    this.vigenciaInicio.set(s.dataVigenciaInicio);
    this.vigenciaFim.set(s.dataVigenciaFim);
    this.ativo.set(s.ativo);
    this.unidade.set(s.granularidadeUnidade);
    this.valorSlot.set(s.granularidadeValor);
    this.vagasPorSlot.set(s.vagasPorSlot);
    this.gerarVagas.set(s.vagasPorSlot);
    this.horarios.set(s.faixas.map((f) => this.faixaParaLinha(f, s.vagasPorSlot)));
    this.periodicidades.set(s.periodicidades);
    this.excecoes.set(s.excecoes);
    if (s.excecoes.length) this.excecoesAbertas.set(true);
  }

  private faixaParaLinha(f: FaixaForm, vagas: number | null): HorarioLinhaUi {
    return {
      uid: f.uid,
      id: f.id,
      horaInicio: f.horaInicio,
      horaFim: f.horaFim,
      vagas,
    };
  }

  private snapshot(): JanelaFormState {
    const faixas: FaixaForm[] = this.horarios().map((h) => ({
      uid: h.uid,
      id: h.id,
      horaInicio: h.horaInicio,
      horaFim: h.horaFim,
    }));
    return {
      nome: this.nome(),
      descricao: this.descricao(),
      modalidade: this.modalidade(),
      dataVigenciaInicio: this.vigenciaInicio(),
      dataVigenciaFim: this.vigenciaFim(),
      ativo: this.ativo(),
      granularidadeUnidade: this.unidade(),
      granularidadeValor: this.valorSlot(),
      vagasPorSlot: this.vagasPorSlot(),
      faixas,
      periodicidades: this.periodicidades(),
      excecoes: this.excecoes(),
    };
  }
}
