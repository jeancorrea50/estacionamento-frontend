import { Injectable, signal, computed } from '@angular/core';

/**
 * Store em memória (session) das permissões por perfil.
 * Usado quando não há backend para perfis com permissões.
 * Chave: profileId ou profileName (quando id não existe).
 */
@Injectable({ providedIn: 'root' })
export class ProfilePermissionsStoreService {
  private readonly store = signal<Record<string, string[]>>({});

  private normalizeProfileKey(key: string): string {
    return String(key ?? '').trim().toLowerCase();
  }

  getProfilePermissions(key: string): string[] {
    const normalized = this.normalizeProfileKey(key);
    return this.store()[normalized] ?? [];
  }

  setProfilePermissions(key: string, permissions: string[]): void {
    const normalizedKey = this.normalizeProfileKey(key);
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const permission of permissions) {
      const raw = String(permission ?? '').trim();
      if (!raw) continue;
      const cmp = raw.toLowerCase();
      if (seen.has(cmp)) continue;
      seen.add(cmp);
      deduped.push(raw);
    }
    this.store.update((m) => ({ ...m, [normalizedKey]: deduped }));
  }

  getProfilePermissionsSignal(key: string) {
    const normalized = this.normalizeProfileKey(key);
    return computed(() => this.store()[normalized] ?? []);
  }
}
