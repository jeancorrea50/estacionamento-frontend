import { Injectable } from '@angular/core';
import type { EcossistemaLayoutPersistido } from '../models/ecossistema.models';
import { ECOSSISTEMA_NOS } from '../data/ecossistema-mapa.data';

/** v2: layout canônico alinhado ao print operacional (Entrada e Saída no centro). */
const STORAGE_KEY = 'gts.ecossistema.layout.v2';
const LAYOUT_VERSION = 2;

@Injectable({ providedIn: 'root' })
export class EcossistemaLayoutService {
  load(): EcossistemaLayoutPersistido | null {
    try {
      // Descarta layout antigo (v1 em colunas por grupo).
      localStorage.removeItem('gts.ecossistema.layout.v1');
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as EcossistemaLayoutPersistido;
      if (parsed?.version !== LAYOUT_VERSION || !parsed.positions || !parsed.view) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  save(data: Omit<EcossistemaLayoutPersistido, 'version'> & { version?: number }): void {
    try {
      const payload: EcossistemaLayoutPersistido = {
        version: LAYOUT_VERSION,
        positions: data.positions,
        view: data.view,
        expanded: data.expanded ?? [],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota / private mode */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('gts.ecossistema.layout.v1');
    } catch {
      /* ignore */
    }
  }

  defaultPositions(): Record<string, { x: number; y: number }> {
    const map: Record<string, { x: number; y: number }> = {};
    for (const n of ECOSSISTEMA_NOS) {
      map[n.id] = { x: n.x, y: n.y };
    }
    return map;
  }
}
