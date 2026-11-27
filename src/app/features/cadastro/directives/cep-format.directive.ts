import { Directive, HostListener } from '@angular/core';
import { NgControl } from '@angular/forms';

/** Formato CEP: 00000-000 (8 dígitos). */
export function formatCep(value: string): string {
  const digits = String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

@Directive({
  selector: '[appCepFormat]',
  standalone: true,
})
export class CepFormatDirective {
  constructor(private ngControl: NgControl) {}

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatCep(input.value);
    if (formatted === input.value) return;
    const digitsBefore = (input.value.slice(0, input.selectionStart ?? 0).match(/\d/g) || []).length;
    this.ngControl.control?.setValue(formatted, { emitEvent: false });
    setTimeout(() => {
      let pos = 0;
      let count = 0;
      for (; pos < formatted.length && count < digitsBefore; pos++) {
        if (/\d/.test(formatted[pos])) count++;
      }
      input.setSelectionRange(pos, pos);
    }, 0);
  }
}
