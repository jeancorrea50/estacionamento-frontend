import { Injectable, signal } from '@angular/core';
import type {
  EcossistemaProblema,
  EcossistemaProblemaInput,
} from '../models/ecossistema-problema.models';
import { gerarSugestoesResolucao } from '../utils/ecossistema-problema-sugestoes.util';

const STORAGE_KEY = 'gts.ecossistema.problemas.v1';

/**
 * Problemas manuais do Ecossistema — persistência local (navegador).
 * Não há API de tickets no backend; o painel serve como quadro operacional.
 */
@Injectable({ providedIn: 'root' })
export class EcossistemaProblemaService {
  private readonly items = signal<EcossistemaProblema[]>(this.load());

  readonly problemas = this.items.asReadonly();

  listar(opts?: { incluirResolvidos?: boolean }): EcossistemaProblema[] {
    const all = this.items();
    if (opts?.incluirResolvidos) return [...all].sort(cmpProblema);
    return all.filter((p) => p.status === 'aberto').sort(cmpProblema);
  }

  /** Problemas ligados a um módulo do mapa. */
  porNo(noId: string, opts?: { incluirResolvidos?: boolean }): EcossistemaProblema[] {
    const id = (noId || '').trim();
    if (!id) return [];
    return this.listar({ incluirResolvidos: opts?.incluirResolvidos !== false }).filter(
      (p) => (p.noId || '').trim() === id
    );
  }

  /** Ids de nós com problema aberto + destacar. */
  nosDestacados(): Set<string> {
    const set = new Set<string>();
    for (const p of this.items()) {
      if (p.status === 'aberto' && p.destacar && p.noId) set.add(p.noId);
    }
    return set;
  }

  criar(input: EcossistemaProblemaInput): EcossistemaProblema {
    const titulo = input.titulo.trim();
    const descricao = input.descricao.trim();
    if (!titulo) throw new Error('Informe um título para o problema.');
    if (!descricao) throw new Error('Descreva o problema.');

    const base = {
      titulo,
      descricao,
      categoria: input.categoria,
      severidade: input.severidade,
      noId: input.noId?.trim() || null,
      fluxoId: input.fluxoId?.trim() || null,
      destacar: input.destacar !== false,
    };

    const problema: EcossistemaProblema = {
      id: `prob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      ...base,
      status: 'aberto',
      sugestoes: gerarSugestoesResolucao(base),
      criadoEm: new Date().toISOString(),
      resolvidoEm: null,
    };

    const next = [problema, ...this.items()];
    this.items.set(next);
    this.persist(next);
    return problema;
  }

  marcarResolvido(id: string): void {
    this.patch(id, {
      status: 'resolvido',
      resolvidoEm: new Date().toISOString(),
      destacar: false,
    });
  }

  reabrir(id: string): void {
    this.patch(id, { status: 'aberto', resolvidoEm: null });
  }

  toggleDestacar(id: string): void {
    const p = this.items().find((x) => x.id === id);
    if (!p || p.status !== 'aberto') return;
    this.patch(id, { destacar: !p.destacar });
  }

  remover(id: string): void {
    const next = this.items().filter((p) => p.id !== id);
    this.items.set(next);
    this.persist(next);
  }

  private patch(id: string, partial: Partial<EcossistemaProblema>): void {
    const next = this.items().map((p) => (p.id === id ? { ...p, ...partial } : p));
    this.items.set(next);
    this.persist(next);
  }

  private load(): EcossistemaProblema[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as EcossistemaProblema[];
      if (!Array.isArray(parsed)) return [];
      // Regenera passos de resolução a partir do texto atual do problema.
      return parsed.map((p) => ({
        ...p,
        sugestoes: gerarSugestoesResolucao({
          titulo: p.titulo,
          descricao: p.descricao,
          categoria: p.categoria,
          noId: p.noId,
          fluxoId: p.fluxoId,
        }),
      }));
    } catch {
      return [];
    }
  }

  private persist(list: EcossistemaProblema[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* quota */
    }
  }
}

function cmpProblema(a: EcossistemaProblema, b: EcossistemaProblema): number {
  if (a.status !== b.status) return a.status === 'aberto' ? -1 : 1;
  return (b.criadoEm || '').localeCompare(a.criadoEm || '');
}
