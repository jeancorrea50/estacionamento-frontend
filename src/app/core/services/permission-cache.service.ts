import { Injectable, signal } from '@angular/core';

const LS_KEY = 'gts-user-permission-keys';

function normalizePermissionKey(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
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
    return requiredKeys.some((r) => keys.includes(r));
  }

  has(key: string): boolean {
    return this.hasAny([key]);
  }
}
