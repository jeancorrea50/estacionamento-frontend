import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import {
  ECOSSISTEMA_LABEL,
  ECOSSISTEMA_ROUTE,
} from '../../ecossistema/ecossistema-rotas';
import { ADMINISTRACAO_ROUTE } from '../../administracao/administracao-rotas';
import type { MenuAdmin, SubMenuAdmin } from '../models/menu-admin.model';
import { MenuAdminService } from './menu-admin.service';
import { MenuApiService } from './menu-api.service';
import {
  computeNextIdFromMenus,
  mapBuscarResponseToMenuAdmins,
  menuAdminToAlterarSubMenuOnlyInput,
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

export interface EcossistemaMenuSeedResult {
  created: boolean;
  updatedRoute: boolean;
  label: string | null;
}

/**
 * Publica no backend (idempotente) o submenu Administração → Ecossistema,
 * para o login liberar a rota `/app/administracao/ecossistema` no payload `menus`.
 */
@Injectable({ providedIn: 'root' })
export class EcossistemaMenuSeedService {
  private readonly menuApi = inject(MenuApiService);
  private readonly menuAdmin = inject(MenuAdminService);

  ensureEcossistemaSubMenu(
    menus: MenuAdmin[] = this.menuAdmin.getSnapshot().menus
  ): Observable<EcossistemaMenuSeedResult> {
    const admin = this.findAdministracaoMenu(menus);
    if (!admin || admin.id <= 0) {
      return of({ created: false, updatedRoute: false, label: null });
    }

    const existing = this.findEcossistemaSub(admin);
    if (existing) {
      const current = normalizeLegacyAppRoute(existing.rota) ?? existing.rota;
      if (normRoute(current) === normRoute(ECOSSISTEMA_ROUTE)) {
        return of({ created: false, updatedRoute: false, label: null });
      }
      const fixed: SubMenuAdmin = {
        ...existing,
        nome: ECOSSISTEMA_LABEL,
        rota: ECOSSISTEMA_ROUTE,
      };
      return this.persist(admin, fixed, false).pipe(
        map(() => ({ created: false, updatedRoute: true, label: ECOSSISTEMA_LABEL }))
      );
    }

    const novo = this.buildNewSub(admin);
    return this.persist(admin, novo, true).pipe(
      map(() => ({ created: true, updatedRoute: false, label: ECOSSISTEMA_LABEL }))
    );
  }

  private persist(
    menu: MenuAdmin,
    sub: SubMenuAdmin,
    includePermissions: boolean
  ): Observable<MenuAdmin[]> {
    const currentMenu =
      this.menuAdmin.getSnapshot().menus.find((m) => m.id === menu.id) ?? menu;
    const payload = menuAdminToAlterarSubMenuOnlyInput(currentMenu, sub, {
      includePermissions,
    });
    return this.menuApi.alterar(payload).pipe(
      switchMap(() => this.menuApi.buscar()),
      map((raw) => {
        const latest = mapBuscarResponseToMenuAdmins(raw);
        this.menuAdmin.replaceMenusHidratar(latest, computeNextIdFromMenus(latest));
        return latest;
      })
    );
  }

  private findAdministracaoMenu(menus: MenuAdmin[]): MenuAdmin | null {
    const target = normRoute(ADMINISTRACAO_ROUTE);
    return (
      menus.find((m) => {
        const r = normRoute(normalizeLegacyAppRoute(m.rota) ?? m.rota);
        return r === target || r.startsWith(`${target}/`);
      }) ??
      menus.find((m) => normLabel(m.nome) === 'administracao') ??
      null
    );
  }

  private findEcossistemaSub(menu: MenuAdmin): SubMenuAdmin | null {
    const targetRoute = normRoute(ECOSSISTEMA_ROUTE);
    let found: SubMenuAdmin | null = null;
    walkSubMenus(menu.subMenus ?? [], (sub) => {
      if (found) return;
      const route = normRoute(normalizeLegacyAppRoute(sub.rota) ?? sub.rota);
      const label = normLabel(sub.nome);
      if (route === targetRoute || label === 'ecossistema' || label === 'mapa funcional') {
        found = sub;
      }
    });
    return found;
  }

  private buildNewSub(menu: MenuAdmin): SubMenuAdmin {
    let maxOrdem = -1;
    walkSubMenus(menu.subMenus ?? [], (sub) => {
      maxOrdem = Math.max(maxOrdem, Number(sub.ordem) || 0);
    });
    return {
      id: 0,
      nome: ECOSSISTEMA_LABEL,
      rota: ECOSSISTEMA_ROUTE,
      ordem: maxOrdem + 1,
      ativo: true,
      exibirNoSidebar: true,
      permissions: [
        {
          id: 0,
          ordem: 0,
          subModuleId: 0,
          acao: buildPermissaoAcaoPorRota(ECOSSISTEMA_ROUTE, ECOSSISTEMA_LABEL, 'visualizar'),
        },
      ],
    };
  }
}
