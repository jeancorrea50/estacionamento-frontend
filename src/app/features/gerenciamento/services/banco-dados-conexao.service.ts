import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { mergeServiceResultToRoot } from '../../../core/api/utils/service-result.util';
import type {
  AmbienteBancoDados,
  BancoDadosConexao,
  BancoDadosConexaoFormPayload,
  BancoDadosConexaoMigration,
  BancoDadosConexaoOpcoes,
  BancoDadosConexaoTestarResult,
  BancoDadosConexaoTransferirPayload,
  BancoDadosNomeSelect,
  BancoDadosNomeSugerido,
  EstacionamentoSelect,
  SelectItem,
  TipoBancoDados,
  TransferenciaBancoDados,
  TransferenciaEnfileiradaResult,
} from '../models/banco-dados-conexao.models';

const API = `${environment.API_BASE_URL}/BancoDadosConexao`;

function peel<T>(body: unknown): T {
  if (body && typeof body === 'object') {
    const merged = mergeServiceResultToRoot(body as Record<string, unknown>);
    const r = merged['result'] ?? merged['Result'] ?? merged['data'] ?? merged['Data'] ?? merged;
    return r as T;
  }
  return body as T;
}

function normalizeMigrationItem(raw: Record<string, unknown>): BancoDadosConexaoMigration {
  return {
    id: Number(raw['id'] ?? raw['Id'] ?? 0),
    bancoDadosConexaoId: Number(raw['bancoDadosConexaoId'] ?? raw['BancoDadosConexaoId'] ?? 0),
    ambiente: Number(raw['ambiente'] ?? raw['Ambiente'] ?? 0) as BancoDadosConexaoMigration['ambiente'],
    host: String(raw['host'] ?? raw['Host'] ?? ''),
    porta: Number(raw['porta'] ?? raw['Porta'] ?? 0),
    nomeBanco: String(raw['nomeBanco'] ?? raw['NomeBanco'] ?? ''),
    migrationName: String(raw['migrationName'] ?? raw['MigrationName'] ?? ''),
    status: Number(raw['status'] ?? raw['Status'] ?? 0) as BancoDadosConexaoMigration['status'],
    statusDescricao: (raw['statusDescricao'] ?? raw['StatusDescricao']) as string | undefined,
    detalheFalhaJson: (raw['detalheFalhaJson'] ?? raw['DetalheFalhaJson'] ?? null) as string | null,
    dataCriacao: String(raw['dataCriacao'] ?? raw['DataCriacao'] ?? ''),
    dataUltimaAtualizacao: String(raw['dataUltimaAtualizacao'] ?? raw['DataUltimaAtualizacao'] ?? ''),
    dataAplicacao: (raw['dataAplicacao'] ?? raw['DataAplicacao'] ?? null) as string | null,
  };
}

function normalizeConexao(item: BancoDadosConexao): BancoDadosConexao {
  const rec = item as unknown as Record<string, unknown>;
  const rawMig = rec['migration'] ?? rec['Migration'];
  const list = Array.isArray(rawMig)
    ? rawMig
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map(normalizeMigrationItem)
    : [];
  return { ...item, migration: list };
}

@Injectable({ providedIn: 'root' })
export class BancoDadosConexaoService {
  private readonly http = inject(HttpClient);

  listar(): Observable<BancoDadosConexao[]> {
    return this.http.get<unknown>(API).pipe(
      map((body) => {
        const raw = peel<unknown>(body);
        const lista = Array.isArray(raw) ? (raw as BancoDadosConexao[]) : [];
        return lista.map(normalizeConexao);
      })
    );
  }

  obterPorId(id: number): Observable<BancoDadosConexao> {
    return this.http
      .get<unknown>(`${API}/${id}`)
      .pipe(map((body) => normalizeConexao(peel<BancoDadosConexao>(body))));
  }

  listarOpcoes(): Observable<BancoDadosConexaoOpcoes> {
    return this.http.get<unknown>(`${API}/opcoes`).pipe(map((body) => peel<BancoDadosConexaoOpcoes>(body)));
  }

  listarHosts(): Observable<SelectItem[]> {
    return this.http.get<unknown>(`${API}/opcoes/hosts`).pipe(
      map((body) => {
        const raw = peel<unknown>(body);
        return Array.isArray(raw) ? (raw as SelectItem[]) : [];
      })
    );
  }

  listarBancos(host?: string | null): Observable<BancoDadosNomeSelect[]> {
    let params = new HttpParams();
    if (host?.trim()) params = params.set('host', host.trim());
    return this.http.get<unknown>(`${API}/opcoes/bancos`, { params }).pipe(
      map((body) => {
        const raw = peel<unknown>(body);
        return Array.isArray(raw) ? (raw as BancoDadosNomeSelect[]) : [];
      })
    );
  }

  listarEstacionamentos(): Observable<EstacionamentoSelect[]> {
    return this.http.get<unknown>(`${API}/opcoes/estacionamentos`).pipe(
      map((body) => {
        const raw = peel<unknown>(body);
        return Array.isArray(raw) ? (raw as EstacionamentoSelect[]) : [];
      })
    );
  }

