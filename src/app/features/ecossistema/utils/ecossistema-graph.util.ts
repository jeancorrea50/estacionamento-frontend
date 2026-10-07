import type { EcossistemaAresta } from '../models/ecossistema.models';
import { ECOSSISTEMA_ARESTAS } from '../data/ecossistema-mapa.data';

export function highlightDiretas(nodeId: string): Set<string> {
  const set = new Set<string>([nodeId]);
  for (const e of ECOSSISTEMA_ARESTAS) {
    if (e.from === nodeId) set.add(e.to);
    if (e.to === nodeId) set.add(e.from);
  }
  return set;
}

/** Vizinhos em qualquer direção (exploração associativa). */
export function highlightFluxoCompleto(nodeId: string): Set<string> {
  const set = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of ECOSSISTEMA_ARESTAS) {
      if (set.has(e.from) && !set.has(e.to)) {
        set.add(e.to);
        changed = true;
      }
      if (set.has(e.to) && !set.has(e.from)) {
        set.add(e.from);
        changed = true;
      }
    }
  }
  return set;
}

export function edgeCubicPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, (x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function strokeDashFor(e: EcossistemaAresta): string | null {
  return e.evidencia === 'proposto' || e.evidencia === 'nao_verificado' ? '6 4' : null;
}
