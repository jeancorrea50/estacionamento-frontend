import { HttpClient } from '@angular/common/http';
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

  resumoParaTransportadora(): Observable<VagaDisponibilidadeResumo | null> {
    return this.http.get<ApiEnvelope<VagaDisponibilidadeResumo>>(`${this.base}/disponibilidade`).pipe(
      map((r) => r.result ?? null),
      catchError(() => of(null))
    );
  }

  listarReservas(): Observable<VagaReservaTransportadoraItem[]> {
    return this.http
      .get<ApiEnvelope<VagaReservaTransportadoraItem[]>>(`${this.base}/reservas`)
      .pipe(
        map((r) => r.result ?? []),
        catchError(() => of([]))
      );
  }

  criarReserva(input: VagaReservaTransportadoraInput): Observable<VagaReservaTransportadoraItem | null> {
    return this.http
      .post<ApiEnvelope<VagaReservaTransportadoraItem>>(`${this.base}/reservas`, input)
      .pipe(
        map((r) => r.result ?? null),
        catchError(() => of(null))
      );
  }

  inativarReserva(id: number): Observable<boolean> {
    return this.http.delete<ApiEnvelope<object>>(`${this.base}/reservas/${id}`).pipe(
      map((r) => r.success !== false),
      catchError(() => of(false))
    );
  }
}
