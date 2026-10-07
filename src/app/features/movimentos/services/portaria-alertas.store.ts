import { Injectable, signal } from '@angular/core';

/** Alerta operacional exibido em “Últimos Alertas” na portaria. */
export interface PortariaAlertaItem {
  id: string;
  titulo: string;
  descricao: string;
  /** Epoch ms — usado em tempo relativo. */
  createdAtMs: number;
}

/**
 * Feed local de alertas da portaria (suspender, agendar, etc.).
 * Complementa o snapshot HTTP/hub — sobrevive à navegação enquanto a aba estiver aberta.
 */
@Injectable({ providedIn: 'root' })
export class PortariaAlertasStore {
  private readonly itemsSignal = signal<PortariaAlertaItem[]>([]);

  readonly items = this.itemsSignal.asReadonly();

  push(input: { titulo: string; descricao: string; id?: string }): void {
    const titulo = input.titulo?.trim();
    const descricao = input.descricao?.trim();
    if (!titulo) return;

    const item: PortariaAlertaItem = {
      id: input.id?.trim() || `alerta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      titulo,
      descricao: descricao || '—',
      createdAtMs: Date.now()
    };

    this.itemsSignal.update((list) => [item, ...list.filter((x) => x.id !== item.id)].slice(0, 30));
  }

  clear(): void {
    this.itemsSignal.set([]);
  }
}
