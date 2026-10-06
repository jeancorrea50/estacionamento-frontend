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

/** API autenticada publicada no backend (GtCentral). */
const CONVITE_AUTH = `${environment.API_BASE_URL}/ConviteTransportadora`;
/** API pública por token. */
const CONVITE_PUBLIC = `${environment.API_BASE_URL}/public/convite-transportadora`;

export interface ConviteOperacaoResult {
  ok: boolean;
  data?: ConviteTransportadoraResult;
  message?: string;
}

/**
 * Cliente HTTP do convite de transportadora.
 * Alinhado a `/api/ConviteTransportadora` + `/api/public/convite-transportadora`.
 */
@Injectable({ providedIn: 'root' })
export class ConviteTransportadoraService {
  private readonly http = inject(HttpClient);

  /** POST `/api/ConviteTransportadora` */
  criar(input: CriarConviteTransportadoraInput): Observable<ConviteOperacaoResult> {
    const email = input.responsavelEmail.trim().toLowerCase();
    const body = {
      emailConvidado: email,
      clientUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
      responsavelNome: input.responsavelNome.trim(),
      responsavelCpf: input.responsavelCpf.replace(/\D/g, ''),
      responsavelEmail: email,
      diasExpiracao: 7,
    };
    return this.http.post<unknown>(CONVITE_AUTH, body).pipe(
      timeout(30000),
      map((raw) => this.mapOperacao(raw, 'Convite gerado com sucesso.')),
      catchError((err) => of(this.mapErro(err, 'Não foi possível enviar o convite.')))
    );
  }

  /** Cancelar via POST `/api/ConviteTransportadora/{id}/cancelar` (reenvio não implementado). */
  reenviar(conviteId: number): Observable<ConviteOperacaoResult> {
    if (!conviteId || conviteId <= 0) {
      return of({ ok: false, message: 'Convite inválido.' });
    }
    return of({
      ok: false,
      message: 'Reenvio de e-mail ainda não está disponível. Copie o link do convite novamente.',
    });
  }

  /** POST `/api/ConviteTransportadora/{id}/cancelar` */
  cancelar(conviteId: number): Observable<ConviteOperacaoResult> {
    if (!conviteId || conviteId <= 0) {
      return of({ ok: false, message: 'Convite inválido.' });
    }
    return this.http.post<unknown>(`${CONVITE_AUTH}/${conviteId}/cancelar`, {}).pipe(
      timeout(30000),
      map((raw) => this.mapOperacao(raw, 'Convite cancelado.')),
      catchError((err) => of(this.mapErro(err, 'Não foi possível cancelar o convite.')))
    );
  }

  /** GET `/api/public/convite-transportadora/{token}` */
  obterPorToken(token: string): Observable<ConviteTransportadoraPublicoDto | null> {
    const t = (token ?? '').trim();
    if (!t) return of(null);
    return this.http.get<unknown>(`${CONVITE_PUBLIC}/${encodeURIComponent(t)}`).pipe(
      timeout(20000),
      map((body) => this.mapPublico(body)),
      catchError(() => of(null))
    );
  }

  /** Compat: rascunho não existe na API por etapas — no-op ok. */
  salvarRascunho(
    _token: string,
    _input: CompletarCadastroTransportadoraInput
  ): Observable<{ ok: boolean; message?: string }> {
    return of({ ok: true, message: 'Use a tela de etapas do convite para salvar o progresso.' });
  }

  /** Compat: conclusão é na etapa endereço da tela pública. */
  concluir(
    _token: string,
    _input: CompletarCadastroTransportadoraInput
  ): Observable<{ ok: boolean; data?: ConcluirCadastroTransportadoraResult; message?: string }> {
    return of({
      ok: false,
      message: 'Conclua o cadastro pela tela pública multi-step do convite.',
    });
  }

