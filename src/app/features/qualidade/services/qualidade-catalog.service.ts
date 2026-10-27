import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { listarTodosCasosQualidade, QUALIDADE_INVENTARIO } from '../data/qualidade-inventario.data';
import { listarSpecsOrfaos } from '../data/qualidade-automacao-mapa.data';
import type {
  QualidadeArtefatoSuite,
  QualidadeCasoView,
  QualidadeExecucaoStorePayload,
  QualidadeModulo,
  QualidadeResumoIndicadores,
  QualidadeStatus,
} from '../models/qualidade.models';
import { QualidadeExecutionRepository } from '../repositories/qualidade-execution.repository';
import { LocalQualidadeExecutionRepository } from '../repositories/local-qualidade-execution.repository';
import { QualidadeAutomacaoResultadosService } from './qualidade-automacao-resultados.service';

/** Fallback: se o token abstrato não estiver no injector, usa store local. */

export interface QualidadeCatalogSnapshot {
  modulos: QualidadeModulo[];
  casos: QualidadeCasoView[];
  resumo: QualidadeResumoIndicadores;
  specsOrfaos: string[];
  store: QualidadeExecucaoStorePayload;
  vitest: QualidadeArtefatoSuite;
  playwright: QualidadeArtefatoSuite;
}

function statusDeArtefato(
  casoId: string,
  specs: string[] | undefined,
  vitest: QualidadeArtefatoSuite,
  playwright: QualidadeArtefatoSuite
): 'aprovado' | 'falhou' | 'nao_executado' | null {
  if (!specs?.length) return null;
  let hasAny = false;
  let anyFail = false;
  let anyPass = false;
  for (const spec of specs) {
    const key = spec.replace(/\\/g, '/');
    const st = vitest.porArquivo[key] ?? playwright.porArquivo[key];
    if (!st || st === 'nao_executado') continue;
    hasAny = true;
    if (st === 'falhou') anyFail = true;
    if (st === 'aprovado') anyPass = true;
  }
  if (!hasAny) return null;
  if (anyFail) return 'falhou';
  if (anyPass) return 'aprovado';
  return null;
}

function statusEfetivo(
  manual: QualidadeStatus | undefined,
  artefato: 'aprovado' | 'falhou' | 'nao_executado' | null,
  tipoCobertura: string
): QualidadeStatus {
  if (manual) return manual;
  if (artefato === 'aprovado') return 'aprovado';
  if (artefato === 'falhou') return 'falhou';
  if (tipoCobertura === 'sem_cobertura') return 'nao_automatizado';
  return 'nao_executado';
}

@Injectable({ providedIn: 'root' })
export class QualidadeCatalogService {
  private readonly localRepo = inject(LocalQualidadeExecutionRepository);
  private readonly automacao = inject(QualidadeAutomacaoResultadosService);
  private readonly repo: QualidadeExecutionRepository =
    inject(QualidadeExecutionRepository, { optional: true }) ?? this.localRepo;

  /** Expõe o repositório ativo (local agora; HTTP no futuro). */
  get executionRepo(): QualidadeExecutionRepository {
    return this.repo;
  }

  carregarSnapshot(): Observable<QualidadeCatalogSnapshot> {
    return forkJoin({
      store: this.repo.carregar(),
      vitest: this.automacao.carregarVitest().pipe(
        catchError(() => of(this.automacao.artefatoVazio('vitest', 'Falha ao ler artefato')))
      ),
      playwright: this.automacao.carregarPlaywright().pipe(
        catchError(() => of(this.automacao.artefatoVazio('playwright', 'Falha ao ler artefato')))
      ),
    }).pipe(map(({ store, vitest, playwright }) => this.montar(store, vitest, playwright)));
  }

  private montar(
    store: QualidadeExecucaoStorePayload,
    vitest: QualidadeArtefatoSuite,
    playwright: QualidadeArtefatoSuite
  ): QualidadeCatalogSnapshot {
    const rows = listarTodosCasosQualidade();
    const casos: QualidadeCasoView[] = rows.map((row) => {
      const ultimo = store.ultimosPorCaso[row.caso.id] ?? null;
      const artefatoStatus = statusDeArtefato(
        row.caso.id,
        row.caso.automacaoSpecPaths,
        vitest,
        playwright
      );
      return {
        caso: row.caso,
        moduloId: row.moduloId,
        moduloTitulo: row.moduloTitulo,
        telaId: row.telaId,
        telaTitulo: row.telaTitulo,
        funcionalidadeId: row.funcionalidadeId,
        funcionalidadeTitulo: row.funcionalidadeTitulo,
        ultimoRegistro: ultimo,
        artefatoStatus,
        statusEfetivo: statusEfetivo(
          ultimo?.status,
          artefatoStatus,
          row.caso.tipoCobertura
        ),
      };
    });

    const resumo = this.calcularResumo(casos, vitest, playwright);
    return {
      modulos: QUALIDADE_INVENTARIO,
      casos,
      resumo,
      specsOrfaos: listarSpecsOrfaos(),
      store,
      vitest,
      playwright,
    };
  }

  private calcularResumo(
    casos: QualidadeCasoView[],
    vitest: QualidadeArtefatoSuite,
    playwright: QualidadeArtefatoSuite
  ): QualidadeResumoIndicadores {
    const inventariados = casos.length;
    let comAutomacaoMapeada = 0;
    let comArtefatoCi = 0;
    let manuaisRegistrados = 0;
    let aprovados = 0;
    let falhos = 0;
    let bloqueados = 0;
    let naoExecutados = 0;
    let naoAutomatizados = 0;
    let comprovados = 0;

    const temArtefato =
      (vitest.geradoEm != null && vitest.total > 0) ||
      (playwright.geradoEm != null && playwright.total > 0);

    for (const c of casos) {
      if ((c.caso.automacaoSpecPaths?.length ?? 0) > 0) comAutomacaoMapeada += 1;
      if (c.artefatoStatus === 'aprovado' || c.artefatoStatus === 'falhou') comArtefatoCi += 1;
      if (c.ultimoRegistro?.origem === 'manual') manuaisRegistrados += 1;

      switch (c.statusEfetivo) {
        case 'aprovado':
          aprovados += 1;
          if (c.ultimoRegistro || c.artefatoStatus) comprovados += 1;
          break;
        case 'falhou':
          falhos += 1;
          if (c.ultimoRegistro || c.artefatoStatus) comprovados += 1;
          break;
        case 'bloqueado':
          bloqueados += 1;
          break;
        case 'nao_automatizado':
          naoAutomatizados += 1;
          break;
        case 'nao_executado':
        case 'em_execucao':
        case 'nao_aplicavel':
          naoExecutados += 1;
          break;
      }
    }

    if (!temArtefato) {
      // Artefato ausente não conta como “com artefato CI” agregado além do por caso.
    }

    const percentualCoberturaComprovada =
      inventariados === 0 ? 0 : Math.round((comprovados / inventariados) * 1000) / 10;

    return {
      inventariados,
      comAutomacaoMapeada,
      comArtefatoCi,
      manuaisRegistrados,
      aprovados,
      falhos,
      bloqueados,
      naoExecutados,
      naoAutomatizados,
      percentualCoberturaComprovada,
    };
  }
}
