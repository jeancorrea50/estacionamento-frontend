import { formatCnpj } from '../directives/cnpj-format.directive';
import { formatCpf } from '../directives/cpf-format.directive';
import { formatTelefone } from '../directives/telefone-format.directive';

/** TipoChave do backend: 1=Cpf, 2=Cnpj, 3=Email, 4=Telefone, 5=Aleatoria */
export type TipoChavePix = 1 | 2 | 3 | 4 | 5;

/** Máscara visual da chave PIX conforme o tipo. */
export function formatChavePix(value: string | null | undefined, tipo: number | null | undefined): string {
  const raw = String(value ?? '');
  switch (Number(tipo)) {
    case 1:
      return formatCpf(raw);
    case 2:
      return formatCnpj(raw);
    case 3:
      return raw.replace(/\s+/g, '').slice(0, 150);
    case 4:
      return formatTelefone(raw);
    case 5:
      return formatUuidPix(raw);
    default:
      return raw.trim().slice(0, 150);
  }
}

/** Valor enviado à API (CPF/CNPJ/telefone só dígitos; e-mail/UUID limpos). */
export function normalizeChavePixForApi(
  value: string | null | undefined,
  tipo: number | null | undefined
): string {
  const formatted = formatChavePix(value, tipo);
  switch (Number(tipo)) {
    case 1:
    case 2:
    case 4:
      return formatted.replace(/\D/g, '');
    case 3:
      return formatted.trim().toLowerCase();
    case 5:
      return formatted.trim().toLowerCase();
    default:
      return String(value ?? '').trim();
  }
}

export function chavePixMaxLength(tipo: number | null | undefined): number {
  switch (Number(tipo)) {
    case 1:
      return 14;
    case 2:
      return 18;
    case 3:
      return 150;
    case 4:
      return 15;
    case 5:
      return 36;
    default:
      return 150;
  }
}

export function chavePixInputMode(tipo: number | null | undefined): string {
  switch (Number(tipo)) {
    case 1:
    case 2:
    case 4:
      return 'numeric';
    case 3:
      return 'email';
    default:
      return 'text';
  }
}

function formatUuidPix(value: string): string {
  const hex = value.replace(/[^a-fA-F0-9]/g, '').slice(0, 32).toLowerCase();
  if (hex.length <= 8) return hex;
  if (hex.length <= 12) return `${hex.slice(0, 8)}-${hex.slice(8)}`;
  if (hex.length <= 16) return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12)}`;
  if (hex.length <= 20) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16)}`;
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
