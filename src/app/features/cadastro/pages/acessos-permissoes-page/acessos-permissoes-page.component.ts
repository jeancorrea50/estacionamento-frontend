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
import {
  MENU_STRUCTURE,
  MenuNode,
  MenuSubItem,
} from '../../constants/menu-structure';
import { MenuPermissionsStoreService } from '../../services/menu-permissions-store.service';
import {
  PERMISSION_MODULES,
  PERMISSION_CATALOG,
  type PermissionModule,
} from '../../constants/permission-catalog';

@Component({
  selector: 'app-acessos-permissoes-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './acessos-permissoes-page.component.html',
  styleUrls: ['./acessos-permissoes-page.component.scss'],
})
export class AcessosPermissoesPageComponent implements OnInit {
  private normalizePermissionKey(value: string): string {
    return String(value ?? '').trim().toLowerCase();
  }
  private menuPermissionsStore = inject(MenuPermissionsStoreService);
  private cdr = inject(ChangeDetectorRef);

  readonly menuStructure = MENU_STRUCTURE;
  readonly PERMISSION_MODULES = PERMISSION_MODULES;
  readonly PERMISSION_CATALOG = PERMISSION_CATALOG;

  /** Nó em edição no modal (id) e permissões selecionadas. */
  editingNodeId = signal<string | null>(null);
  formPermissionIds = signal<string[]>([]);
  permissionSearchTerm = signal('');
  expandedModules = signal<PermissionModule[]>([]);

  filteredPermissionsByModule = computed(() => {
    const term = this.permissionSearchTerm().trim().toLowerCase();
    const result: { module: PermissionModule; keys: string[] }[] = [];
    for (const mod of PERMISSION_MODULES) {
      const keys = (PERMISSION_CATALOG[mod] ?? []).filter((key) =>
        term ? key.toLowerCase().includes(term) : true
      );
      if (keys.length) result.push({ module: mod, keys });
    }
    return result;
  });

  selectedCount = computed(() => this.formPermissionIds().length);
  isModalOpen = computed(() => this.editingNodeId() !== null);

  /** Modal Nova permissão — layout lista por menu + submenus (como Permissões do Perfil) */
  novaPermissaoOpen = signal(false);
  novaSelectedSubIds = signal<string[]>([]);
  novaExpandedMenuIds = signal<string[]>([]);
  novaMenuFilterTerm = signal('');

  /** Menus filtrados pelo termo (nome do menu ou de algum submenu/neto). */
  filteredMenusForNova = computed(() => {
    const term = this.novaMenuFilterTerm().trim().toLowerCase();
    if (!term) return MENU_STRUCTURE;
    return MENU_STRUCTURE.filter((node) => {
      if (node.label.toLowerCase().includes(term)) return true;
      return this.flattenSubItems(node.children).some((c) =>
        c.label.toLowerCase().includes(term)
      );
    });
  });

  novaSelectedCount = computed(() => this.novaSelectedSubIds().length);

  ngOnInit(): void {
    this.cdr.markForCheck();
  }

  getPermissionsForNode(nodeId: string): string[] {
    return this.menuPermissionsStore.getPermissions(nodeId);
  }

  getNodeLabel(node: MenuNode, sub?: MenuSubItem): string {
    return sub ? sub.label : node.label;
  }

  openVincular(nodeId: string): void {
    this.editingNodeId.set(nodeId);
    this.formPermissionIds.set([...this.menuPermissionsStore.getPermissions(nodeId)]);
    this.permissionSearchTerm.set('');
    this.expandedModules.set([]);
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.editingNodeId.set(null);
    this.cdr.markForCheck();
  }

  togglePermission(key: string): void {
    const current = this.formPermissionIds();
    const cmp = this.normalizePermissionKey(key);
    const idx = current.findIndex((k) => this.normalizePermissionKey(k) === cmp);
    if (idx >= 0) {
      this.formPermissionIds.set(current.filter((k) => this.normalizePermissionKey(k) !== cmp));
    } else {
      this.formPermissionIds.set([...current, key]);
    }
    this.cdr.markForCheck();
  }

  toggleModuleExpanded(module: PermissionModule): void {
    const current = this.expandedModules();
    const idx = current.indexOf(module);
    if (idx >= 0) {
      this.expandedModules.set(current.filter((m) => m !== module));
    } else {
      this.expandedModules.set([...current, module]);
    }
    this.cdr.markForCheck();
  }

  isModuleExpanded(module: PermissionModule): boolean {
    return this.expandedModules().includes(module);
  }

  getSelectedCountInModule(module: PermissionModule): number {
    const keys = PERMISSION_CATALOG[module] ?? [];
    const selected = this.formPermissionIds().map((k) => this.normalizePermissionKey(k));
    return keys.filter((k) => selected.includes(this.normalizePermissionKey(k))).length;
  }

  salvarVinculos(): void {
    const nodeId = this.editingNodeId();
    if (!nodeId) return;
    this.menuPermissionsStore.setPermissions(nodeId, this.formPermissionIds());
    this.closeModal();
    this.cdr.markForCheck();
  }

  getEditingNodeLabel(): string {
    const id = this.editingNodeId();
    if (!id) return '';
    for (const node of MENU_STRUCTURE) {
      if (node.id === id) return node.label;
      const hit = this.flattenSubItems(node.children).find((s) => s.id === id);
      if (hit) return hit.label;
    }
    return id;
  }

