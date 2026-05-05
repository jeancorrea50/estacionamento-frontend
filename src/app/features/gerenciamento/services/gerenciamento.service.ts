import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { AcessosUsuariosService, UsuarioListItem } from '../../cadastro/services/acessos-usuarios.service';
import { AcessosPerfisService, ApplicationRole } from '../../cadastro/services/acessos-perfis.service';
import { UsuarioGerenciamentoItem, GerenciamentoFiltros } from '../models/gerenciamento.types';
import type { UsuarioDetalheOutput } from '../../../core/api/types/usuario-api.types';
import { EstacionamentoLookupService, LookupOption } from '../../cadastro/services/estacionamento-lookup.service';

/**
 * Orquestra listagem, CRUD e perfis da tela de Acessos (Gerenciamento).
 */
@Injectable({
  providedIn: 'root'
})
export class GerenciamentoService {
  constructor(
    private usuariosService: AcessosUsuariosService,
    private perfisService: AcessosPerfisService,
    private EstacionamentoLookup: EstacionamentoLookupService
  ) {}

  /** GET /api/auth/Usuario + filtros em memória. */
  buscar(filtros: GerenciamentoFiltros): Observable<UsuarioGerenciamentoItem[]> {
    return forkJoin({
      usuariosBody: this.usuariosService.buscar(),
      estacionamentos: this.EstacionamentoLookup.list().pipe(catchError(() => of([] as LookupOption[])))
    }).pipe(
      map(({ usuariosBody, estacionamentos }) => this.normalizeList(usuariosBody, filtros, estacionamentos))
    );
  }

  getPerfis(): Observable<ApplicationRole[]> {
    return this.perfisService.buscarSimplicadoUsuario().pipe(
      map((body) => this.normalizePerfis(body)),
      catchError(() => of([]))
    );
  }

  obterDetalhe(id: string): Observable<UsuarioDetalheOutput & { nome?: string; emailOuLogin?: string; cpfCnpj?: string }> {
    return this.usuariosService.obterPorId(id) as Observable<
      UsuarioDetalheOutput & { nome?: string; emailOuLogin?: string; cpfCnpj?: string }
    >;
  }

  gravar(dto: unknown): Observable<unknown> {
    return this.usuariosService.gravar(dto);
  }

  alterar(dto: unknown): Observable<unknown> {
    return this.usuariosService.alterar(dto);
  }

  excluir(id: string): Observable<unknown> {
    return this.usuariosService.delete(id);
  }

  private normalizeList(
    body: unknown,
    filtros: GerenciamentoFiltros,
    estacionamentos: LookupOption[]
  ): UsuarioGerenciamentoItem[] {
    const estMap = new Map<number, string>();
    for (const e of estacionamentos) {
      if (typeof e.id === 'number' && Number.isFinite(e.id)) {
        estMap.set(e.id, e.label);
      }
    }
    const raw = this.normalizeListRaw(body);
    return raw
      .map((item) => this.toGerenciamentoItem(item, estMap))
      .filter((item) => this.passaFiltros(item, filtros));
  }

  private passaFiltros(
    item: UsuarioGerenciamentoItem,
    filtros: GerenciamentoFiltros
  ): boolean {
    const termo = (filtros.nomeOuEmail ?? '').trim().toLowerCase();
    if (termo) {
      const partes = [item.nome, item.userName, item.email, item.emailOuLogin].filter(
        (s): s is string => typeof s === 'string' && s.trim() !== ''
      );
      const ok = partes.some((p) => p.toLowerCase().includes(termo));
      if (!ok) {
        return false;
      }
    }
    const pn = (filtros.perfilNome ?? '').trim().toLowerCase();
    if (pn) {
      const role = (item.perfil ?? '').trim().toLowerCase();
      if (!role) {
        return false;
      }
      if (role !== pn && !role.includes(pn)) {
        return false;
      }
    }
    return true;
  }

  private normalizeListRaw(body: unknown): UsuarioListItem[] {
    if (Array.isArray(body)) {
      return body as UsuarioListItem[];
    }
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

  /** Lista pode vir com `EstacionamentoId` (PascalCase) ou `estacionamentoId` (camelCase) conforme serialização JSON. */
  private toGerenciamentoItem(item: UsuarioListItem, estMap: Map<number, string>): UsuarioGerenciamentoItem {
    const rawItem = item as UsuarioListItem & {
      estacionamentoId?: number | null;
      estacionamento?: string | null;
      Estacionamento?: string | null;
    };
    const EstacionamentoId = item.EstacionamentoId ?? rawItem.estacionamentoId ?? null;
    const estacionamentoDaApi = String(
      rawItem.estacionamento ?? rawItem.Estacionamento ?? ''
    ).trim();
    const EstacionamentoNome =
      estacionamentoDaApi ||
      (typeof EstacionamentoId === 'number' && EstacionamentoId > 0
        ? estMap.get(EstacionamentoId) ?? null
        : null);
    return {
      id: item.id,
      userName: item.userName,
      nome: item.nome,
      email: item.email,
      emailOuLogin: (item.emailOuLogin ?? item.email ?? item.userName) as string,
      perfil: item.perfil ?? item.role ?? null,
      EstacionamentoId,
      EstacionamentoNome,
      ativo: item.ativo ?? true
    };
  }

  private normalizePerfis(body: unknown): ApplicationRole[] {
    if (Array.isArray(body)) {
      return body as ApplicationRole[];
    }
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
}
