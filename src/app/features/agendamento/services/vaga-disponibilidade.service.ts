import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  VagaDisponibilidadeResumo,
  VagaReservaTransportadoraInput,
  VagaReservaTransportadoraItem,
} from '../models/vaga-disponibilidade.models';

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  result?: T;
}

@Injectable({ providedIn: 'root' })
export class VagaDisponibilidadeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.API_BASE_URL}/Agendamento/vagas`;

  /**
   * GET `/Agendamento/vagas/disponibilidade?data=yyyy-MM-dd`
   * Sem `data`, o backend usa o dia atual do estacionamento.
   */
  resumoParaTransportadora(dataIso?: string | null): Observable<VagaDisponibilidadeResumo | null> {
    let params = new HttpParams();
    const data = (dataIso ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      params = params.set('data', data);
    }

    return this.http
      .get<ApiEnvelope<VagaDisponibilidadeResumo>>(`${this.base}/disponibilidade`, { params })
      .pipe(
        map((r) => r.result ?? null),
        catchError(() => of(null))
      );
  }

  listarReservas(): Observable<VagaReservaTransportadoraItem[]> {
    return this.http
      .get<ApiEnvelope<VagaReservaTransportadoraItem[] | Record<string, unknown>[]>>(
        `${this.base}/reservas`
      )
      .pipe(
        map((r) => (r.result ?? []).map((row) => this.mapReserva(row))),
        catchError(() => of([]))
      );
  }

  criarReserva(input: VagaReservaTransportadoraInput): Observable<VagaReservaTransportadoraItem | null> {
    const payload: VagaReservaTransportadoraInput = {
      ...input,
      transferenciaAutomaticaSaldo: !!input.transferenciaAutomaticaSaldo,
    };
    return this.http
      .post<ApiEnvelope<VagaReservaTransportadoraItem | Record<string, unknown>>>(
        `${this.base}/reservas`,
        payload
      )
      .pipe(
        map((r) => (r.result != null ? this.mapReserva(r.result) : null)),
        catchError(() => of(null))
      );
  }

  inativarReserva(id: number): Observable<boolean> {
    return this.http.delete<ApiEnvelope<object>>(`${this.base}/reservas/${id}`).pipe(
      map((r) => r.success !== false),
      catchError(() => of(false))
    );
  }

  private mapReserva(
    row: VagaReservaTransportadoraItem | Record<string, unknown>
  ): VagaReservaTransportadoraItem {
    const r = row as Record<string, unknown>;
    const base = row as VagaReservaTransportadoraItem;
    return {
      ...base,
      transferenciaAutomaticaSaldo: this.pickBool(
        r,
        'transferenciaAutomaticaSaldo',
        'TransferenciaAutomaticaSaldo'
      ),
    };
  }

  private pickBool(row: Record<string, unknown>, camel: string, pascal: string): boolean {
    const v = row[camel] ?? row[pascal];
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === 'true' || s === '1';
    }
    return false;
  }
}
