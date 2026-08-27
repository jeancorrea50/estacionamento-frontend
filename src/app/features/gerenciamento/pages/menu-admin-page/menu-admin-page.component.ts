import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { finalize, firstValueFrom } from 'rxjs';
import type { ApiError } from '../../../../core/api/models/api-error.model';
import { ToastService } from '../../../../core/api/services/toast.service';
import { MenuAdminService } from '../../services/menu-admin.service';
import { MenuApiService } from '../../services/menu-api.service';
import type { MenuCreateInput } from '../../services/menu-api.types';
import {
  computeNextIdFromMenus,
  mapBuscarResponseToMenuAdmins,
  menuAdminToUpdateInput,
} from '../../services/menu-api.mapper';
import {
  MenuAdmin,
  MenuPermissionRow,
  PERMISSOES_ACOES,
  SubMenuAdmin,
} from '../../models/menu-admin.model';
import {
  buildFullAcaoPermissao,
  hasMatchingPermissionAcao,
  permissionRowMatchesUi,
  slugSubModuloNome,
} from '../../services/menu-permission-acao';
import {
  defaultExibirNoSidebar,
  rememberSidebarVisibility,
} from '../../services/menu-sidebar-visibility';

@Component({
  selector: 'app-menu-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './menu-admin-page.component.html',
  styleUrls: ['./menu-admin-page.component.scss'],
})
export class MenuAdminPageComponent implements OnInit {
  protected readonly admin = inject(MenuAdminService);
  private readonly menuApi = inject(MenuApiService);
  private readonly toast = inject(ToastService);
  protected readonly acoes = PERMISSOES_ACOES;

  /** Carregamento inicial da lista (GET Buscar). */
  protected readonly carregandoLista = signal(false);
  protected readonly erroLista = signal<string | null>(null);

  /** Sincronização com API Menu (Gravar / Alterar / Delete). */
  protected readonly salvandoNoBackend = signal(false);

  /** Modal Novo/Editar menu — POST Gravar / PUT Alterar. */
  protected readonly salvandoMenuModal = signal(false);
  /** Modal de submenu em salvamento (PUT Alterar). */
  protected readonly salvandoSubModal = signal(false);
  /** DELETE em andamento para menu/submenu. */
  protected readonly excluindoKey = signal<string | null>(null);

  ngOnInit(): void {
    this.carregarMenusDoBackend();
  }

  /** Recarrega a grid a partir do servidor (mesmo contrato do Salvar após OrganizarMenus). */
  protected carregarMenusDoBackend(): void {
    if (this.carregandoLista()) return;
    this.carregandoLista.set(true);
    this.erroLista.set(null);
    this.menuApi
      .buscar()
      .pipe(finalize(() => this.carregandoLista.set(false)))
      .subscribe({
        next: (raw) => this.applyBuscarPayload(raw),
        error: (err: unknown) => {
          const apiMsg = this.apiErrorMessage(
            err,
            'Não foi possível carregar os menus do servidor.'
          );
          this.erroLista.set(apiMsg);
          // Mensagem já exibida pelo errorInterceptor (toast).
        },
      });
  }

  private applyBuscarPayload(raw: unknown): void {
    const menus = mapBuscarResponseToMenuAdmins(raw);
    const nextId = computeNextIdFromMenus(menus);
    this.admin.replaceMenusHidratar(menus, nextId);
  }

  /** Atualiza lista após Gravar/Alterar sem bloquear a tela com o spinner inicial. */
  private refreshMenusAfterMutation(): void {
    this.menuApi.buscar().subscribe({
      next: (raw) => this.applyBuscarPayload(raw),
      // Falha no Buscar: toast já exibido pelo errorInterceptor.
    });
  }

