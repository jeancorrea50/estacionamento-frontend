import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import type {
  CompletarCadastroTransportadoraInput,
  ConcluirCadastroTransportadoraResult,
  ConviteTransportadoraPublicoDto,
  ConviteTransportadoraResult,
  CriarConviteTransportadoraInput,
  StatusCadastroTransportadora,
} from '../models/convite-transportadora.models';
import { parseStatusCadastroTransportadora } from '../models/convite-transportadora.models';

const CONVITE_BASE = `${environment.API_BASE_URL}/Transportadora/convite`;

export interface ConviteOperacaoResult {
  ok: boolean;
  data?: ConviteTransportadoraResult;
  message?: string;
}

/**
 * Cliente HTTP do contrato de Convite Transportadora.
 * EstacionamentoId do pátio vem do JWT / headers do interceptor — não enviar no body.
 */
@Injectable({ providedIn: 'root' })
export class ConviteTransportadoraService {
  private readonly http = inject(HttpClient);

  /** POST `/api/Transportadora/convite` */
  criar(input: CriarConviteTransportadoraInput): Observable<ConviteOperacaoResult> {
    const body = {
      responsavelNome: input.responsavelNome.trim(),
      responsavelCpf: input.responsavelCpf.replace(/\D/g, ''),
      responsavelEmail: input.responsavelEmail.trim().toLowerCase(),
    };
    return this.http.post<unknown>(CONVITE_BASE, body).pipe(
      timeout(30000),
      map((raw) => this.mapOperacao(raw, 'Convite enviado com sucesso.')),
      catchError((err) => of(this.mapErro(err, 'Não foi possível enviar o convite.')))
    );
  }

  /** POST `/api/Transportadora/convite/{id}/reenviar` */
  reenviar(conviteId: number): Observable<ConviteOperacaoResult> {
    if (!conviteId || conviteId <= 0) {
      return of({ ok: false, message: 'Convite inválido.' });
    }
    return this.http.post<unknown>(`${CONVITE_BASE}/${conviteId}/reenviar`, {}).pipe(
      timeout(30000),
      map((raw) => this.mapOperacao(raw, 'Convite reenviado com sucesso.')),
      catchError((err) => of(this.mapErro(err, 'Não foi possível reenviar o convite.')))
    );
  }

  /** POST `/api/Transportadora/convite/{id}/cancelar` */
  cancelar(conviteId: number): Observable<ConviteOperacaoResult> {
    if (!conviteId || conviteId <= 0) {
      return of({ ok: false, message: 'Convite inválido.' });
    }
    return this.http.post<unknown>(`${CONVITE_BASE}/${conviteId}/cancelar`, {}).pipe(
      timeout(30000),
      map((raw) => this.mapOperacao(raw, 'Convite cancelado.')),
      catchError((err) => of(this.mapErro(err, 'Não foi possível cancelar o convite.')))
    );
  }

  /** GET `/api/Transportadora/convite/publico/{token}` */
  obterPorToken(token: string): Observable<ConviteTransportadoraPublicoDto | null> {
    const t = (token ?? '').trim();
    if (!t) return of(null);
    return this.http.get<unknown>(`${CONVITE_BASE}/publico/${encodeURIComponent(t)}`).pipe(
      timeout(20000),
      map((body) => this.mapPublico(body)),
      catchError(() => of(null))
    );
  }

  /** PUT `/api/Transportadora/convite/publico/{token}/rascunho` */
  salvarRascunho(
    token: string,
    input: CompletarCadastroTransportadoraInput
  ): Observable<{ ok: boolean; message?: string }> {
    const t = (token ?? '').trim();
    if (!t) return of({ ok: false, message: 'Token inválido.' });
    return this.http.put<unknown>(`${CONVITE_BASE}/publico/${encodeURIComponent(t)}/rascunho`, input).pipe(
      timeout(30000),
      map((body) => {
        const o = (body ?? {}) as Record<string, unknown>;
        const success = o['success'] === true || o['Success'] === true || o['sucesso'] === true;
        const msg = String(o['message'] ?? o['Message'] ?? o['mensagem'] ?? '');
        return { ok: success || body != null, message: msg || 'Rascunho salvo.' };
      }),
      catchError((err) => of(this.mapErro(err, 'Não foi possível salvar o rascunho.')))
    );
  }

  /** POST `/api/Transportadora/convite/publico/{token}/concluir` */
  concluir(
    token: string,
    input: CompletarCadastroTransportadoraInput
  ): Observable<{ ok: boolean; data?: ConcluirCadastroTransportadoraResult; message?: string }> {
    const t = (token ?? '').trim();
    if (!t) return of({ ok: false, message: 'Token inválido.' });
    return this.http.post<unknown>(`${CONVITE_BASE}/publico/${encodeURIComponent(t)}/concluir`, input).pipe(
      timeout(60000),
      map((body) => {
        const peeled = this.peel(body);
        const o = peeled ?? {};
        const transportadoraId = Number(o['transportadoraId'] ?? o['TransportadoraId'] ?? 0) || 0;
        const status =
          parseStatusCadastroTransportadora(o['status'] ?? o['Status'] ?? o['statusCadastro']) ?? 'Ativa';
        const msg = String(o['mensagem'] ?? o['message'] ?? o['Message'] ?? '');
        const envelope = (body ?? {}) as Record<string, unknown>;
        const success =
          envelope['success'] === true ||
          envelope['Success'] === true ||
          transportadoraId > 0;
        return {
          ok: success,
          message: msg || (success ? 'Cadastro concluído com sucesso.' : 'Falha ao concluir cadastro.'),
          data: success
            ? { transportadoraId, status: status as StatusCadastroTransportadora, mensagem: msg || null }
            : undefined,
        };
      }),
      catchError((err) => {
        const mapped = this.mapErro(err, 'Não foi possível concluir o cadastro.');
        return of({ ok: false as const, message: mapped.message });
      })
    );
  }

