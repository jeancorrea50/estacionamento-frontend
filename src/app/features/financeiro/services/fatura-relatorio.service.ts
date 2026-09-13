import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { unwrapServiceResult } from '../../../core/api/utils/service-result.util';
import type {
  FaturaRelatorioFiltro,
  FaturaRelatorioItem,
  FaturaRelatorioOutput,
  FaturaRelatorioResumo,
} from '../pages/faturamento-page/relatorio/faturamento-relatorio.types';

const API = `${environment.API_BASE_URL}/financeiro/FaturaRelatorio`;

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

function pickNumOrNull(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k] ?? row[k.charAt(0).toUpperCase() + k.slice(1)];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function mapItem(raw: unknown): FaturaRelatorioItem {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    id: pickNum(row, 'id', 'Id'),
    numero: pickStr(row, 'numero', 'Numero'),
    transportadoraId: pickNumOrNull(row, 'transportadoraId', 'TransportadoraId'),
    transportadoraNome: pickStr(row, 'transportadoraNome', 'TransportadoraNome'),
    estacionamentoId: pickNum(row, 'estacionamentoId', 'EstacionamentoId'),
    estacionamentoNome: pickStr(row, 'estacionamentoNome', 'EstacionamentoNome'),
    tipoFatura: pickNum(row, 'tipoFatura', 'TipoFatura'),
    tipoFaturaDescricao: pickStr(row, 'tipoFaturaDescricao', 'TipoFaturaDescricao'),
    status: pickNum(row, 'status', 'Status'),
    statusDescricao: pickStr(row, 'statusDescricao', 'StatusDescricao'),
    modalidadeRecebimento: pickNumOrNull(row, 'modalidadeRecebimento', 'ModalidadeRecebimento'),
    modalidadeDescricao: pickStr(row, 'modalidadeDescricao', 'ModalidadeDescricao'),
    valorTotal: pickNum(row, 'valorTotal', 'ValorTotal'),
    valorRecebido: pickNum(row, 'valorRecebido', 'ValorRecebido'),
    valorEmAberto: pickNum(row, 'valorEmAberto', 'ValorEmAberto'),
    dataEmissao: pickStr(row, 'dataEmissao', 'DataEmissao'),
    dataVencimento: pickStr(row, 'dataVencimento', 'DataVencimento'),
    dataPagamento: pickStr(row, 'dataPagamento', 'DataPagamento') || null,
    observacao: pickStr(row, 'observacao', 'Observacao') || null,
  };
}

function mapResumo(raw: unknown): FaturaRelatorioResumo {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    quantidade: pickNum(row, 'quantidade', 'Quantidade'),
    valorTotal: pickNum(row, 'valorTotal', 'ValorTotal'),
    valorRecebido: pickNum(row, 'valorRecebido', 'ValorRecebido'),
    valorEmAberto: pickNum(row, 'valorEmAberto', 'ValorEmAberto'),
    qtdPago: pickNum(row, 'qtdPago', 'QtdPago'),
    qtdEmAberto: pickNum(row, 'qtdEmAberto', 'QtdEmAberto'),
    qtdVencido: pickNum(row, 'qtdVencido', 'QtdVencido'),
    qtdCancelada: pickNum(row, 'qtdCancelada', 'QtdCancelada'),
  };
}

function mapOutput(body: unknown): FaturaRelatorioOutput {
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

function toParams(filtro: FaturaRelatorioFiltro): HttpParams {
  let params = new HttpParams();
  const set = (key: string, value: string | number | null | undefined) => {
    if (value == null || value === '') return;
    params = params.set(key, String(value));
  };

  set('DataInicial', filtro.dataInicial);
  set('DataFinal', filtro.dataFinal);
  set('PeriodoCampo', filtro.periodoCampo);
  set('TransportadoraId', filtro.transportadoraId);
  set('Status', filtro.status);
  set('ModalidadeRecebimento', filtro.modalidadeRecebimento);
  set('TipoFatura', filtro.tipoFatura);
  set('Numero', filtro.numero);
  set('Descricao', filtro.descricao);
  set('DataVencimentoInicial', filtro.dataVencimentoInicial);
  set('DataVencimentoFinal', filtro.dataVencimentoFinal);
  set('DataPagamentoInicial', filtro.dataPagamentoInicial);
  set('DataPagamentoFinal', filtro.dataPagamentoFinal);
  set('ValorMinimo', filtro.valorMinimo);
  set('ValorMaximo', filtro.valorMaximo);
  set('Limite', filtro.limite);
  return params;
}

@Injectable({ providedIn: 'root' })
export class FaturaRelatorioService {
  private readonly http = inject(HttpClient);

  buscar(filtro: FaturaRelatorioFiltro): Observable<FaturaRelatorioOutput> {
    return this.http.get<unknown>(API, { params: toParams(filtro) }).pipe(map(mapOutput));
  }

  baixarPdf(filtro: FaturaRelatorioFiltro): Observable<Blob> {
    return this.http.get(`${API}/pdf`, { params: toParams(filtro), responseType: 'blob' });
  }

  baixarExcel(filtro: FaturaRelatorioFiltro): Observable<Blob> {
    return this.http.get(`${API}/excel`, { params: toParams(filtro), responseType: 'blob' });
  }
}
