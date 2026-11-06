import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import type { QualidadeArtefatoSuite } from '../models/qualidade.models';

/** Caminhos públicos (Angular `public/` → raiz do site). */
export const QA_VITEST_URL = '/qa/vitest-summary.json';
export const QA_PLAYWRIGHT_URL = '/qa/playwright-summary.json';

interface ArtefatoRaw {
  ferramenta?: string;
  geradoEm?: string | null;
  total?: number;
  aprovados?: number;
  falhos?: number;
  porArquivo?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class QualidadeAutomacaoResultadosService {
  private readonly http = inject(HttpClient);

  artefatoVazio(
    ferramenta: QualidadeArtefatoSuite['ferramenta'],
    aviso: string
  ): QualidadeArtefatoSuite {
    return {
      ferramenta,
      geradoEm: null,
      total: 0,
      aprovados: 0,
      falhos: 0,
      porArquivo: {},
      aviso,
    };
  }

  carregarVitest(): Observable<QualidadeArtefatoSuite> {
    return this.carregar(QA_VITEST_URL, 'vitest');
  }

  carregarPlaywright(): Observable<QualidadeArtefatoSuite> {
    return this.carregar(QA_PLAYWRIGHT_URL, 'playwright');
  }

  private carregar(
    url: string,
    ferramenta: QualidadeArtefatoSuite['ferramenta']
  ): Observable<QualidadeArtefatoSuite> {
    return this.http.get<ArtefatoRaw>(url, { responseType: 'json' }).pipe(
      map((raw) => this.mapear(raw, ferramenta)),
      catchError(() =>
        of(
          this.artefatoVazio(
            ferramenta,
            `Artefato ausente em ${url}. Execute os testes via npm/CI e publique o JSON (ver /qa/README.md). Sem artefato = não aprovado.`
          )
        )
      )
    );
  }

  private mapear(
    raw: ArtefatoRaw | null | undefined,
    ferramenta: QualidadeArtefatoSuite['ferramenta']
  ): QualidadeArtefatoSuite {
    if (!raw || typeof raw !== 'object') {
      return this.artefatoVazio(ferramenta, 'Artefato inválido');
    }
    const porArquivo: QualidadeArtefatoSuite['porArquivo'] = {};
    const src = raw.porArquivo ?? {};
    for (const [k, v] of Object.entries(src)) {
      const key = k.replace(/\\/g, '/');
      if (v === 'aprovado' || v === 'falhou' || v === 'nao_executado') {
        porArquivo[key] = v;
      }
    }
    const total = Number(raw.total) || Object.keys(porArquivo).length;
    const aprovados =
      Number(raw.aprovados) ||
      Object.values(porArquivo).filter((s) => s === 'aprovado').length;
    const falhos =
      Number(raw.falhos) || Object.values(porArquivo).filter((s) => s === 'falhou').length;

    // Nunca inferir aprovação se geradoEm/total vazios e porArquivo vazio.
    if (!raw.geradoEm && total === 0) {
      return this.artefatoVazio(
        ferramenta,
        'Artefato placeholder sem execução. Não conta como aprovado.'
      );
    }

    return {
      ferramenta,
      geradoEm: raw.geradoEm?.trim() || null,
      total,
      aprovados,
      falhos,
      porArquivo,
    };
  }
}
