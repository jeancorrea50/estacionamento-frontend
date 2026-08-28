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
 * Transportadoras, Veículos, Motoristas e Estacionamento.
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
    const route = normRoute(def.rota);
    const label = normLabel(def.nome);

    return existing.some((sub) => {
      const subRoute = normRoute(normalizeLegacyAppRoute(sub.rota) ?? sub.rota);
      const subLabel = normLabel(sub.nome);
      if (subRoute === route) return true;
      if (subLabel === label) return true;
      if (subLabel === normLabel(def.nome.replace(/s$/, ''))) return true;
      return false;
    });
  }

  private listRouteFixes(existing: SubMenuAdmin[], expected: CadastroFlatSubMenuDef[]): SubMenuAdmin[] {
    const fixes: SubMenuAdmin[] = [];

    for (const def of expected) {
      const targetRoute = normalizeLegacyAppRoute(def.rota) ?? def.rota;
      const match = existing.find((sub) => {
        const label = normLabel(sub.nome);
        return label === normLabel(def.nome) || label === normLabel(def.nome.replace(/s$/, ''));
      });
      if (!match) continue;

      const currentRoute = normalizeLegacyAppRoute(match.rota) ?? match.rota;
      if (normRoute(currentRoute) !== normRoute(targetRoute)) {
        fixes.push({
          ...match,
          nome: def.nome,
          rota: targetRoute,
          exibirNoSidebar: true,
        });
      } else if (normLabel(match.nome) !== normLabel(def.nome)) {
        fixes.push({
          ...match,
          nome: def.nome,
          rota: targetRoute,
          exibirNoSidebar: true,
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
          acao: buildFullAcaoPermissao(def.nome, 'visualizar'),
        },
      ],
    };
  }
}