  private mapOperacao(raw: unknown, defaultOk: string): ConviteOperacaoResult {
    const envelope = (raw ?? {}) as Record<string, unknown>;
    const peeled = this.peel(raw) ?? envelope;
    const success =
      envelope['success'] === true ||
      envelope['Success'] === true ||
      envelope['sucesso'] === true ||
      Number(peeled['id'] ?? peeled['Id'] ?? 0) > 0;
    const msg = String(
      envelope['message'] ?? envelope['Message'] ?? envelope['mensagem'] ?? peeled['mensagem'] ?? ''
    );
    const status =
      parseStatusCadastroTransportadora(peeled['status'] ?? peeled['Status'] ?? peeled['statusCadastro']) ??
      'ConviteEnviado';
    return {
      ok: success,
      message: msg || (success ? defaultOk : 'Operação não concluída.'),
      data: success
        ? {
            id: Number(peeled['id'] ?? peeled['Id'] ?? 0) || 0,
            status,
            responsavelNome: String(peeled['responsavelNome'] ?? peeled['ResponsavelNome'] ?? ''),
            responsavelCpf: String(peeled['responsavelCpf'] ?? peeled['ResponsavelCpf'] ?? ''),
            responsavelEmail: String(peeled['responsavelEmail'] ?? peeled['ResponsavelEmail'] ?? ''),
            linkConviteFrontend:
              (peeled['linkConviteFrontend'] ??
                peeled['LinkConviteFrontend'] ??
                null) as string | null,
            emailEnviado:
              peeled['emailEnviado'] === true ||
              peeled['EmailEnviado'] === true ||
              undefined,
            expiresAt: (peeled['expiresAt'] ?? peeled['ExpiresAt'] ?? null) as string | null,
            transportadoraId:
              Number(peeled['transportadoraId'] ?? peeled['TransportadoraId'] ?? 0) || null,
            mensagem: msg || null,
          }
        : undefined,
    };
  }

  private mapPublico(body: unknown): ConviteTransportadoraPublicoDto | null {
    const o = this.peel(body);
    if (!o) return null;
    const status =
      parseStatusCadastroTransportadora(o['status'] ?? o['Status'] ?? o['statusCadastro']) ??
      'ConviteEnviado';
    const tokenValido =
      o['tokenValido'] === true ||
      o['TokenValido'] === true ||
      (o['tokenValido'] == null && status !== 'ConviteExpirado' && status !== 'Ativa');
    return {
      tokenValido,
      status,
      responsavelNome: String(o['responsavelNome'] ?? o['ResponsavelNome'] ?? ''),
      responsavelCpf: String(o['responsavelCpf'] ?? o['ResponsavelCpf'] ?? ''),
      responsavelEmail: String(o['responsavelEmail'] ?? o['ResponsavelEmail'] ?? ''),
      estacionamentoNome: (o['estacionamentoNome'] ?? o['EstacionamentoNome'] ?? null) as string | null,
      transportadoraId: Number(o['transportadoraId'] ?? o['TransportadoraId'] ?? 0) || null,
      progressoCadastro: (() => {
        const n = Number(o['progressoCadastro'] ?? o['ProgressoCadastro']);
        return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.trunc(n))) : null;
      })(),
      rascunho: (o['rascunho'] ?? o['Rascunho'] ?? null) as CompletarCadastroTransportadoraInput | null,
      mensagem: (o['mensagem'] ?? o['message'] ?? o['Message'] ?? null) as string | null,
      expiresAt: (o['expiresAt'] ?? o['ExpiresAt'] ?? null) as string | null,
    };
  }

  private peel(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') return null;
    const o = body as Record<string, unknown>;
    const inner = o['result'] ?? o['Result'] ?? o['data'] ?? o['Data'];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      return inner as Record<string, unknown>;
    }
    return o;
  }

  private mapErro(err: unknown, fallback: string): ConviteOperacaoResult {
    const e = err as {
      status?: number;
      error?: {
        message?: string;
        mensagem?: string;
        Message?: string;
        notifications?: unknown;
        title?: string;
      };
      message?: string;
    };
    const status = Number(e?.status);
    if (status === 404 || status === 405) {
      return {
        ok: false,
        message:
          'API de convite ainda não está disponível no backend (endpoint /Transportadora/convite). ' +
          'O frontend está pronto; falta publicar o módulo de convite no servidor.',
      };
    }
    if (status === 401 || status === 403) {
      return {
        ok: false,
        message: 'Sem permissão para enviar convite. Verifique o login e o pátio selecionado.',
      };
    }
    const notifications = e?.error?.notifications;
    const fromList = Array.isArray(notifications) ? String(notifications[0] ?? '') : '';
    const fromBody =
      e?.error?.message ?? e?.error?.mensagem ?? e?.error?.Message ?? e?.error?.title ?? '';
    const genericHttp =
      typeof e?.message === 'string' && /erro na requisição\s*\(\d+\)/i.test(e.message)
        ? ''
        : e?.message;
    const msg = fromBody || fromList || genericHttp || fallback;
    return { ok: false, message: String(msg || fallback) };
  }
}
