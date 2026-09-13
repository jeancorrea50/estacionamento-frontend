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
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
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
import { mapBuscarResponseToMenuAdmins } from '../../../gerenciamento/services/menu-api.mapper';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  resolvePermissaoAcaoMeta,
  type PermissaoAcaoMeta,
} from './perfil-permissao-acao.util';
import {
  buildPermissionTreeState,
  countMenusInTree,
  countPermissionsInMenu,
  countTotalPermissionsInTree,
  findPermissionByAction,
  getExtraPermissions,
  getSelectedPermissionCount,
  getSelectedPermissionKeys,
  isActionColumnFullySelected,
  isActionColumnIndeterminate,
  mapTreeToPerfilMenusPayload,
  setAllPermissionsInTree,
  toggleActionColumnInMenu,
  toggleMenuSelection,
  togglePermissaoSelection,
  toggleSubMenuSelection,
  type TreeMenuNode,
  type TreePermissaoNode,
  type TreeSubMenuNode,
} from './perfil-permissoes-tree.util';

type ModalKind = 'create' | 'rename' | 'delete' | null;
type AccessFilter = 'all' | 'allowed' | 'denied';

const AVISO_SEM_ENDPOINT = 'Backend não possui endpoints de perfis (roles) ainda.';
const LAST_PROFILE_KEY = 'acessos-perfis-last-profile-id';
const ACOES_PADRAO = ['visualizar', 'gravar', 'alterar', 'excluir'] as const;

@Component({
  selector: 'app-acessos-perfis-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCheckboxModule],
  templateUrl: './acessos-perfis-page.component.html',
  styleUrls: ['./acessos-perfis-page.component.scss'],
})
export class AcessosPerfisPageComponent implements OnInit {
  readonly acoesPadrao = ACOES_PADRAO;
  readonly acaoLabels: Record<(typeof ACOES_PADRAO)[number], string> = {
    visualizar: 'Visualizar',
    gravar: 'Gravar',
    alterar: 'Alterar',
    excluir: 'Excluir',
  };

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

  selectedProfileId = signal<string | null>(null);
  expandedMenus = signal<Set<number>>(new Set());
  searchQuery = signal('');
  accessFilter = signal<AccessFilter>('all');
  dirty = signal(false);
  baselineKeys = signal('');

  permissionTree = signal<TreeMenuNode[]>([]);
  private backendMenuCatalog = signal<MenuAdmin[]>([]);

  modalKind = signal<ModalKind>(null);
  saving = signal(false);
  saveError = signal<string | null>(null);
  deleting = signal(false);
  formName = '';

  isModalOpen = computed(() => this.modalKind() !== null);
  isCreate = computed(() => this.modalKind() === 'create');
  isRename = computed(() => this.modalKind() === 'rename');
  isDelete = computed(() => this.modalKind() === 'delete');

  selectedProfile = computed(() => {
    const id = this.selectedProfileId();
    if (!id) return null;
    return this.itens.find((item) => this.profileKey(item) === id) ?? null;
  });

  selectedPermissionsCount = computed(() => getSelectedPermissionCount(this.permissionTree()));

  modulesSummary = computed(() => {
    const tree = this.permissionTree();
    let selected = 0;
    for (const menu of tree) {
      const counts = countPermissionsInMenu(menu);
      if (counts.selected > 0 || menu.selecionado) selected += 1;
    }
    return { total: tree.length, selected };
  });

  menusSummary = computed(() => countMenusInTree(this.permissionTree()));

  totalPermissionsInCatalog = computed(() => countTotalPermissionsInTree(this.permissionTree()));

