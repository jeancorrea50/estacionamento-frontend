import {
  Component,
  inject,
  ChangeDetectorRef,
  effect,
  signal,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { AcessosUsuariosService, UsuarioListItem } from '../../services/acessos-usuarios.service';
import { AcessosUsuariosToolbarService } from '../../services/acessos-usuarios-toolbar.service';
import { AcessosPerfisService, ApplicationRole } from '../../services/acessos-perfis.service';
import { ProfilePermissionsStoreService } from '../../services/profile-permissions-store.service';
import { EstacionamentoLookupService, LookupOption as EstacionamentoOption } from '../../services/estacionamento-lookup.service';
import { TransportadoraLookupService, LookupOption as TransportadoraOption } from '../../services/transportadora-lookup.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { PERMISSION_MODULES, PERMISSION_CATALOG, type PermissionModule } from '../../constants/permission-catalog';

const PERFIL_KEY_ADMIN = 'ADMIN';
const PERFIL_KEY_Estacionamento = 'Estacionamento';
const PERFIL_KEY_TRANSPORTADORA = 'TRANSPORTADORA';

@Component({
  selector: 'app-acessos-usuarios-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './acessos-usuarios-page.component.html',
  styleUrls: ['./acessos-usuarios-page.component.scss'],
})
export class AcessosUsuariosPageComponent implements OnDestroy {
  private usuariosService = inject(AcessosUsuariosService);
  private perfisService = inject(AcessosPerfisService);
  private profileStore = inject(ProfilePermissionsStoreService);
  private toolbar = inject(AcessosUsuariosToolbarService);
  private EstacionamentoLookup = inject(EstacionamentoLookupService);
  private transportadoraLookup = inject(TransportadoraLookupService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  erro: string | null = null;
  itens: UsuarioListItem[] = [];

  modalOpen = signal(false);
  isEdit = signal(false);
  editItem = signal<UsuarioListItem | null>(null);
  saving = signal(false);
  saveError = signal<string | null>(null);

  perfisList: ApplicationRole[] = [];
  loadingPerfis = false;

  form = {
    nome: '',
    email: '',
    cpf: '',
    senha: '',
    ativo: true,
    perfilId: '' as string,
    EstacionamentoId: null as number | null,
    EstacionamentoLabel: '' as string,
    transportadoraId: null as number | null,
    transportadoraLabel: '' as string,
    useDefaultPermissions: true,
    userPermissionIds: [] as string[],
  };

  /** Chave do perfil selecionado (normalizada: ADMIN, Estacionamento, TRANSPORTADORA). */
  get perfilKey(): string {
    const id = this.form.perfilId;
    if (!id) return '';
    const role = this.findPerfilBySelectedValue(id);
    const name = (
      role?.name ??
      role?.perfil ??
      role?.nome ??
      role?.normalizedName ??
      id
    ).toString().toUpperCase();
    if (name.includes(PERFIL_KEY_ADMIN)) return PERFIL_KEY_ADMIN;
    if (name.includes(PERFIL_KEY_Estacionamento)) return PERFIL_KEY_Estacionamento;
    if (name.includes(PERFIL_KEY_TRANSPORTADORA)) return PERFIL_KEY_TRANSPORTADORA;
    return '';
  }

  get showEstacionamentoField(): boolean {
    return this.perfilKey === PERFIL_KEY_Estacionamento;
  }

  get showTransportadoraField(): boolean {
    return this.perfilKey === PERFIL_KEY_TRANSPORTADORA;
  }

  get EstacionamentoObrigatorio(): boolean {
    return this.perfilKey === PERFIL_KEY_Estacionamento;
  }

  get transportadoraObrigatorio(): boolean {
    return this.perfilKey === PERFIL_KEY_TRANSPORTADORA;
  }

  /** Listagem Estacionamento (layout tipo Banco em Dados Bancários) */
  EstacionamentoList = signal<EstacionamentoOption[]>([]);
  EstacionamentoListLoaded = signal(false);
  EstacionamentoLoading = signal(false);
  EstacionamentoFiltro = '';
  EstacionamentoDropdownOpen = signal(false);
  private subs = new Subscription();

  /** Autocomplete Transportadora */
  transportadoraSearchTerm = '';
  transportadoraOptions = signal<TransportadoraOption[]>([]);
  transportadoraLoading = signal(false);
  transportadoraDropdownOpen = signal(false);
  private transportadoraSearch$ = new Subject<string>();
  private listaSub?: Subscription;

  readonly PERMISSION_MODULES = PERMISSION_MODULES;
  readonly PERMISSION_CATALOG = PERMISSION_CATALOG;

  private normalizePermissionKey(value: string | null | undefined): string {
    return String(value ?? '').trim().toLowerCase();
  }

  /** Permissões do perfil selecionado (store ou catálogo como fallback para sempre exibir a seção). */
  get profilePermissions(): string[] {
    const id = this.form.perfilId;
    if (!id) return [];
    const role = this.findPerfilBySelectedValue(id);
    const key = String(
      role?.name ?? role?.perfil ?? role?.nome ?? role?.normalizedName ?? role?.id ?? id
    );
    const fromStore = this.profileStore.getProfilePermissions(key);
    return fromStore;
  }

  private findPerfilBySelectedValue(value: string | number): ApplicationRole | undefined {
    const selected = String(value ?? '').trim().toLowerCase();
    if (!selected) return undefined;
    return this.perfisList.find((p) => {
      const candidates = [
        p.name,
        p.perfil,
        p.nome,
        p.normalizedName,
        (p as { descricao?: unknown }).descricao,
        p.id,
        p.perfilId,
        this.perfilDisplayValue(p),
      ]
        .filter((v) => v != null)
        .map((v) => String(v).trim().toLowerCase());
      return candidates.includes(selected);
    });
  }

  private resolvePerfilNomeForPayload(selectedValue: string): string | undefined {
    const role = this.findPerfilBySelectedValue(selectedValue);
    const nome = String(
      role?.name ??
        role?.perfil ??
        role?.nome ??
        role?.normalizedName ??
        (role as { descricao?: unknown })?.descricao ??
        selectedValue ??
        ''
    ).trim();
    return nome || undefined;
  }

  perfilDisplayValue(role: ApplicationRole): string {
    return String(
      role?.name ??
        role?.perfil ??
        role?.nome ??
        role?.normalizedName ??
        (role as { descricao?: unknown })?.descricao ??
        role?.id ??
        role?.perfilId ??
        ''
    ).trim();
  }

  get profilePermissionsByModule(): { module: PermissionModule; keys: string[] }[] {
    const list = this.profilePermissions.map((k) => k.toLowerCase());
    const result: { module: PermissionModule; keys: string[] }[] = [];
    for (const mod of PERMISSION_MODULES) {
      const keys = (PERMISSION_CATALOG[mod] ?? []).filter((k) => list.includes(k.toLowerCase()));
      if (keys.length) result.push({ module: mod, keys });
    }
    return result;
  }

  get EstacionamentoDisplay(): string {
    return this.EstacionamentoDropdownOpen() ? this.EstacionamentoFiltro : this.form.EstacionamentoLabel;
  }

  get EstacionamentoFiltrados(): EstacionamentoOption[] {
    const list = this.EstacionamentoList();
    const t = (this.EstacionamentoFiltro ?? '').trim().toLowerCase();
    if (!t) return list;
    return list.filter(
      (o) =>
        o.label.toLowerCase().includes(t) ||
        (o.cnpj && o.cnpj.replace(/\D/g, '').includes(t.replace(/\D/g, '')))
    );
  }

  constructor() {
    effect(() => {
      this.toolbar.trigger();
      this.carregarLista();
    });
    this.setupTransportadoraSearch();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.listaSub?.unsubscribe();
  }

  private carregarListaEstacionamentos(): void {
    if (this.EstacionamentoListLoaded() || this.EstacionamentoLoading()) return;
    this.EstacionamentoLoading.set(true);
    this.cdr.markForCheck();
    this.EstacionamentoLookup.list().subscribe({
      next: (opts) => {
        this.EstacionamentoList.set(opts);
        this.EstacionamentoListLoaded.set(true);
        this.EstacionamentoLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.EstacionamentoLoading.set(false);
        this.EstacionamentoList.set([]);
        this.toast.error('Endpoint de busca não disponível no backend.');
        this.cdr.markForCheck();
      },
    });
  }

  onEstacionamentoFocus(): void {
    this.EstacionamentoDropdownOpen.set(true);
    this.EstacionamentoFiltro = this.form.EstacionamentoLabel;
    this.carregarListaEstacionamentos();
    this.cdr.markForCheck();
  }

  toggleEstacionamentoDropdown(event: Event): void {
    event.preventDefault();
    const open = !this.EstacionamentoDropdownOpen();
    this.EstacionamentoDropdownOpen.set(open);
    if (open) {
      this.EstacionamentoFiltro = this.form.EstacionamentoLabel;
      this.carregarListaEstacionamentos();
    }
    this.cdr.markForCheck();
  }

  onEstacionamentoInput(event: Event): void {
    this.EstacionamentoFiltro = (event.target as HTMLInputElement).value;
    this.EstacionamentoDropdownOpen.set(true);
    this.cdr.markForCheck();
  }

  onEstacionamentoBlur(): void {
    setTimeout(() => {
      this.EstacionamentoDropdownOpen.set(false);
      this.EstacionamentoFiltro = this.form.EstacionamentoLabel;
      this.cdr.markForCheck();
    }, 200);
  }

  private setupTransportadoraSearch(): void {
    this.subs.add(
      this.transportadoraSearch$.pipe(
        debounceTime(300),
        map((term) => term.trim()),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term) {
            this.transportadoraLoading.set(false);
            this.transportadoraOptions.set([]);
            this.transportadoraDropdownOpen.set(false);
            this.cdr.markForCheck();
            return of([]);
          }
          this.transportadoraLoading.set(true);
          this.cdr.markForCheck();
          return this.transportadoraLookup.search(term);
        })
      ).subscribe({
        next: (opts) => {
          this.transportadoraLoading.set(false);
          this.transportadoraOptions.set(opts);
          this.transportadoraDropdownOpen.set(opts.length > 0);
          this.cdr.markForCheck();
        },
        error: () => {
          this.transportadoraLoading.set(false);
          this.transportadoraOptions.set([]);
          this.toast.error('Endpoint de busca não disponível no backend.');
          this.cdr.markForCheck();
        },
      })
    );
  }

  carregarLista(): void {
    this.listaSub?.unsubscribe();
    this.loading = true;
    this.erro = null;
    this.cdr.markForCheck();
    const termo = this.toolbar.searchTerm().trim();
    this.listaSub = this.usuariosService.buscar(termo || undefined).subscribe({
      next: (body) => {
        this.loading = false;
        this.erro = null;
        this.itens = this.normalizeList(body);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.erro = err?.message ?? 'Endpoint não encontrado no backend.';
        this.itens = [];
        this.cdr.markForCheck();
      },
    });
  }

  retry(): void {
    this.carregarLista();
  }

  private normalizeList(body: unknown): UsuarioListItem[] {
    if (Array.isArray(body)) return body as UsuarioListItem[];
    if (body && typeof body === 'object' && 'result' in body) {
      const r = (body as { result?: unknown }).result;
      return Array.isArray(r) ? (r as UsuarioListItem[]) : [];
    }
    if (body && typeof body === 'object' && 'results' in body) {
      const r = (body as { results?: unknown }).results;
      return Array.isArray(r) ? (r as UsuarioListItem[]) : [];
    }
    return [];
  }

  openNovo(): void {
    this.saveError.set(null);
    this.form = {
      nome: '',
      email: '',
      cpf: '',
      senha: '',
      ativo: true,
      perfilId: '',
      EstacionamentoId: null,
      EstacionamentoLabel: '',
      transportadoraId: null,
      transportadoraLabel: '',
      useDefaultPermissions: true,
      userPermissionIds: [],
    };
    this.EstacionamentoFiltro = '';
    this.transportadoraSearchTerm = '';
    this.EstacionamentoList.set([]);
    this.EstacionamentoListLoaded.set(false);
    this.transportadoraOptions.set([]);
    this.EstacionamentoDropdownOpen.set(false);
    this.transportadoraDropdownOpen.set(false);
    this.isEdit.set(false);
    this.editItem.set(null);
    this.carregarPerfis();
    this.modalOpen.set(true);
    this.cdr.markForCheck();
  }

  openEditar(item: UsuarioListItem): void {
    this.saveError.set(null);
    this.editItem.set(item);
    const ext = item as { EstacionamentoId?: number; transportadoraId?: number; EstacionamentoLabel?: string; transportadoraLabel?: string };
    this.form = {
      nome: item.nome ?? '',
      email: item.emailOuLogin ?? '',
      cpf: (item as { cpf?: string }).cpf ?? '',
      senha: '',
      ativo: item.ativo ?? true,
      perfilId: '',
      EstacionamentoId: ext.EstacionamentoId ?? null,
      EstacionamentoLabel: ext.EstacionamentoLabel ?? '',
      transportadoraId: ext.transportadoraId ?? null,
      transportadoraLabel: ext.transportadoraLabel ?? '',
      useDefaultPermissions: true,
      userPermissionIds: [],
    };
    this.EstacionamentoFiltro = this.form.EstacionamentoLabel || '';
    this.transportadoraSearchTerm = this.form.transportadoraLabel || '';
    this.EstacionamentoList.set([]);
    this.EstacionamentoListLoaded.set(false);
    this.transportadoraOptions.set([]);
    this.isEdit.set(true);
    this.carregarPerfis();
    this.modalOpen.set(true);
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.saveError.set(null);
    this.cdr.markForCheck();
  }

  private carregarPerfis(): void {
    this.loadingPerfis = true;
    this.perfisService.buscar().subscribe({
      next: (body) => {
        this.loadingPerfis = false;
        this.perfisList = this.normalizePerfis(body);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingPerfis = false;
        this.perfisList = [];
        this.cdr.markForCheck();
      },
    });
  }

  private normalizePerfis(body: unknown): ApplicationRole[] {
    const list = this.extractRawPerfis(body);
    return list
      .map((item) => this.normalizePerfilItem(item))
      .filter((item): item is ApplicationRole => item !== null);
  }

  private extractRawPerfis(body: unknown): Record<string, unknown>[] {
    if (Array.isArray(body)) {
      return body.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
    }
    if (!body || typeof body !== 'object') return [];
    const record = body as Record<string, unknown>;
    const candidates = ['result', 'results', 'items', 'itens', 'data', 'perfis', 'roles'];
    for (const key of candidates) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value.filter(
          (item): item is Record<string, unknown> => !!item && typeof item === 'object'
        );
      }
    }
    return [];
  }

  private normalizePerfilItem(raw: Record<string, unknown>): ApplicationRole | null {
    const id = this.readId(raw, 'id', 'permissaoId', 'perfilId', 'roleId');
    const permissaoId = this.readId(raw, 'permissaoId', 'perfilId', 'id', 'roleId');
    const display = this.readText(raw, 'name', 'permissao', 'perfil', 'nome', 'normalizedName', 'descricao');
    if (id == null && permissaoId == null && !display) return null;
    const nome = this.readText(raw, 'nome', 'name', 'permissao', 'perfil', 'descricao');
    const name = this.readText(raw, 'name', 'nome', 'permissao', 'perfil', 'descricao');
    const permissao = this.readText(raw, 'permissao', 'perfil', 'name', 'nome', 'descricao');
    return {
      ...(id != null ? { id } : {}),
      ...(permissaoId != null ? { permissaoId, perfilId: permissaoId } : {}),
      ...(name ? { name } : {}),
      ...(nome ? { nome } : {}),
      ...(permissao ? { permissao, perfil: permissao } : {}),
      normalizedName: this.readText(raw, 'normalizedName', 'descricao') ?? null,
    };
  }

  private readText(record: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  private readId(record: Record<string, unknown>, ...keys: string[]): number | string | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  }

  onPerfilChange(): void {
    this.form.EstacionamentoId = null;
    this.form.EstacionamentoLabel = '';
    this.form.transportadoraId = null;
    this.form.transportadoraLabel = '';
    this.EstacionamentoFiltro = '';
    this.transportadoraSearchTerm = '';
    this.EstacionamentoList.set([]);
    this.EstacionamentoListLoaded.set(false);
    this.transportadoraOptions.set([]);
    this.EstacionamentoDropdownOpen.set(false);
    this.transportadoraDropdownOpen.set(false);
    const profile = this.profilePermissions;
    if (this.form.useDefaultPermissions) {
      this.form.userPermissionIds = [...profile];
    } else {
      const profileSet = new Set(profile.map((p) => this.normalizePermissionKey(p)));
      this.form.userPermissionIds = this.form.userPermissionIds.filter((p) =>
        profileSet.has(this.normalizePermissionKey(p))
      );
    }
    this.cdr.markForCheck();
  }

  onUseDefaultPermissionsChange(): void {
    if (this.form.useDefaultPermissions) {
      this.form.userPermissionIds = [...this.profilePermissions];
    }
    this.cdr.markForCheck();
  }

  toggleUserPermission(key: string): void {
    if (this.form.useDefaultPermissions) return;
    const cmp = this.normalizePermissionKey(key);
    const idx = this.form.userPermissionIds.findIndex(
      (k) => this.normalizePermissionKey(k) === cmp
    );
    if (idx >= 0) {
      this.form.userPermissionIds = this.form.userPermissionIds.filter(
        (k) => this.normalizePermissionKey(k) !== cmp
      );
    } else {
      this.form.userPermissionIds = [...this.form.userPermissionIds, key];
    }
    this.cdr.markForCheck();
  }

  isUserPermissionChecked(key: string): boolean {
    const cmp = this.normalizePermissionKey(key);
    return this.form.userPermissionIds.some((k) => this.normalizePermissionKey(k) === cmp);
  }

  selectEstacionamento(opt: EstacionamentoOption): void {
    this.form.EstacionamentoId = opt.id;
    this.form.EstacionamentoLabel = opt.label;
    this.EstacionamentoFiltro = opt.label;
    this.EstacionamentoDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  clearEstacionamento(): void {
    this.form.EstacionamentoId = null;
    this.form.EstacionamentoLabel = '';
    this.EstacionamentoFiltro = '';
    this.EstacionamentoDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  onTransportadoraInput(): void {
    this.transportadoraSearch$.next(this.transportadoraSearchTerm);
    if (!this.transportadoraSearchTerm.trim()) {
      this.form.transportadoraId = null;
      this.form.transportadoraLabel = '';
      this.transportadoraOptions.set([]);
      this.transportadoraLoading.set(false);
      this.transportadoraDropdownOpen.set(false);
      this.cdr.markForCheck();
    }
  }

  selectTransportadora(opt: TransportadoraOption): void {
    this.form.transportadoraId = opt.id;
    this.form.transportadoraLabel = opt.label;
    this.transportadoraSearchTerm = opt.label;
    this.transportadoraOptions.set([]);
    this.transportadoraDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  clearTransportadora(): void {
    this.form.transportadoraId = null;
    this.form.transportadoraLabel = '';
    this.transportadoraSearchTerm = '';
    this.transportadoraOptions.set([]);
    this.transportadoraDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  validarFormulario(): boolean {
    if (!this.form.nome.trim()) return false;
    if (!this.form.email.trim()) return false;
    if (String(this.form.cpf ?? '').replace(/\D/g, '').length !== 11) return false;
    if (!this.isEdit() && !this.form.senha.trim()) return false;
    if (this.EstacionamentoObrigatorio && (this.form.EstacionamentoId == null || this.form.EstacionamentoId === 0)) {
      return false;
    }
    if (this.transportadoraObrigatorio && (this.form.transportadoraId == null || this.form.transportadoraId === 0)) {
      return false;
    }
    return true;
  }

  salvar(): void {
    this.saveError.set(null);
    if (!this.validarFormulario()) {
      this.saveError.set('Preencha os campos obrigatórios (nome, email, CPF válido, senha no cadastro e vínculo quando exigido).');
      this.cdr.markForCheck();
      return;
    }
    const perfilNome = this.resolvePerfilNomeForPayload(this.form.perfilId);
    const payload = {
      nome: this.form.nome.trim(),
      email: this.form.email.trim(),
      cpf: this.form.cpf.trim() || undefined,
      senha: this.form.senha || undefined,
      ativo: this.form.ativo,
      perfilId: this.form.perfilId || undefined,
      perfilNome,
      EstacionamentoId: this.showEstacionamentoField ? this.form.EstacionamentoId ?? undefined : undefined,
      transportadoraId: this.showTransportadoraField ? this.form.transportadoraId ?? undefined : undefined,
      userPermissionIds: this.form.userPermissionIds,
      ...(this.editItem()?.id ? { id: this.editItem()!.id } : {}),
    };
    this.saving.set(true);
    const obs = this.isEdit()
      ? this.usuariosService.alterar({
          id: this.editItem()!.id,
          nome: payload.nome,
          email: payload.email,
          login: (this.editItem() as { userName?: string })?.userName,
          senha: payload.senha,
          confirmarSenha: payload.senha,
          cpf: payload.cpf,
          perfilId: payload.perfilId,
          perfilNome: payload.perfilNome,
          EstacionamentoId: payload.EstacionamentoId,
          transportadoraId: payload.transportadoraId,
        })
      : this.usuariosService.gravar(payload);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(
          this.isEdit()
            ? 'Usuário atualizado com sucesso.'
            : 'Cadastro realizado. Enviamos um e-mail de confirmação para usuário.'
        );
        this.closeModal();
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const e = err as { message?: string };
        this.saveError.set(e?.message?.trim() || 'Não foi possível cadastrar o usuário no backend.');
        this.cdr.markForCheck();
      }
    });
  }
}
