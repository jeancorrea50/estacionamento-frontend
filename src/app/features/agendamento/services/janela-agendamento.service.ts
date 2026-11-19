import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { throwIfServiceFailure, unwrapServiceResult } from '../../../core/api/utils/service-result.util';
import {
  mapJanelaDetalhe,
  mapJanelaDisponibilidade,
  mapJanelaPaged,
  montarPayloadJanela,
} from '../mappers/janela-agendamento.mapper';
import {
  JanelaAgendamentoDetalhe,
  JanelaAgendamentoFiltro,
  JanelaAgendamentoPayload,
  JanelaDisponibilidade,
  JanelaDuplicarInput,
  JanelaPagedResult,
  ModalidadeAgendamento,
  ModalidadeJanela,
} from '../models/janela-agendamento.models';
import { JanelaDisponibilidadeRealtimeService } from './janela-disponibilidade-realtime.service';

const REQUEST_TIMEOUT_MS = 15000;

/**
 * API `/api/JanelaAgendamento` (permissões `janelas.*`; `disponibilidade` aceita
 * `agendamentos.visualizar` / `agendar.*`).
 * Erros HTTP seguem pelo `errorInterceptor` (toast + ApiError); falhas lógicas
 * (`success: false` em 200) viram ApiError via `throwIfServiceFailure`.
 */
@Injectable({ providedIn: 'root' })
export class JanelaAgendamentoService {
  private readonly api = `${environment.API_BASE_URL}/JanelaAgendamento`;
  private readonly http = inject(HttpClient);
  private readonly realtime = inject(JanelaDisponibilidadeRealtimeService);

  buscar(filtro: JanelaAgendamentoFiltro = {}): Observable<JanelaPagedResult> {
    const numeroPagina = filtro.numeroPagina || 1;
    const tamanhoPagina = filtro.tamanhoPagina || 25;
    let params = new HttpParams()
      .set('NumeroPagina', String(numeroPagina))
      .set('TamanhoPagina', String(tamanhoPagina));
    if (filtro.modalidade) params = params.set('Modalidade', String(filtro.modalidade));
    if (filtro.ativo === true || filtro.ativo === false) params = params.set('Ativo', String(filtro.ativo));

    return this.http.get<unknown>(this.api, { params }).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((body) => mapJanelaPaged(unwrapServiceResult<unknown>(body), numeroPagina, tamanhoPagina))
    );
  }

  obterPorId(id: number): Observable<JanelaAgendamentoDetalhe> {
    return this.http.get<unknown>(`${this.api}/${id}`).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((body) => this.toDetalhe(body))
    );
  }

  gravar(payload: JanelaAgendamentoPayload): Observable<JanelaAgendamentoDetalhe> {
    return this.http.post<unknown>(this.api, montarPayloadJanela(payload)).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((body) => this.toDetalhe(body)),
      tap(() => this.realtime.notifyLocal())
    );
  }

  alterar(id: number, payload: JanelaAgendamentoPayload): Observable<JanelaAgendamentoDetalhe> {
    return this.http.put<unknown>(this.api, montarPayloadJanela({ ...payload, id })).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((body) => this.toDetalhe(body)),
      tap(() => this.realtime.notifyLocal())
    );
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<unknown>(`${this.api}/${id}`).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((body) => throwIfServiceFailure(body)),
      tap(() => this.realtime.notifyLocal())
    );
  }

  duplicar(input: JanelaDuplicarInput): Observable<JanelaAgendamentoDetalhe> {
    const body = {
      janelaOrigemId: input.janelaOrigemId,
      modalidadeDestino: input.modalidadeDestino,
      nome: input.nome.trim(),
    };
    return this.http.post<unknown>(`${this.api}/duplicar`, body).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((res) => this.toDetalhe(res)),
      tap(() => this.realtime.notifyLocal())
    );
  }

  /** Slots disponíveis (o backend já omite `disponiveis = 0`). Aceita Ambos (3). */
  disponibilidade(
    data: string,
    modalidade: ModalidadeJanela | ModalidadeAgendamento,
    transportadoraId?: number | null
  ): Observable<JanelaDisponibilidade> {
    let params = new HttpParams().set('data', data).set('modalidade', String(modalidade));
    if (typeof transportadoraId === 'number' && transportadoraId > 0) {
      params = params.set('transportadoraId', String(transportadoraId));
    }
    return this.http.get<unknown>(`${this.api}/disponibilidade`, { params }).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((body) => mapJanelaDisponibilidade(unwrapServiceResult<unknown>(body)))
    );
  }

  private toDetalhe(body: unknown): JanelaAgendamentoDetalhe {
    const result = unwrapServiceResult<unknown>(body);
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw { message: 'Resposta inválida da API de janelas.', status: 502 };
    }
    return mapJanelaDetalhe(result as Record<string, unknown>);
  }
}
