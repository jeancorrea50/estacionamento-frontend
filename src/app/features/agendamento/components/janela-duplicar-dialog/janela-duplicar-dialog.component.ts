import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';
import { ApiError } from '../../../../core/api/models';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  JanelaAgendamentoDetalhe,
  JanelaAgendamentoListItem,
  MODALIDADE_JANELA_OPCOES,
  ModalidadeJanela,
  modalidadeJanelaLabel,
} from '../../models/janela-agendamento.models';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';

export interface JanelaDuplicarDialogData {
  /**
   * Janela de origem já escolhida (ação "Duplicar" da linha).
   * Sem ela, o dialog lista as janelas da modalidade oposta para o usuário buscar e escolher.
   */
  origem?: JanelaAgendamentoListItem;
  /** Modalidade da tela (destino padrão). */
  modalidadeAtual: ModalidadeJanela;
}

export interface JanelaDuplicarDialogResult {
  saved: true;
  janela: JanelaAgendamentoDetalhe;
}

/** Duplicar janela para outra modalidade (ou mesma, com novo nome). Abrir com `cfg-form-dialog-panel`. */
@Component({
  selector: 'app-janela-duplicar-dialog',
  standalone: true,
  imports: [MatDialogModule],
  styleUrl: './janela-duplicar-dialog.component.scss',
  template: `
    <div class="dup">
      <header class="dup__header">
        <h2 class="dup__title" mat-dialog-title>Duplicar janela</h2>
        <button type="button" class="dup__close" aria-label="Fechar" (click)="cancelar()">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>

      <mat-dialog-content class="dup__body">
        @if (data.origem) {
          <p class="dup__hint">
            Origem: <strong>{{ data.origem.nome }}</strong> ({{ modalidadeLabel(data.origem.modalidade) }})
          </p>
        } @else {
          <div class="dup__field">
            <label class="dup__label" for="dup-busca">
              Buscar janela de {{ modalidadeLabel(modalidadeOrigemLista()) }}
            </label>
            <input
              id="dup-busca"
              class="dup__input"
              type="search"
              autocomplete="off"
              placeholder="Filtrar por nome…"
              [value]="busca()"
              (input)="busca.set($any($event.target).value)"
            />
          </div>
          @if (carregando()) {
            <p class="dup__hint">Carregando janelas…</p>
          } @else if (candidatas().length === 0) {
            <p class="dup__empty">
              Nenhuma janela encontrada em {{ modalidadeLabel(modalidadeOrigemLista()) }}.
            </p>
          } @else {
            <ul class="dup__list" role="listbox" aria-label="Janelas de origem">
              @for (j of candidatas(); track j.id) {
                <li>
                  <button
                    type="button"
                    role="option"
                    class="dup__option"
                    [class.dup__option--on]="origemId() === j.id"
                    [attr.aria-selected]="origemId() === j.id"
                    (click)="escolherOrigem(j)"
                  >
                    <span class="dup__option-nome">{{ j.nome }}</span>
                    <span class="dup__option-meta">
                      {{ j.vagasPorSlot }} vaga(s)/slot · {{ j.qtdFaixas }} faixa(s)
                      {{ j.ativo ? '' : '· inativa' }}
                    </span>
                  </button>
                </li>
              }
            </ul>
          }
        }

        <div class="dup__grid">
          <div class="dup__field">
            <label class="dup__label" for="dup-modalidade">Modalidade de destino</label>
            <select
              id="dup-modalidade"
              class="dup__input"
              [disabled]="!data.origem"
              (change)="destino.set($any($event.target).value === '2' ? 2 : 1)"
            >
              @for (m of modalidades; track m.value) {
                <option [value]="m.value" [selected]="m.value === destino()">{{ m.label }}</option>
              }
            </select>
          </div>
          <div class="dup__field">
            <label class="dup__label" for="dup-nome">Nome da nova janela <span class="req">*</span></label>
            <input
              id="dup-nome"
              class="dup__input"
              type="text"
              maxlength="150"
              autocomplete="off"
              [value]="nome()"
              (input)="nome.set($any($event.target).value)"
            />
          </div>
        </div>
        <p class="dup__hint">
          A cópia mantém horários, capacidade, exceções e periodicidades. O nome deve ser único na modalidade
          de destino.
        </p>
      </mat-dialog-content>

      <footer class="dup__footer">
        <button type="button" class="dup__btn" (click)="cancelar()" [disabled]="salvando()">Cancelar</button>
        <button
          type="button"
          class="dup__btn dup__btn--primary"
          (click)="duplicar()"
          [disabled]="!podeDuplicar()"
        >
          {{ salvando() ? 'Duplicando...' : 'Duplicar' }}
        </button>
      </footer>
    </div>
  `,
})
export class JanelaDuplicarDialogComponent implements OnInit {
  private readonly ref = inject(MatDialogRef<JanelaDuplicarDialogComponent, JanelaDuplicarDialogResult | undefined>);
  private readonly api = inject(JanelaAgendamentoService);
  private readonly toast = inject(ToastService);
  readonly data = inject<JanelaDuplicarDialogData>(MAT_DIALOG_DATA);

  readonly modalidades = MODALIDADE_JANELA_OPCOES;
  readonly modalidadeLabel = modalidadeJanelaLabel;

  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly busca = signal('');
  readonly lista = signal<JanelaAgendamentoListItem[]>([]);
  readonly origemId = signal<number | null>(this.data.origem?.id ?? null);
  readonly nome = signal('');
  readonly destino = signal<ModalidadeJanela>(1);

  /** Sem origem fixa: origem vem da modalidade oposta à da tela; destino = modalidade da tela. */
  readonly modalidadeOrigemLista = computed<ModalidadeJanela>(() =>
    this.data.modalidadeAtual === 1 ? 2 : 1
  );

  readonly candidatas = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    return this.lista().filter((j) => !termo || j.nome.toLowerCase().includes(termo));
  });

  readonly podeDuplicar = computed(
    () => !this.salvando() && this.origemId() != null && this.nome().trim().length > 0
  );

  ngOnInit(): void {
    const origem = this.data.origem;
    if (origem) {
      // Padrão: copiar para a outra modalidade.
      this.destino.set(origem.modalidade === 1 ? 2 : 1);
      this.nome.set(`${origem.nome} (cópia)`);
      return;
    }
    this.destino.set(this.data.modalidadeAtual);
    this.carregarCandidatas();
  }

  escolherOrigem(j: JanelaAgendamentoListItem): void {
    this.origemId.set(j.id);
    if (!this.nome().trim()) this.nome.set(j.nome);
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  duplicar(): void {
    const origemId = this.origemId();
    if (!this.podeDuplicar() || origemId == null) return;

    this.salvando.set(true);
    this.api
      .duplicar({
        janelaOrigemId: origemId,
        modalidadeDestino: this.destino(),
        nome: this.nome(),
      })
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: (janela) => {
          this.toast.success('Janela duplicada.');
          this.ref.close({ saved: true, janela });
        },
        error: (err: ApiError) => {
          if (!err?.toastShown) this.toast.error(err?.message || 'Não foi possível duplicar a janela.');
        },
      });
  }

  private carregarCandidatas(): void {
    this.carregando.set(true);
    this.api
      .buscar({ modalidade: this.modalidadeOrigemLista(), numeroPagina: 1, tamanhoPagina: 100 })
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: (p) => this.lista.set(p.items),
        error: (err: ApiError) => {
          if (!err?.toastShown) this.toast.error(err?.message || 'Não foi possível carregar as janelas.');
        },
      });
  }
}
