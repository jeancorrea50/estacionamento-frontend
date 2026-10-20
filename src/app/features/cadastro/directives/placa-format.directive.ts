import { Directive, HostListener } from '@angular/core';
import { NgControl } from '@angular/forms';
import { formatPlacaInput } from '../utils/placa-br';

/**
 * Máscara profissional de placa BR (Mercosul AAA9A99 / antiga AAA9999).
 * Exibe com hífen: ABC-1D23. Exportada via formatação em `placa-br.ts`.
 */
@Directive({
  selector: '[appPlacaFormat]',
  standalone: true
})
export class PlacaFormatDirective {
  constructor(private ngControl: NgControl) {}

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatPlacaInput(input.value);
    if (formatted === input.value) return;

    const alnumBefore = (
      input.value.slice(0, input.selectionStart ?? 0).match(/[A-Za-z0-9]/g) || []
    ).length;

    this.ngControl.control?.setValue(formatted, { emitEvent: false });

    setTimeout(() => {
      let pos = 0;
      let count = 0;
      for (; pos < formatted.length && count < alnumBefore; pos++) {
        if (/[A-Za-z0-9]/.test(formatted[pos])) count++;
      }
      input.setSelectionRange(pos, pos);
    }, 0);
  }
}
