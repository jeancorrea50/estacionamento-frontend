import { Injectable, signal, computed } from '@angular/core';

/**
 * Store em memória do vínculo permissões por nó do menu (menu / módulo / submenu).
 * Chave: id do nó (menu-dashboard, sub-Estacionamento, etc.); valor: lista de chaves de permissão.
 */
@Injectable({ providedIn: 'root' })
export class MenuPermissionsStoreService {
  private readonly store = signal<Record<string, string[]>>({});

  private normalizePermissionKey(permission: string): string {
    return String(permission ?? '').trim().toLowerCase();
  }

  getPermissions(nodeId: string): string[] {
    return this.store()[nodeId] ?? [];
  }

  setPermissions(nodeId: string, permissionKeys: string[]): void {
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const permission of permissionKeys) {
      const raw = String(permission ?? '').trim();
      if (!raw) continue;
      const cmp = this.normalizePermissionKey(raw);
      if (seen.has(cmp)) continue;
      seen.add(cmp);
      deduped.push(raw);
    }
    this.store.update((m) => ({ ...m, [nodeId]: deduped }));
  }

  /** Adiciona uma chave ao nó, sem duplicar. */
  appendPermission(nodeId: string, permissionKey: string): void {
    const key = this.normalizePermissionKey(permissionKey);
    if (!key) return;
    this.store.update((m) => {
      const prev = m[nodeId] ?? [];
      const exists = prev.some((k) => this.normalizePermissionKey(k) === key);
      if (exists) return m;
      return { ...m, [nodeId]: [...prev, permissionKey.trim()] };
    });
  }

  getPermissionsSignal(nodeId: string) {
    return computed(() => this.store()[nodeId] ?? []);
  }
}
