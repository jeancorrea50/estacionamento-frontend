import { Component, input, model } from '@angular/core';
import {
  DIAS_SEMANA_OPCOES,
  MESES_OPCOES,
  PERIODICIDADE_OPCOES,
  PeriodicidadeTipo,
} from '../../../models/janela-agendamento.models';
import { PeriodicidadeForm, periodicidadeVazia } from '../janela-form.state';

type PeriodicidadeTexto = 'dataInicio' | 'dataFim' | 'descricao';

/** Aba Periodicidade: regras de recorrência (dias da semana, dia do mês, mês) e vigência de cada regra. */
@Component({
  selector: 'app-janela-periodicidades-tab',
  standalone: true,
  styleUrl: './janela-tab.component.scss',
  template: `
    <section class="jan-section">
      <div class="jan-toolbar">
        <h3 class="jan-title">Periodicidade</h3>
        <button type="button" class="jan-btn" (click)="adicionar()">
          <span class="material-symbols-outlined" aria-hidden="true">add</span>
          Adicionar regra
        </button>
      </div>
      <p class="jan-hint">
        Define em quais dias a janela se aplica. Regras ativas não podem ter vigências sobrepostas.
      </p>

      @if (periodicidades().length === 0) {
        <p class="jan-empty">Nenhuma regra. Adicione ao menos uma periodicidade.</p>
      } @else {
        <ul class="jan-list">
          @for (p of periodicidades(); track p.uid; let i = $index) {
            <li class="jan-item">
              <div class="jan-grid jan-item__body">
                <div class="jan-field">
                  <label class="jan-label" [attr.for]="'jan-pe-tipo-' + p.uid">Tipo</label>
                  <select
                    [id]="'jan-pe-tipo-' + p.uid"
                    class="jan-input"
                    (change)="atualizarTipo(p.uid, $any($event.target).value)"
                  >
                    @for (o of tipos; track o.value) {
                      <option [value]="o.value" [selected]="o.value === p.tipo">{{ o.label }}</option>
                    }
                  </select>
                </div>

                @if (p.tipo === 4 || p.tipo === 5) {
                  <div class="jan-field">
                    <label class="jan-label" [attr.for]="'jan-pe-dia-' + p.uid">Dia do mês (1–31)</label>
                    <input
                      [id]="'jan-pe-dia-' + p.uid"
                      class="jan-input"
                      type="text"
                      inputmode="numeric"
                      autocomplete="off"
                      maxlength="2"
                      [value]="p.diaMes ?? ''"
                      (input)="onDiaMes(p.uid, $event)"
                    />
                  </div>
                }
                @if (p.tipo === 5) {
                  <div class="jan-field">
                    <label class="jan-label" [attr.for]="'jan-pe-mes-' + p.uid">Mês</label>
                    <select
                      [id]="'jan-pe-mes-' + p.uid"
                      class="jan-input"
                      (change)="onMes(p.uid, $any($event.target).value)"
                    >
                      <option value="" [selected]="p.mes == null">Selecione…</option>
                      @for (m of meses; track m.value) {
                        <option [value]="m.value" [selected]="m.value === p.mes">{{ m.label }}</option>
                      }
                    </select>
                  </div>
                }

                <div class="jan-field">
                  <label class="jan-label" [attr.for]="'jan-pe-ini-' + p.uid">Vigência início</label>
                  <input
                    [id]="'jan-pe-ini-' + p.uid"
                    class="jan-input"
                    type="date"
                    [value]="p.dataInicio"
                    (input)="atualizarTexto(p.uid, 'dataInicio', $any($event.target).value)"
                  />
                </div>
                <div class="jan-field">
                  <label class="jan-label" [attr.for]="'jan-pe-fim-' + p.uid">Vigência fim</label>
                  <input
                    [id]="'jan-pe-fim-' + p.uid"
                    class="jan-input"
                    type="date"
                    [value]="p.dataFim"
                    (input)="atualizarTexto(p.uid, 'dataFim', $any($event.target).value)"
                  />
                </div>

                @if (p.tipo === 2 || p.tipo === 3) {
                  <div class="jan-field jan-field--full">
                    <span class="jan-label" id="jan-pe-dias-lbl-{{ p.uid }}">Dias da semana</span>
                    <div class="jan-chips" role="group" [attr.aria-labelledby]="'jan-pe-dias-lbl-' + p.uid">
                      @for (d of dias; track d.value) {
                        <button
                          type="button"
                          class="jan-chip"
                          [class.jan-chip--on]="p.dias.includes(d.value)"
                          [attr.aria-pressed]="p.dias.includes(d.value)"
                          [attr.title]="d.label"
                          (click)="alternarDia(p.uid, d.value)"
                        >
                          {{ d.abrev }}
                        </button>
                      }
                    </div>
                  </div>
                }

                <div class="jan-field jan-field--full">
                  <label class="jan-label" [attr.for]="'jan-pe-desc-' + p.uid">Descrição</label>
                  <input
                    [id]="'jan-pe-desc-' + p.uid"
                    class="jan-input"
                    type="text"
                    maxlength="200"
                    placeholder="Opcional"
                    [value]="p.descricao"
                    (input)="atualizarTexto(p.uid, 'descricao', $any($event.target).value)"
                  />
                </div>
                <label class="jan-check jan-field--full">
                  <input
                    type="checkbox"
                    [checked]="p.ativo"
                    (change)="patch(p.uid, { ativo: $any($event.target).checked })"
                  />
                  Regra ativa
                </label>
              </div>
              <button
                type="button"
                class="jan-icon-btn"
                [attr.aria-label]="'Remover regra ' + (i + 1)"
                (click)="remover(p.uid)"
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
export class JanelaPeriodicidadesTabComponent {
  readonly periodicidades = model.required<PeriodicidadeForm[]>();
  /** Início padrão (vigência da janela) para novas regras. */
  readonly dataPadrao = input<string>('');

  readonly tipos = PERIODICIDADE_OPCOES;
  readonly dias = DIAS_SEMANA_OPCOES;
  readonly meses = MESES_OPCOES;

  adicionar(): void {
    this.periodicidades.update((l) => [...l, periodicidadeVazia(this.dataPadrao())]);
  }

  remover(uid: number): void {
    this.periodicidades.update((l) => l.filter((p) => p.uid !== uid));
  }

  atualizarTexto(uid: number, campo: PeriodicidadeTexto, valor: string): void {
    this.patch(uid, { [campo]: valor } as Partial<PeriodicidadeForm>);
  }

  /** Trocar o tipo limpa campos que deixam de se aplicar. */
  atualizarTipo(uid: number, raw: string): void {
    const tipo = (Number(raw) || 1) as PeriodicidadeTipo;
    this.patch(uid, {
      tipo,
      dias: tipo === 2 || tipo === 3 ? this.diasDe(uid) : [],
      diaMes: tipo === 4 || tipo === 5 ? this.diaMesDe(uid) : null,
      mes: tipo === 5 ? this.mesDe(uid) : null,
    });
  }

  alternarDia(uid: number, dia: number): void {
    const atuais = this.diasDe(uid);
    const dias = atuais.includes(dia) ? atuais.filter((d) => d !== dia) : [...atuais, dia];
    this.patch(uid, { dias });
  }

  onDiaMes(uid: number, event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    const n = digits ? Math.min(Number(digits), 31) : 0;
    el.value = n > 0 ? String(n) : '';
    this.patch(uid, { diaMes: n > 0 ? n : null });
  }

  onMes(uid: number, raw: string): void {
    this.patch(uid, { mes: raw ? Number(raw) : null });
  }

  patch(uid: number, partial: Partial<PeriodicidadeForm>): void {
    this.periodicidades.update((l) => l.map((p) => (p.uid === uid ? { ...p, ...partial } : p)));
  }

  private find(uid: number): PeriodicidadeForm | undefined {
    return this.periodicidades().find((p) => p.uid === uid);
  }

  private diasDe(uid: number): number[] {
    return this.find(uid)?.dias ?? [];
  }

  private diaMesDe(uid: number): number | null {
    return this.find(uid)?.diaMes ?? null;
  }

  private mesDe(uid: number): number | null {
    return this.find(uid)?.mes ?? null;
  }
}
