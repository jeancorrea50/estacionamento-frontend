import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { unwrapServiceResult } from '../../../core/api/utils/service-result.util';
import type {
  MovimentacaoRelatorioFiltro,
  MovimentacaoRelatorioItem,
  MovimentacaoRelatorioOutput,
  MovimentacaoRelatorioResumo,
} from '../pages/movimentacao-relatorio/movimentacao-relatorio.types';

const API = `${environment.API_BASE_URL}/MovimentacaoRelatorio`;

function pickNum(row: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k] ?? row[k.charAt(0).toUpperCase() + k.slice(1)];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function pickStr(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.charAt(0).toUpperCase() + k.slice(1)];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function pickBool(row: Record<string, unknown>, ...keys: string[]): boolean {
  for (const k of keys) {
    const v = row[k] ?? row[k.charAt(0).toUpperCase() + k.slice(1)];
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === '1' || v === 'true' || v === 'True') return true;
    if (v === 0 || v === '0' || v === 'false' || v === 'False') return false;
  }
  return false;
}

function mapItem(raw: unknown): MovimentacaoRelatorioItem {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    id: pickNum(row, 'id', 'Id'),
    placaVeiculo: pickStr(row, 'placaVeiculo', 'PlacaVeiculo', 'placa'),
    nomeMotorista: pickStr(row, 'nomeMotorista', 'NomeMotorista'),
    nomeTransportadora: pickStr(row, 'nomeTransportadora', 'NomeTransportadora'),
    status: pickNum(row, 'status', 'Status'),
    statusDescricao: pickStr(row, 'statusDescricao', 'StatusDescricao'),
    dataHoraEntrada: pickStr(row, 'dataHoraEntrada', 'DataHoraEntrada') || null,
    dataHoraSaida: pickStr(row, 'dataHoraSaida', 'DataHoraSaida') || null,
    faturado: pickBool(row, 'faturado', 'Faturado'),
    avulso: pickBool(row, 'avulso', 'Avulso'),
    ehExcedente: pickBool(row, 'ehExcedente', 'EhExcedente'),
    observacao: pickStr(row, 'observacao', 'Observacao') || null,
  };
}

function mapResumo(raw: unknown): MovimentacaoRelatorioResumo {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    quantidade: pickNum(row, 'quantidade', 'Quantidade'),
    qtdEntrada: pickNum(row, 'qtdEntrada', 'QtdEntrada'),
    qtdSaida: pickNum(row, 'qtdSaida', 'QtdSaida'),
    qtdSuspenso: pickNum(row, 'qtdSuspenso', 'QtdSuspenso'),
    qtdAgendado: pickNum(row, 'qtdAgendado', 'QtdAgendado'),
    qtdCancelado: pickNum(row, 'qtdCancelado', 'QtdCancelado'),
    qtdFaturado: pickNum(row, 'qtdFaturado', 'QtdFaturado'),
    qtdExcedente: pickNum(row, 'qtdExcedente', 'QtdExcedente'),
  };
}

function mapOutput(body: unknown): MovimentacaoRelatorioOutput {
  const peeled = unwrapServiceResult<Record<string, unknown>>(body) ?? {};
  const row = peeled && typeof peeled === 'object' ? peeled : {};
  const itensRaw = row['itens'] ?? row['Itens'];
  return {
    resumo: mapResumo(row['resumo'] ?? row['Resumo']),
    itens: Array.isArray(itensRaw) ? itensRaw.map(mapItem) : [],
    truncado: Boolean(row['truncado'] ?? row['Truncado']),
    limiteAplicado: pickNum(row, 'limiteAplicado', 'LimiteAplicado'),
  };
}

function toParams(filtro: MovimentacaoRelatorioFiltro): HttpParams {
  let params = new HttpParams();
  const set = (key: string, value: string | number | boolean | null | undefined) => {
    if (value == null || value === '') return;
    params = params.set(key, String(value));
  };

  set('DataInicial', filtro.dataInicial);
  set('DataFinal', filtro.dataFinal);
  set('DataSaidaInicial', filtro.dataSaidaInicial);
  set('DataSaidaFinal', filtro.dataSaidaFinal);
  set('Placa', filtro.placa);
  set('TransportadoraId', filtro.transportadoraId);
  set('Status', filtro.status);
  set('Faturado', filtro.faturado);
  set('EhExcedente', filtro.ehExcedente);
  set('Avulso', filtro.avulso);
  set('Descricao', filtro.descricao);
  set('Limite', filtro.limite);
  return params;
}

@Injectable({ providedIn: 'root' })
export class MovimentacaoRelatorioService {
  private readonly http = inject(HttpClient);

  buscar(filtro: MovimentacaoRelatorioFiltro): Observable<MovimentacaoRelatorioOutput> {
    return this.http.get<unknown>(API, { params: toParams(filtro) }).pipe(map(mapOutput));
  }

  baixarPdf(filtro: MovimentacaoRelatorioFiltro): Observable<Blob> {
    return this.http.get(`${API}/pdf`, { params: toParams(filtro), responseType: 'blob' });
  }

  baixarExcel(filtro: MovimentacaoRelatorioFiltro): Observable<Blob> {
    return this.http.get(`${API}/excel`, { params: toParams(filtro), responseType: 'blob' });
  }
}
