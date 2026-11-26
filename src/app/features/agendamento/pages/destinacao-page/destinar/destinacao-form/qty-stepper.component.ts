import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * Campo numérico com − / + (vagas). `value = null` mostra "—" (valores diferentes).
 * Usado no modal de destinação; candidato a ir para shared/ se outra tela precisar.
 */
@Component({
  selector: 'app-qty-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'qty', '[class.is-invalid]': 'invalid()' },
  template: `
    <button
      type="button"
      class="icon-btn icon-btn--sm"
      [attr.aria-label]="'Menos uma — ' + label()"
      [disabled]="disabled() || (value() ?? min()) <= min()"
      (click)="set((value() ?? min() + 1) - 1)"
    >
      <span class="material-symbols-outlined" aria-hidden="true">remove</span>
    </button>
    <input
      class="qty__input mono"
      type="number"
      inputmode="numeric"
      [min]="min()"
      [max]="max()"
      [placeholder]="value() === null ? '—' : ''"
      [attr.aria-label]="label()"
      [attr.aria-invalid]="invalid() || null"
      [disabled]="disabled()"
      [value]="value() ?? ''"
      (change)="set($any($event.target).valueAsNumber)"
    />
    <button
      type="button"
      class="icon-btn icon-btn--sm"
      [attr.aria-label]="'Mais uma — ' + label()"
      [disabled]="disabled() || (value() ?? 0) >= max()"
      (click)="set((value() ?? 0) + 1)"
    >
      <span class="material-symbols-outlined" aria-hidden="true">add</span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .qty__input {
      width: 52px;
      height: 34px;
      border: 1px solid var(--dst-border);
      border-radius: 6px;
      background: var(--dst-input);
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      text-align: center;
      color: var(--dst-text);
      -moz-appearance: textfield;
    }
    .qty__input::-webkit-inner-spin-button,
    .qty__input::-webkit-outer-spin-button {
      -webkit-appearance: none;
    }
    .qty__input::placeholder {
      color: var(--dst-muted);
    }
    .qty__input:focus-visible {
      outline: 2px solid var(--dst-primary);
      outline-offset: 1px;
    }
    :host(.is-invalid) .qty__input {
      border-color: var(--dst-danger);
    }
  `,
})
export class QtyStepperComponent {
  readonly value = model<number | null>(1);
  readonly min = input(1);
  readonly max = input(999);
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly invalid = input(false);

  set(v: number): void {
    if (Number.isNaN(v)) return;
    this.value.set(Math.max(this.min(), Math.min(this.max(), Math.trunc(v))));
  }
}