  filteredTree = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.accessFilter();
    return this.permissionTree()
      .map((menu) => this.filterMenuNode(menu, query, filter))
      .filter((menu): menu is TreeMenuNode => menu != null);
  });

  sideSummaryModules = computed(() => {
    return this.permissionTree()
      .map((menu) => {
        const counts = countPermissionsInMenu(menu);
        return {
          menuId: menu.menuId,
          nome: menu.nome,
          selected: counts.selected,
          total: counts.total,
        };
      })
      .filter((m) => m.total > 0);
  });

  ngOnInit(): void {
    this.carregar();
  }

  carregar(opts?: { preferProfileId?: string | null; preferName?: string | null }): void {
    this.loading = true;
    this.erro = null;
    this.cdr.markForCheck();
    forkJoin({
      perfis: this.perfisService.buscar(),
      menus: this.menuApi.buscar().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ perfis, menus }) => {
        const rawList = this.extractRawProfileList(perfis);
        this.loading = false;
        this.erro = null;
        this.itens = rawList
          .map((item) => this.normalizeRoleItem(item))
          .sort((a, b) =>
            this.perfilDisplayName(a).localeCompare(this.perfilDisplayName(b), 'pt-BR')
          );
        const fromMenuApi =
          menus != null ? this.sanitizeMenuCatalog(mapBuscarResponseToMenuAdmins(menus)) : [];
        const catalog =
          fromMenuApi.length > 0
            ? fromMenuApi
            : this.sanitizeMenuCatalog(this.buildMenuCatalogFromProfiles(rawList));
        this.backendMenuCatalog.set(catalog);
        this.syncProfilePermissionsStore();

        const preferredId =
          opts?.preferProfileId ?? this.selectedProfileId() ?? this.readLastProfileId();
        const preferredName = opts?.preferName?.trim().toLowerCase() ?? null;
        const match =
          (preferredId ? this.itens.find((i) => this.profileKey(i) === preferredId) : null) ??
          (preferredName
            ? this.itens.find((i) => this.perfilDisplayName(i).toLowerCase() === preferredName)
            : null) ??
          this.itens[0] ??
          null;
        if (match) {
          this.applyProfileSelection(match, { expandAll: true });
        } else {
          this.selectedProfileId.set(null);
          this.permissionTree.set(buildPermissionTreeState(catalog, null, []));
          this.resetBaseline();
        }
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

  retry(): void {
    this.carregar();
  }

  perfilDisplayName(item: ApplicationRole | null | undefined): string {
    if (!item) return '—';
    return (item.name ?? item.nome ?? item.perfil ?? '—').trim() || '—';
  }

  profileKey(item: ApplicationRole): string {
    const id = item.id ?? item.perfilId ?? item.permissaoId;
    if (id != null && `${id}`.length > 0) return String(id);
    return `name:${(item.name ?? item.nome ?? '').trim()}`;
  }

  onProfileSelectChange(rawId: string): void {
    const next = this.itens.find((item) => this.profileKey(item) === rawId);
    if (!next) return;
    this.selectProfile(next);
  }

  selectProfile(item: ApplicationRole): void {
    if (this.profileKey(item) === this.selectedProfileId()) return;
    if (this.dirty()) {
      const ok = window.confirm(
        'Você possui alterações não salvas. Descartar e trocar de perfil?'
      );
      if (!ok) {
        this.cdr.markForCheck();
        return;
      }
    }
    this.applyProfileSelection(item, { expandAll: false });
  }

  openNovo(): void {
    this.saveError.set(null);
    this.formName = '';
    this.modalKind.set('create');
    this.cdr.markForCheck();
  }

  openRenomear(): void {
    const profile = this.selectedProfile();
    if (!profile) return;
    this.saveError.set(null);
    this.formName = this.perfilDisplayName(profile);
    this.modalKind.set('rename');
    this.cdr.markForCheck();
  }

  openExcluir(): void {
    const profile = this.selectedProfile();
    if (!profile) return;
    this.modalKind.set('delete');
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.modalKind.set(null);
    this.saveError.set(null);
    this.formName = '';
    this.cdr.markForCheck();
  }

  confirmarModalNome(): void {
    const kind = this.modalKind();
    const nome = this.formName.trim();
    if (!nome) {
      this.saveError.set('Informe o nome do perfil.');
      return;
    }
    if (kind === 'create') {
      this.criarPerfil(nome);
      return;
    }
    if (kind === 'rename') {
      this.renomearPerfil(nome);
    }
  }

  confirmarExclusao(): void {
    const item = this.selectedProfile();
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
        this.selectedProfileId.set(null);
        this.dirty.set(false);
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
    return this.perfilDisplayName(this.selectedProfile());
  }

  isMenuExpanded(menuId: number): boolean {
    return this.expandedMenus().has(menuId);
  }

  toggleMenuExpanded(menuId: number): void {
    const next = new Set(this.expandedMenus());
    if (next.has(menuId)) next.delete(menuId);
    else next.add(menuId);
    this.expandedMenus.set(next);
  }

  expandirTodos(): void {
    this.expandedMenus.set(new Set(this.permissionTree().map((m) => m.menuId)));
  }

  recolherTodos(): void {
    this.expandedMenus.set(new Set());
  }

  selecionarTodos(): void {
    this.setTree(setAllPermissionsInTree(this.permissionTree(), true));
  }

  limparSelecao(): void {
    this.setTree(setAllPermissionsInTree(this.permissionTree(), false));
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  setAccessFilter(filter: AccessFilter): void {
    this.accessFilter.set(filter);
  }

  onMenuToggle(menuId: number, checked: boolean): void {
    this.setTree(toggleMenuSelection(this.permissionTree(), menuId, checked));
  }

  onMenuCheckboxChange(menuId: number, event: MatCheckboxChange): void {
    this.onMenuToggle(menuId, event.checked);
  }

  onSubMenuToggle(menuId: number, subMenuId: number, checked: boolean): void {
    this.setTree(toggleSubMenuSelection(this.permissionTree(), menuId, subMenuId, checked));
  }

  onSubMenuCheckboxChange(menuId: number, subMenuId: number, event: MatCheckboxChange): void {
    this.onSubMenuToggle(menuId, subMenuId, event.checked);
  }

  onPermissaoToggle(
    menuId: number,
    subMenuId: number,
    permissaoId: number,
    checked: boolean
  ): void {
    this.setTree(
      togglePermissaoSelection(this.permissionTree(), menuId, subMenuId, permissaoId, checked)
    );
  }

  onPermissaoCheckboxChange(
    menuId: number,
    subMenuId: number,
    permissaoId: number,
    event: MatCheckboxChange
  ): void {
    this.onPermissaoToggle(menuId, subMenuId, permissaoId, event.checked);
  }

  onActionColumnToggle(menuId: number, action: string, event: MatCheckboxChange): void {
    this.setTree(toggleActionColumnInMenu(this.permissionTree(), menuId, action, event.checked));
  }

  isMenuIndeterminate(menu: TreeMenuNode): boolean {
    const counts = countPermissionsInMenu(menu);
    return counts.selected > 0 && counts.selected < counts.total;
  }

  isSubMenuIndeterminate(subMenu: TreeSubMenuNode): boolean {
    const flat = this.flattenSubMenus([subMenu]);
    const total = flat.reduce((acc, node) => acc + node.permissoes.length, 0);
    if (total === 0) return false;
    const selected = flat.reduce(
      (acc, node) => acc + node.permissoes.filter((p) => p.selecionado).length,
      0
    );
    return selected > 0 && selected < total;
  }

  menuCounts(menu: TreeMenuNode): { total: number; selected: number } {
    return countPermissionsInMenu(menu);
  }

  isColumnChecked(menu: TreeMenuNode, action: string): boolean {
    return isActionColumnFullySelected(menu, action);
  }

  isColumnIndeterminate(menu: TreeMenuNode, action: string): boolean {
    return isActionColumnIndeterminate(menu, action);
  }

  permissionForAction(subMenu: TreeSubMenuNode, action: string): TreePermissaoNode | undefined {
    return findPermissionByAction(subMenu, action);
  }

  extraPermissions(subMenu: TreeSubMenuNode): TreePermissaoNode[] {
    return getExtraPermissions(subMenu);
  }

  extraActionColumns(menu: TreeMenuNode): string[] {
    const seen = new Set<string>();
    const extras: string[] = [];
    for (const sub of this.flattenSubMenus(menu.subMenus)) {
      for (const perm of getExtraPermissions(sub)) {
        const action = resolvePermissaoAcaoMeta(perm.key || perm.nome).action;
        if (!seen.has(action)) {
          seen.add(action);
          extras.push(action);
        }
      }
    }
    return extras;
  }

  resolveAcaoMeta(permissao: TreePermissaoNode): PermissaoAcaoMeta {
    return resolvePermissaoAcaoMeta(permissao.key || permissao.nome);
  }

  actionLabel(action: string): string {
    const known = (ACOES_PADRAO as readonly string[]).includes(action)
      ? this.acaoLabels[action as (typeof ACOES_PADRAO)[number]]
      : null;
    return known ?? resolvePermissaoAcaoMeta(action).label;
  }

  descartarAlteracoes(): void {
    const profile = this.selectedProfile();
    if (!profile) return;
    const ok = window.confirm('Descartar todas as alterações não salvas?');
    if (!ok) return;
    this.applyProfileSelection(profile, { expandAll: false });
  }

  salvarPermissoes(): void {
    const profile = this.selectedProfile();
    if (!profile) return;
    this.saveError.set(null);
    this.saving.set(true);
    this.cdr.markForCheck();

    const dto = this.toUpsertPayload(profile);
    this.perfisService.alterar(dto).subscribe({
      next: () => {
        const key = this.getProfileStoreKey(profile) ?? this.perfilDisplayName(profile);
        const selectedPermissionKeys = getSelectedPermissionKeys(this.permissionTree());
        if (key) {
          this.profilePermissionsStore.setProfilePermissions(key, selectedPermissionKeys);
        }
        this.syncPermissionCacheForCurrentUserProfile(this.perfilDisplayName(profile));
        this.syncSessionAccessFromBackendCatalog();
        this.toast.success('Permissões salvas com sucesso.');
        this.toast.warning(
          'Permissões atualizadas. Faça novo login para aplicar 100% das regras do token.'
        );
        this.saving.set(false);
        this.resetBaseline();
        this.carregar({ preferProfileId: this.profileKey(profile) });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(this.mensagemErroSalvarPerfil(err));
        this.toast.warning(this.saveError() ?? 'Erro ao salvar.');
        this.cdr.markForCheck();
      },
    });
  }

  trackPerfil(item: ApplicationRole): string {
    return this.profileKey(item);
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

  private applyProfileSelection(
    item: ApplicationRole,
    opts: { expandAll: boolean }
  ): void {
    const key = this.profileKey(item);
    this.selectedProfileId.set(key);
    this.writeLastProfileId(key);
    this.permissionTree.set(
      buildPermissionTreeState(
        this.backendMenuCatalog(),
        item.menus ?? null,
        item.permissionIds ?? []
      )
    );
    if (opts.expandAll || this.expandedMenus().size === 0) {
      this.expandirTodos();
    }
    this.resetBaseline();
    this.cdr.markForCheck();
  }

  private setTree(tree: TreeMenuNode[]): void {
    this.permissionTree.set(tree);
    this.recomputeDirty();
    this.cdr.markForCheck();
  }

  private resetBaseline(): void {
    const keys = this.snapshotKeys(this.permissionTree());
    this.baselineKeys.set(keys);
    this.dirty.set(false);
  }

  private recomputeDirty(): void {
    this.dirty.set(this.snapshotKeys(this.permissionTree()) !== this.baselineKeys());
  }

  private snapshotKeys(tree: TreeMenuNode[]): string {
    return JSON.stringify([...getSelectedPermissionKeys(tree)].sort());
  }

  private criarPerfil(nome: string): void {
    this.saving.set(true);
    this.cdr.markForCheck();
    const emptyTree = buildPermissionTreeState(this.backendMenuCatalog(), null, []);
    const dto: PerfilUpsertInput = {
      nome,
      menus: mapTreeToPerfilMenusPayload(emptyTree),
    };
    this.perfisService.gravar(dto).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.toast.success('Perfil criado com sucesso.');
        this.carregar({ preferName: nome });
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(this.mensagemErroSalvarPerfil(err));
        this.cdr.markForCheck();
      },
    });
  }

  private renomearPerfil(nome: string): void {
    const profile = this.selectedProfile();
    if (!profile) return;
    this.saving.set(true);
    this.cdr.markForCheck();
    const dto = this.toUpsertPayload(profile);
    dto.nome = nome;
    this.perfisService.alterar(dto).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.toast.success('Perfil renomeado.');
        this.carregar({ preferProfileId: this.profileKey(profile), preferName: nome });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(this.mensagemErroSalvarPerfil(err));
        this.cdr.markForCheck();
      },
    });
  }

  private filterMenuNode(
    menu: TreeMenuNode,
    query: string,
    filter: AccessFilter
  ): TreeMenuNode | null {
    const menuNameMatch = !query || menu.nome.toLowerCase().includes(query);
    const filteredSubs = menu.subMenus
      .map((sub) => this.filterSubMenuNode(sub, query, filter, menuNameMatch))
      .filter((sub): sub is TreeSubMenuNode => sub != null);

    if (filteredSubs.length === 0 && !menuNameMatch) return null;
    if (filteredSubs.length === 0 && menuNameMatch && query) {
      // Módulo bate na busca: mostra filhos filtrados só por accessFilter
      const byAccess = menu.subMenus
        .map((sub) => this.filterSubMenuNode(sub, '', filter, true))
        .filter((sub): sub is TreeSubMenuNode => sub != null);
      if (byAccess.length === 0 && filter !== 'all') return null;
      return { ...menu, subMenus: byAccess.length ? byAccess : menu.subMenus };
    }
    if (filteredSubs.length === 0 && filter !== 'all') return null;
    return { ...menu, subMenus: filteredSubs.length ? filteredSubs : menu.subMenus };
  }

  private filterSubMenuNode(
    subMenu: TreeSubMenuNode,
    query: string,
    filter: AccessFilter,
    ancestorMatched: boolean
  ): TreeSubMenuNode | null {
    const nameMatch = !query || subMenu.nome.toLowerCase().includes(query) || ancestorMatched;
    const hasSelected = subMenu.permissoes.some((p) => p.selecionado) || subMenu.selecionado;
    const accessOk =
      filter === 'all' ||
      (filter === 'allowed' && hasSelected) ||
      (filter === 'denied' && !hasSelected);

    const nested = (subMenu.subMenus ?? [])
      .map((child) => this.filterSubMenuNode(child, query, filter, nameMatch))
      .filter((child): child is TreeSubMenuNode => child != null);

    if (!nameMatch && nested.length === 0) return null;
    if (!accessOk && nested.length === 0) return null;

    return {
      ...subMenu,
      subMenus: nested.length ? nested : subMenu.subMenus,
    };
  }

  private flattenSubMenus(subMenus: TreeSubMenuNode[]): TreeSubMenuNode[] {
    const out: TreeSubMenuNode[] = [];
    const walk = (items: TreeSubMenuNode[]) => {
      for (const item of items) {
        out.push(item);
        if (item.subMenus?.length) walk(item.subMenus);
      }
    };
    walk(subMenus);
    return out;
  }

  private toUpsertPayload(editingItem: ApplicationRole | null): PerfilUpsertInput {
    const nome =
      (editingItem ? this.perfilDisplayName(editingItem) : this.formName.trim()) || null;
    const dto: PerfilUpsertInput = {
      nome: nome === '—' ? null : nome,
      menus: mapTreeToPerfilMenusPayload(this.permissionTree()),
    };
    const id = this.toOptionalNumber(editingItem?.id ?? editingItem?.perfilId);
    if (id != null && id > 0) {
      dto.id = id;
    }
    return dto;
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

  private readLastProfileId(): string | null {
    try {
      return localStorage.getItem(LAST_PROFILE_KEY);
    } catch {
      return null;
    }
  }

  private writeLastProfileId(id: string): void {
    try {
      localStorage.setItem(LAST_PROFILE_KEY, id);
    } catch {
      /* ignore */
    }
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
    const id = this.readId(raw, 'id', 'permissaoId', 'perfilId', 'roleId');
    const nome = this.readString(raw, 'nome', 'name', 'permissao', 'perfil');
    return {
      id,
      permissaoId: this.readId(raw, 'permissaoId', 'id', 'perfilId'),
      perfilId: this.readId(raw, 'perfilId', 'permissaoId', 'id'),
      permissao: this.readString(raw, 'permissao', 'nome', 'name', 'perfil'),
      perfil: this.readString(raw, 'perfil', 'permissao', 'nome', 'name'),
      name: this.readString(raw, 'name', 'nome', 'permissao', 'perfil'),
      nome,
      normalizedName: this.readString(raw, 'normalizedName', 'descricao'),
      concurrencyStamp: this.readString(raw, 'concurrencyStamp'),
      menus,
      permissionIds,
      ativo: this.readProfileAtivoFlag(raw),
      usuariosVinculados: this.readOptionalUserCount(raw),
      ultimaAtualizacao: this.readOptionalDateString(raw),
    };
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

}