  /** GET /api/BancoDadosConexao/sugerir-nome */
  sugerirNome(params: {
    descricao: string;
    ambiente: AmbienteBancoDados | number;
    tipoBanco: TipoBancoDados | number;
    ignorarId?: number | null;
  }): Observable<BancoDadosNomeSugerido> {
    let httpParams = new HttpParams()
      .set('descricao', params.descricao.trim())
      .set('ambiente', String(params.ambiente))
      .set('tipoBanco', String(params.tipoBanco));
    if (params.ignorarId && params.ignorarId > 0) {
      httpParams = httpParams.set('ignorarId', String(params.ignorarId));
    }
    return this.http.get<unknown>(`${API}/sugerir-nome`, { params: httpParams }).pipe(
      map((body) => {
        const raw = peel<Record<string, unknown>>(body) ?? {};
        return {
          nomeBanco: String(raw['nomeBanco'] ?? raw['NomeBanco'] ?? '').trim(),
          descricaoSlug: String(raw['descricaoSlug'] ?? raw['DescricaoSlug'] ?? '').trim(),
          ambienteCodigo: String(raw['ambienteCodigo'] ?? raw['AmbienteCodigo'] ?? '').trim(),
          maxLength: Number(raw['maxLength'] ?? raw['MaxLength'] ?? 128) || 128,
          padrao: String(raw['padrao'] ?? raw['Padrao'] ?? ''),
        } satisfies BancoDadosNomeSugerido;
      })
    );
  }

  testar(payload: BancoDadosConexaoFormPayload & { id?: number }): Observable<BancoDadosConexaoTestarResult> {
    return this.http
      .post<unknown>(`${API}/testar`, payload)
      .pipe(map((body) => peel<BancoDadosConexaoTestarResult>(body)));
  }

  /**
   * POST /api/BancoDadosConexao — valida, grava perfil, enfileira migrations (202).
   * Resposta: `{ sucesso, mensagem, hangfireJobId, data: { perfil } }` ou envelope legado.
   */
  gravar(payload: BancoDadosConexaoFormPayload): Observable<{
    perfil: BancoDadosConexao;
    mensagem?: string;
    hangfireJobId?: string;
    migracaoEnfileirada?: boolean;
  }> {
    return this.http.post<unknown>(API, payload).pipe(
      map((body) => {
        if (!body || typeof body !== 'object') {
          return { perfil: peel<BancoDadosConexao>(body) };
        }
        const o = mergeServiceResultToRoot(body as Record<string, unknown>);
        const dataRaw = o['data'] ?? o['Data'];
        const data =
          dataRaw != null && typeof dataRaw === 'object'
            ? (dataRaw as Record<string, unknown>)
            : null;
        const perfilRaw =
          data?.['perfil'] ??
          data?.['Perfil'] ??
          o['perfil'] ??
          o['Perfil'] ??
          (o['id'] != null || o['Id'] != null ? o : null);

        const perfil = normalizeConexao(
          (perfilRaw ?? peel<BancoDadosConexao>(body)) as BancoDadosConexao
        );

        return {
          perfil,
          mensagem: String(o['mensagem'] ?? o['Mensagem'] ?? '').trim() || undefined,
          hangfireJobId: (o['hangfireJobId'] ?? o['HangfireJobId']) as string | undefined,
          migracaoEnfileirada: Boolean(o['migracaoEnfileirada'] ?? o['MigracaoEnfileirada'] ?? false),
        };
      })
    );
  }

  alterar(payload: BancoDadosConexaoFormPayload & { id: number }): Observable<BancoDadosConexao> {
    return this.http.put<unknown>(API, payload).pipe(map((body) => peel<BancoDadosConexao>(body)));
  }

  /** POST /api/BancoDadosConexao/transferir — enfileira BACPAC (202). */
  transferir(payload: BancoDadosConexaoTransferirPayload): Observable<TransferenciaEnfileiradaResult> {
    return this.http.post<unknown>(`${API}/transferir`, payload).pipe(
      map((body) => {
        if (!body || typeof body !== 'object') {
          return { sucesso: false, mensagem: 'Resposta inválida.' };
        }
        const o = mergeServiceResultToRoot(body as Record<string, unknown>);
        const dataRaw = o['data'] ?? o['Data'];
        const hasEnvelope =
          'hangfireJobId' in o ||
          'HangfireJobId' in o ||
          (dataRaw != null && typeof dataRaw === 'object');

        if (hasEnvelope) {
          return {
            sucesso: Boolean(o['sucesso'] ?? o['Sucesso'] ?? true),
            mensagem: String(o['mensagem'] ?? o['Mensagem'] ?? ''),
            hangfireJobId: (o['hangfireJobId'] ?? o['HangfireJobId']) as string | undefined,
            data: dataRaw as TransferenciaBancoDados | undefined,
          };
        }

        return { sucesso: true, data: peel<TransferenciaBancoDados>(body) };
      })
    );
  }

  obterTransferencia(id: number): Observable<TransferenciaBancoDados> {
    return this.http
      .get<unknown>(`${API}/transferencias/${id}`)
      .pipe(map((body) => peel<TransferenciaBancoDados>(body)));
  }

  listarTransferencias(codExportacao?: string | null): Observable<TransferenciaBancoDados[]> {
    let params = new HttpParams();
    if (codExportacao?.trim()) params = params.set('codExportacao', codExportacao.trim());
    return this.http.get<unknown>(`${API}/transferencias`, { params }).pipe(
      map((body) => {
        const raw = peel<unknown>(body);
        return Array.isArray(raw) ? (raw as TransferenciaBancoDados[]) : [];
      })
    );
  }
}
