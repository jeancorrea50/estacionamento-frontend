import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import type {
  QualidadeExecucaoRegistro,
  QualidadeExecucaoStorePayload,
} from '../models/qualidade.models';
import { sanitizarTextoQualidade } from '../utils/qualidade-sanitize.util';
import {
  QualidadeExecutionRepository,
  type QualidadeRegistroManualInput,
} from './qualidade-execution.repository';

export const QUALIDADE_STORE_KEY = 'gts-qualidade-execucoes-v1';
const HISTORICO_MAX = 500;

function emptyPayload(): QualidadeExecucaoStorePayload {
  return {
    version: 1,
    atualizadoEm: new Date().toISOString(),
    ultimosPorCaso: {},
    historico: [],
  };
}

function readStore(): QualidadeExecucaoStorePayload {
  try {
    const raw = localStorage.getItem(QUALIDADE_STORE_KEY);
    if (!raw) return emptyPayload();
    const parsed = JSON.parse(raw) as QualidadeExecucaoStorePayload;
    if (!parsed || parsed.version !== 1 || typeof parsed !== 'object') {
      return emptyPayload();
    }
    return {
      version: 1,
      atualizadoEm: parsed.atualizadoEm || new Date().toISOString(),
      ultimosPorCaso: parsed.ultimosPorCaso ?? {},
      historico: Array.isArray(parsed.historico) ? parsed.historico : [],
    };
  } catch {
    return emptyPayload();
  }
}

function writeStore(payload: QualidadeExecucaoStorePayload): void {
  localStorage.setItem(QUALIDADE_STORE_KEY, JSON.stringify(payload));
}

@Injectable({ providedIn: 'root' })
export class LocalQualidadeExecutionRepository extends QualidadeExecutionRepository {
  override carregar(): Observable<QualidadeExecucaoStorePayload> {
    return of(readStore());
  }

  override listarHistorico(casoId?: string): Observable<QualidadeExecucaoRegistro[]> {
    const store = readStore();
    const list = casoId
      ? store.historico.filter((h) => h.casoId === casoId)
      : store.historico;
    return of(list);
  }

  override obterUltimo(casoId: string): Observable<QualidadeExecucaoRegistro | null> {
    const store = readStore();
    return of(store.ultimosPorCaso[casoId] ?? null);
  }

  override registrarManual(
    input: QualidadeRegistroManualInput
  ): Observable<QualidadeExecucaoRegistro> {
    const casoId = input.casoId?.trim();
    if (!casoId) {
      return throwError(() => new Error('casoId obrigatório'));
    }
    const status = input.status;
    if (status === 'aprovado' || status === 'falhou') {
      const evidencia = sanitizarTextoQualidade(input.evidenciaTexto);
      const obtido = sanitizarTextoQualidade(input.resultadoObtido);
      if (!evidencia && !obtido) {
        return throwError(
          () =>
            new Error(
              'Para Aprovado ou Falhou, informe resultado obtido ou evidência textual.'
            )
        );
      }
    }

    const registro: QualidadeExecucaoRegistro = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      casoId,
      status,
      resultadoObtido: sanitizarTextoQualidade(input.resultadoObtido),
      observacoes: sanitizarTextoQualidade(input.observacoes, 2000),
      evidenciaTexto: sanitizarTextoQualidade(input.evidenciaTexto),
      origem: 'manual',
      ambiente: sanitizarTextoQualidade(input.ambiente || 'local', 80) || 'local',
      versaoApp: sanitizarTextoQualidade(input.versaoApp || 'dev', 80) || 'dev',
      responsavelLocal: sanitizarTextoQualidade(input.responsavelLocal || 'operador-local', 80),
      criadoEm: new Date().toISOString(),
    };

    const store = readStore();
    store.ultimosPorCaso[casoId] = registro;
    store.historico = [registro, ...store.historico].slice(0, HISTORICO_MAX);
    store.atualizadoEm = registro.criadoEm;
    writeStore(store);
    return of(registro);
  }

  override limparCaso(casoId: string): Observable<void> {
    const store = readStore();
    delete store.ultimosPorCaso[casoId];
    store.historico = store.historico.filter((h) => h.casoId !== casoId);
    store.atualizadoEm = new Date().toISOString();
    writeStore(store);
    return of(void 0);
  }

  override limparTudo(): Observable<void> {
    writeStore(emptyPayload());
    return of(void 0);
  }
}
