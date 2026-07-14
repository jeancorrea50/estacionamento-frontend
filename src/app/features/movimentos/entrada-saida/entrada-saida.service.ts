import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EntradaSaidaFiltro,
  EntradaSaidaPagedResult,
  EntradaSaidaPermanenciaInput,
  EntradaSaidaPostInput,
  EntradaSaidaPutInput,
  EntradaSaidaOutput,
  EntradaSaidaSearchOutput,
  parseEntradaSaidaStatus
} from '../models/entrada-saida.models';

const ENTRADA_SAIDA_API = `${environment.API_BASE_URL}/EntradaSaida`;

@Injectable({ providedIn: 'root' })
export class EntradaSaidaService {
  private readonly http = inject(HttpClient);

  buscar(filtro: EntradaSaidaFiltro): Observable<EntradaSaidaPagedResult<EntradaSaidaSearchOutput>> {
    const params = this.buildBuscarParams(filtro);
    return this.http.get<unknown>(ENTRADA_SAIDA_API, { params }).pipe(
      map((body) => this.normalizePagedResult(body, filtro.numeroPagina, filtro.tamanhoPagina))
    );
  }

  getById(id: number): Observable<EntradaSaidaOutput | null> {
    return this.http.get<unknown>(`${ENTRADA_SAIDA_API}/${id}`).pipe(
      map((body) => this.extractResult<EntradaSaidaOutput>(body))
    );
  }

  obterPorPlaca(placa: string): Observable<EntradaSaidaOutput | null> {
    return this.http.get<unknown>(`${ENTRADA_SAIDA_API}/buscar-por-placa/${encodeURIComponent(placa)}`).pipe(
      map((body) => this.extractResult<EntradaSaidaOutput>(body))
    );
  }

  create(data: EntradaSaidaPostInput): Observable<EntradaSaidaOutput> {
    return this.http.post<EntradaSaidaOutput>(ENTRADA_SAIDA_API, data);
  }

  update(id: number, data: EntradaSaidaPostInput): Observable<EntradaSaidaOutput> {
    const payload: EntradaSaidaPutInput = { ...data, id };
    return this.http.put<EntradaSaidaOutput>(ENTRADA_SAIDA_API, payload);
  }

  suspenderPermanencia(id: number, payload: EntradaSaidaPermanenciaInput): Observable<void> {
    return this.http.patch<void>(`${ENTRADA_SAIDA_API}/${id}/suspender-permanencia`, payload);
  }

  finalizarPermanencia(id: number, dataHoraEvento?: string): Observable<void> {
    let params = new HttpParams();
    if (dataHoraEvento?.trim()) {
      params = params.set('dataHoraSaida', dataHoraEvento.trim());
    }
    return this.http.patch<void>(`${ENTRADA_SAIDA_API}/${id}/finalizar-permanencia`, null, { params });
  }

  saida(placa: string): Observable<void> {
    return this.http.post<void>(`${ENTRADA_SAIDA_API}/saida`, { placa });
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${ENTRADA_SAIDA_API}/${id}`);
  }

  private buildBuscarParams(filtro: EntradaSaidaFiltro): HttpParams {
    let params = new HttpParams()
      .set('NumeroPagina', String(filtro.numeroPagina))
      .set('TamanhoPagina', String(filtro.tamanhoPagina))
      .set('page', String(filtro.page ?? filtro.numeroPagina))
      .set('size', String(filtro.size ?? filtro.tamanhoPagina));

    if (filtro.placa?.trim()) params = params.set('placa', filtro.placa.trim());
    if (typeof filtro.motoristaId === 'number') params = params.set('motoristaId', String(filtro.motoristaId));
    if (typeof filtro.transportadoraId === 'number') params = params.set('transportadoraId', String(filtro.transportadoraId));
    if (typeof filtro.somenteEmAberto === 'boolean') params = params.set('somenteEmAberto', String(filtro.somenteEmAberto));
    return params;
  }

  private normalizePagedResult(
    body: unknown,
    numeroPagina: number,
    tamanhoPagina: number
  ): EntradaSaidaPagedResult<EntradaSaidaSearchOutput> {
    const source = this.unwrap(body);
    const root = (source && typeof source === 'object') ? source as Record<string, unknown> : {};
    const rows =
      (Array.isArray(root['results']) && root['results']) ||
      (Array.isArray(root['items']) && root['items']) ||
      (Array.isArray(root['itens']) && root['itens']) ||
      (Array.isArray(source) && source) ||
      [];

    const items = rows
      .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
      .map((row) => this.mapSearchItem(row));

    return {
      items,
      totalCount: Number(root['rowCount'] ?? root['totalCount'] ?? root['totalRegistros'] ?? items.length) || items.length,
      numeroPagina: Number(root['currentPage'] ?? root['numeroPagina'] ?? numeroPagina) || numeroPagina,
      tamanhoPagina: Number(root['pageSize'] ?? root['tamanhoPagina'] ?? tamanhoPagina) || tamanhoPagina
    };
  }

  private mapSearchItem(row: Record<string, unknown>): EntradaSaidaSearchOutput {
    return {
      id: Number(row['id']) || 0,
      descricao: String(row['descricao'] ?? ''),
      motoristaId: Number(row['motoristaId']) || 0,
      nomeMotorista: String(row['nomeMotorista'] ?? ''),
      transportadoraId: Number(row['transportadoraId']) || 0,
      nomeTransportadora: String(row['nomeTransportadora'] ?? ''),
      veiculoId: Number(row['veiculoId']) || 0,
      placaVeiculo: String(row['placaVeiculo'] ?? ''),
      dataHoraEntrada: String(row['dataHoraEntrada'] ?? ''),
      dataHoraSaida: (row['dataHoraSaida'] as string | null | undefined) ?? null,
      status: parseEntradaSaidaStatus(
        (row['status'] as number | string | undefined) ??
          (row['situacao'] as number | string | undefined) ??
          (row['Situacao'] as number | string | undefined)
      )
    };
  }

  private extractResult<T>(body: unknown): T | null {
    const raw = this.unwrap(body);
    if (raw == null || typeof raw !== 'object') return null;
    return raw as T;
  }

  private unwrap(body: unknown): unknown {
    let cur: unknown = body;
    for (let i = 0; i < 2; i++) {
      if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
      const obj = cur as Record<string, unknown>;
      if (obj['result'] != null) {
        cur = obj['result'];
        continue;
      }
      if (obj['Result'] != null) {
        cur = obj['Result'];
        continue;
      }
      break;
    }
    return cur;
  }
}
