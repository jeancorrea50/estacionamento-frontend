import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, from, of } from 'rxjs';
import { map, switchMap, toArray } from 'rxjs/operators';

import { normalizeFaturamentoAppRoute } from '../../financeiro/faturamento-rotas';
import {
  type FinanceiroFlatSubMenuDef,
  flattenFinanceiroMenuTree,
  getFinanceiroMenuRoute,
} from '../../financeiro/financeiro-menu-structure';
import type { MenuAdmin, SubMenuAdmin } from '../models/menu-admin.model';
import { MenuAdminService } from './menu-admin.service';
import { MenuApiService } from './menu-api.service';
import {
  computeNextIdFromMenus,
  mapBuscarResponseToMenuAdmins,
  menuAdminToAlterarSubMenuOnlyInput,
} from './menu-api.mapper';
import { buildFullAcaoPermissao } from './menu-permission-acao';
import { walkSubMenus } from './menu-tree.util';
import { normalizeLegacyAppRoute } from '../../../core/utils/app-route-normalizer';

function normRoute(route: string | null | undefined): string {
  return String(route ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
}

function normLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export interface FinanceiroMenuSeedResult {
  created: number;
  updatedRoutes: number;
  labels: string[];
}

interface MenuMutation {
  sub: SubMenuAdmin;
  includePermissions: boolean;
}

/**
 * Publica no backend (idempotente) a estrutura Financeiro → Faturamento/Pagamentos → abas.
 * A API persiste submenus planos; o front recompõe 3 níveis pelo prefixo de rota.
 */
@Injectable({ providedIn: 'root' })
export class FinanceiroMenuSeedService {
  private readonly menuApi = inject(MenuApiService);
  private readonly menuAdmin = inject(MenuAdminService);

  /** @deprecated Use {@link ensureFinanceiroMenuStructure}. */
  ensureFinanceiroFaturamentoSubMenus(
    menus: MenuAdmin[] = this.menuAdmin.getSnapshot().menus
  ): Observable<FinanceiroMenuSeedResult> {
    return this.ensureFinanceiroMenuStructure(menus);
  }

  ensureFinanceiroMenuStructure(
    menus: MenuAdmin[] = this.menuAdmin.getSnapshot().menus
  ): Observable<FinanceiroMenuSeedResult> {
    const financeiro = this.findFinanceiroMenu(menus);
    if (!financeiro || financeiro.id <= 0) {
      return of({ created: 0, updatedRoutes: 0, labels: [] });
    }

    const existing = this.collectExistingSubs(financeiro);
    const expected = flattenFinanceiroMenuTree();
    const missing = expected.filter((def) => !this.hasMatchingSub(existing, def));
    const routeFixes = this.listRouteFixes(existing, expected);

    if (
      missing.length === 0 &&
      routeFixes.length === 0 &&
      normRoute(financeiro.rota) === normRoute(getFinanceiroMenuRoute())
    ) {
      return of({ created: 0, updatedRoutes: 0, labels: [] });
    }

    const startOrdem = this.nextFlatOrdem(financeiro);
    const mutations: MenuMutation[] = [
      ...routeFixes.map((sub) => ({ sub, includePermissions: false })),
      ...missing.map((def, index) => ({
        sub: this.buildNewSub(def, startOrdem + index),
        includePermissions: true,
      })),
    ];

    if (!mutations.length) {
      return of({ created: 0, updatedRoutes: 0, labels: [] });
    }

    return from(mutations).pipe(
      concatMap((mutation) => {
        const currentMenu =
          this.menuAdmin.getSnapshot().menus.find((m) => m.id === financeiro.id) ?? financeiro;
        const payload = menuAdminToAlterarSubMenuOnlyInput(currentMenu, mutation.sub, {
          includePermissions: mutation.includePermissions,
        });
        return this.menuApi.alterar(payload).pipe(
          switchMap(() => this.menuApi.buscar()),
          map((raw) => mapBuscarResponseToMenuAdmins(raw))
        );
      }),
      toArray(),
      switchMap((batches) => {
        const latest = batches.length ? batches[batches.length - 1] : menus;
        this.menuAdmin.replaceMenusHidratar(latest, computeNextIdFromMenus(latest));
        return of({
          created: missing.length,
          updatedRoutes: routeFixes.length,
          labels: [
            ...routeFixes.map((sub) => `${sub.nome} (rota)`),
            ...missing.map((m) => m.nome),
          ],
        });
      })
    );
  }

  private findFinanceiroMenu(menus: MenuAdmin[]): MenuAdmin | undefined {
    const canonical = normRoute(getFinanceiroMenuRoute());
    const byRoute = menus.find((m) => {
      const r = normRoute(normalizeLegacyAppRoute(m.rota) ?? m.rota);
      return r === canonical || r.startsWith(`${canonical}/`);
    });
    if (byRoute) return byRoute;

    return menus.find((m) => normLabel(m.nome) === 'financeiro');
  }

  private collectExistingSubs(menu: MenuAdmin): SubMenuAdmin[] {
    const subs: SubMenuAdmin[] = [];
    walkSubMenus(menu.subMenus ?? [], (sub) => subs.push(sub));
    return subs;
  }

  private hasMatchingSub(existing: SubMenuAdmin[], def: FinanceiroFlatSubMenuDef): boolean {
    const route = normRoute(def.rota);
    const label = normLabel(def.nome);
    const tabSuffix = route.split('/').pop() ?? '';

    return existing.some((sub) => {
      const subRoute = normRoute(normalizeLegacyAppRoute(sub.rota) ?? sub.rota);
      const subLabel = normLabel(sub.nome);
      if (subRoute === route) return true;
      if (subLabel === label) return true;
      if (tabSuffix && (subRoute.endsWith(`/${tabSuffix}`) || subRoute === tabSuffix)) return true;
      return false;
    });
  }

  private listRouteFixes(existing: SubMenuAdmin[], expected: FinanceiroFlatSubMenuDef[]): SubMenuAdmin[] {
    const fixes: SubMenuAdmin[] = [];

    for (const def of expected) {
      const targetRoute = normalizeLegacyAppRoute(def.rota) ?? def.rota;
      const match = existing.find((sub) => normLabel(sub.nome) === normLabel(def.nome));
      if (!match) continue;

      const currentRoute = normalizeLegacyAppRoute(match.rota) ?? match.rota;
      if (normRoute(currentRoute) !== normRoute(targetRoute)) {
        fixes.push({
          ...match,
          rota: targetRoute,
          exibirNoSidebar: def.exibirNoSidebar,
        });
      }
    }

    return fixes;
  }

  private nextFlatOrdem(menu: MenuAdmin): number {
    let max = -1;
    walkSubMenus(menu.subMenus ?? [], (sub) => {
      max = Math.max(max, sub.ordem ?? 0);
    });
    return max + 1;
  }

  private buildNewSub(def: FinanceiroFlatSubMenuDef, ordem: number): SubMenuAdmin {
    const rota = normalizeLegacyAppRoute(def.rota) ?? def.rota;
    return {
      id: 0,
      nome: def.nome,
      ordem,
      rota,
      ativo: true,
      exibirNoSidebar: def.exibirNoSidebar,
      permissions: [
        {
          id: 0,
          ordem: 0,
          subModuleId: 0,
          acao: buildFullAcaoPermissao(def.nome, 'visualizar'),
        },
      ],
    };
  }
}
