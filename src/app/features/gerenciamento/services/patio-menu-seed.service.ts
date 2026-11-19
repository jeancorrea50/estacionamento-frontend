import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, from, of } from 'rxjs';
import { map, switchMap, toArray } from 'rxjs/operators';

import {
  type PatioFlatSubMenuDef,
  flattenPatioMenuTree,
  getPatioMenuRoute,
} from '../../patio/patio-menu-structure';
import type { MenuAdmin, SubMenuAdmin } from '../models/menu-admin.model';
import { MenuAdminService } from './menu-admin.service';
import { MenuApiService } from './menu-api.service';
import {
  computeNextIdFromMenus,
  mapBuscarResponseToMenuAdmins,
  menuAdminToAlterarSubMenuOnlyInput,
  menuAdminToCreateInput,
  menuAdminToUpdateInput,
} from './menu-api.mapper';
import { buildPermissaoAcaoPorRota } from './menu-permission-acao';
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

export interface PatioMenuSeedResult {
  createdMenu: boolean;
  createdSubs: number;
  updatedRoutes: number;
  renamed: boolean;
  labels: string[];
}

interface MenuMutation {
  sub: SubMenuAdmin;
  includePermissions: boolean;
}

/**
 * Publica no backend (idempotente) o módulo Pátio + submenus canônicos.
 * Cobre ausência total do menu e legado "Movimentos"/"Movimento".
 */
@Injectable({ providedIn: 'root' })
export class PatioMenuSeedService {
  private readonly menuApi = inject(MenuApiService);
  private readonly menuAdmin = inject(MenuAdminService);

  ensurePatioMenuStructure(
    menus: MenuAdmin[] = this.menuAdmin.getSnapshot().menus
  ): Observable<PatioMenuSeedResult> {
    const patio = this.findPatioMenu(menus);
    if (!patio) {
      return this.createPatioMenu(menus);
    }

    return this.ensurePatioSubMenus(patio, menus);
  }

  private createPatioMenu(menus: MenuAdmin[]): Observable<PatioMenuSeedResult> {
    const expected = flattenPatioMenuTree();
    const novo: MenuAdmin = {
      id: 0,
      nome: 'Pátio',
      ordem: menus.length,
      icone: 'local_parking',
      rota: getPatioMenuRoute(),
      ativo: true,
      exibirNoSidebar: true,
      existeNoServidor: false,
      subMenus: expected.map((def, index) => this.buildNewSub(def, index)),
    };

    return this.menuApi.gravar(menuAdminToCreateInput(novo)).pipe(
      switchMap(() => this.menuApi.buscar()),
      map((raw) => {
        const latest = mapBuscarResponseToMenuAdmins(raw);
        this.menuAdmin.replaceMenusHidratar(latest, computeNextIdFromMenus(latest));
        return {
          createdMenu: true,
          createdSubs: expected.length,
          updatedRoutes: 0,
          renamed: false,
          labels: ['Pátio', ...expected.map((d) => d.nome)],
        };
      })
    );
  }

  private ensurePatioSubMenus(
    patio: MenuAdmin,
    menus: MenuAdmin[]
  ): Observable<PatioMenuSeedResult> {
    const existing = this.collectExistingSubs(patio);
    const expected = flattenPatioMenuTree();
    const missing = expected.filter((def) => !this.hasMatchingSub(existing, def));
    const routeFixes = this.listRouteFixes(existing, expected);

    const needsRename = normLabel(patio.nome) !== 'patio';
    const needsParentRoute = normRoute(patio.rota) !== normRoute(getPatioMenuRoute());

    if (
      missing.length === 0 &&
      routeFixes.length === 0 &&
      !needsRename &&
      !needsParentRoute
    ) {
      return of({
        createdMenu: false,
        createdSubs: 0,
        updatedRoutes: 0,
        renamed: false,
        labels: [],
      });
    }

    const parentPatch$ =
      needsRename || needsParentRoute
        ? this.persistParentMeta(patio, {
            nome: 'Pátio',
            rota: getPatioMenuRoute(),
            icone: patio.icone?.trim() || 'local_parking',
          })
        : of(menus);

    const startOrdem = this.nextFlatOrdem(patio);
    const mutations: MenuMutation[] = [
      ...routeFixes.map((sub) => ({ sub, includePermissions: false })),
      ...missing.map((def, index) => ({
        sub: this.buildNewSub(def, startOrdem + index),
        includePermissions: true,
      })),
    ];

    return parentPatch$.pipe(
      switchMap((afterParent) => {
        if (!mutations.length) {
          return of({
            createdMenu: false,
            createdSubs: 0,
            updatedRoutes: routeFixes.length,
            renamed: needsRename || needsParentRoute,
            labels:
              needsRename || needsParentRoute
                ? ['Pátio (menu)']
                : routeFixes.map((sub) => `${sub.nome} (rota)`),
          } satisfies PatioMenuSeedResult);
        }

        const patioId = patio.id;
        return from(mutations).pipe(
          concatMap((mutation) => {
            const currentMenu =
              this.menuAdmin.getSnapshot().menus.find((m) => m.id === patioId) ?? patio;
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
            const latest = batches.length ? batches[batches.length - 1] : afterParent;
            this.menuAdmin.replaceMenusHidratar(latest, computeNextIdFromMenus(latest));
            return of({
              createdMenu: false,
              createdSubs: missing.length,
              updatedRoutes: routeFixes.length,
              renamed: needsRename || needsParentRoute,
              labels: [
                ...(needsRename || needsParentRoute ? ['Pátio (menu)'] : []),
                ...routeFixes.map((sub) => `${sub.nome} (rota)`),
                ...missing.map((m) => m.nome),
              ],
            } satisfies PatioMenuSeedResult);
          })
        );
      })
    );
  }