  /** Erro vindo do `errorInterceptor` é `ApiError` com `message` na raiz. */
  private apiErrorMessage(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'message' in err) {
      const m = (err as ApiError).message;
      if (typeof m === 'string' && m.trim()) return m.trim();
    }
    const e = err as { error?: { message?: string } | string; message?: string };
    return typeof e?.error === 'string'
      ? e.error
      : e?.error?.message ?? e?.message ?? fallback;
  }

  /** IDs das listas de submenu — conecta arrastar entre menus diferentes (OrganizarMenus no Salvar). */
  protected submenuDropListConnections(): string[] {
    return this.admin.menus().map((m) => `submenu-drop-${m.id}`);
  }

  /** Accordion: menus expandidos */
  protected readonly expandedMenuIds = signal<Set<number>>(new Set());

  /** Modal menu */
  protected readonly menuModalOpen = signal(false);
  protected readonly menuEditId = signal<number | null>(null);
  protected menuFormNome = '';
  protected menuFormIcon = '';
  protected menuFormRota = '';
  protected menuFormAtivo = true;
  protected menuFormExibirNoSidebar = true;

  /** Modal submenu */
  protected readonly subModalOpen = signal(false);
  protected readonly subModalMenuId = signal<number | null>(null);
  protected readonly subEditId = signal<number | null>(null);
  protected subFormNome = '';
  protected subFormRota = '';
  protected subFormAtivo = true;
  protected subFormExibirNoSidebar = true;
  protected subFormRotaManualOverride = false;
  protected subFormPermissoesSelecionadas: string[] = [];
  protected subFormPermissoesCustomizadas: string[] = [];
  protected novaPermissaoCustom = '';
  private subPermissoesOriginais: MenuPermissionRow[] = [];

  protected toggleExpand(menuId: number): void {
    this.expandedMenuIds.update((set) => {
      const n = new Set(set);
      if (n.has(menuId)) n.delete(menuId);
      else n.add(menuId);
      return n;
    });
  }

  protected isExpanded(menuId: number): boolean {
    return this.expandedMenuIds().has(menuId);
  }

  // ——— Menu modal ———
  protected openNovoMenu(): void {
    this.menuEditId.set(null);
    this.menuFormNome = '';
    this.menuFormIcon = 'menu';
    this.menuFormRota = '';
    this.menuFormAtivo = true;
    this.menuFormExibirNoSidebar = true;
    this.menuModalOpen.set(true);
  }

  protected openEditMenu(m: MenuAdmin): void {
    this.menuEditId.set(m.id);
    this.menuFormNome = m.nome;
    this.menuFormIcon = m.icone;
    this.menuFormRota = m.rota ?? '';
    this.menuFormAtivo = m.ativo;
    this.menuFormExibirNoSidebar = m.exibirNoSidebar !== false;
    this.menuModalOpen.set(true);
  }

  /** Normaliza rota do menu-módulo (`/app/...`). */
  private normalizeMenuModuleRoute(raw: string, nomeFallback: string): string {
    const route = raw.trim();
    if (!route) {
      const seg = this.slugifyRouteSegment(nomeFallback);
      return seg ? `/app/${seg}` : '/app';
    }
    if (route.startsWith('/app/')) return route.replace(/\/+$/, '') || '/app';
    if (route.startsWith('/')) return `/app${route}`.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    return `/app/${route}`.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  }

  protected salvarMenu(): void {
    const nome = this.menuFormNome.trim();
    if (!nome) return;
    if (this.salvandoMenuModal()) return;
    const id = this.menuEditId();
    const icone = this.menuFormIcon.trim() || 'menu';
    const rota = this.normalizeMenuModuleRoute(this.menuFormRota, nome);

    if (id == null) {
      const dto: MenuCreateInput = {
        id: 0,
        nome,
        descricao: nome,
        ordem: this.admin.menus().length,
        rota,
        ativo: true,
        exibirNoSidebar: this.menuFormExibirNoSidebar,
        mostrarSidebar: this.menuFormExibirNoSidebar,
        subMenus: null,
      };
      this.salvandoMenuModal.set(true);
      this.menuApi
        .gravar(dto)
        .pipe(finalize(() => this.salvandoMenuModal.set(false)))
        .subscribe({
          next: () => {
            this.menuModalOpen.set(false);
            this.toast.success('Menu criado no servidor.');
            this.refreshMenusAfterMutation();
          },
          // Erro: toast do errorInterceptor.
        });
      return;
    }

    const m = this.admin.getSnapshot().menus.find((x) => x.id === id);
    if (!m) return;

    /** Id temporário/local (sem registro no servidor): só estado local. */
    if (id <= 0) {
      this.admin.updateMenu(id, {
        nome,
        icone,
        rota,
        ativo: this.menuFormAtivo,
        exibirNoSidebar: this.menuFormExibirNoSidebar,
      });
      this.menuModalOpen.set(false);
      return;
    }

    /** Qualquer menu com id vindo do Buscar deve usar PUT Alterar (nome, ícone, rota, ativo, submenus). */
    const atualizado: MenuAdmin = {
      ...m,
      nome,
      icone,
      rota,
      ativo: this.menuFormAtivo,
      exibirNoSidebar: this.menuFormExibirNoSidebar,
    };
    rememberSidebarVisibility('menu', id, this.menuFormExibirNoSidebar);
    this.salvandoMenuModal.set(true);
    this.menuApi
      .alterar(menuAdminToUpdateInput(atualizado))
      .pipe(finalize(() => this.salvandoMenuModal.set(false)))
      .subscribe({
        next: () => {
          // Mantém preferência local mesmo se o backend ainda não gravar o campo.
          this.admin.updateMenu(id, {
            nome,
            icone,
            rota,
            ativo: this.menuFormAtivo,
            exibirNoSidebar: this.menuFormExibirNoSidebar,
          });
          this.menuModalOpen.set(false);
          this.toast.success('Menu atualizado no servidor.');
          this.refreshMenusAfterMutation();
        },
        // Erro: toast do errorInterceptor.
      });
  }

  protected isExcluindoMenu(menuId: number): boolean {
    return this.excluindoKey() === `menu:${menuId}`;
  }

  protected isExcluindoSub(subId: number): boolean {
    return this.excluindoKey() === `sub:${subId}`;
  }

  protected excluirMenu(m: MenuAdmin): void {
    if (this.isExcluindoMenu(m.id)) return;
    if (!confirm(`Excluir o menu "${m.nome}" e todos os submenus?`)) return;
    if (m.id <= 0) {
      this.admin.deleteMenu(m.id);
      this.toast.success('Menu removido.');
      return;
    }

    this.excluindoKey.set(`menu:${m.id}`);
    this.menuApi
      .delete(m.id)
      .pipe(finalize(() => this.excluindoKey.set(null)))
      .subscribe({
        next: () => {
          this.toast.success('Menu excluído no servidor.');
          this.refreshMenusAfterMutation();
        },
        // Erro: toast já exibido pelo errorInterceptor.
      });
  }

  protected onMenuDrop(e: CdkDragDrop<MenuAdmin[]>): void {
    this.admin.onMenuDrop(e);
  }

  // ——— Submenu modal ———
  protected openNovoSubmenu(menuId: number): void {
    this.subModalMenuId.set(menuId);
    this.subEditId.set(null);
    this.subFormNome = '';
    this.subFormRota = this.buildSubmenuBaseRoute(menuId);
    this.subFormAtivo = true;
    this.subFormExibirNoSidebar = defaultExibirNoSidebar(this.subFormRota);
    this.subFormRotaManualOverride = false;
    this.subFormPermissoesSelecionadas = [];
    this.subFormPermissoesCustomizadas = [];
    this.novaPermissaoCustom = '';
    this.subPermissoesOriginais = [];
    this.subModalOpen.set(true);
  }

  protected openEditSub(menuId: number, s: SubMenuAdmin): void {
    this.subModalMenuId.set(menuId);
    this.subEditId.set(s.id);
    this.subFormNome = s.nome;
    this.subFormRota = s.rota;
    this.subFormAtivo = s.ativo;
    this.subFormExibirNoSidebar = s.exibirNoSidebar !== false;
    this.subFormRotaManualOverride = false;
    this.subPermissoesOriginais = s.permissions.map((p) => ({ ...p }));
    this.subFormPermissoesSelecionadas = this.acoes.filter((acao) =>
      hasMatchingPermissionAcao(s.permissions, s.nome, acao)
    ) as string[];
    this.subFormPermissoesCustomizadas = s.permissions
      .map((p) => (p.acao ?? '').trim())
      .filter((acao) => !!acao)
      .filter((acao) => !this.isPermissaoPadraoMapeada(s.nome, acao));
    this.novaPermissaoCustom = '';
    this.subModalOpen.set(true);
  }

  protected isPermissaoSubSelecionada(acao: string): boolean {
    return this.subFormPermissoesSelecionadas.includes(acao);
  }

  protected togglePermissaoSub(acao: string, enabled: boolean): void {
    const current = new Set(this.subFormPermissoesSelecionadas);
    if (enabled) current.add(acao);
    else current.delete(acao);
    this.subFormPermissoesSelecionadas = this.acoes.filter((a) => current.has(a)) as string[];
  }

  protected selecionarTodasPermissoesSub(): void {
    this.subFormPermissoesSelecionadas = [...this.acoes];
  }

  protected limparPermissoesSub(): void {
    this.subFormPermissoesSelecionadas = [];
    this.subFormPermissoesCustomizadas = [];
    this.novaPermissaoCustom = '';
  }

  protected adicionarPermissaoCustomizada(): void {
    const normalized = this.normalizeCustomPermission(this.subFormNome, this.novaPermissaoCustom);
    if (!normalized) return;
    if (
      this.subFormPermissoesCustomizadas.some(
        (p) => this.normalizePermissionToken(p) === this.normalizePermissionToken(normalized)
      )
    ) {
      this.toast.show('Permissão já adicionada.', 'info');
      return;
    }
    this.subFormPermissoesCustomizadas = [...this.subFormPermissoesCustomizadas, normalized];
    this.novaPermissaoCustom = '';
  }

  protected removerPermissaoCustomizada(index: number): void {
    this.subFormPermissoesCustomizadas = this.subFormPermissoesCustomizadas.filter(
      (_p, i) => i !== index
    );
  }

  protected togglePermissaoCustomizada(perm: string, enabled: boolean): void {
    const key = this.normalizePermissionToken(perm);
    if (enabled) {
      if (
        this.subFormPermissoesCustomizadas.some(
          (p) => this.normalizePermissionToken(p) === key
        )
      ) {
        return;
      }
      this.subFormPermissoesCustomizadas = [...this.subFormPermissoesCustomizadas, perm];
      return;
    }
    this.subFormPermissoesCustomizadas = this.subFormPermissoesCustomizadas.filter(
      (p) => this.normalizePermissionToken(p) !== key
    );
  }

  protected openNovaPermissaoNoMenu(menuId: number): void {
    const menu = this.admin.getSnapshot().menus.find((m) => m.id === menuId);
    if (!menu || menu.subMenus.length === 0) {
      this.toast.show('Crie um submenu antes de adicionar permissões.', 'info');
      return;
    }
    if (menu.subMenus.length === 1) {
      this.openEditSub(menuId, menu.subMenus[0]);
      return;
    }
    this.toast.show(
      'Selecione um submenu e clique no lápis para criar/editar permissões.',
      'info'
    );
  }

  protected formatPermissoesResumo(sub: SubMenuAdmin): string {
    if (!sub.permissions?.length) return 'Sem permissões';
    return sub.permissions.map((p) => p.acao).filter(Boolean).join(', ');
  }

  private isPermissaoPadraoMapeada(subNome: string, acao: string): boolean {
    return this.acoes.some((uiAcao) =>
      permissionRowMatchesUi(
        { id: 0, ordem: 0, subModuleId: 0, acao },
        subNome,
        uiAcao
      )
    );
  }

  private normalizePermissionToken(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeCustomPermission(subNome: string, raw: string): string {
    const token = raw.trim().toLowerCase().replace(/\s+/g, '');
    if (!token) return '';
    if (token.includes('.')) return token;
    const prefix = slugSubModuloNome(subNome || 'submenu');
    return `${prefix}.${token}`;
  }

  private buildPermissionRowsForSubmenu(
    subId: number,
    subNome: string,
    selectedAcoes: string[],
    selectedCustomPermissions: string[],
    existingRows: MenuPermissionRow[]
  ): MenuPermissionRow[] {
    const rows: MenuPermissionRow[] = [];
    for (const acao of selectedAcoes) {
      const current = existingRows.find((row) => permissionRowMatchesUi(row, subNome, acao));
      rows.push({
        id: current?.id ?? 0,
        ordem: rows.length,
        subModuleId: subId,
        acao: buildFullAcaoPermissao(subNome, acao),
      });
    }

    for (const rawCustom of selectedCustomPermissions) {
      const acao = this.normalizeCustomPermission(subNome, rawCustom);
      if (!acao) continue;
      const current = existingRows.find(
        (row) => this.normalizePermissionToken(row.acao) === this.normalizePermissionToken(acao)
      );
      rows.push({
        id: current?.id ?? 0,
        ordem: rows.length,
        subModuleId: subId,
        acao,
      });
    }
    return rows;
  }

  private collectRemovedPermissionIds(
    previous: MenuPermissionRow[],
    current: MenuPermissionRow[]
  ): number[] {
    const currentIds = new Set(current.filter((p) => p.id > 0).map((p) => p.id));
    return previous
      .filter((p) => p.id > 0 && !currentIds.has(p.id))
      .map((p) => p.id);
  }

  private async deleteRemovedPermissions(ids: number[]): Promise<void> {
    for (const id of ids) {
      await firstValueFrom(this.menuApi.deletePermissao(id));
    }
  }

  private hasUpdatedExistingPermissions(
    previous: MenuPermissionRow[],
    current: MenuPermissionRow[]
  ): boolean {
    const currentById = new Map(current.filter((p) => p.id > 0).map((p) => [p.id, p]));
    for (const oldRow of previous) {
      if (oldRow.id <= 0) continue;
      const next = currentById.get(oldRow.id);
      if (!next) continue;
      if (this.normalizePermissionToken(oldRow.acao) !== this.normalizePermissionToken(next.acao)) {
        return true;
      }
      if ((oldRow.ordem ?? 0) !== (next.ordem ?? 0)) {
        return true;
      }
    }
    return false;
  }

  private slugifyRouteSegment(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private buildSubmenuRoute(menuId: number, nome: string): string {
    const base = this.buildSubmenuBaseRoute(menuId).replace(/\/+$/, '');
    const subSeg = this.slugifyRouteSegment(nome) || 'submenu';
    return `${base}/${subSeg}`.replace(/\/{2,}/g, '/');
  }

  private buildSubmenuBaseRoute(menuId: number): string {
    const snap = this.admin.getSnapshot();
    const menu = snap.menus.find((x) => x.id === menuId);
    const menuRota = menu?.rota?.trim();
    const firstSubRoute = menu?.subMenus.find((s) => s.rota?.startsWith('/app/'))?.rota ?? '';
    let base = '/app';
    if (firstSubRoute) {
      const idx = firstSubRoute.lastIndexOf('/');
      base = idx > 0 ? firstSubRoute.slice(0, idx) : '/app';
    } else if (menuRota && menuRota.startsWith('/app')) {
      base = menuRota.replace(/\/+$/, '');
    } else if (menu?.nome) {
      const menuSeg = this.slugifyRouteSegment(menu.nome);
      if (menuSeg) base = `/app/${menuSeg}`;
    }
    return `${base}/`.replace(/\/{2,}/g, '/');
  }

  /** Novo submenu: rota final segue automaticamente o nome digitado. */
  protected onNovoSubmenuNomeChange(value: string): void {
    const menuId = this.subModalMenuId();
    if (menuId == null) return;
    if (this.subFormRotaManualOverride) return;
    const nome = value.trim();
    this.subFormRota = nome
      ? this.buildSubmenuRoute(menuId, nome)
      : this.buildSubmenuBaseRoute(menuId);
  }

  protected onSubmenuRotaChange(_value: string): void {
    this.subFormRotaManualOverride = true;
    if (this.subEditId() === null) {
      this.subFormExibirNoSidebar = defaultExibirNoSidebar(this.subFormRota);
    }
  }

  private normalizeSubRoute(rawRoute: string, menuId: number, nome: string): string {
    const route = rawRoute.trim();
    if (!route) return this.buildSubmenuRoute(menuId, nome);
    if (route.startsWith('/app/')) return route;
    if (route.startsWith('/')) return `/app${route}`.replace(/\/{2,}/g, '/');
    return `/app/${route}`.replace(/\/{2,}/g, '/');
  }

  /**
   * Criação de submenu em menu já existente:
   * backend atualizado passou a aceitar melhor via POST Gravar.
   */
  private buildGravarPayloadFromMenu(menu: MenuAdmin): MenuCreateInput {
    return {
      id: menu.id > 0 ? menu.id : 0,
      nome: menu.nome,
      descricao: menu.nome,
      ordem: menu.ordem,
      rota: menu.rota?.trim() ? menu.rota.trim() : undefined,
      ativo: menu.ativo,
      exibirNoSidebar: menu.exibirNoSidebar !== false,
      mostrarSidebar: menu.exibirNoSidebar !== false,
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

  protected salvarSub(): void {
    if (this.salvandoSubModal()) return;
    const menuId = this.subModalMenuId();
    if (menuId == null) return;
    const nome = this.subFormNome.trim();
    if (!nome) return;
    const rota = this.normalizeSubRoute(this.subFormRota, menuId, nome);
    const sid = this.subEditId();
    if (sid == null) {
      const snap = this.admin.getSnapshot();
      const menu = snap.menus.find((x) => x.id === menuId);
      if (!menu) return;

      if (menuId > 0) {
        const novoSub: SubMenuAdmin = {
          id: 0,
          nome,
          ordem: menu.subMenus.length,
          rota,
          ativo: this.subFormAtivo,
          exibirNoSidebar: this.subFormExibirNoSidebar,
          permissions: this.buildPermissionRowsForSubmenu(
            0,
            nome,
            this.subFormPermissoesSelecionadas,
            this.subFormPermissoesCustomizadas,
            []
          ),
        };
        const menuComNovoSub: MenuAdmin = { ...menu, subMenus: [...menu.subMenus, novoSub] };
        const payload = this.buildGravarPayloadFromMenu(menuComNovoSub);
        this.salvandoSubModal.set(true);
        this.menuApi
          .gravar(payload)
          .pipe(finalize(() => this.salvandoSubModal.set(false)))
          .subscribe({
            next: () => {
              this.subModalOpen.set(false);
              this.toast.success('Submenu criado e publicado no servidor.');
              this.refreshMenusAfterMutation();
            },
            // Erro: toast do errorInterceptor.
          });
        return;
      }

      this.admin.addSubMenu(menuId, nome, rota);
      const subs = this.admin.getSnapshot().menus.find((x) => x.id === menuId)?.subMenus ?? [];
      const created = subs.length > 0 ? subs[subs.length - 1] : undefined;
      if (created) {
        this.admin.setSubMenuPermissions(
          menuId,
          created.id,
          this.buildPermissionRowsForSubmenu(
            created.id,
            nome,
            this.subFormPermissoesSelecionadas,
            this.subFormPermissoesCustomizadas,
            []
          )
        );
        this.admin.updateSubMenu(menuId, created.id, {
          ativo: this.subFormAtivo,
          exibirNoSidebar: this.subFormExibirNoSidebar,
        });
      }
      this.subModalOpen.set(false);
      return;
    }

    const snap = this.admin.getSnapshot();
    const menu = snap.menus.find((x) => x.id === menuId);
    if (!menu) return;
    const subOriginal = menu.subMenus.find((s) => s.id === sid);
    if (!subOriginal) return;

    const atualizado: MenuAdmin = {
      ...menu,
      subMenus: menu.subMenus.map((s) =>
        s.id === sid
          ? {
              ...s,
              nome,
              rota,
              ativo: this.subFormAtivo,
              exibirNoSidebar: this.subFormExibirNoSidebar,
              permissions: this.buildPermissionRowsForSubmenu(
                sid,
                nome,
                this.subFormPermissoesSelecionadas,
                this.subFormPermissoesCustomizadas,
                this.subPermissoesOriginais
              ),
            }
          : s
      ),
    };

    if (menuId <= 0 || sid <= 0) {
      this.admin.updateSubMenu(menuId, sid, {
        nome,
        rota,
        ativo: this.subFormAtivo,
        exibirNoSidebar: this.subFormExibirNoSidebar,
      });
      this.subModalOpen.set(false);
      return;
    }

    const nextPermissions =
      atualizado.subMenus.find((s) => s.id === sid)?.permissions ?? [];
    const addedPermissions = nextPermissions.filter((p) => p.id <= 0);
    const removedPermissionIds = this.collectRemovedPermissionIds(
      this.subPermissoesOriginais,
      nextPermissions
    );
    const updatedExistingPermissions = this.hasUpdatedExistingPermissions(
      this.subPermissoesOriginais,
      nextPermissions
    );
    const hasMetaChanges =
      subOriginal.nome !== nome ||
      subOriginal.rota !== rota ||
      subOriginal.ativo !== this.subFormAtivo ||
      subOriginal.exibirNoSidebar !== this.subFormExibirNoSidebar;
    const includePermissionsInAlterar =
      addedPermissions.length > 0 || updatedExistingPermissions;
    const hasPermissionChanges =
      includePermissionsInAlterar || removedPermissionIds.length > 0;

    if (!hasMetaChanges && !hasPermissionChanges) {
      this.subModalOpen.set(false);
      this.toast.show('Nenhuma alteração para salvar.', 'info');
      return;
    }

    rememberSidebarVisibility('sub', sid, this.subFormExibirNoSidebar);

    // Edição de submenu existente: sempre PUT Alterar (nunca POST Gravar).
    this.salvandoSubModal.set(true);
    this.deleteRemovedPermissions(removedPermissionIds)
      .then(() =>
        hasMetaChanges || includePermissionsInAlterar
          ? firstValueFrom(
              this.menuApi.alterar(
                menuAdminToUpdateInput(atualizado, {
                  includePermissions: includePermissionsInAlterar,
                  permissionSubMenuId: sid,
                })
              )
            )
          : Promise.resolve()
      )
      .then(() => {
        this.subModalOpen.set(false);
        this.toast.success('Submenu/permissões atualizados no servidor.');
        this.refreshMenusAfterMutation();
      })
      .catch(() => {
        // Erro: toast do errorInterceptor.
      })
      .finally(() => this.salvandoSubModal.set(false));
  }

  protected excluirSub(menuId: number, s: SubMenuAdmin): void {
    if (this.isExcluindoSub(s.id)) return;
    if (!confirm(`Excluir o submenu "${s.nome}"?`)) return;
    if (s.id <= 0) {
      this.admin.deleteSubMenu(menuId, s.id);
      this.toast.success('Submenu removido.');
      return;
    }

    this.excluindoKey.set(`sub:${s.id}`);
    this.menuApi
      .deleteSubMenu(s.id)
      .pipe(finalize(() => this.excluindoKey.set(null)))
      .subscribe({
        next: () => {
          this.toast.success('Submenu excluído no servidor.');
          this.refreshMenusAfterMutation();
        },
        // Erro: toast já exibido pelo errorInterceptor.
      });
  }

  protected onSubDrop(menuId: number, e: CdkDragDrop<SubMenuAdmin[]>): void {
    this.admin.onSubMenuDrop(menuId, e);
  }

  protected salvarNoBackend(): void {
    if (this.salvandoNoBackend()) return;
    this.salvandoNoBackend.set(true);
    this.menuApi
      .salvarAlteracoesNoBackend()
      .pipe(finalize(() => this.salvandoNoBackend.set(false)))
      .subscribe({
        next: () => this.toast.success('Ordem dos menus e submenus salva no servidor.'),
        // Erro: toast já exibido pelo errorInterceptor.
      });
  }
}
