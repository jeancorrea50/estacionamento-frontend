import { Injectable, signal } from '@angular/core';

const LS_KEY = 'gts-user-permission-keys';

function normalizePermissionKey(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Backend/JWT pode emitir o recurso no singular (catálogo) ou no plural (label do submenu).
 * Ex.: tela checa `agendamento.gravar`; claim vem `agendamentos.gravar`.
 */
const RECURSO_ALIASES: Readonly<Record<string, readonly string[]>> = {
  agendamento: ['agendamentos'],
  agendamentos: ['agendamento'],
  veiculo: ['veiculos'],
  veiculos: ['veiculo'],
  motorista: ['motoristas'],
  motoristas: ['motorista'],
  transportadora: ['transportadoras'],
  transportadoras: ['transportadora'],
};

function expandRecursoKeys(recurso: string): string[] {
  const r = normalizePermissionKey(recurso);
  if (!r) return [];
  return [r, ...(RECURSO_ALIASES[r] ?? [])];
}

/**
 * Cache local de chaves de permissão do usuário logado (preenchido a partir do claim `Permission` do JWT).
 */
@Injectable({ providedIn: 'root' })
export class PermissionCacheService {
  private readonly keys = signal<string[]>(this.load());

  readonly permissionKeys = this.keys.asReadonly();

  private load(): string[] {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as unknown[];
        if (Array.isArray(p)) {
          const normalized = Array.from(
            new Set(p.map((k) => normalizePermissionKey(String(k))).filter(Boolean))
          );
          const serialized = JSON.stringify(normalized);
          if (serialized !== raw) {
            try {
              localStorage.setItem(LS_KEY, serialized);
            } catch {
              /* ignore */
            }
          }
          return normalized;
        }
      }
    } catch {
      /* ignore */
    }
    return [];
  }

  setKeys(keys: string[]): void {
    const normalized = Array.from(
      new Set(keys.map((k) => normalizePermissionKey(k)).filter(Boolean))
    );
    this.keys.set(normalized);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
  }

  /** Logout: remove permissões em memória e no storage. */
  clear(): void {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
    this.keys.set([]);
  }

  hasAny(required: string[]): boolean {
    const keys = this.keys().map((k) => normalizePermissionKey(k)).filter(Boolean);
    if (keys.includes('*')) return true;
    if (keys.length === 0) return false;
    const requiredKeys = required.map((r) => normalizePermissionKey(r)).filter(Boolean);
    return requiredKeys.some((r) => keys.includes(r) || this.keyMatchesAlias(keys, r));
  }

  has(key: string): boolean {
    return this.hasAny([key]);
  }

  /** Claim `recurso.acao` (aceita alias singular/plural) ou curinga `*`. */
  allows(recurso: string, acao: string): boolean {
    const a = normalizePermissionKey(acao);
    if (!a) return false;
    return expandRecursoKeys(recurso).some((r) => this.has(`${r}.${a}`));
  }

  /** Aceita `agendamento.gravar` quando a sessão só tem `agendamentos.gravar` (e vice-versa). */
  private keyMatchesAlias(storedKeys: string[], required: string): boolean {
    const [recurso, ...acaoParts] = required.split('.');
    if (!recurso || acaoParts.length === 0) return false;
    const acao = acaoParts.join('.');
    return expandRecursoKeys(recurso).some((alias) => {
      if (alias === recurso) return false;
      return storedKeys.includes(`${alias}.${acao}`);
    });
  }
}
