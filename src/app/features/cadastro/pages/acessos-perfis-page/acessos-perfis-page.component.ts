import {
  Component,
  OnInit,
  inject,
  ChangeDetectorRef,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  AcessosPerfisService,
  ApplicationRole,
  PerfilUpsertInput,
} from '../../services/acessos-perfis.service';
import { ProfilePermissionsStoreService } from '../../services/profile-permissions-store.service';
import type { MenuAdmin } from '../../../gerenciamento/models/menu-admin.model';
import { MenuApiService } from '../../../gerenciamento/services/menu-api.service';
import {
  mapBuscarResponseToMenuAdmins,
} from '../../../gerenciamento/services/menu-api.mapper';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  buildPermissionTreeState,
  getSelectedMenuCount,
  getSelectedPermissionCount,
  getSelectedPermissionKeys,
  hasAnyMenuSelected,
  mapTreeToPerfilMenusPayload,
  toggleMenuSelection,
  togglePermissaoSelection,
  toggleSubMenuSelection,
  type TreeMenuNode,
} from './perfil-permissoes-tree.util';

type ModalKind = 'create' | 'edit' | 'delete' | 'view' | null;

const AVISO_SEM_ENDPOINT =
  'Backend não possui endpoints de perfis (roles) ainda.';

@Component({
  selector: 'app-acessos-perfis-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './acessos-perfis-page.component.html',
  styleUrls: ['./acessos-perfis-page.component.scss'],
})
export class AcessosPerfisPageComponent implements OnInit {
  private perfisService = inject(AcessosPerfisService);
  private menuApi = inject(MenuApiService);
  private profilePermissionsStore = inject(ProfilePermissionsStoreService);
  private permissionCache = inject(PermissionCacheService);
  private sessionAccess = inject(SessionAccessService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  erro: string | null = null;
  itens: ApplicationRole[] = [];

  /** Filtros (somente UI; lista já carregada). Ordem fixa: nome A-Z. */
  /** Texto digitado no campo (ainda não aplicado até clicar na lupa ou Enter). */
  searchDraft = '';
  /** Termo efetivo da busca (usado em `perfisFiltrados`). */
  searchTerm = '';
  statusFilter: 'all' | 'ativo' | 'inativo' = 'all';

  modalKind = signal<ModalKind>(null);
  editItem = signal<ApplicationRole | null>(null);
  deleteItem = signal<ApplicationRole | null>(null);
  viewItem = signal<ApplicationRole | null>(null);
  saving = signal(false);
  saveError = signal<string | null>(null);
  deleting = signal(false);

  form = { name: '', normalizedName: '', permissionIds: [] as string[] };
  private backendMenuCatalog = signal<MenuAdmin[]>([]);
  permissionTree = signal<TreeMenuNode[]>([]);

  get selectedPermissionsCount(): number {
    return getSelectedPermissionCount(this.permissionTree());
  }

  get selectedMenusCount(): number {
    return getSelectedMenuCount(this.permissionTree());
  }

  isModalOpen = computed(() => this.modalKind() !== null);
  isCreate = computed(() => this.modalKind() === 'create');
  isEdit = computed(() => this.modalKind() === 'edit');
  isDelete = computed(() => this.modalKind() === 'delete');
  isView = computed(() => this.modalKind() === 'view');

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading = true;
    this.erro = null;
    this.cdr.markForCheck();
    forkJoin({
      perfis: this.perfisService.buscar(),
      // Catálogo oficial de menus/permissões (ids corretos para o PUT/POST de Perfil).
      menus: this.menuApi.buscar().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ perfis, menus }) => {
        const rawList = this.extractRawProfileList(perfis);
        this.loading = false;
        this.erro = null;
        this.itens = rawList.map((item) => this.normalizeRoleItem(item));
        this.searchDraft = '';
        this.searchTerm = '';
        const fromMenuApi =
          menus != null ? this.sanitizeMenuCatalog(mapBuscarResponseToMenuAdmins(menus)) : [];
        const catalog =
          fromMenuApi.length > 0
            ? fromMenuApi
            : this.sanitizeMenuCatalog(this.buildMenuCatalogFromProfiles(rawList));
        this.backendMenuCatalog.set(catalog);
        this.permissionTree.set(buildPermissionTreeState(catalog, null, []));
        this.syncProfilePermissionsStore();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.erro = AVISO_SEM_ENDPOINT;
        this.itens = [];
        this.cdr.markForCheck();
      },
    });
  }

  /** Mantém apenas ids válidos do servidor (evita FK inválida no save do perfil). */
  private sanitizeMenuCatalog(menus: MenuAdmin[]): MenuAdmin[] {
    return menus
      .filter((menu) => menu.id > 0)
      .map((menu) => ({
        ...menu,
        subMenus: (menu.subMenus ?? [])
          .filter((sub) => sub.id > 0)
          .map((sub) => ({
            ...sub,
            permissions: (sub.permissions ?? []).filter((p) => p.id > 0),
          })),
      }))
      .sort((a, b) => a.ordem - b.ordem);
  }

  retry(): void {
    this.carregar();
  }

  /** Aplica o texto do campo à lista (sem nova chamada HTTP). */
  aplicarBuscaPerfil(): void {
    this.searchTerm = this.searchDraft.trim();
    this.cdr.markForCheck();
  }

  limparBuscaPerfil(): void {
    this.searchDraft = '';
    this.searchTerm = '';
    this.cdr.markForCheck();
  }

  private buildMenuCatalogFromProfiles(items: Record<string, unknown>[]): MenuAdmin[] {
    const byMenuId = new Map<number, MenuAdmin>();

    for (const item of items) {
      const menus = this.getArrayProp(item, 'menus', 'Menus');
      for (const menuItem of menus ?? []) {
        const mappedMenu = this.mapMenuFromPerfilResponse(menuItem);
        if (!mappedMenu) continue;
        const existingMenu = byMenuId.get(mappedMenu.id);
        if (!existingMenu) {
          byMenuId.set(mappedMenu.id, mappedMenu);
          continue;
        }
        byMenuId.set(mappedMenu.id, this.mergeMenuNodes(existingMenu, mappedMenu));
      }
    }

    return [...byMenuId.values()].sort((a, b) => a.ordem - b.ordem);
  }

  private mapMenuFromPerfilResponse(value: unknown): MenuAdmin | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const id = this.readNumber(record, 'menuId', 'moduleId', 'id');
    if (id == null) return null;
    const nome =
      this.readString(record, 'descricao', 'nome', 'name', 'menuDescricao') ?? `Menu ${id}`;
    const subMenusRaw = this.getArrayProp(
      record,
      'subMenus',
      'submenus',
      'subModules',
      'submodulos',
      'SubMenus'
    );

    const subMenus = (subMenusRaw ?? [])
      .map((sub, idx) => this.mapSubMenuFromPerfilResponse(sub, idx))
      .filter((sub): sub is NonNullable<typeof sub> => sub !== null);

    return {
      id,
      nome,
      ordem: this.readNumber(record, 'ordem') ?? 0,
      icone: this.readString(record, 'icone') ?? 'menu',
      ativo: !this.readBoolean(record, 'inativo'),
      exibirNoSidebar: true,
      subMenus,
      existeNoServidor: true,
    };
  }

  private mapSubMenuFromPerfilResponse(value: unknown, fallbackOrder: number) {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const id = this.readNumber(record, 'subMenuId', 'subModuleId', 'id');
    if (id == null) return null;
    const nome = this.readString(record, 'subDescricao', 'descricao', 'nome', 'name') ?? `Submenu ${id}`;
    const permissionsRaw = this.getArrayProp(
      record,
      'permissoes',
      'permissions',
      'Permissoes',
      'Permissions'
    );
    const permissions = (permissionsRaw ?? [])
      .map((perm, idx) => this.mapPermissionFromPerfilResponse(perm, id, idx))
      .filter((perm): perm is NonNullable<typeof perm> => perm !== null);

    return {
      id,
      nome,
      ordem: this.readNumber(record, 'ordem') ?? fallbackOrder,
      rota: this.readString(record, 'rota') ?? '',
      ativo: !this.readBoolean(record, 'inativo'),
      exibirNoSidebar: true,
      permissions,
    };
  }

  private mapPermissionFromPerfilResponse(value: unknown, subMenuId: number, fallbackOrder: number) {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const id = this.readNumber(record, 'permissaoId', 'permissionId', 'id');
    const acao = this.readString(record, 'acao', 'descricao', 'name');
    if (id == null || !acao) return null;
    return {
      id,
      ordem: this.readNumber(record, 'ordem') ?? fallbackOrder,
      subModuleId: subMenuId,
      acao,
    };
  }

  private mergeMenuNodes(current: MenuAdmin, incoming: MenuAdmin): MenuAdmin {
    const bySubMenuId = new Map<number, (typeof current.subMenus)[number]>();
    for (const subMenu of current.subMenus ?? []) {
      bySubMenuId.set(subMenu.id, { ...subMenu, permissions: [...(subMenu.permissions ?? [])] });
    }

    for (const subMenu of incoming.subMenus ?? []) {
      const existing = bySubMenuId.get(subMenu.id);
      if (!existing) {
        bySubMenuId.set(subMenu.id, { ...subMenu, permissions: [...(subMenu.permissions ?? [])] });
        continue;
      }
      const permissionById = new Map<number, (typeof existing.permissions)[number]>();
      for (const permission of existing.permissions ?? []) {
        permissionById.set(permission.id, permission);
      }
      for (const permission of subMenu.permissions ?? []) {
        if (!permissionById.has(permission.id)) {
          permissionById.set(permission.id, permission);
        }
      }
      bySubMenuId.set(subMenu.id, {
        ...existing,
        nome: existing.nome || subMenu.nome,
        rota: existing.rota || subMenu.rota,
        ativo: existing.ativo ?? subMenu.ativo,
        ordem: Math.min(existing.ordem, subMenu.ordem),
        permissions: [...permissionById.values()].sort((a, b) => a.ordem - b.ordem),
      });
    }

    return {
      ...current,
      nome: current.nome || incoming.nome,
      ordem: Math.min(current.ordem, incoming.ordem),
      subMenus: [...bySubMenuId.values()].sort((a, b) => a.ordem - b.ordem),
    };
  }

  private extractRawProfileList(body: unknown): Record<string, unknown>[] {
    if (Array.isArray(body)) {
      return body.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
    }
    if (body && typeof body === 'object' && 'result' in body) {
      const r = (body as { result?: unknown }).result;
      if (Array.isArray(r)) {
        return r.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
      }
    }
    if (body && typeof body === 'object' && 'results' in body) {
      const r = (body as { results?: unknown }).results;
      if (Array.isArray(r)) {
        return r.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
      }
    }
    return [];
  }

  private normalizeRoleItem(raw: Record<string, unknown>): ApplicationRole {
    const permissionIds = this.extractPermissionIdsFromRole(raw);
    const menus = this.getArrayProp(raw, 'menus', 'Menus');
    return {
      id: this.readId(raw, 'id', 'perfilId', 'roleId'),
      perfilId: this.readId(raw, 'perfilId', 'id'),
      perfil: this.readString(raw, 'perfil'),
      name: this.readString(raw, 'name', 'nome', 'perfil'),
      nome: this.readString(raw, 'nome', 'name', 'perfil'),
      normalizedName: this.readString(raw, 'normalizedName', 'descricao'),
      concurrencyStamp: this.readString(raw, 'concurrencyStamp'),
      menus,
      permissionIds,
      ativo: this.readProfileAtivoFlag(raw),
      usuariosVinculados: this.readOptionalUserCount(raw),
      ultimaAtualizacao: this.readOptionalDateString(raw),
    };
  }

  /** Lista aplicando busca e status (sem nova chamada HTTP). Ordem: nome A-Z. */
  get perfisFiltrados(): ApplicationRole[] {
    let list = [...this.itens];
    const q = this.searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const nome = (item.name ?? item.nome ?? '').toLowerCase();
        const desc = (item.normalizedName ?? '').toLowerCase();
        return nome.includes(q) || desc.includes(q);
      });
    }
    if (this.statusFilter === 'ativo') {
      list = list.filter((item) => this.isPerfilAtivoUi(item));
    } else if (this.statusFilter === 'inativo') {
      list = list.filter((item) => !this.isPerfilAtivoUi(item));
    }

    list.sort((a, b) => {
      const na = (a.name ?? a.nome ?? '').toLocaleLowerCase('pt-BR');
      const nb = (b.name ?? b.nome ?? '').toLocaleLowerCase('pt-BR');
      return na.localeCompare(nb, 'pt-BR');
    });

    return list;
  }

  isPerfilAtivoUi(item: ApplicationRole): boolean {
    if (item.ativo === false) return false;
    if (item.ativo === true) return true;
    return true;
  }

  formatUltimaAtualizacao(iso: string | null | undefined): string {
    if (!iso?.trim()) return '—';
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return iso.trim();
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(t));
  }

  formatUsuariosVinculados(item: ApplicationRole): string {
    const n = item.usuariosVinculados;
    if (n == null || Number.isNaN(n)) return '—';
    return String(n);
  }

  perfilDisplayName(item: ApplicationRole): string {
    return (item.name ?? item.nome ?? item.perfil ?? '—').trim() || '—';
  }

  openVisualizar(item: ApplicationRole): void {
    this.viewItem.set(item);
    this.modalKind.set('view');
    this.cdr.markForCheck();
  }

  openDuplicar(item: ApplicationRole): void {
    this.saveError.set(null);
    this.editItem.set(null);
    const base = this.perfilDisplayName(item);
    const suffix = base !== '—' ? `${base} (cópia)` : 'Perfil (cópia)';
    this.form = {
      name: suffix,
      normalizedName: item.normalizedName ?? '',
      permissionIds: [...(item.permissionIds ?? [])],
    };
    this.permissionTree.set(
      buildPermissionTreeState(this.backendMenuCatalog(), item.menus ?? null, item.permissionIds ?? [])
    );
    this.modalKind.set('create');
    this.cdr.markForCheck();
  }

  private readProfileAtivoFlag(raw: Record<string, unknown>): boolean | undefined {
    if (raw['inativo'] === true || raw['Inativo'] === true) return false;
    if (raw['ativo'] === false || raw['Ativo'] === false) return false;
    if (raw['ativo'] === true || raw['Ativo'] === true) return true;
    return undefined;
  }

  private readOptionalUserCount(raw: Record<string, unknown>): number | null | undefined {
    const n = this.readNumber(
      raw,
      'usuariosVinculados',
      'qtdUsuarios',
      'totalUsuarios',
      'usuariosCount',
      'qtdeUsuarios'
    );
    if (n != null && n >= 0) return n;
    return undefined;
  }

  private readOptionalDateString(raw: Record<string, unknown>): string | null | undefined {
    const s = this.readString(
      raw,
      'dataAtualizacao',
      'ultimaAtualizacao',
      'dataAlteracao',
      'updatedAt',
      'ultimaAlteracao',
      'DataAtualizacao'
    );
    return s ?? undefined;
  }

  private extractPermissionIdsFromRole(raw: Record<string, unknown>): string[] {
    const fromExplicitList = this.readStringArray(raw['permissionIds'] ?? raw['permissions']);
    const fromMenus = this.extractPermissionIdsFromMenus(this.getArrayProp(raw, 'menus', 'Menus'));
    const fromModulos = this.extractPermissionIdsFromModulos(
      this.getArrayProp(raw, 'modulos', 'Modulos', 'subMenus')
    );
    const merged = [...fromExplicitList, ...fromMenus, ...fromModulos];
    return Array.from(new Set(merged.map((key) => key.trim()).filter((key) => key.length > 0)));
  }

  private extractPermissionIdsFromMenus(menus: unknown[] | null): string[] {
    if (!menus) return [];
    const selected: string[] = [];

    for (const menu of menus) {
      if (!menu || typeof menu !== 'object') continue;
      const menuRec = menu as Record<string, unknown>;
      const subMenus = this.getArrayProp(menuRec, 'subMenus', 'submenus', 'SubMenus');

      for (const sub of subMenus ?? []) {
        if (!sub || typeof sub !== 'object') continue;
        const subRec = sub as Record<string, unknown>;
        const permissions = this.getArrayProp(subRec, 'permissions', 'permissoes', 'Permissoes');
        for (const perm of permissions ?? []) {
          if (!perm || typeof perm !== 'object') continue;
          const permRec = perm as Record<string, unknown>;
          const isSelected = this.readBoolean(
            permRec,
            'permSelecionado',
            'selecionadoPerm',
            'selecionado',
            'selected',
            'ativo',
            'subSelecionado'
          );
          if (!isSelected) continue;
          const action = this.resolvePermissionKey(permRec, subRec);
          if (action) {
            selected.push(action);
          }
        }
      }
    }
    return selected;
  }

  private extractPermissionIdsFromModulos(modulos: unknown[] | null): string[] {
    if (!modulos) return [];
    const selected: string[] = [];

    for (const modulo of modulos) {
      if (!modulo || typeof modulo !== 'object') continue;
      const moduloRec = modulo as Record<string, unknown>;
      const subModulos = this.getArrayProp(moduloRec, 'subModulos', 'submodulos', 'SubModulos');

      for (const sub of subModulos ?? []) {
        if (!sub || typeof sub !== 'object') continue;
        const subRec = sub as Record<string, unknown>;
        const perms = this.getArrayProp(subRec, 'permissoes', 'permissions', 'Permissoes');
        for (const perm of perms ?? []) {
          if (!perm || typeof perm !== 'object') continue;
          const permRec = perm as Record<string, unknown>;
          const isSelected = this.readBoolean(
            permRec,
            'selecionado',
            'permSelecionado',
            'selecionadoPerm',
            'selected'
          );
          if (!isSelected) continue;
          const action = this.resolvePermissionKey(permRec, subRec);
          if (action) {
            selected.push(action);
          }
        }
      }
    }

    return selected;
  }

  private resolvePermissionKey(
    permission: Record<string, unknown>,
    subMenu: Record<string, unknown>
  ): string | null {
    const fromAction = this.readString(permission, 'acao', 'action', 'descricao', 'name');
    if (fromAction) return fromAction;

    const permissionId = this.readNumber(permission, 'permissaoId', 'permissionId', 'id');
    if (permissionId != null) {
      const fromCatalog = this.getPermissionIdToKeyMap().get(permissionId);
      if (fromCatalog) return fromCatalog;
    }

    const subName = this.readString(subMenu, 'subDescricao', 'descricao', 'nome', 'name');
    if (!subName) return null;
    const actionLabel = this.readString(permission, 'acao', 'descricao') ?? 'visualizar';
    return `${subName.toLowerCase()}.${actionLabel.toLowerCase()}`;
  }

  private syncProfilePermissionsStore(): void {
    for (const item of this.itens) {
      const key = this.getProfileStoreKey(item);
      if (!key) continue;
      this.profilePermissionsStore.setProfilePermissions(key, [...(item.permissionIds ?? [])]);
    }
  }

  private readString(record: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  private readId(record: Record<string, unknown>, ...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  }

  private readNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
      }
    }
    return undefined;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  }

  private readBoolean(record: Record<string, unknown>, ...keys: string[]): boolean {
    for (const key of keys) {
      if (record[key] === true) return true;
    }
    return false;
  }

  private getArrayProp(record: Record<string, unknown>, ...keys: string[]): unknown[] | null {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
    return null;
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }

  openNovo(): void {
    this.saveError.set(null);
    this.editItem.set(null);
    this.form = { name: '', normalizedName: '', permissionIds: [] };
    this.permissionTree.set(buildPermissionTreeState(this.backendMenuCatalog(), null, []));
    this.modalKind.set('create');
    this.cdr.markForCheck();
  }

  openEditar(item: ApplicationRole): void {
    this.saveError.set(null);
    this.editItem.set(item);
    this.form = {
      name: item.name ?? item.nome ?? item.perfil ?? '',
      normalizedName: item.normalizedName ?? '',
      permissionIds: [...(item.permissionIds ?? [])],
    };
    this.permissionTree.set(
      buildPermissionTreeState(this.backendMenuCatalog(), item.menus ?? null, item.permissionIds ?? [])
    );
    this.modalKind.set('edit');
    this.cdr.markForCheck();
  }

  onMenuToggle(menuId: number, checked: boolean): void {
    this.permissionTree.set(toggleMenuSelection(this.permissionTree(), menuId, checked));
    this.cdr.markForCheck();
  }

  selecionarTodasPermissoes(): void {
    this.permissionTree.set(
      this.permissionTree().map((menu) => ({
        ...menu,
        selecionado: true,
        subMenus: menu.subMenus.map((subMenu) => ({
          ...subMenu,
          selecionado: true,
          permissoes: subMenu.permissoes.map((permissao) => ({ ...permissao, selecionado: true })),
        })),
      }))
    );
    this.cdr.markForCheck();
  }

  limparPermissoesSelecionadas(): void {
    this.permissionTree.set(
      this.permissionTree().map((menu) => ({
        ...menu,
        selecionado: false,
        subMenus: menu.subMenus.map((subMenu) => ({
          ...subMenu,
          selecionado: false,
          permissoes: subMenu.permissoes.map((permissao) => ({ ...permissao, selecionado: false })),
        })),
      }))
    );
    this.cdr.markForCheck();
  }

  onSubMenuToggle(menuId: number, subMenuId: number, checked: boolean): void {
    this.permissionTree.set(toggleSubMenuSelection(this.permissionTree(), menuId, subMenuId, checked));
    this.cdr.markForCheck();
  }

  onPermissaoToggle(
    menuId: number,
    subMenuId: number,
    permissaoId: number,
    checked: boolean
  ): void {
    this.permissionTree.set(
      togglePermissaoSelection(this.permissionTree(), menuId, subMenuId, permissaoId, checked)
    );
    this.cdr.markForCheck();
  }

  private syncSessionAccessFromBackendCatalog(): void {
    const menus = this.backendMenuCatalog();
    this.sessionAccess.setMenus(
      menus.map((m) => ({
        id: m.id,
        descricao: m.nome,
        icone: m.icone,
        ativo: m.ativo,
        ordem: m.ordem,
        subMenus: (m.subMenus ?? []).map((s) => ({
          id: s.id,
          descricao: s.nome,
          rota: s.rota,
          ativo: s.ativo,
          ordem: s.ordem,
        })),
      }))
    );
  }

  private syncPermissionCacheForCurrentUserProfile(editedRoleName: string): void {
    const logged = this.authService.getLoggedUser();
    if (!logged) return;

    const loggedPerfil = (logged.perfil ?? '').trim().toLowerCase();
    const role = (editedRoleName ?? '').trim().toLowerCase();
    if (!loggedPerfil || !role || loggedPerfil !== role) return;

    const keys = getSelectedPermissionKeys(this.permissionTree());
    this.permissionCache.setKeys(keys);
    const updated = { ...logged, permissionKeys: keys };
    localStorage.setItem('loggedUser', JSON.stringify(updated));
  }

  private getProfileStoreKey(item: ApplicationRole | null | undefined): string | null {
    if (!item) return null;
    const key = item.name ?? item.nome ?? item.perfil ?? item.id?.toString() ?? item.perfilId?.toString();
    return key?.trim() ? key.trim() : null;
  }

  private toUpsertPayload(editingItem: ApplicationRole | null): PerfilUpsertInput {
    const nome = this.form.name.trim() || null;
    // Contrato Swagger: PerfilCreateInput / PerfilUpdateInput → { id?, nome, menus }
    const dto: PerfilUpsertInput = {
      nome,
      menus: mapTreeToPerfilMenusPayload(this.permissionTree()),
    };
    const id = this.toOptionalNumber(editingItem?.id ?? editingItem?.perfilId);
    if (id != null && id > 0) {
      dto.id = id;
    }
    return dto;
  }

  private getPermissionIdToKeyMap(): Map<number, string> {
    const map = new Map<number, string>();
    for (const menu of this.backendMenuCatalog()) {
      for (const sub of menu.subMenus ?? []) {
        for (const permission of sub.permissions ?? []) {
          const key = (permission.acao ?? '').trim();
          if (permission.id && key) {
            map.set(permission.id, key);
          }
        }
      }
    }
    return map;
  }

  getProfilePermissionCount(item: ApplicationRole): number {
    return item.permissionIds?.length ?? 0;
  }

  trackPerfil(item: ApplicationRole): string {
    const id = item.id ?? item.perfilId;
    if (id != null && `${id}`.length > 0) {
      return `perfil:${id}`;
    }
    const nome = `${item.name ?? ''}::${item.nome ?? ''}`;
    return `perfil-name:${nome}`;
  }

  openExcluir(item: ApplicationRole): void {
    this.deleteItem.set(item);
    this.modalKind.set('delete');
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.modalKind.set(null);
    this.editItem.set(null);
    this.deleteItem.set(null);
    this.viewItem.set(null);
    this.saveError.set(null);
    this.cdr.markForCheck();
  }

  salvar(): void {
    const kind = this.modalKind();
    if (kind === 'delete') return;
    this.saveError.set(null);
    if (!hasAnyMenuSelected(this.permissionTree())) {
      this.saveError.set('Selecione pelo menos um menu para salvar o perfil.');
      this.cdr.markForCheck();
      return;
    }
    this.saving.set(true);
    this.cdr.markForCheck();

    const dto: PerfilUpsertInput = this.toUpsertPayload(kind === 'edit' ? this.editItem() : null);

    if (kind === 'edit') {
      const item = this.editItem();
      if (item?.id) {
        dto.id = this.toOptionalNumber(item.id);
      }
    }

    const obs =
      kind === 'create'
        ? this.perfisService.gravar(dto)
        : this.perfisService.alterar(dto);

    obs.subscribe({
      next: () => {
        const key = this.getProfileStoreKey(this.editItem()) ?? this.form.name.trim();
        const selectedPermissionKeys = getSelectedPermissionKeys(this.permissionTree());
        if (key) {
          this.profilePermissionsStore.setProfilePermissions(key, selectedPermissionKeys);
        }
        const editedRoleName = this.form.name.trim() || this.editItem()?.name || '';
        this.syncPermissionCacheForCurrentUserProfile(editedRoleName);
        this.syncSessionAccessFromBackendCatalog();
        this.toast.warning('Permissões atualizadas. Faça novo login para aplicar 100% das regras do token.');
        this.saving.set(false);
        this.closeModal();
        this.carregar();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(this.mensagemErroSalvarPerfil(err));
        this.cdr.markForCheck();
      },
    });
  }

  private mensagemErroSalvarPerfil(err: unknown): string {
    const raw =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? '').trim()
        : '';
    if (/entity changes|inner exception|dbupdate|foreign key|fk_/i.test(raw)) {
      return 'Não foi possível salvar o perfil. Verifique as permissões selecionadas (ids inválidos ou vínculo inconsistente no servidor).';
    }
    return raw || 'Erro ao salvar.';
  }

  confirmarExclusao(): void {
    const item = this.deleteItem();
    if (!item?.id) {
      this.closeModal();
      return;
    }
    this.deleting.set(true);
    this.cdr.markForCheck();
    this.perfisService.delete(item.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.closeModal();
        this.carregar();
        this.cdr.markForCheck();
      },
      error: () => {
        this.deleting.set(false);
        this.closeModal();
        this.carregar();
        this.cdr.markForCheck();
      },
    });
  }

  get deleteItemName(): string {
    const item = this.deleteItem();
    return item?.name ?? item?.normalizedName ?? 'este perfil';
  }
}
