import type { DiagnosticoCategoria, DiagnosticoSeveridade } from './ecossistema-diagnostico.models';

export type ProblemaCategoria = DiagnosticoCategoria | 'outro';

export type ProblemaStatus = 'aberto' | 'resolvido';

/** Problema lançado manualmente no Ecossistema (persistido localmente). */
export interface EcossistemaProblema {
  id: string;
  titulo: string;
  descricao: string;
  categoria: ProblemaCategoria;
  severidade: DiagnosticoSeveridade;
  /** Módulo do mapa (opcional). */
  noId: string | null;
  /** Fluxo ponta a ponta (opcional). */
  fluxoId: string | null;
  /** Destaca o nó no canvas enquanto aberto. */
  destacar: boolean;
  status: ProblemaStatus;
  /** Sugestões de resolução geradas apenas após criar o problema. */
  sugestoes: string[];
  criadoEm: string;
  resolvidoEm: string | null;
}

export interface EcossistemaProblemaInput {
  titulo: string;
  descricao: string;
  categoria: ProblemaCategoria;
  severidade: DiagnosticoSeveridade;
  noId?: string | null;
  fluxoId?: string | null;
  destacar?: boolean;
}

export const PROBLEMA_CATEGORIA_LABEL: Record<ProblemaCategoria, string> = {
  conexao: 'Conexão / proxy',
  backend: 'Backend / API',
  frontend: 'Frontend',
  regra_negocio: 'Regra de negócio',
  fluxo_vago: 'Fluxo / processo',
  sessao: 'Sessão / pátio',
  outro: 'Outro',
};

export const PROBLEMA_STATUS_LABEL: Record<ProblemaStatus, string> = {
  aberto: 'Aberto',
  resolvido: 'Resolvido',
};