  private persistParentMeta(
    menu: MenuAdmin,
    patch: Pick<MenuAdmin, 'nome' | 'rota' | 'icone'>
  ): Observable<MenuAdmin[]> {
    const atualizado: MenuAdmin = {
      ...menu,
      ...patch,
      ativo: menu.ativo !== false,
      exibirNoSidebar: menu.exibirNoSidebar !== false,
    };
    return this.menuApi.alterar(menuAdminToUpdateInput(atualizado)).pipe(
      switchMap(() => this.menuApi.buscar()),
      map((raw) => {
        const latest = mapBuscarResponseToMenuAdmins(raw);
        this.menuAdmin.replaceMenusHidratar(latest, computeNextIdFromMenus(latest));
        return latest;
      })
    );
  }

  private findPatioMenu(menus: MenuAdmin[]): MenuAdmin | undefined {
    const canonical = normRoute(getPatioMenuRoute());
    const byRoute = menus.find((m) => {
      const r = normRoute(normalizeLegacyAppRoute(m.rota) ?? m.rota);
      return (
        r === canonical ||
        r.startsWith(`${canonical}/`) ||
        r === '/app/movimentos' ||
        r.startsWith('/app/movimentos/') ||
        r === '/app/movimento' ||
        r.startsWith('/app/movimento/')
      );
    });
    if (byRoute) return byRoute;

    return menus.find((m) => {
      const label = normLabel(m.nome);
      return label === 'patio' || label === 'movimentos' || label === 'movimento';
    });
  }

  private collectExistingSubs(menu: MenuAdmin): SubMenuAdmin[] {
    const subs: SubMenuAdmin[] = [];
    walkSubMenus(menu.subMenus ?? [], (sub) => subs.push(sub));
    return subs;
  }

  private hasMatchingSub(existing: SubMenuAdmin[], def: PatioFlatSubMenuDef): boolean {
    return this.findExistingForDef(existing, def) != null;
  }

  private findExistingForDef(
    existing: SubMenuAdmin[],
    def: PatioFlatSubMenuDef
  ): SubMenuAdmin | undefined {
    const route = normRoute(def.rota);
    const label = normLabel(def.nome);

    const byExactRoute = existing.find(
      (sub) => normRoute(normalizeLegacyAppRoute(sub.rota) ?? sub.rota) === route
    );
    if (byExactRoute) return byExactRoute;

    const legacyAliases = this.legacyAliasesFor(def.rota);
    const byLegacy = existing.find((sub) =>
      legacyAliases.has(normRoute(normalizeLegacyAppRoute(sub.rota) ?? sub.rota))
    );
    if (byLegacy) return byLegacy;

    const sameLabel = existing.filter((sub) => {
      const subLabel = normLabel(sub.nome);
      return (
        subLabel === label ||
        (label === 'movimentacoes' && (subLabel === 'movimentos' || subLabel === 'lista')) ||
        (label === 'entrada e saida' && subLabel === 'movimento')
      );
    });
    if (sameLabel.length === 1) return sameLabel[0];
    return undefined;
  }

  private legacyAliasesFor(route: string): Set<string> {
    const r = normRoute(route);
    if (r.endsWith('/patio/movimentacoes')) {
      return new Set([
        '/app/movimentos',
        '/app/movimentos/lista',
        '/app/movimentos/operacao',
        '/app/patio/movimentacoes',
      ]);
    }
    if (r.endsWith('/patio/entrada-saida')) {
      return new Set([
        '/app/movimento',
        '/app/movimentos/entrada-saida',
        '/app/patio/entrada-saida',
      ]);
    }
    if (r.endsWith('/patio/movimentacoes/relatorio')) {
      return new Set(['/app/patio/movimentacoes/relatorio']);
    }
    return new Set([r]);
  }

  private listRouteFixes(
    existing: SubMenuAdmin[],
    expected: PatioFlatSubMenuDef[]
  ): SubMenuAdmin[] {
    const fixes: SubMenuAdmin[] = [];

    for (const def of expected) {
      const targetRoute = normalizeLegacyAppRoute(def.rota) ?? def.rota;
      const match = this.findExistingForDef(existing, def);
      if (!match) continue;

      const currentRoute = normalizeLegacyAppRoute(match.rota) ?? match.rota;
      const needsRoute = normRoute(currentRoute) !== normRoute(targetRoute);
      const needsName = normLabel(match.nome) !== normLabel(def.nome);
      if (!needsRoute && !needsName) continue;

      if (needsRoute) {
        const occupiedByOther = existing.some(
          (sub) =>
            sub !== match &&
            normRoute(normalizeLegacyAppRoute(sub.rota) ?? sub.rota) === normRoute(targetRoute)
        );
        if (occupiedByOther) continue;
      }

      fixes.push({
        ...match,
        nome: def.nome,
        rota: targetRoute,
        exibirNoSidebar: true,
      });
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

  private buildNewSub(def: PatioFlatSubMenuDef, ordem: number): SubMenuAdmin {
    const rota = normalizeLegacyAppRoute(def.rota) ?? def.rota;
    return {
      id: 0,
      nome: def.nome,
      ordem,
      rota,
      ativo: true,
      exibirNoSidebar: true,
      permissions: [
        {
          id: 0,
          ordem: 0,
          subModuleId: 0,
          acao: buildPermissaoAcaoPorRota(rota, def.nome, 'visualizar'),
        },
      ],
    };
  }
}
