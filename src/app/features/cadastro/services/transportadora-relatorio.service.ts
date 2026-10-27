import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { unwrapServiceResult } from '../../../core/api/utils/service-result.util';
import type {
  TransportadoraRelatorioFiltro,
  TransportadoraRelatorioItem,
  TransportadoraRelatorioOutput,
  TransportadoraRelatorioResumo,
} from '../pages/transportadora-relatorio/transportadora-relatorio.types';

const API = `${environment.API_BASE_URL}/TransportadoraRelatorio`;

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

function mapItem(raw: unknown): TransportadoraRelatorioItem {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    id: pickNum(row, 'id', 'Id'),
    razaoSocial: pickStr(row, 'razaoSocial', 'RazaoSocial'),
    fantasia: pickStr(row, 'fantasia', 'Fantasia', 'nomeFantasia', 'NomeFantasia'),
    cnpj: pickStr(row, 'cnpj', 'Cnpj'),
    email: pickStr(row, 'email', 'Email'),
    ativo: pickBool(row, 'ativo', 'Ativo'),
    responsavelLegal: pickStr(row, 'responsavelLegal', 'ResponsavelLegal'),
    responsavelTelefone: pickStr(row, 'responsavelTelefone', 'ResponsavelTelefone'),
    quantidadeVeiculo: pickNum(row, 'quantidadeVeiculo', 'QuantidadeVeiculo', 'quantidadeVeiculos'),
    dataAtualizacao: pickStr(row, 'dataAtualizacao', 'DataAtualizacao') || null,
  };
}

function mapResumo(raw: unknown): TransportadoraRelatorioResumo {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    quantidade: pickNum(row, 'quantidade', 'Quantidade'),
    qtdAtivas: pickNum(row, 'qtdAtivas', 'QtdAtivas'),
    qtdInativas: pickNum(row, 'qtdInativas', 'QtdInativas'),
    totalVeiculos: pickNum(row, 'totalVeiculos', 'TotalVeiculos'),
  };
}

function mapOutput(body: unknown): TransportadoraRelatorioOutput {
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

function toParams(filtro: TransportadoraRelatorioFiltro): HttpParams {
  let params = new HttpParams();
  const set = (key: string, value: string | number | boolean | null | undefined) => {
    if (value == null || value === '') return;
    params = params.set(key, String(value));
  };

  set('DataInicial', filtro.dataInicial);
  set('DataFinal', filtro.dataFinal);
  set('Descricao', filtro.descricao);
  set('RazaoSocial', filtro.razaoSocial);
  set('Cnpj', filtro.cnpj);
  set('Ativo', filtro.ativo);
  set('QuantidadeVeiculosMin', filtro.quantidadeVeiculosMin);
  set('QuantidadeVeiculosMax', filtro.quantidadeVeiculosMax);
  set('Limite', filtro.limite);
  return params;
}

@Injectable({ providedIn: 'root' })
export class TransportadoraRelatorioService {
  private readonly http = inject(HttpClient);

  buscar(filtro: TransportadoraRelatorioFiltro): Observable<TransportadoraRelatorioOutput> {
    return this.http.get<unknown>(API, { params: toParams(filtro) }).pipe(map(mapOutput));
  }

  baixarPdf(filtro: TransportadoraRelatorioFiltro): Observable<Blob> {
    return this.http.get(`${API}/pdf`, { params: toParams(filtro), responseType: 'blob' });
  }

  baixarExcel(filtro: TransportadoraRelatorioFiltro): Observable<Blob> {
    return this.http.get(`${API}/excel`, { params: toParams(filtro), responseType: 'blob' });
  }
}
