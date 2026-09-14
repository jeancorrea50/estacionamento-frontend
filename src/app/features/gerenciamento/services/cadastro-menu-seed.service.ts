import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, from, of } from 'rxjs';
import { map, switchMap, toArray } from 'rxjs/operators';

import {
  type CadastroFlatSubMenuDef,
  flattenCadastroMenuTree,
  getCadastroMenuRoute,
} from '../../cadastro/cadastro-menu-structure';
import type { MenuAdmin, SubMenuAdmin } from '../models/menu-admin.model';
import { MenuAdminService } from './menu-admin.service';
import { MenuApiService } from './menu-api.service';
import {
  computeNextIdFromMenus,
  mapBuscarResponseToMenuAdmins,
  menuAdminToAlterarSubMenuOnlyInput,
} from './menu-api.mapper';
import { buildFullAcaoPermissao, buildPermissaoAcaoPorRota } from './menu-permission-acao';
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

export interface CadastroMenuSeedResult {
  created: number;
  updatedRoutes: number;
  labels: string[];
}

interface MenuMutation {
  sub: SubMenuAdmin;
  includePermissions: boolean;
}

/**
 * Publica no backend (idempotente) os submenus do Cadastro:
 * Veículo, Motorista e Transportadora.
 */
@Injectable({ providedIn: 'root' })
export class CadastroMenuSeedService {
  private readonly menuApi = inject(MenuApiService);
  private readonly menuAdmin = inject(MenuAdminService);

  ensureCadastroMenuStructure(
    menus: MenuAdmin[] = this.menuAdmin.getSnapshot().menus
  ): Observable<CadastroMenuSeedResult> {
    const cadastro = this.findCadastroMenu(menus);
    if (!cadastro || cadastro.id <= 0) {
      return of({ created: 0, updatedRoutes: 0, labels: [] });
    }

    const existing = this.collectExistingSubs(cadastro);
    const expected = flattenCadastroMenuTree();
    const missing = expected.filter((def) => !this.hasMatchingSub(existing, def));
    const routeFixes = this.listRouteFixes(existing, expected);

    if (
      missing.length === 0 &&
      routeFixes.length === 0 &&
      normRoute(cadastro.rota) === normRoute(getCadastroMenuRoute())
    ) {
      return of({ created: 0, updatedRoutes: 0, labels: [] });
    }

    const startOrdem = this.nextFlatOrdem(cadastro);
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
          this.menuAdmin.getSnapshot().menus.find((m) => m.id === cadastro.id) ?? cadastro;
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

  private findCadastroMenu(menus: MenuAdmin[]): MenuAdmin | undefined {
    const canonical = normRoute(getCadastroMenuRoute());
    const byRoute = menus.find((m) => {
      const r = normRoute(normalizeLegacyAppRoute(m.rota) ?? m.rota);
      return r === canonical || r.startsWith(`${canonical}/`);
    });
    if (byRoute) return byRoute;

    return menus.find((m) => normLabel(m.nome) === 'cadastro' || normLabel(m.nome) === 'cadastros');
  }

  private collectExistingSubs(menu: MenuAdmin): SubMenuAdmin[] {
    const subs: SubMenuAdmin[] = [];
    walkSubMenus(menu.subMenus ?? [], (sub) => subs.push(sub));
    return subs;
  }

  private hasMatchingSub(existing: SubMenuAdmin[], def: CadastroFlatSubMenuDef): boolean {
    return this.findExistingForDef(existing, def) != null;
  }

  private findExistingForDef(
    existing: SubMenuAdmin[],
    def: CadastroFlatSubMenuDef
  ): SubMenuAdmin | undefined {
    const route = normRoute(def.rota);
    const label = normLabel(def.nome);
    const parent = this.parentRoute(route);

    const byExactRoute = existing.find(
      (sub) => normRoute(normalizeLegacyAppRoute(sub.rota) ?? sub.rota) === route
    );
    if (byExactRoute) return byExactRoute;

    const sameLabel = existing.filter((sub) => {
      const subLabel = normLabel(sub.nome);
      return subLabel === label || subLabel === normLabel(def.nome.replace(/s$/, ''));
    });
    if (sameLabel.length === 0) return undefined;

    if (parent) {
      const byParent = sameLabel.find((sub) => {
        const subRoute = normRoute(normalizeLegacyAppRoute(sub.rota) ?? sub.rota);
        return this.parentRoute(subRoute) === parent;
      });
      if (byParent) return byParent;
    }

    if (sameLabel.length === 1) return sameLabel[0];
    return undefined;
  }

  private parentRoute(route: string): string {
    const parts = route.split('/').filter(Boolean);
    if (parts.length <= 1) return '';
    return `/${parts.slice(0, -1).join('/')}`;
  }

  private listRouteFixes(existing: SubMenuAdmin[], expected: CadastroFlatSubMenuDef[]): SubMenuAdmin[] {
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

  private buildNewSub(def: CadastroFlatSubMenuDef, ordem: number): SubMenuAdmin {
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
