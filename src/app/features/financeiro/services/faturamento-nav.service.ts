import { Injectable, inject } from '@angular/core';

import { SessionAccessService } from '../../../core/services/session-access.service';
import { FATURAMENTO_ROUTE, faturamentoTabRoute } from '../faturamento-rotas';
import type { FaturamentoTabId } from '../pages/faturamento-page/faturamento-visao.types';

function norm(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
}

/**
 * Resolve a rota das abas de Faturamento priorizando o que está cadastrado em
 * Gerenciamento > Menu (menus da sessão). Sem cadastro correspondente, usa a rota canônica do SPA.
 */
@Injectable({ providedIn: 'root' })
export class FaturamentoNavService {
  private readonly sessionAccess = inject(SessionAccessService);

  resolveTabRoute(id: FaturamentoTabId): string {
    const canonical = faturamentoTabRoute(id);
    const doMenu = this.buscarRotaNosMenus(id, canonical);
    return doMenu ?? canonical;
  }

  /** Rota + query string pronta para `routerLink`/`navigateByUrl`. */
  buildTabUrl(id: FaturamentoTabId, queryParams?: Record<string, string>): string {
    const route = this.resolveTabRoute(id);
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return route;
    }
    return `${route}?${new URLSearchParams(queryParams).toString()}`;
  }

  private buscarRotaNosMenus(id: FaturamentoTabId, canonical: string): string | null {
    const alvo = norm(canonical);
    const sufixo = `/${id}`;

    for (const rota of this.rotasCadastradas()) {
      const atual = norm(rota);
      if (!atual.startsWith(norm(FATURAMENTO_ROUTE))) continue;
      if (atual === alvo || atual.endsWith(sufixo)) {
        return rota.replace(/\/+$/, '');
      }
    }
    return null;
  }

  private rotasCadastradas(): string[] {
    const rotas: string[] = [];
    for (const menu of this.sessionAccess.menus()) {
      if (menu.ativo === false) continue;
      for (const sub of menu.subMenus ?? []) {
        if (sub.ativo === false) continue;
        const rota = sub.rota?.trim();
        if (rota) rotas.push(rota);
      }
    }
    return rotas;
  }
}
