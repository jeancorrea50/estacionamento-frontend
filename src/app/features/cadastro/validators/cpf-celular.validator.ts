import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Algoritmo oficial dos dígitos verificadores do CPF. */
export function isCpfChecksumValid(digits: string): boolean {
  const d = String(digits ?? '').replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let rev = (sum * 10) % 11;
  if (rev === 10) rev = 0;
  if (rev !== Number(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  rev = (sum * 10) % 11;
  if (rev === 10) rev = 0;
  return rev === Number(d[10]);
}

/** CPF: obrigatório, 11 dígitos e checksum válido (ignora máscara). */
export function cpfCompletoValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const digits = String(control.value ?? '').replace(/\D/g, '');
    if (!digits.length) return { required: true };
    if (digits.length !== 11) {
      return {
        cpfIncompleto: {
          requiredLength: 11,
          actualLength: digits.length,
          message: 'CPF deve ter 11 dígitos'
        }
      };
    }
    if (!isCpfChecksumValid(digits)) {
      return { cpfInvalido: { message: 'CPF inválido' } };
    }
    return null;
  };
}

/**
 * Celular BR: opcional se vazio; se preenchido, exige 11 dígitos (DDD + 9 + número).
 */
export function celularCompletoValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const digits = String(control.value ?? '').replace(/\D/g, '');
    if (!digits.length) return null;
    if (digits.length !== 11) {
      return {
        celularIncompleto: {
          requiredLength: 11,
          actualLength: digits.length,
          message: 'Celular deve ter DDD + 9 dígitos'
        }
      };
    }
    if (digits[2] !== '9') {
      return {
        celularInvalido: {
          message: 'Celular deve ter o 9 após o DDD'
        }
      };
    }
    return null;
  };
}
