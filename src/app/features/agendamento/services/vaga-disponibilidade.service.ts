import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  ModalidadeVagaAgendamento,
  PeriodicidadeVagaReserva,
  PeriodoDiaVaga,
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
      .get<ApiEnvelope<VagaDisponibilidadeResumo | Record<string, unknown>>>(
        `${this.base}/disponibilidade`,
        { params }
      )
      .pipe(
        map((r) => (r.result != null ? this.mapResumo(r.result) : null)),
        catchError(() => of(null))
      );
  }

  /**
   * GET `/Agendamento/vagas/reservas?data=yyyy-MM-dd` — destinações não excluídas.
   * `data` define o dia de `usadasNoDia` (default: hoje do estacionamento).
   */
  listarReservas(dataIso?: string | null): Observable<VagaReservaTransportadoraItem[]> {
    let params = new HttpParams();
    const data = (dataIso ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      params = params.set('data', data);
    }
    return this.http
      .get<ApiEnvelope<VagaReservaTransportadoraItem[] | Record<string, unknown>[]>>(
        `${this.base}/reservas`,
        { params }
      )
      .pipe(
        map((r) => (r.result ?? []).map((row) => this.mapReserva(row))),
        catchError(() => of([]))
      );
  }

  criarReserva(input: VagaReservaTransportadoraInput): Observable<VagaReservaTransportadoraItem | null> {
    return this.http
      .post<ApiEnvelope<VagaReservaTransportadoraItem | Record<string, unknown>>>(
        `${this.base}/reservas`,
        this.normalizarInput(input)
      )
      .pipe(
        map((r) => (r.result != null ? this.mapReserva(r.result) : null)),
        catchError(() => of(null))
      );
  }

  /** PUT `/Agendamento/vagas/reservas/{id}` — altera uma destinação (um horário). */
  atualizarReserva(
    id: number,
    input: VagaReservaTransportadoraInput
  ): Observable<VagaReservaTransportadoraItem | null> {
    return this.http
      .put<ApiEnvelope<VagaReservaTransportadoraItem | Record<string, unknown>>>(
        `${this.base}/reservas/${id}`,
        this.normalizarInput(input)
      )
      .pipe(
        map((r) => (r.result != null ? this.mapReserva(r.result) : null)),
        catchError(() => of(null))
      );
  }

  /** PATCH `/Agendamento/vagas/reservas/{id}/status` — pausa (`ativo=false`) ou reativa. */
  alterarStatusReserva(id: number, ativo: boolean): Observable<boolean> {
    return this.http
      .patch<ApiEnvelope<object>>(`${this.base}/reservas/${id}/status`, { ativo })
      .pipe(
        map((r) => r.success !== false),
        catchError(() => of(false))
      );
  }

  private normalizarInput(input: VagaReservaTransportadoraInput): VagaReservaTransportadoraInput {
    const dias =
      input.periodicidade === 2 && input.diasSemana != null && String(input.diasSemana).trim()
        ? String(input.diasSemana).trim()
        : null;
    const idOuNull = (v: number | null | undefined) => (v != null && v > 0 ? v : null);
    return {
      ...input,
      diasSemana: dias,
      transferenciaAutomaticaSaldo: !!input.transferenciaAutomaticaSaldo,
      responsavelFaturamentoId: idOuNull(input.responsavelFaturamentoId),
      destinadorId: idOuNull(input.destinadorId),
    };
  }

  /** DELETE `/Agendamento/vagas/reservas/{id}` — exclusão lógica (libera o saldo). */
  inativarReserva(id: number): Observable<boolean> {
    return this.http.delete<ApiEnvelope<object>>(`${this.base}/reservas/${id}`).pipe(
      map((r) => r.success !== false),
      catchError(() => of(false))
    );
  }

  private mapResumo(
    row: VagaDisponibilidadeResumo | Record<string, unknown>
  ): VagaDisponibilidadeResumo {
    const r = row as Record<string, unknown>;
    const base = row as VagaDisponibilidadeResumo;
    const reservasRaw = r['reservas'] ?? r['Reservas'];
    const reservas = Array.isArray(reservasRaw)
      ? reservasRaw.map((item) => this.mapReserva(item as Record<string, unknown>))
      : Array.isArray(base.reservas)
        ? base.reservas.map((item) => this.mapReserva(item))
        : [];
    return {
      capacidadeEstacionamento:
        this.pickNumberOrNull(r, 'capacidadeEstacionamento', 'CapacidadeEstacionamento') ??
        base.capacidadeEstacionamento ??
        null,
      capacidadeLimpeza:
        this.pickNumberOrNull(r, 'capacidadeLimpeza', 'CapacidadeLimpeza') ??
        base.capacidadeLimpeza ??
        null,
      vagasReservadasEstacionamento:
        this.pickNumber(r, 'vagasReservadasEstacionamento', 'VagasReservadasEstacionamento') ||
        base.vagasReservadasEstacionamento ||
        0,
      vagasReservadasLimpeza:
        this.pickNumber(r, 'vagasReservadasLimpeza', 'VagasReservadasLimpeza') ||
        base.vagasReservadasLimpeza ||
        0,
      vagasDisponiveisEstacionamento:
        this.pickNumberOrNull(r, 'vagasDisponiveisEstacionamento', 'VagasDisponiveisEstacionamento') ??
        base.vagasDisponiveisEstacionamento ??
        null,
      vagasDisponiveisLimpeza:
        this.pickNumberOrNull(r, 'vagasDisponiveisLimpeza', 'VagasDisponiveisLimpeza') ??
        base.vagasDisponiveisLimpeza ??
        null,
      controleAtivo:
        'controleAtivo' in r || 'ControleAtivo' in r
          ? this.pickBool(r, 'controleAtivo', 'ControleAtivo')
          : base.controleAtivo !== false,
      reservas,
    };
  }

  private mapReserva(
    row: VagaReservaTransportadoraItem | Record<string, unknown>
  ): VagaReservaTransportadoraItem {
    const r = row as Record<string, unknown>;
    const base = row as VagaReservaTransportadoraItem;
    const responsavelFaturamentoId = this.pickNumberOrNull(
      r,
      'responsavelFaturamentoId',
      'ResponsavelFaturamentoId'
    );
    return {
      ...base,
      id: this.pickNumber(r, 'id', 'Id') || base.id,
      transportadoraId: this.pickNumber(r, 'transportadoraId', 'TransportadoraId') || base.transportadoraId || 0,
      transportadoraNome:
        this.pickString(r, 'transportadoraNome', 'TransportadoraNome') || base.transportadoraNome || '',
      modalidade: (this.pickNumber(r, 'modalidade', 'Modalidade') ||
        base.modalidade ||
        1) as ModalidadeVagaAgendamento,
      modalidadeLabel:
        this.pickString(r, 'modalidadeLabel', 'ModalidadeLabel') || base.modalidadeLabel || '',
      quantidade: this.pickNumber(r, 'quantidade', 'Quantidade') || base.quantidade || 0,
      dataInicio: this.pickString(r, 'dataInicio', 'DataInicio') || base.dataInicio || '',
      dataFim: this.pickStringOrNull(r, 'dataFim', 'DataFim') ?? base.dataFim ?? null,
      periodicidade: (this.pickNumber(r, 'periodicidade', 'Periodicidade') ||
        base.periodicidade ||
        1) as PeriodicidadeVagaReserva,
      periodicidadeLabel:
        this.pickString(r, 'periodicidadeLabel', 'PeriodicidadeLabel') || base.periodicidadeLabel || '',
      periodoDia: (this.pickNumberOrNull(r, 'periodoDia', 'PeriodoDia') ??
        base.periodoDia ??
        null) as PeriodoDiaVaga,
      periodoDiaLabel:
        this.pickStringOrNull(r, 'periodoDiaLabel', 'PeriodoDiaLabel') ?? base.periodoDiaLabel ?? null,
      horaInicio: this.pickStringOrNull(r, 'horaInicio', 'HoraInicio') ?? base.horaInicio ?? null,
      horaFim: this.pickStringOrNull(r, 'horaFim', 'HoraFim') ?? base.horaFim ?? null,
      diasSemana:
        this.pickStringOrNull(r, 'diasSemana', 'DiasSemana') ?? base.diasSemana ?? null,
      responsavelFaturamentoId,
      responsavelFaturamentoNome:
        this.pickStringOrNull(r, 'responsavelFaturamentoNome', 'ResponsavelFaturamentoNome') ??
        base.responsavelFaturamentoNome ??
        null,
      avulso: this.pickBool(r, 'avulso', 'Avulso') || !!base.avulso,
      transferenciaAutomaticaSaldo: this.pickBool(
        r,
        'transferenciaAutomaticaSaldo',
        'TransferenciaAutomaticaSaldo'
      ),
      ativo: 'ativo' in r || 'Ativo' in r ? this.pickBool(r, 'ativo', 'Ativo') : base.ativo !== false,
      destinadorId:
        this.pickNumberOrNull(r, 'destinadorId', 'DestinadorId') ?? base.destinadorId ?? null,
      destinadorNome:
        this.pickStringOrNull(r, 'destinadorNome', 'DestinadorNome') ?? base.destinadorNome ?? null,
      usuarioCriacao:
        this.pickStringOrNull(r, 'usuarioCriacao', 'UsuarioCriacao') ?? base.usuarioCriacao ?? null,
      dataCriacao: this.pickStringOrNull(r, 'dataCriacao', 'DataCriacao') ?? base.dataCriacao ?? null,
      usuarioAtualizacao:
        this.pickStringOrNull(r, 'usuarioAtualizacao', 'UsuarioAtualizacao') ??
        base.usuarioAtualizacao ??
        null,
      dataAtualizacao:
        this.pickStringOrNull(r, 'dataAtualizacao', 'DataAtualizacao') ?? base.dataAtualizacao ?? null,
      usadasNoDia: this.pickNumber(r, 'usadasNoDia', 'UsadasNoDia') || base.usadasNoDia || 0,
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

  private pickNumber(row: Record<string, unknown>, camel: string, pascal: string): number {
    const v = row[camel] ?? row[pascal];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  }

  private pickNumberOrNull(row: Record<string, unknown>, camel: string, pascal: string): number | null {
    if (!(camel in row) && !(pascal in row)) return null;
    const v = row[camel] ?? row[pascal];
    if (v == null || v === '') return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  private pickString(row: Record<string, unknown>, camel: string, pascal: string): string {
    const v = row[camel] ?? row[pascal];
    if (typeof v === 'string') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    return '';
  }

  private pickStringOrNull(row: Record<string, unknown>, camel: string, pascal: string): string | null {
    if (!(camel in row) && !(pascal in row)) return null;
    const v = row[camel] ?? row[pascal];
    if (v == null) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    return null;
  }
}
