import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** CPF: obrigatório e com exatamente 11 dígitos (ignora máscara). */
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
