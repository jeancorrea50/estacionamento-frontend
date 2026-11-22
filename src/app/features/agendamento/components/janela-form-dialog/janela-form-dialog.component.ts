import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';
import { ApiError } from '../../../../core/api/models';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  GranularidadeUnidade,
  JanelaAgendamentoDetalhe,
  MODALIDADE_JANELA_CRUD_OPCOES,
  ModalidadeJanela,
  parseModalidadeJanela,
} from '../../models/janela-agendamento.models';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import {
  ExcecaoForm,
  FaixaForm,
  JanelaFormAba,
  JanelaFormState,
  PeriodicidadeForm,
  formDeDetalhe,
  formParaPayload,
  formVazio,
} from './janela-form.state';
import { JanelaFormErro, validarJanelaForm } from './janela-form.validation';
import { JanelaExcecoesTabComponent } from './tabs/janela-excecoes-tab.component';
import { JanelaHorariosTabComponent } from './tabs/janela-horarios-tab.component';
import { JanelaPeriodicidadesTabComponent } from './tabs/janela-periodicidades-tab.component';

export interface JanelaFormDialogData {
  mode: 'create' | 'edit';
  /** Modalidade pré-selecionada na criação. */
  modalidade: ModalidadeJanela;
  /** Detalhe completo (GET {id}) — obrigatório em `edit`. */
  janela?: JanelaAgendamentoDetalhe;
}

export interface JanelaFormDialogResult {
  saved: true;
  janela: JanelaAgendamentoDetalhe;
}

/**
 * Criar/editar janela de agendamento. Abas próprias (Horários | Capacidade | Exceções | Periodicidade),
 * sem MatTabGroup — mesmo padrão do dialog de Config. Cobrança.
 * Abrir com `panelClass: 'cfg-form-dialog-panel'` (tema claro/escuro).
 */
@Component({
  selector: 'app-janela-form-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    JanelaHorariosTabComponent,
    JanelaExcecoesTabComponent,
    JanelaPeriodicidadesTabComponent,
  ],
  templateUrl: './janela-form-dialog.component.html',
  styleUrl: './janela-form-dialog.component.scss',
})
export class JanelaFormDialogComponent {
  private readonly ref = inject(MatDialogRef<JanelaFormDialogComponent, JanelaFormDialogResult | undefined>);
  private readonly api = inject(JanelaAgendamentoService);
  private readonly toast = inject(ToastService);
  readonly data = inject<JanelaFormDialogData>(MAT_DIALOG_DATA);

  readonly modalidades = MODALIDADE_JANELA_CRUD_OPCOES;
  readonly editando = this.data.mode === 'edit' && !!this.data.janela;

  readonly aba = signal<JanelaFormAba>('horarios');
  readonly salvando = signal(false);
  readonly erros = signal<JanelaFormErro[]>([]);

  // Estado do formulário em signals individuais (permite `[(model)]` nas abas).
  readonly nome = signal('');
  readonly descricao = signal('');
  readonly modalidade = signal<ModalidadeJanela>(1);
  readonly vigenciaInicio = signal('');
  readonly vigenciaFim = signal('');
  readonly ativo = signal(true);
  readonly unidade = signal<GranularidadeUnidade>(1);
  readonly valorSlot = signal<number | null>(1);
  readonly vagasPorSlot = signal<number | null>(null);
  readonly faixas = signal<FaixaForm[]>([]);
  readonly periodicidades = signal<PeriodicidadeForm[]>([]);
  readonly excecoes = signal<ExcecaoForm[]>([]);

  readonly titulo = computed(() => (this.editando ? 'Editar janela' : 'Nova janela'));
  readonly modalidadeLabel = computed(
    () => this.modalidades.find((m) => m.value === this.modalidade())?.label ?? ''
  );
  readonly errosDaAba = computed(() => this.erros().filter((e) => e.aba === this.aba()));

  constructor() {
    this.aplicar(
      this.editando && this.data.janela ? formDeDetalhe(this.data.janela) : formVazio(this.data.modalidade)
    );
  }

  selecionarAba(aba: JanelaFormAba): void {
    this.aba.set(aba);
  }

  temErroNaAba(aba: JanelaFormAba): boolean {
    return this.erros().some((e) => e.aba === aba);
  }

  onTexto(campo: 'nome' | 'descricao' | 'vigenciaInicio' | 'vigenciaFim', event: Event): void {
    this[campo].set((event.target as HTMLInputElement).value);
  }

  onModalidade(raw: string): void {
    if (this.editando) return;
    this.modalidade.set(parseModalidadeJanela(raw));
  }

  /** Máscara numérica: só dígitos (vagas por slot). */
  onVagas(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    const n = digits ? Number(digits) : 0;
    el.value = n > 0 ? String(n) : '';
    this.vagasPorSlot.set(n > 0 ? n : null);
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  salvar(): void {
    if (this.salvando()) return;
    const estado = this.snapshot();
    const erros = validarJanelaForm(estado);
    this.erros.set(erros);
    if (erros.length) {
      // Vai para a primeira aba com erro, a menos que a aba atual já tenha algum.
      const abaComErro = erros.find((e) => e.aba !== 'cabecalho')?.aba as JanelaFormAba | undefined;
      if (abaComErro && !this.temErroNaAba(this.aba())) this.aba.set(abaComErro);
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
        // HTTP já recebeu toast no interceptor; falha lógica (200 + success:false) não.
        if (!err?.toastShown) this.toast.error(err?.message || 'Não foi possível salvar a janela.');
      },
    });
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
    this.faixas.set(s.faixas);
    this.periodicidades.set(s.periodicidades);
    this.excecoes.set(s.excecoes);
  }

  private snapshot(): JanelaFormState {
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
      faixas: this.faixas(),
      periodicidades: this.periodicidades(),
      excecoes: this.excecoes(),
    };
  }
}