  abrirNovaPermissao(): void {
    this.novaSelectedSubIds.set([]);
    this.novaExpandedMenuIds.set([]);
    this.novaMenuFilterTerm.set('');
    this.novaPermissaoOpen.set(true);
    this.cdr.markForCheck();
  }

  fecharNovaPermissao(): void {
    this.novaPermissaoOpen.set(false);
    this.cdr.markForCheck();
  }

  /**
   * Itens selecionáveis do menu (inclui 2º nível: Convites/Relatório sob Transportadora).
   * Sem filhos: o próprio menu.
   */
  submenuItems(node: MenuNode): { id: string; label: string }[] {
    const flat = this.flattenSubItems(node.children);
    if (flat.length) return flat;
    return [{ id: node.id, label: node.label }];
  }

  /** Achata submenus + netos para listagem/vínculo de permissões. */
  flattenSubItems(
    children: MenuSubItem[] | undefined,
    parentLabel?: string
  ): { id: string; label: string }[] {
    const out: { id: string; label: string }[] = [];
    for (const sub of children ?? []) {
      const label = parentLabel ? `${parentLabel} › ${sub.label}` : sub.label;
      if (sub.children?.length) {
        // Pai com filhos também entra (ex.: Transportadora / Faturamento).
        out.push({ id: sub.id, label: parentLabel ? label : sub.label });
        out.push(...this.flattenSubItems(sub.children, sub.label));
      } else {
        out.push({ id: sub.id, label });
      }
    }
    return out;
  }

  /** Linhas da tabela principal (menu + módulo/submenu, incluindo netos). */
  permissionTableRows(): { menu: MenuNode; sub: MenuSubItem; label: string }[] {
    const rows: { menu: MenuNode; sub: MenuSubItem; label: string }[] = [];
    for (const node of MENU_STRUCTURE) {
      if (!node.children?.length) {
        continue;
      }
      for (const item of this.flattenSubItems(node.children)) {
        const sub = this.findSubById(node.children, item.id);
        if (sub) rows.push({ menu: node, sub, label: item.label });
      }
    }
    return rows;
  }

  private findSubById(children: MenuSubItem[] | undefined, id: string): MenuSubItem | null {
    for (const sub of children ?? []) {
      if (sub.id === id) return sub;
      const nested = this.findSubById(sub.children, id);
      if (nested) return nested;
    }
    return null;
  }

  toggleNovaSub(id: string): void {
    const cur = this.novaSelectedSubIds();
    const idx = cur.indexOf(id);
    if (idx >= 0) {
      this.novaSelectedSubIds.set(cur.filter((x) => x !== id));
    } else {
      this.novaSelectedSubIds.set([...cur, id]);
    }
    this.cdr.markForCheck();
  }

  isNovaSubSelected(id: string): boolean {
    return this.novaSelectedSubIds().includes(id);
  }

  toggleMenuExpandedNova(menuId: string): void {
    const cur = this.novaExpandedMenuIds();
    if (cur.includes(menuId)) {
      this.novaExpandedMenuIds.set(cur.filter((x) => x !== menuId));
    } else {
      this.novaExpandedMenuIds.set([...cur, menuId]);
    }
    this.cdr.markForCheck();
  }

  isMenuExpandedNova(menuId: string): boolean {
    return this.novaExpandedMenuIds().includes(menuId);
  }

  selectedCountInMenuNova(node: MenuNode): number {
    const items = this.submenuItems(node);
    return items.filter((i) => this.novaSelectedSubIds().includes(i.id)).length;
  }

  isMenuFullySelectedNova(node: MenuNode): boolean {
    const items = this.submenuItems(node);
    if (items.length === 0) return false;
    return items.every((i) => this.novaSelectedSubIds().includes(i.id));
  }

  toggleTodasDoMenuNova(node: MenuNode, ev: Event): void {
    ev.stopPropagation();
    const items = this.submenuItems(node);
    const ids = items.map((i) => i.id);
    const cur = new Set(this.novaSelectedSubIds());
    const allSelected = ids.every((id) => cur.has(id));
    if (allSelected) {
      ids.forEach((id) => cur.delete(id));
    } else {
      ids.forEach((id) => cur.add(id));
    }
    this.novaSelectedSubIds.set(Array.from(cur));
    this.cdr.markForCheck();
  }

  selecionarTodasMenusNova(): void {
    const all: string[] = [];
    for (const node of MENU_STRUCTURE) {
      for (const item of this.submenuItems(node)) {
        all.push(item.id);
      }
    }
    this.novaSelectedSubIds.set(all);
    this.cdr.markForCheck();
  }

  limparSelecaoNova(): void {
    this.novaSelectedSubIds.set([]);
    this.cdr.markForCheck();
  }

  private buildPermissionKey(targetNodeId: string): string {
    const sufix = targetNodeId.replace(/^(sub-|menu-)/i, '').replace(/-/g, '_');
    let key = `custom.${sufix}`;
    const existing = this.menuPermissionsStore.getPermissions(targetNodeId);
    if (existing.includes(key)) {
      key = `custom.${sufix}_${Date.now().toString(36)}`;
    }
    return key;
  }

  salvarNovaPermissao(): void {
    const selected = this.novaSelectedSubIds();
    if (selected.length === 0) return;
    for (const targetNodeId of selected) {
      const key = this.buildPermissionKey(targetNodeId);
      this.menuPermissionsStore.appendPermission(targetNodeId, key);
    }
    this.fecharNovaPermissao();
    this.cdr.markForCheck();
  }
}
