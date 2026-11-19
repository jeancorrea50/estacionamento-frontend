import { Component, input, model } from '@angular/core';
import { EXCECAO_OPCOES, ExcecaoTipo } from '../../../models/janela-agendamento.models';
import { ExcecaoForm, novoUid } from '../janela-form.state';

type ExcecaoTexto = 'data' | 'horaInicio' | 'horaFim' | 'motivo';

/** Aba Exceções: bloqueios e ajustes de capacidade em datas/horários específicos. */
@Component({
  selector: 'app-janela-excecoes-tab',
  standalone: true,
  styleUrl: './janela-tab.component.scss',
  template: `
    <section class="jan-section">
      <div class="jan-toolbar">
        <h3 class="jan-title">Exceções</h3>
        <button type="button" class="jan-btn" (click)="adicionar()">
          <span class="material-symbols-outlined" aria-hidden="true">add</span>
          Adicionar exceção
        </button>
      </div>
      <p class="jan-hint">
        Bloqueio impede agendamentos no dia (ou no intervalo informado). Ajuste de capacidade
        substitui as vagas por slot. Deixe os horários vazios para valer o dia inteiro.
      </p>

      @if (excecoes().length === 0) {
        <p class="jan-empty">Nenhuma exceção cadastrada.</p>
      } @else {
        <ul class="jan-list">
          @for (e of excecoes(); track e.uid; let i = $index) {
            <li class="jan-item">
              <div class="jan-grid jan-item__body">
                <div class="jan-field">
                  <label class="jan-label" [attr.for]="'jan-ex-data-' + e.uid">Data</label>
                  <input
                    [id]="'jan-ex-data-' + e.uid"
                    class="jan-input"
                    type="date"
                    [value]="e.data"
                    (input)="atualizarTexto(e.uid, 'data', $any($event.target).value)"
                  />
                </div>
                <div class="jan-field">
                  <label class="jan-label" [attr.for]="'jan-ex-tipo-' + e.uid">Tipo</label>
                  <select
                    [id]="'jan-ex-tipo-' + e.uid"
                    class="jan-input"
                    (change)="atualizarTipo(e.uid, $any($event.target).value)"
                  >
                    @for (o of tipos; track o.value) {
                      <option [value]="o.value" [selected]="o.value === e.tipo">{{ o.label }}</option>
                    }
                  </select>
                </div>
                <div class="jan-field">
                  <label class="jan-label" [attr.for]="'jan-ex-ini-' + e.uid">Hora início</label>
                  <input
                    [id]="'jan-ex-ini-' + e.uid"
                    class="jan-input"
                    type="time"
                    [value]="e.horaInicio"
                    (input)="atualizarTexto(e.uid, 'horaInicio', $any($event.target).value)"
                  />
                </div>
                <div class="jan-field">
                  <label class="jan-label" [attr.for]="'jan-ex-fim-' + e.uid">Hora fim</label>
                  <input
                    [id]="'jan-ex-fim-' + e.uid"
                    class="jan-input"
                    type="time"
                    [value]="e.horaFim"
                    (input)="atualizarTexto(e.uid, 'horaFim', $any($event.target).value)"
                  />
                </div>
                @if (e.tipo === 2) {
                  <div class="jan-field">
                    <label class="jan-label" [attr.for]="'jan-ex-vagas-' + e.uid">Vagas (ajuste)</label>
                    <input
                      [id]="'jan-ex-vagas-' + e.uid"
                      class="jan-input"
                      type="text"
                      inputmode="numeric"
                      autocomplete="off"
                      maxlength="5"
                      [value]="e.vagasAjuste ?? ''"
                      (input)="onVagas(e.uid, $event)"
                    />
                  </div>
                }
                <div class="jan-field jan-field--full">
                  <label class="jan-label" [attr.for]="'jan-ex-motivo-' + e.uid">Motivo</label>
                  <input
                    [id]="'jan-ex-motivo-' + e.uid"
                    class="jan-input"
                    type="text"
                    maxlength="200"
                    placeholder="Opcional"
                    [value]="e.motivo"
                    (input)="atualizarTexto(e.uid, 'motivo', $any($event.target).value)"
                  />
                </div>
              </div>
              <button
                type="button"
                class="jan-icon-btn"
                [attr.aria-label]="'Remover exceção ' + (i + 1)"
                (click)="remover(e.uid)"
              >
                <span class="material-symbols-outlined" aria-hidden="true">delete</span>
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class JanelaExcecoesTabComponent {
  readonly excecoes = model.required<ExcecaoForm[]>();
  /** Data padrão para novas linhas (`yyyy-MM-dd`). */
  readonly dataPadrao = input<string>('');

  readonly tipos = EXCECAO_OPCOES;

  adicionar(): void {
    const nova: ExcecaoForm = {
      uid: novoUid(),
      data: this.dataPadrao(),
      tipo: 1,
      horaInicio: '',
      horaFim: '',
      vagasAjuste: null,
      motivo: '',
    };
    this.excecoes.update((l) => [...l, nova]);
  }

  remover(uid: number): void {
    this.excecoes.update((l) => l.filter((e) => e.uid !== uid));
  }

  atualizarTexto(uid: number, campo: ExcecaoTexto, valor: string): void {
    this.patch(uid, { [campo]: valor } as Partial<ExcecaoForm>);
  }

  atualizarTipo(uid: number, raw: string): void {
    const tipo: ExcecaoTipo = Number(raw) === 2 ? 2 : 1;
    this.patch(uid, tipo === 1 ? { tipo, vagasAjuste: null } : { tipo });
  }

  onVagas(uid: number, event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    el.value = digits;
    this.patch(uid, { vagasAjuste: digits ? Number(digits) : null });
  }

  private patch(uid: number, partial: Partial<ExcecaoForm>): void {
    this.excecoes.update((l) => l.map((e) => (e.uid === uid ? { ...e, ...partial } : e)));
  }
}