  private mapOperacao(raw: unknown, defaultOk: string): ConviteOperacaoResult {
    const envelope = (raw ?? {}) as Record<string, unknown>;
    const peeled = this.peel(raw) ?? envelope;
    const success =
      envelope['success'] === true ||
      envelope['Success'] === true ||
      envelope['sucesso'] === true ||
      envelope['sucess'] === true ||
      Number(peeled['id'] ?? peeled['Id'] ?? 0) > 0;
    const msg = String(
      envelope['message'] ?? envelope['Message'] ?? envelope['mensagem'] ?? peeled['mensagem'] ?? ''
    );
    const statusRaw = peeled['status'] ?? peeled['Status'] ?? 'ConviteEnviado';
    const status =
      parseStatusCadastroTransportadora(statusRaw) ??
      (String(statusRaw) === 'Pendente' || String(statusRaw) === 'EmAndamento'
        ? 'ConviteEnviado'
        : String(statusRaw) === 'Concluido'
          ? 'Ativa'
          : 'ConviteEnviado');
    const url =
      (peeled['urlConvite'] ??
        peeled['UrlConvite'] ??
        peeled['linkConviteFrontend'] ??
        peeled['LinkConviteFrontend'] ??
        null) as string | null;
    return {
      ok: success,
      message: msg || (success ? defaultOk : 'Operação não concluída.'),
      data: success
        ? {
            id: Number(peeled['id'] ?? peeled['Id'] ?? 0) || 0,
            status: status as StatusCadastroTransportadora,
            responsavelNome: String(peeled['responsavelNome'] ?? peeled['ResponsavelNome'] ?? ''),
            responsavelCpf: String(peeled['responsavelCpf'] ?? peeled['ResponsavelCpf'] ?? ''),
            responsavelEmail: String(
              peeled['responsavelEmail'] ??
                peeled['ResponsavelEmail'] ??
                peeled['emailConvidado'] ??
                peeled['EmailConvidado'] ??
                ''
            ),
            linkConviteFrontend: url,
            emailEnviado: false,
            expiresAt: (peeled['dataExpiracao'] ?? peeled['DataExpiracao'] ?? peeled['expiresAt'] ?? null) as
              | string
              | null,
            transportadoraId:
              Number(peeled['transportadoraIdCriada'] ?? peeled['TransportadoraIdCriada'] ?? 0) || null,
            mensagem: msg || null,
          }
        : undefined,
    };
  }

  private mapPublico(body: unknown): ConviteTransportadoraPublicoDto | null {
    const o = this.peel(body);
    if (!o) return null;
    const statusApi = String(o['status'] ?? o['Status'] ?? '');
    const status: StatusCadastroTransportadora =
      statusApi === 'Concluido'
        ? 'Ativa'
        : statusApi === 'Expirado'
          ? 'ConviteExpirado'
          :       statusApi === 'Cancelado'
            ? 'Inativa'
            : 'ConviteEnviado';
    const etapa = Number(o['etapaAtual'] ?? o['EtapaAtual'] ?? 1);
    const progresso = Number.isFinite(etapa) ? Math.min(100, Math.max(0, (etapa - 1) * 25)) : null;
    return {
      tokenValido: status !== 'ConviteExpirado' && status !== 'Ativa' && statusApi !== 'Cancelado',
      status,
      responsavelNome: String(o['responsavelNome'] ?? o['ResponsavelNome'] ?? ''),
      responsavelCpf: String(o['responsavelCpf'] ?? o['ResponsavelCpf'] ?? ''),
      responsavelEmail: String(
        o['responsavelEmail'] ?? o['ResponsavelEmail'] ?? o['emailConvidado'] ?? o['EmailConvidado'] ?? ''
      ),
      estacionamentoNome: null,
      transportadoraId: Number(o['transportadoraIdCriada'] ?? o['TransportadoraIdCriada'] ?? 0) || null,
      progressoCadastro: progresso,
      rascunho: null,
      mensagem: (o['mensagem'] ?? o['message'] ?? o['Message'] ?? null) as string | null,
      expiresAt: (o['dataExpiracao'] ?? o['DataExpiracao'] ?? null) as string | null,
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
        errors?: unknown;
      };
      message?: string;
    };
    const status = Number(e?.status);
    if (status === 401 || status === 403) {
      return {
        ok: false,
        message: 'Sem permissão para enviar convite. Verifique o login e o pátio selecionado.',
      };
    }
    const notifications = e?.error?.notifications;
    const fromList = Array.isArray(notifications) ? String(notifications[0] ?? '') : '';
    const errors = e?.error?.errors;
    const fromErrors = Array.isArray(errors) ? errors.map(String).join(' ') : '';
    const fromBody =
      e?.error?.message ?? e?.error?.mensagem ?? e?.error?.Message ?? e?.error?.title ?? '';
    const msg = fromBody || fromErrors || fromList || e?.message || fallback;
    return { ok: false, message: String(msg || fallback) };
  }
}
