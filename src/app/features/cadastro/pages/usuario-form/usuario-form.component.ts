import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  AcessosUsuariosService,
  USUARIO_ENDPOINT_NAO_DISPONIVEL,
  USUARIO_EDITAR_ENDPOINT_NAO_DISPONIVEL,
} from '../../services/acessos-usuarios.service';
import {
  AcessosPerfisService,
  ApplicationRole,
} from '../../services/acessos-perfis.service';
import { AcessosPermissoesService } from '../../services/acessos-permissoes.service';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './usuario-form.component.html',
  styleUrls: ['./usuario-form.component.scss'],
})
export class UsuarioFormComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private usuariosService = inject(AcessosUsuariosService);
  private perfisService = inject(AcessosPerfisService);
  private permissoesService = inject(AcessosPermissoesService);
  private cdr = inject(ChangeDetectorRef);

  id: string | null = null;
  isEdit = false;
  saving = false;
  saveError: string | null = null;

  form = {
    nome: '',
    email: '',
    senha: '',
    ativo: true,
    tipo: '' as string,
    perfilIds: [] as string[],
    permissaoIds: [] as string[],
  };

  perfisList: ApplicationRole[] = [];
  loadingPerfis = false;
  perfisErro: string | null = null;

  permissoesList: { id: string; nome: string }[] = [];
  loadingPermissoes = false;
  permissoesErro: string | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.id = id;
    this.isEdit = !!id;
    if (id) {
      this.usuariosService.obterPorId(id).subscribe({
        next: (user: unknown) => {
          const u = user as { nome?: string; emailOuLogin?: string; ativo?: boolean; tipo?: string; perfilIds?: string[] };
          this.form.nome = u.nome ?? '';
          this.form.email = u.emailOuLogin ?? '';
          this.form.ativo = u.ativo ?? true;
          this.form.tipo = u.tipo ?? '';
          this.form.perfilIds = Array.isArray(u.perfilIds) ? [...u.perfilIds] : [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.cdr.markForCheck();
        },
      });
    }
    this.carregarPerfis();
    this.carregarPermissoes();
  }

  private carregarPerfis(): void {
    this.loadingPerfis = true;
    this.perfisErro = null;
    this.perfisService.buscar().subscribe({
      next: (body) => {
        this.loadingPerfis = false;
        this.perfisList = this.normalizePerfis(body);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingPerfis = false;
        this.perfisErro = 'Não foi possível carregar os perfis.';
        this.perfisList = [];
        this.cdr.markForCheck();
      },
    });
  }

  private carregarPermissoes(): void {
    this.loadingPermissoes = true;
    this.permissoesErro = null;
    this.permissoesService.buscar().subscribe({
      next: (body: unknown) => {
        this.loadingPermissoes = false;
        this.permissoesList = this.normalizePermissoes(body);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingPermissoes = false;
        this.permissoesErro = 'Endpoint de permissões não encontrado no backend.';
        this.permissoesList = [];
        this.cdr.markForCheck();
      },
    });
  }

  private normalizePerfis(body: unknown): ApplicationRole[] {
    if (Array.isArray(body)) return body as ApplicationRole[];
    if (body && typeof body === 'object' && 'result' in body) {
      const r = (body as { result?: unknown }).result;
      return Array.isArray(r) ? (r as ApplicationRole[]) : [];
    }
    if (body && typeof body === 'object' && 'results' in body) {
      const r = (body as { results?: unknown }).results;
      return Array.isArray(r) ? (r as ApplicationRole[]) : [];
    }
    return [];
  }

  private normalizePermissoes(body: unknown): { id: string; nome: string }[] {
    if (Array.isArray(body)) return body as { id: string; nome: string }[];
    if (body && typeof body === 'object' && 'result' in body) {
      const r = (body as { result?: unknown }).result;
      return Array.isArray(r) ? (r as { id: string; nome: string }[]) : [];
    }
    return [];
  }

  togglePerfil(perfilId: string): void {
    const idx = this.form.perfilIds.indexOf(perfilId);
    if (idx >= 0) {
      this.form.perfilIds = this.form.perfilIds.filter((id) => id !== perfilId);
    } else {
      this.form.perfilIds = [...this.form.perfilIds, perfilId];
    }
    this.cdr.markForCheck();
  }

  toPerfilId(value: string | number | null | undefined): string {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string') return value;
    return '';
  }

  togglePermissao(permId: string): void {
    const idx = this.form.permissaoIds.indexOf(permId);
    if (idx >= 0) {
      this.form.permissaoIds = this.form.permissaoIds.filter((id) => id !== permId);
    } else {
      this.form.permissaoIds = [...this.form.permissaoIds, permId];
    }
    this.cdr.markForCheck();
  }

  salvar(): void {
    this.saveError = null;
    this.saving = true;
    this.cdr.markForCheck();

    const dto = {
      nome: this.form.nome,
      email: this.form.email,
      senha: this.form.senha || undefined,
      ativo: this.form.ativo,
      tipo: this.form.tipo || undefined,
      perfilIds: this.form.perfilIds,
      permissaoIds: this.form.permissaoIds,
      ...(this.id ? { id: this.id } : {}),
    };

    const obs = this.isEdit
      ? this.usuariosService.alterar(dto)
      : this.usuariosService.gravar(dto);

    obs.subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/app/administracao/usuario']);
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.saveError = this.isEdit
          ? USUARIO_EDITAR_ENDPOINT_NAO_DISPONIVEL
          : USUARIO_ENDPOINT_NAO_DISPONIVEL;
        this.cdr.markForCheck();
      },
    });
  }
}
