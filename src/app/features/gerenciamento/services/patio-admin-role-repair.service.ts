import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, from, of } from 'rxjs';
import { catchError, map, switchMap, toArray } from 'rxjs/operators';

import {
  AcessosPerfisService,
  type ApplicationRole,
  type PerfilUpsertInput,
} from '../../cadastro/services/acessos-perfis.service';
import {
  buildPermissionTreeState,
  mapTreeToPerfilMenusPayload,
  toggleMenuSelection,
  type TreeMenuNode,
} from '../../cadastro/pages/acessos-perfis-page/perfil-permissoes-tree.util';
import type { MenuAdmin } from '../models/menu-admin.model';
import { flattenSubMenus } from './menu-tree.util';
import { getPatioMenuRoute } from '../../patio/patio-menu-structure';

function normLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normRoute(route: string | null | undefined): string {
  return String(route ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
}

/** Perfis operacionais que devem manter o módulo Pátio após republicação do catálogo. */
const TARGET_ROLE_LABELS = new Set(['admin', 'estacionamento']);

export interface PatioAdminRoleRepairResult {
  repaired: string[];
  skipped: string[];
}

/**
 * Reatacha o menu Pátio aos perfis Admin/Estacionamento quando o catálogo
 * já tem Pátio, mas o RolePermission ficou sem o vínculo (ex.: save de perfil
 * enquanto o menu ainda não existia no backend).
 *
 * Respeita o contrato PUT /auth/Permissao — só altera se Pátio estiver ausente.
 */
@Injectable({ providedIn: 'root' })
export class PatioAdminRoleRepairService {
  private readonly perfisService = inject(AcessosPerfisService);

  ensurePatioOnOperationalRoles(
    catalog: MenuAdmin[],
    roles: ApplicationRole[]
  ): Observable<PatioAdminRoleRepairResult> {
    const patio = this.findPatioMenu(catalog);
    if (!patio || patio.id <= 0) {
      return of({ repaired: [], skipped: roles.map((r) => this.roleName(r) || '?') });
    }

    const targets = roles.filter((role) => TARGET_ROLE_LABELS.has(normLabel(this.roleName(role))));
    if (!targets.length) {
      return of({ repaired: [], skipped: [] });
    }

    return from(targets).pipe(
      concatMap((role) => this.repairRoleIfNeeded(role, catalog, patio).pipe(
        map((changed) => ({ role, changed })),
        catchError(() => of({ role, changed: false }))
      )),
      toArray(),
      map((rows) => ({
        repaired: rows.filter((r) => r.changed).map((r) => this.roleName(r.role) || String(r.role.id)),
        skipped: rows.filter((r) => !r.changed).map((r) => this.roleName(r.role) || String(r.role.id)),
      }))
    );
  }

  private repairRoleIfNeeded(
    role: ApplicationRole,
    catalog: MenuAdmin[],
    patio: MenuAdmin
  ): Observable<boolean> {
    const roleId = this.toPositiveId(role.id ?? role.permissaoId ?? role.perfilId);
    if (roleId == null) return of(false);

    if (this.roleAlreadyHasPatio(role, patio.id)) {
      return of(false);
    }

    const permissionKeys = role.permissionIds ?? [];
    const tree = buildPermissionTreeState(catalog, role.menus ?? null, permissionKeys);
    const withPatio = toggleMenuSelection(tree, patio.id, true);
    if (!this.treeHasPatioSelected(withPatio, patio.id)) {
      return of(false);
    }

    const dto: PerfilUpsertInput = {
      id: roleId,
      nome: this.roleName(role) || 'Admin',
      menus: mapTreeToPerfilMenusPayload(withPatio),
    };

    return this.perfisService.alterar(dto).pipe(
      switchMap(() => of(true)),
      catchError(() => of(false))
    );
  }

  private roleAlreadyHasPatio(role: ApplicationRole, patioMenuId: number): boolean {
    const menus = Array.isArray(role.menus) ? role.menus : [];
    for (const menu of menus) {
      if (!menu || typeof menu !== 'object') continue;
      const rec = menu as Record<string, unknown>;
      const menuId = this.toPositiveId(rec['menuId'] ?? rec['id']);
      const selected = rec['selecionado'] === true || rec['selected'] === true;
      if (menuId === patioMenuId && selected) return true;

      const rota = normRoute(String(rec['rota'] ?? rec['route'] ?? ''));
      const nome = normLabel(String(rec['descricao'] ?? rec['nome'] ?? rec['name'] ?? ''));
      if ((rota === normRoute(getPatioMenuRoute()) || nome === 'patio') && selected) return true;

      const subs = Array.isArray(rec['subMenus'])
        ? rec['subMenus']
        : Array.isArray(rec['submenus'])
          ? rec['submenus']
          : [];
      for (const sub of subs) {
        if (!sub || typeof sub !== 'object') continue;
        const subRec = sub as Record<string, unknown>;
        const subSelected =
          subRec['selecionado'] === true ||
          subRec['subSelecionado'] === true ||
          subRec['selected'] === true;
        const subRota = normRoute(String(subRec['rota'] ?? subRec['route'] ?? ''));
        if (subSelected && subRota.startsWith(`${normRoute(getPatioMenuRoute())}/`)) {
          return true;
        }
      }
    }
    return false;
  }

  private treeHasPatioSelected(tree: TreeMenuNode[], patioMenuId: number): boolean {
    const node = tree.find((m) => m.menuId === patioMenuId);
    return !!node?.selecionado;
  }

  private findPatioMenu(catalog: MenuAdmin[]): MenuAdmin | undefined {
    const canonical = normRoute(getPatioMenuRoute());
    const byRoute = catalog.find((m) => {
      const r = normRoute(m.rota);
      return r === canonical || r.startsWith(`${canonical}/`);
    });
    if (byRoute) return byRoute;

    const byLabel = catalog.find((m) => {
      const label = normLabel(m.nome);
      return label === 'patio' || label === 'movimentos' || label === 'movimento';
    });
    if (!byLabel) return undefined;

    // Exige ao menos um submenu canônico de pátio para evitar falso positivo.
    const subs = flattenSubMenus(byLabel.subMenus ?? []);
    const hasPatioSub = subs.some((s) => normRoute(s.rota).startsWith(`${canonical}/`));
    return hasPatioSub ? byLabel : undefined;
  }

  private roleName(role: ApplicationRole): string {
    return String(role.nome ?? role.name ?? role.permissao ?? role.perfil ?? '').trim();
  }

  private toPositiveId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.trunc(value);
    }
    if (typeof value === 'string' && value.trim()) {
      const n = Number(value.trim());
      if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    }
    return null;
  }
}
