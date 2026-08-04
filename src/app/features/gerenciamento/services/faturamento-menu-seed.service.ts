import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { FATURAMENTO_ROUTE, FATURAMENTO_TABS } from '../../financeiro/faturamento-rotas';
import type { MenuAdmin, SubMenuAdmin } from '../models/menu-admin.model';
import { MenuAdminService } from './menu-admin.service';
import { MenuApiService } from './menu-api.service';
import {
  computeNextIdFromMenus,
  mapBuscarResponseToMenuAdmins,
} from './menu-api.mapper';
import type { MenuCreateInput } from './menu-api.types';

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

/**
 * Publica no backend (idempotente) os submenus de Faturamento no menu Financeiro,
 * com as mesmas rotas usadas pelas abas do SPA e pelos links da Visão Geral.
 */
@Injectable({ providedIn: 'root' })
export class FaturamentoMenuSeedService {
  private readonly menuApi = inject(MenuApiService);
  private readonly menuAdmin = inject(MenuAdminService);

  /**
   * Garante os 6 submenus no menu Financeiro. Se algum faltar, grava via POST Gravar
   * e recarrega a lista. Sem alteração quando já existem.
   */
  ensureFinanceiroFaturamentoSubMenus(
    menus: MenuAdmin[] = this.menuAdmin.getSnapshot().menus
  ): Observable<{ created: number; labels: string[] }> {
    const financeiro = this.findFinanceiroMenu(menus);
    if (!financeiro || financeiro.id <= 0) {
      return of({ created: 0, labels: [] });
    }

    const missing = this.listMissingSubMenus(financeiro);
    if (missing.length === 0) {
      return of({ created: 0, labels: [] });
    }

    const startOrdem = financeiro.subMenus.length;
    const novos: SubMenuAdmin[] = missing.map((tab, i) => ({
      id: 0,
      nome: tab.label,
      ordem: startOrdem + i,
      rota: tab.route,
      ativo: true,
      exibirNoSidebar: false,
      permissions: [],
    }));

    const menuComNovos: MenuAdmin = {
      ...financeiro,
      subMenus: [...financeiro.subMenus, ...novos],
    };

    const payload = this.buildGravarPayload(menuComNovos);
    return this.menuApi.gravar(payload).pipe(
      switchMap(() => this.menuApi.buscar()),
      map((raw) => {
        const nextMenus = mapBuscarResponseToMenuAdmins(raw);
        this.menuAdmin.replaceMenusHidratar(nextMenus, computeNextIdFromMenus(nextMenus));
        return {
          created: missing.length,
          labels: missing.map((t) => t.label),
        };
      })
    );
  }

  private findFinanceiroMenu(menus: MenuAdmin[]): MenuAdmin | undefined {
    const byRoute = menus.find((m) => {
      const r = normRoute(m.rota);
      return r === '/app/financeiro' || r.startsWith('/app/financeiro/');
    });
    if (byRoute) return byRoute;

    return menus.find((m) => {
      const n = normLabel(m.nome);
      return n === 'financeiro' || n.includes('financeiro');
    });
  }

  private listMissingSubMenus(menu: MenuAdmin): typeof FATURAMENTO_TABS[number][] {
    const routes = new Set(menu.subMenus.map((s) => normRoute(s.rota)));
    const labels = new Set(menu.subMenus.map((s) => normLabel(s.nome)));

    return FATURAMENTO_TABS.filter((tab) => {
      const r = normRoute(tab.route);
      const l = normLabel(tab.label);
      if (routes.has(r)) return false;
      // Evita duplicar se já existir submenu com o mesmo nome (rota antiga/erratic).
      if (labels.has(l)) return false;
      // Match por sufixo da aba (ex.: .../faturas).
      for (const existing of routes) {
        if (existing === r || existing.endsWith(`/${tab.path}`)) return false;
      }
      return true;
    });
  }

  private buildGravarPayload(menu: MenuAdmin): MenuCreateInput {
    return {
      id: menu.id > 0 ? menu.id : 0,
      nome: menu.nome,
      descricao: menu.nome,
      ordem: menu.ordem,
      rota: menu.rota?.trim() ? menu.rota.trim() : FATURAMENTO_ROUTE.replace(/\/faturamento$/, ''),
      ativo: menu.ativo,
      subMenus: menu.subMenus.map((s) => ({
        id: s.id > 0 ? s.id : 0,
        nome: s.nome,
        descricao: s.nome,
        ordem: s.ordem,
        rota: s.rota,
        ativo: s.ativo,
        isAtivo: s.ativo,
        isActive: s.ativo,
        exibirNoSidebar: s.exibirNoSidebar !== false,
        mostrarSidebar: s.exibirNoSidebar !== false,
        permissions: (s.permissions ?? []).map((p, i) => ({
          ordem: p.ordem ?? i,
          id: p.id > 0 ? p.id : 0,
          subModuleId: s.id > 0 ? s.id : 0,
          descricao: p.acao,
        })),
      })),
    };
  }
}
