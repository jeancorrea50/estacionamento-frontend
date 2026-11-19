import { Component, computed, model } from '@angular/core';
import {
  GRANULARIDADE_MAX,
  GRANULARIDADE_OPCOES,
  GranularidadeUnidade,
} from '../../../models/janela-agendamento.models';
import { FaixaForm, novoUid } from '../janela-form.state';

/** Aba Horários: faixas `HH:mm–HH:mm` e granularidade (tamanho de cada slot). */
@Component({
  selector: 'app-janela-horarios-tab',
  standalone: true,
  styleUrl: './janela-tab.component.scss',
  template: `
    <section class="jan-section">
      <div class="jan-grid">
        <div class="jan-field">
          <label class="jan-label" for="jan-gran-unidade">Unidade do slot</label>
          <select
            id="jan-gran-unidade"
            class="jan-input"
            [value]="unidade()"
            (change)="onUnidade($any($event.target).value)"
          >
            @for (o of unidades; track o.value) {
              <option [value]="o.value" [selected]="o.value === unidade()">{{ o.label }}</option>
            }
          </select>
        </div>
        <div class="jan-field">
          <label class="jan-label" for="jan-gran-valor">Tamanho do slot (1–{{ maximo() }})</label>
          <input
            id="jan-gran-valor"
            class="jan-input"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            [attr.maxlength]="maximo().toString().length"
            [value]="valor() ?? ''"
            (input)="onValorInput($event)"
            [attr.aria-label]="'Tamanho do slot em ' + (unidade() === 1 ? 'horas' : 'minutos')"
          />
        </div>
      </div>
      <p class="jan-hint">
        Cada faixa é dividida em slots do tamanho informado. Ex.: faixa 08:00–12:00 com 1 hora gera 4
        slots.
      </p>

      <div class="jan-toolbar">
        <h3 class="jan-title">Faixas de horário</h3>
        <button type="button" class="jan-btn" (click)="adicionar()">
          <span class="material-symbols-outlined" aria-hidden="true">add</span>
          Adicionar faixa
        </button>
      </div>

      @if (faixas().length === 0) {
        <p class="jan-empty">Nenhuma faixa. Adicione ao menos uma faixa de horário.</p>
      } @else {
        <ul class="jan-list">
          @for (f of faixas(); track f.uid; let i = $index) {
            <li class="jan-item">
              <div class="jan-grid jan-item__body">
                <div class="jan-field">
                  <label class="jan-label" [attr.for]="'jan-fx-ini-' + f.uid">Início</label>
                  <input
                    [id]="'jan-fx-ini-' + f.uid"
                    class="jan-input"
                    type="time"
                    [value]="f.horaInicio"
                    (input)="atualizar(f.uid, 'horaInicio', $any($event.target).value)"
                  />
                </div>
                <div class="jan-field">
                  <label class="jan-label" [attr.for]="'jan-fx-fim-' + f.uid">Fim</label>
                  <input
                    [id]="'jan-fx-fim-' + f.uid"
                    class="jan-input"
                    type="time"
                    [value]="f.horaFim"
                    (input)="atualizar(f.uid, 'horaFim', $any($event.target).value)"
                  />
                </div>
              </div>
              <button
                type="button"
                class="jan-icon-btn"
                [attr.aria-label]="'Remover faixa ' + (i + 1)"
                (click)="remover(f.uid)"
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
export class JanelaHorariosTabComponent {
  readonly faixas = model.required<FaixaForm[]>();
  readonly unidade = model.required<GranularidadeUnidade>();
  readonly valor = model.required<number | null>();

  readonly unidades = GRANULARIDADE_OPCOES;
  readonly maximo = computed(() => GRANULARIDADE_MAX[this.unidade()]);

  adicionar(): void {
    this.faixas.update((l) => [...l, { uid: novoUid(), horaInicio: '', horaFim: '' }]);
  }

  remover(uid: number): void {
    this.faixas.update((l) => l.filter((f) => f.uid !== uid));
  }

  atualizar(uid: number, campo: 'horaInicio' | 'horaFim', valor: string): void {
    this.faixas.update((l) => l.map((f) => (f.uid === uid ? { ...f, [campo]: valor } : f)));
  }

  onUnidade(raw: string): void {
    const unidade: GranularidadeUnidade = Number(raw) === 2 ? 2 : 1;
    this.unidade.set(unidade);
    const atual = this.valor();
    if (atual != null && atual > GRANULARIDADE_MAX[unidade]) {
      this.valor.set(GRANULARIDADE_MAX[unidade]);
    }
  }

  /** Máscara: só dígitos, limitado ao máximo da unidade (24 h / 1440 min). */
  onValorInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    const n = digits ? Math.min(Number(digits), this.maximo()) : 0;
    const valor = n > 0 ? n : null;
    el.value = valor == null ? '' : String(valor);
    this.valor.set(valor);
  }
}
