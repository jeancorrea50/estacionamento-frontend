import { TransportadoraContatoPayload } from '../models/transportadora.dto';

/** Prefixo em `observacao` para metadados do contato (nome, CPF, e-mail, cargo) — contrato interno front/API. */
export const TRSPC1_PREFIX = 'trspc1:';

export interface Trspc1Meta {
  n?: string;
  c?: string;
  e?: string;
  g?: string;
}

export function encodeTrspc1Meta(meta: Trspc1Meta): string {
  const payload: Trspc1Meta = {
    n: meta.n?.trim() || undefined,
    c: meta.c?.replace(/\D/g, '') || undefined,
    e: meta.e?.trim() || undefined,
    g: meta.g?.trim() || undefined
  };
  const keys = Object.keys(payload).filter((k) => (payload as Record<string, string | undefined>)[k]);
  if (keys.length === 0) return '';
  return TRSPC1_PREFIX + JSON.stringify(payload);
}

export function decodeTrspc1Meta(observacao: string | null | undefined): Trspc1Meta {
  const raw = String(observacao ?? '').trim();
  if (!raw.startsWith(TRSPC1_PREFIX)) return {};
  try {
    const parsed = JSON.parse(raw.slice(TRSPC1_PREFIX.length)) as Trspc1Meta;
    return typeof parsed === 'object' && parsed != null ? parsed : {};
  } catch {
    return {};
  }
}

export function buildContatoPayload(
  opts: {
    principal: boolean;
    telefoneDigits: string;
    meta: Trspc1Meta;
  }
): TransportadoraContatoPayload {
  const observacao = encodeTrspc1Meta(opts.meta);
  const nome = opts.meta.n?.trim();
  const cpf = opts.meta.c?.replace(/\D/g, '');
  const email = opts.meta.e?.trim();
  return {
    principal: opts.principal,
    descricao: nome || (opts.principal ? 'Contato principal' : 'Contato complementar'),
    cpf: cpf || '',
    telefone: opts.telefoneDigits,
    email: email || '',
    observacao: observacao || (opts.principal ? 'Contato principal' : 'Contato complementar')
  };
}

/** Contato só é enviado com telefone válido — `numero` vazio ou curto costuma gerar 400 na API. */
export function contatoDeveSerEnviado(telefoneDigits: string, _meta: Trspc1Meta): boolean {
  return telefoneDigits.length >= 10;
}
