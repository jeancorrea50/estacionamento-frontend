import {
  Component,
  inject,
  ChangeDetectorRef,
  signal,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GerenciamentoService } from '../../services/gerenciamento.service';
import {
  GerenciamentoFiltros,
  UsuarioGerenciamentoForm,
  UsuarioGerenciamentoItem
} from '../../models/gerenciamento.types';
import { ApplicationRole } from '../../../cadastro/services/acessos-perfis.service';
import {
  EstacionamentoLookupService,
  LookupOption as EstacionamentoOption
} from '../../../cadastro/services/estacionamento-lookup.service';
import {
  TransportadoraLookupService,
  LookupOption as TransportadoraOption
} from '../../../cadastro/services/transportadora-lookup.service';
import { ProfilePermissionsStoreService } from '../../../cadastro/services/profile-permissions-store.service';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import type { UsuarioDetalheOutput, UsuarioCadastroOpcoes, UsuarioPapelOpcao } from '../../../../core/api/types/usuario-api.types';
import { ApiError } from '../../../../core/api/models';

@Component({
  selector: 'app-gerenciamento-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gerenciamento-page.component.html',
  styleUrls: ['./gerenciamento-page.component.scss']
})
export class GerenciamentoPageComponent implements OnInit, OnDestroy {
  private gerenciamentoService = inject(GerenciamentoService);
  private EstacionamentoLookup = inject(EstacionamentoLookupService);
  private transportadoraLookup = inject(TransportadoraLookupService);
  private profileStore = inject(ProfilePermissionsStoreService);
  private permissionCache = inject(PermissionCacheService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  /** Permissões alinhadas ao back ([PermissionAuthorize]). */
  canVisualizar = this.permissionCache.has('usuario.visualizar') || this.permissionCache.hasAny(['*']);
  canGravar = this.permissionCache.has('usuario.gravar') || this.permissionCache.hasAny(['*']);
  canAlterar = this.permissionCache.has('usuario.alterar') || this.permissionCache.hasAny(['*']);
  canExcluir = this.permissionCache.has('usuario.excluir') || this.permissionCache.hasAny(['*']);

  get podeCadastrarUsuario(): boolean {
    return this.canGravar && this.opcoesCadastro?.podeCadastrar === true;
  }

  get papeisPermitidos(): UsuarioPapelOpcao[] {
    return this.opcoesCadastro?.tiposPapel ?? [];
  }

  get tiposPessoaDoPapel(): { value: 1 | 2; label: string }[] {
    const papel = this.papelSelecionado;
    const nomes = new Map(
      (this.opcoesCadastro?.tiposPessoa ?? []).map((t) => [t.value, t.label] as const)
    );
    if (!papel) {
      return (this.opcoesCadastro?.tiposPessoa ?? []).map((t) => ({ value: t.value, label: t.label }));
    }
    return papel.tiposPessoaPermitidos.map((v) => ({
      value: v,
      label: nomes.get(v) ?? (v === 2 ? 'Jurídica' : 'Física')
    }));
  }

  get papelSelecionado(): UsuarioPapelOpcao | undefined {
    if (this.form.tipoPapel == null) return undefined;
    return this.papeisPermitidos.find((p) => p.value === this.form.tipoPapel);
  }

  get documentoLabel(): string {
    return this.form.tipoPessoa === 2 ? 'CNPJ' : 'CPF';
  }

  get documentoMaxLength(): number {
    return this.form.tipoPessoa === 2 ? 18 : 14;
  }

  get documentoPlaceholder(): string {
    return this.form.tipoPessoa === 2 ? '00.000.000/0000-00' : '000.000.000-00';
  }

  filtros: GerenciamentoFiltros = { nomeOuEmail: '', perfilNome: '', statusFiltro: '' };

  /** Paginação apenas na UI (lista já carregada pelo mesmo fluxo `buscar`). */
  readonly itensPorPagina = 10;
  paginaAtual = 1;

  loading = false;
  erro: string | null = null;
  itens: UsuarioGerenciamentoItem[] = [];
  buscaRealizada = false;
  perfisList: ApplicationRole[] = [];

  modalFormOpen = signal(false);
  modalVerOpen = signal(false);
  isEdit = signal(false);
  editItem = signal<UsuarioGerenciamentoItem | null>(null);
  itemVer = signal<UsuarioGerenciamentoItem | null>(null);
  saveError = signal<string | null>(null);
  saving = signal(false);
  carregandoDetalhe = signal(false);
  mostrarSenha = false;
  mostrarConfirmarSenha = false;

  form: UsuarioGerenciamentoForm = this.getEmptyForm();

  EstacionamentoOptions = signal<EstacionamentoOption[]>([]);
  EstacionamentoCarregando = signal(false);
  transportadoraOptions = signal<TransportadoraOption[]>([]);
  transportadoraCarregando = signal(false);
  estacionamentoBuscaTermo = '';
  transportadoraBuscaTermo = '';
  perfilBuscaTermo = '';
  vinculoBuscaErro: string | null = null;
  vinculoDropdownOpen = signal(false);
  perfilDropdownOpen = signal(false);
  opcoesCadastro: UsuarioCadastroOpcoes | null = null;
  private subs = new Subscription();
  private buscaSub?: Subscription;

  ngOnInit(): void {
    this.carregarPerfis();
    this.carregarOpcoesCadastro();
    this.buscar();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.buscaSub?.unsubscribe();
  }

  get totalRegistros(): number {
    return this.itens.length;
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalRegistros / this.itensPorPagina));
  }

  get itensPagina(): UsuarioGerenciamentoItem[] {
    const start = (this.paginaAtual - 1) * this.itensPorPagina;
    return this.itens.slice(start, start + this.itensPorPagina);
  }

  get intervaloExibicao(): { de: number; ate: number } {
    if (this.totalRegistros === 0) return { de: 0, ate: 0 };
    const de = (this.paginaAtual - 1) * this.itensPorPagina + 1;
    const ate = Math.min(this.paginaAtual * this.itensPorPagina, this.totalRegistros);
    return { de, ate };
  }

  paginaAnterior(): void {
    if (this.paginaAtual > 1) {
      this.paginaAtual--;
      this.cdr.markForCheck();
    }
  }

  paginaProxima(): void {
    if (this.paginaAtual < this.totalPaginas) {
      this.paginaAtual++;
      this.cdr.markForCheck();
    }
  }

  perfilChipClass(perfil: string | null | undefined): string {
    const p = (perfil ?? '').toLowerCase();
    if (p.includes('admin')) return 'usuarios-perfil-chip--admin';
    if (p.includes('transport')) return 'usuarios-perfil-chip--transport';
    return 'usuarios-perfil-chip--muted';
  }

  temVinculoEstacionamento(item: UsuarioGerenciamentoItem): boolean {
    return !!(
      (item.EstacionamentoNome?.trim() ?? '') !== '' ||
      (item.EstacionamentoId != null && item.EstacionamentoId !== 0)
    );
  }

  temVinculoTransportadora(item: UsuarioGerenciamentoItem): boolean {
    return !!(
      (item.transportadoraNome?.trim() ?? '') !== '' ||
      (item.transportadoraId != null && item.transportadoraId !== 0)
    );
  }

  textoVinculoEstacionamento(item: UsuarioGerenciamentoItem): string {
    const n = item.EstacionamentoNome?.trim();
    if (n) return n;
    if (item.EstacionamentoId != null && item.EstacionamentoId !== 0) {
      return `ID ${item.EstacionamentoId}`;
    }
    return '';
  }

  textoVinculoTransportadora(item: UsuarioGerenciamentoItem): string {
    const n = item.transportadoraNome?.trim();
    if (n) return n;
    if (item.transportadoraId != null && item.transportadoraId !== 0) {
      return `ID ${item.transportadoraId}`;
    }
    return '';
  }

  get profilePermissions(): string[] {
    const id = this.form.perfilId;
    if (!id) return [];
    const role = this.findPerfilBySelectedValue(id);
    const key = String(
      role?.name ?? role?.perfil ?? role?.nome ?? role?.normalizedName ?? role?.id ?? id
    );
    return this.profileStore.getProfilePermissions(key);
  }

  onPerfilFormChange(): void {
    this.profilePermissions;
    this.cdr.markForCheck();
  }

  onCpfInput(value: string): void {
    this.form.cpf = this.aplicarMascaraDocumento(value);
  }

  onTipoPapelChange(raw: string | number): void {
    const value = Number(raw);
    this.form.tipoPapel = Number.isFinite(value) ? (value as 0 | 1 | 2 | 3 | 4) : null;
    const papel = this.papelSelecionado;
    if (papel) {
      this.form.tipoPessoa = papel.tipoPessoaPadrao;
      this.form.cpf = this.aplicarMascaraDocumento(this.form.cpf);
    }
    this.cdr.markForCheck();
  }

  onTipoPessoaChange(raw: string | number): void {
    const value = Number(raw) === 2 ? 2 : 1;
    this.form.tipoPessoa = value;
    this.form.cpf = this.aplicarMascaraDocumento(this.form.cpf);
    this.cdr.markForCheck();
  }

  private aplicarMascaraDocumento(value: string | null | undefined): string {
    if (this.form.tipoPessoa === 2) {
      return this.aplicarMascaraCnpj(value);
    }
    return this.aplicarMascaraCpf(value);
  }

  private aplicarMascaraCnpj(value: string | null | undefined): string {
    const digits = String(value ?? '')
      .replace(/\D/g, '')
      .slice(0, 14);
    if (!digits) return '';
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    }
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  private aplicarMascaraCpf(value: string | null | undefined): string {
    const digits = String(value ?? '')
      .replace(/\D/g, '')
      .slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  get perfisFiltrados(): ApplicationRole[] {
    const termo = this.perfilBuscaTermo.trim().toLowerCase();
    if (!termo) return this.perfisList;
    return this.perfisList.filter((p) => {
      const candidatos = [p.name, p.perfil, p.nome, p.normalizedName, p.id]
        .filter((v): v is string | number => v != null)
        .map((v) => String(v).toLowerCase());
      return candidatos.some((v) => v.includes(termo));
    });
  }

  private findPerfilBySelectedValue(value: string | number): ApplicationRole | undefined {
    const selected = String(value ?? '').trim().toLowerCase();
    if (!selected) return undefined;
    return this.perfisList.find((p) => {
      const candidates = [p.name, p.perfil, p.nome, p.normalizedName, p.id]
        .filter((v) => v != null)
        .map((v) => String(v).trim().toLowerCase());
      return candidates.includes(selected);
    });
  }

  private resolvePerfilNomeForPayload(selectedValue: string): string | undefined {
    const role = this.findPerfilBySelectedValue(selectedValue);
    const nome = String(
      role?.name ?? role?.perfil ?? role?.nome ?? role?.normalizedName ?? selectedValue ?? ''
    ).trim();
    return nome || undefined;
  }

  private getPerfilDetalheNome(perfil: UsuarioDetalheOutput['perfil']): string | undefined {
    if (typeof perfil === 'string') {
      const nome = perfil.trim();
      return nome || undefined;
    }
    if (perfil && typeof perfil === 'object') {
      const nome = typeof perfil.name === 'string' ? perfil.name.trim() : '';
      return nome || undefined;
    }
    return undefined;
  }

  private getPerfilDetalheId(perfil: UsuarioDetalheOutput['perfil']): string | undefined {
    if (!perfil || typeof perfil !== 'object') {
      return undefined;
    }
    if (perfil.id == null) {
      return undefined;
    }
    const id = String(perfil.id).trim();
    return id || undefined;
  }

  private getEmptyForm(): UsuarioGerenciamentoForm {
    return {
      nome: '',
      email: '',
      login: '',
      senha: '',
      confirmarSenha: '',
      EstacionamentoId: 0,
      EstacionamentoLabel: '',
      vinculoTipo: 'estacionamento',
      transportadoraId: 0,
      transportadoraLabel: '',
      cpf: '',
      tipoPessoa: 1,
      tipoPapel: null,
      pessoaId: null,
      perfilId: '',
      ativo: true
    };
  }

  private carregarOpcoesCadastro(): void {
    this.gerenciamentoService.obterOpcoesCadastro().subscribe({
      next: (op) => {
        this.opcoesCadastro = this.normalizarOpcoesCadastro(op);
        this.cdr.markForCheck();
      },
      error: () => {
        this.opcoesCadastro = {
          podeCadastrar: false,
          mensagem: 'Não foi possível carregar as opções de cadastro.',
          tiposPapel: [],
          tiposPessoa: [
            { value: 1, label: 'Física' },
            { value: 2, label: 'Jurídica' }
          ]
        };
        this.cdr.markForCheck();
      }
    });
  }

  private normalizarOpcoesCadastro(raw: UsuarioCadastroOpcoes | Record<string, unknown> | null): UsuarioCadastroOpcoes {
    const r = (raw ?? {}) as Record<string, unknown>;
    const papeisRaw = (r['tiposPapel'] ?? r['TiposPapel'] ?? []) as unknown[];
    const pessoasRaw = (r['tiposPessoa'] ?? r['TiposPessoa'] ?? []) as unknown[];
    return {
      podeCadastrar: Boolean(r['podeCadastrar'] ?? r['PodeCadastrar']),
      papelLogado: (r['papelLogado'] ?? r['PapelLogado']) as UsuarioCadastroOpcoes['papelLogado'],
      papelLogadoLabel: String(r['papelLogadoLabel'] ?? r['PapelLogadoLabel'] ?? '') || null,
      mensagem: String(r['mensagem'] ?? r['Mensagem'] ?? '') || null,
      tiposPapel: (Array.isArray(papeisRaw) ? papeisRaw : []).map((item) => {
        const p = item as Record<string, unknown>;
        return {
          value: Number(p['value'] ?? p['Value']) as UsuarioPapelOpcao['value'],
          label: String(p['label'] ?? p['Label'] ?? ''),
          tipoPessoaPadrao: (Number(p['tipoPessoaPadrao'] ?? p['TipoPessoaPadrao']) === 2 ? 2 : 1) as 1 | 2,
          tiposPessoaPermitidos: ((p['tiposPessoaPermitidos'] ?? p['TiposPessoaPermitidos'] ?? []) as unknown[])
            .map((v) => (Number(v) === 2 ? 2 : 1) as 1 | 2)
        };
      }),
      tiposPessoa: (Array.isArray(pessoasRaw) ? pessoasRaw : []).map((item) => {
        const t = item as Record<string, unknown>;
        const value = Number(t['value'] ?? t['Value']) === 2 ? 2 : 1;
        return { value, label: String(t['label'] ?? t['Label'] ?? (value === 2 ? 'Jurídica' : 'Física')) };
      })
    };
  }

  private carregarPerfis(): void {
    this.gerenciamentoService.getPerfis().subscribe({
      next: (list) => {
        this.perfisList = list;
        this.cdr.markForCheck();
      }
    });
  }

  private carregarEstacionamentosParaModal(): void {
    if (this.EstacionamentoOptions().length > 0 || this.EstacionamentoCarregando()) {
      return;
    }
    this.EstacionamentoCarregando.set(true);
    this.cdr.markForCheck();
    this.EstacionamentoLookup.list().subscribe({
      next: (opts) => {
        this.EstacionamentoCarregando.set(false);
        this.EstacionamentoOptions.set(opts);
        this.cdr.markForCheck();
      },
      error: () => {
        this.EstacionamentoCarregando.set(false);
        this.toast.error('Não foi possível carregar Estacionamentos.');
        this.cdr.markForCheck();
      }
    });
  }

  private carregarTransportadorasParaModal(): void {
    if (this.transportadoraOptions().length > 0 || this.transportadoraCarregando()) {
      return;
    }
    this.transportadoraCarregando.set(true);
    this.cdr.markForCheck();
    this.transportadoraLookup.list().subscribe({
      next: (opts) => {
        this.transportadoraCarregando.set(false);
        this.transportadoraOptions.set(opts);
        this.cdr.markForCheck();
      },
      error: () => {
        this.transportadoraCarregando.set(false);
        this.toast.error('Não foi possível carregar Transportadoras.');
        this.cdr.markForCheck();
      }
    });
  }

  buscar(): void {
    this.buscaSub?.unsubscribe();
    this.buscaRealizada = true;
    this.loading = true;
    this.erro = null;
    this.cdr.markForCheck();
    this.buscaSub = this.gerenciamentoService.buscar(this.filtros).subscribe({
      next: (list) => {
        this.loading = false;
        this.erro = null;
        this.itens = list;
        this.paginaAtual = 1;
        this.cdr.markForCheck();
      },
      error: (err: ApiError) => {
        this.loading = false;
        this.erro = err?.message ?? 'Erro ao carregar a lista de usuários.';
        this.itens = [];
        this.cdr.markForCheck();
      }
    });
  }

  limparFiltros(): void {
    this.filtros = { nomeOuEmail: '', perfilNome: '', statusFiltro: '' };
    this.buscaRealizada = false;
    this.itens = [];
    this.erro = null;
    this.loading = false;
    this.cdr.markForCheck();
  }

  abrirNovo(): void {
    if (!this.canGravar) {
      this.toast.error('Você não possui permissão para cadastrar usuários (usuario.gravar).');
      return;
    }
    if (this.opcoesCadastro?.podeCadastrar !== true) {
      this.toast.error(this.opcoesCadastro?.mensagem || 'Seu tipo de papel não permite cadastrar usuários.');
      return;
    }
    this.saveError.set(null);
    this.form = this.getEmptyForm();
    this.isEdit.set(false);
    this.mostrarSenha = false;
    this.mostrarConfirmarSenha = false;
    this.editItem.set(null);
    this.estacionamentoBuscaTermo = '';
    this.transportadoraBuscaTermo = '';
    this.perfilBuscaTermo = '';
    this.EstacionamentoOptions.set([]);
    this.transportadoraOptions.set([]);
    this.vinculoBuscaErro = null;
    this.vinculoDropdownOpen.set(false);
    this.perfilDropdownOpen.set(false);
    this.modalFormOpen.set(true);
    this.cdr.markForCheck();
  }

  abrirEditar(item: UsuarioGerenciamentoItem): void {
    if (!this.canAlterar) {
      this.toast.error('Você não possui permissão para editar usuários (usuario.alterar).');
      return;
    }
    if (!item.id) {
      return;
    }
    this.saveError.set(null);
    this.editItem.set(item);
    this.isEdit.set(true);
    this.mostrarSenha = false;
    this.mostrarConfirmarSenha = false;
    this.form = this.getEmptyForm();
    this.estacionamentoBuscaTermo = '';
    this.transportadoraBuscaTermo = '';
    this.perfilBuscaTermo = '';
    this.EstacionamentoOptions.set([]);
    this.transportadoraOptions.set([]);
    this.vinculoBuscaErro = null;
    this.vinculoDropdownOpen.set(false);
    this.perfilDropdownOpen.set(false);
    this.carregandoDetalhe.set(true);
    this.modalFormOpen.set(true);
    this.cdr.markForCheck();
    this.gerenciamentoService.obterDetalhe(item.id).subscribe({
      next: (d) => {
        this.preencherFormDoDetalhe(d);
        this.carregandoDetalhe.set(false);
        this.cdr.markForCheck();
      },
      error: (err: ApiError) => {
        this.carregandoDetalhe.set(false);
        this.saveError.set(err?.message ?? 'Não foi possível carregar o usuário.');
        this.cdr.markForCheck();
      }
    });
  }

  private preencherFormDoDetalhe(
    d: UsuarioDetalheOutput & { nome?: string; emailOuLogin?: string; cpf?: string }
  ): void {
    const p = d.pessoa;
    const pessoaIdDetalhe =
      typeof p?.id === 'number' && Number.isFinite(p.id)
        ? p.id
        : typeof d.pessoaId === 'number' && Number.isFinite(d.pessoaId)
          ? d.pessoaId
          : null;
    const perf = d.perfil;
    const estacionamentoId =
      typeof d.estacionamentoId === 'number'
        ? d.estacionamentoId
        : typeof d.EstacionamentoId === 'number'
          ? d.EstacionamentoId
          : 0;
    const estacionamentoNome = typeof d.estacionamento === 'string' ? d.estacionamento.trim() : '';
    const transportadoraId = typeof d.transportadoraId === 'number' ? d.transportadoraId : 0;
    const transportadoraNome = typeof d.transportadora === 'string' ? d.transportadora.trim() : '';
    const tipoPessoaRaw =
      typeof p?.tipoPessoa === 'number'
        ? p.tipoPessoa
        : typeof d.tipoPessoa === 'number'
          ? d.tipoPessoa
          : 1;
    const tipoPapelRaw = typeof d.tipoPapel === 'number' ? d.tipoPapel : null;
    const perfNome = this.getPerfilDetalheNome(perf);
    const perfId = this.getPerfilDetalheId(perf);
    const matchPerfil = this.perfisList.find(
      (r) =>
        (r.name && perfNome && r.name.toLowerCase() === perfNome.toLowerCase()) ||
        (r.id && perfId && String(r.id) === perfId) ||
        (r.name && perfNome && r.name === perfNome)
    );
    this.form = {
      nome: p?.nome ?? d.nome ?? '',
      email: String(d.email ?? '').trim(),
      login: String(d.userName ?? '').trim(),
      senha: '',
      confirmarSenha: '',
      EstacionamentoId: estacionamentoId,
      EstacionamentoLabel: estacionamentoNome,
      vinculoTipo: estacionamentoId > 0 ? 'estacionamento' : 'transportadora',
      transportadoraId: transportadoraId,
      transportadoraLabel: transportadoraNome,
      cpf: this.aplicarMascaraDocumento(p?.cpf ?? d.cpf ?? ''),
      tipoPessoa: tipoPessoaRaw === 2 ? 2 : 1,
      tipoPapel: tipoPapelRaw != null && tipoPapelRaw >= 0 && tipoPapelRaw <= 4
        ? (tipoPapelRaw as 0 | 1 | 2 | 3 | 4)
        : null,
      pessoaId: pessoaIdDetalhe,
      perfilId: (matchPerfil?.id ?? matchPerfil?.name ?? perfId ?? perfNome ?? '') as string,
      ativo: this.form.ativo
    };
    const perfilSelecionado = this.findPerfilBySelectedValue(this.form.perfilId);
    this.perfilBuscaTermo = String(
      perfilSelecionado?.name ??
        perfilSelecionado?.perfil ??
        perfilSelecionado?.nome ??
        this.form.perfilId ??
        ''
    );
    if (this.form.EstacionamentoId != null && !this.form.EstacionamentoLabel) {
      const fromList = this.EstacionamentoOptions().find(
        (o) => o.id === this.form.EstacionamentoId
      );
      if (fromList) {
        this.form.EstacionamentoLabel = fromList.label;
      }
    }
    if (
      this.form.vinculoTipo === 'estacionamento' &&
      this.form.EstacionamentoLabel &&
      !this.estacionamentoBuscaTermo
    ) {
      this.estacionamentoBuscaTermo = this.form.EstacionamentoLabel;
    }
    if (
      this.form.vinculoTipo === 'transportadora' &&
      this.form.transportadoraLabel &&
      !this.transportadoraBuscaTermo
    ) {
      this.transportadoraBuscaTermo = this.form.transportadoraLabel;
    }
  }

  abrirVisualizar(item: UsuarioGerenciamentoItem): void {
    this.itemVer.set(item);
    this.modalVerOpen.set(true);
    this.cdr.markForCheck();
  }

  fecharModalForm(): void {
    this.modalFormOpen.set(false);
    this.saveError.set(null);
    this.mostrarSenha = false;
    this.mostrarConfirmarSenha = false;
    this.perfilDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  toggleMostrarSenha(): void {
    this.mostrarSenha = !this.mostrarSenha;
    this.cdr.markForCheck();
  }

  toggleMostrarConfirmarSenha(): void {
    this.mostrarConfirmarSenha = !this.mostrarConfirmarSenha;
    this.cdr.markForCheck();
  }

  fecharModalVer(): void {
    this.modalVerOpen.set(false);
    this.itemVer.set(null);
    this.cdr.markForCheck();
  }

  limparEstacionamento(): void {
    this.form.EstacionamentoId = 0;
    this.form.EstacionamentoLabel = '';
    this.cdr.markForCheck();
  }

  onEstacionamentoIdChange(v: number | null | undefined): void {
    if (v == null || v === 0) {
      this.form.EstacionamentoId = 0;
      this.form.EstacionamentoLabel = '';
    } else {
      this.form.EstacionamentoId = v;
      const o = this.EstacionamentoOptions().find((e) => e.id === v);
      this.form.EstacionamentoLabel = o?.label ?? '';
    }
    this.cdr.markForCheck();
  }

  onEstacionamentoFieldFocus(): void {
    // Busca sob demanda via lupa.
  }

  onTransportadoraFieldFocus(): void {
    // Busca sob demanda via lupa.
  }

  onVinculoTipoChange(tipo: 'estacionamento' | 'transportadora'): void {
    this.form.vinculoTipo = tipo;
    this.vinculoBuscaErro = null;
    this.vinculoDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  limparBuscaEstacionamento(): void {
    this.estacionamentoBuscaTermo = '';
    this.form.EstacionamentoId = 0;
    this.form.EstacionamentoLabel = '';
    this.EstacionamentoOptions.set([]);
    this.vinculoBuscaErro = null;
    this.vinculoDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  onTransportadoraIdChange(v: number | null | undefined): void {
    if (v == null || v === 0) {
      this.form.transportadoraId = 0;
      this.form.transportadoraLabel = '';
    } else {
      this.form.transportadoraId = v;
      const o = this.transportadoraOptions().find((e) => e.id === v);
      this.form.transportadoraLabel = o?.label ?? '';
    }
    this.cdr.markForCheck();
  }

  limparTransportadora(): void {
    this.form.transportadoraId = 0;
    this.form.transportadoraLabel = '';
    this.transportadoraBuscaTermo = '';
    this.transportadoraOptions.set([]);
    this.vinculoBuscaErro = null;
    this.vinculoDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  onVinculoBuscaKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.buscarVinculo();
    }
  }

  onVinculoBuscaInput(): void {
    this.vinculoBuscaErro = null;
    this.vinculoDropdownOpen.set(false);
    if (this.form.vinculoTipo === 'estacionamento') {
      this.form.EstacionamentoId = 0;
      this.form.EstacionamentoLabel = '';
    } else {
      this.form.transportadoraId = 0;
      this.form.transportadoraLabel = '';
    }
    this.cdr.markForCheck();
  }

  selecionarEstacionamentoBusca(opt: EstacionamentoOption): void {
    this.form.EstacionamentoId = opt.id;
    this.form.EstacionamentoLabel = opt.label;
    this.estacionamentoBuscaTermo = opt.label;
    this.vinculoBuscaErro = null;
    this.vinculoDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  selecionarTransportadoraBusca(opt: TransportadoraOption): void {
    this.form.transportadoraId = opt.id;
    this.form.transportadoraLabel = opt.label;
    this.transportadoraBuscaTermo = opt.label;
    this.vinculoBuscaErro = null;
    this.vinculoDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  fecharVinculoDropdownComDelay(): void {
    setTimeout(() => {
      this.vinculoDropdownOpen.set(false);
      this.cdr.markForCheck();
    }, 180);
  }

  onPerfilBuscaInput(): void {
    this.perfilDropdownOpen.set(true);
    this.cdr.markForCheck();
  }

  limparPerfilBusca(): void {
    this.perfilBuscaTermo = '';
    this.form.perfilId = '';
    this.perfilDropdownOpen.set(false);
    this.onPerfilFormChange();
    this.cdr.markForCheck();
  }

  onPerfilBuscaKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.perfilDropdownOpen.set(true);
      this.cdr.markForCheck();
    }
  }

  abrirPerfilDropdown(): void {
    this.perfilDropdownOpen.set(true);
    this.cdr.markForCheck();
  }

  fecharPerfilDropdownComDelay(): void {
    setTimeout(() => {
      this.perfilDropdownOpen.set(false);
      this.cdr.markForCheck();
    }, 180);
  }

  selecionarPerfilBusca(perfil: ApplicationRole): void {
    const valor = String(perfil.name ?? perfil.perfil ?? perfil.nome ?? perfil.id ?? '').trim();
    this.form.perfilId = valor;
    this.perfilBuscaTermo = valor;
    this.onPerfilFormChange();
    this.perfilDropdownOpen.set(false);
    this.cdr.markForCheck();
  }

  buscarVinculo(): void {
    this.vinculoBuscaErro = null;
    if (this.form.vinculoTipo === 'estacionamento') {
      this.buscarEstacionamentosPorTermo();
    } else {
      this.buscarTransportadorasPorTermo();
    }
  }

  private buscarEstacionamentosPorTermo(): void {
    const termo = this.estacionamentoBuscaTermo.trim();
    if (!termo) {
      this.vinculoBuscaErro = 'Informe um termo para buscar Estacionamentos.';
      this.EstacionamentoOptions.set([]);
      this.cdr.markForCheck();
      return;
    }
    this.EstacionamentoCarregando.set(true);
    this.EstacionamentoLookup.search(termo).subscribe({
      next: (opts) => {
        this.EstacionamentoCarregando.set(false);
        this.EstacionamentoOptions.set(opts);
        if (opts.length === 0) {
          this.vinculoBuscaErro = 'Nenhum estacionamento encontrado para o termo informado.';
          this.vinculoDropdownOpen.set(false);
        } else {
          this.vinculoDropdownOpen.set(true);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.EstacionamentoCarregando.set(false);
        this.EstacionamentoOptions.set([]);
        this.vinculoBuscaErro = 'Não foi possível buscar Estacionamentos.';
        this.vinculoDropdownOpen.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  private buscarTransportadorasPorTermo(): void {
    const termo = this.transportadoraBuscaTermo.trim();
    if (!termo) {
      this.vinculoBuscaErro = 'Informe um termo para buscar Transportadoras.';
      this.transportadoraOptions.set([]);
      this.cdr.markForCheck();
      return;
    }
    this.transportadoraCarregando.set(true);
    this.transportadoraLookup.search(termo).subscribe({
      next: (opts) => {
        this.transportadoraCarregando.set(false);
        this.transportadoraOptions.set(opts);
        if (opts.length === 0) {
          this.vinculoBuscaErro = 'Nenhuma transportadora encontrada para o termo informado.';
          this.vinculoDropdownOpen.set(false);
        } else {
          this.vinculoDropdownOpen.set(true);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.transportadoraCarregando.set(false);
        this.transportadoraOptions.set([]);
        this.vinculoBuscaErro = 'Não foi possível buscar Transportadoras.';
        this.vinculoDropdownOpen.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  salvar(): void {
    this.saveError.set(null);
    if (!this.form.nome?.trim() || !this.form.email?.trim()) {
      this.saveError.set('Preencha nome e e-mail.');
      this.cdr.markForCheck();
      return;
    }
    const emailNorm = this.form.email.trim();
    if (!this.isEmailFormatoValido(emailNorm)) {
      this.saveError.set('Informe um e-mail válido (ex.: nome@dominio.com).');
      this.cdr.markForCheck();
      return;
    }
    if (!this.form.perfilId?.toString().trim()) {
      this.saveError.set('Selecione o perfil do usuário.');
      this.cdr.markForCheck();
      return;
    }
    if (this.form.vinculoTipo === 'estacionamento' && (!this.form.EstacionamentoId || this.form.EstacionamentoId <= 0)) {
      this.saveError.set('Selecione o estacionamento para o vínculo.');
      this.cdr.markForCheck();
      return;
    }
    if (this.form.vinculoTipo === 'transportadora' && (!this.form.transportadoraId || this.form.transportadoraId <= 0)) {
      this.saveError.set('Selecione a transportadora para o vínculo.');
      this.cdr.markForCheck();
      return;
    }
    if (this.form.tipoPapel == null) {
      this.saveError.set('Selecione o tipo de papel do usuário.');
      this.cdr.markForCheck();
      return;
    }
    if (!this.form.tipoPessoa) {
      this.saveError.set('Selecione o tipo de pessoa.');
      this.cdr.markForCheck();
      return;
    }
    const docDigits = String(this.form.cpf ?? '').replace(/[^0-9A-Za-z]/g, '');
    if (this.form.tipoPessoa === 2) {
      if (docDigits.length !== 14) {
        this.saveError.set('Informe o CNPJ com 14 caracteres (obrigatório no cadastro).');
        this.cdr.markForCheck();
        return;
      }
    } else if (docDigits.replace(/\D/g, '').length !== 11) {
      this.saveError.set('Informe o CPF com 11 dígitos (obrigatório no cadastro).');
      this.cdr.markForCheck();
      return;
    }
    if (!this.form.login?.trim() && !this.form.email?.trim()) {
      this.saveError.set('Informe o login (userName) ou e-mail para credenciais.');
      this.cdr.markForCheck();
      return;
    }
    if (!this.isEdit()) {
      if (!this.form.senha || this.form.senha !== this.form.confirmarSenha) {
        this.saveError.set('Senha e confirmar senha devem ser iguais no cadastro.');
        this.cdr.markForCheck();
        return;
      }
    } else {
      if (this.form.senha || this.form.confirmarSenha) {
        if (this.form.senha !== this.form.confirmarSenha) {
          this.saveError.set('Se alterar a senha, confirmação deve coincidir.');
          this.cdr.markForCheck();
          return;
        }
      }
    }
    if (!this.canGravar && !this.isEdit()) {
      this.toast.error('Sem permissão para cadastrar.');
      return;
    }
    if (this.isEdit() && !this.canAlterar) {
      this.toast.error('Sem permissão para alterar.');
      return;
    }
    this.saving.set(true);
    this.cdr.markForCheck();
    const pessoaId =
      this.form.pessoaId != null && Number.isFinite(this.form.pessoaId) ? this.form.pessoaId : 0;
    const perfilNome = this.resolvePerfilNomeForPayload(this.form.perfilId);
    const payload: Record<string, unknown> = {
      nome: this.form.nome.trim(),
      email: this.form.email.trim(),
      login: (this.form.login || this.form.email).trim(),
      senha: this.form.senha || undefined,
      confirmarSenha: this.form.confirmarSenha || undefined,
      cpf: this.form.cpf?.trim() || undefined,
      tipoPessoa: this.form.tipoPessoa,
      tipoPapel: this.form.tipoPapel,
      pessoaId,
      ativo: this.form.ativo,
      perfilId: this.form.perfilId || undefined,
      perfilNome,
      EstacionamentoId:
        this.form.vinculoTipo === 'estacionamento' && typeof this.form.EstacionamentoId === 'number'
          ? this.form.EstacionamentoId
          : 0,
      transportadoraId:
        this.form.vinculoTipo === 'transportadora' && typeof this.form.transportadoraId === 'number'
          ? this.form.transportadoraId
          : 0,
      ...(this.editItem()?.id ? { id: this.editItem()!.id } : {})
    };
    const req = this.isEdit()
      ? this.gerenciamentoService.alterar(payload)
      : this.gerenciamentoService.gravar(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(
          this.isEdit()
            ? 'Usuário atualizado.'
            : 'Cadastro realizado. Enviamos um e-mail de confirmação para usuário.'
        );
        this.fecharModalForm();
        this.buscar();
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.saveError.set(this.mensagemErroSalvar(err));
        this.cdr.markForCheck();
      }
    });
  }

  /** Valida formato mínimo de e-mail (evita envio que gera 400 na API). */
  private isEmailFormatoValido(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  /** ApiError do interceptor usa `message` na raiz; erros legados podem ser instância de Error. */
  private mensagemErroSalvar(err: unknown): string {
    const api = err as ApiError;
    let msg =
      (typeof api?.message === 'string' && api.message.trim() ? api.message.trim() : '') ||
      (err instanceof Error ? err.message : '');
    const fe = api?.fieldErrors;
    if (fe && typeof fe === 'object') {
      const detalhes = Object.entries(fe)
        .flatMap(([campo, msgs]) =>
          (Array.isArray(msgs) ? msgs : [String(msgs)]).map((m) =>
            m ? `${campo}: ${m}` : ''
          )
        )
        .filter(Boolean);
      if (detalhes.length > 0) {
        msg = [msg || 'Corrija os campos indicados.', ...detalhes].join(' ');
      }
    }
    return msg || 'Erro ao salvar.';
  }

  excluir(item: UsuarioGerenciamentoItem): void {
    if (!this.canExcluir || !item.id) {
      this.toast.error('Sem permissão para excluir (usuario.excluir) ou dado inválido.');
      return;
    }
    if (!window.confirm('Excluir este usuário? Esta ação não pode ser desfeita.')) {
      return;
    }
    this.gerenciamentoService.excluir(item.id).subscribe({
      next: () => {
        this.toast.success('Usuário excluído.');
        this.buscar();
        this.cdr.markForCheck();
      },
      error: (err: ApiError) => {
        this.toast.error(err?.message ?? 'Falha ao excluir.');
        this.cdr.markForCheck();
      }
    });
  }
}
