/** Severidade do achado — ordena a fila de correção. */
export type DiagnosticoSeveridade = 'critica' | 'alta' | 'media' | 'baixa';

/** Origem do problema no ecossistema. */
export type DiagnosticoCategoria =
  | 'conexao'
  | 'backend'
  | 'frontend'
  | 'regra_negocio'
  | 'fluxo_vago'
  | 'sessao';

export type DiagnosticoProbeStatus = 'ok' | 'aviso' | 'falha' | 'pulado';

export interface DiagnosticoAchado {
  id: string;
  severidade: DiagnosticoSeveridade;
  categoria: DiagnosticoCategoria;
  titulo: string;
  descricao: string;
  /** Nó do mapa relacionado (se houver). */
  noId?: string;
  /** Aresta / vínculo relacionado. */
  arestaId?: string;
  /** Fluxo ponta a ponta avaliado. */
  fluxoId?: string;
  acaoSugerida: string;
}

export interface DiagnosticoProbeResultado {
  id: string;
  label: string;
  status: DiagnosticoProbeStatus;
  httpStatus: number | null;
  mensagem: string;
  /** Módulo do mapa mais próximo. */
  noId?: string;
}

export interface DiagnosticoFluxoResultado {
  id: string;
  nome: string;
  etapas: string[];
  /** true se todas as etapas/arestas críticas estão identificadas. */
  saudavel: boolean;
  resumo: string;
  achadosIds: string[];
}

export interface DiagnosticoRelatorio {
  geradoEm: string;
  resumo: {
    criticos: number;
    altos: number;
    medios: number;
    baixos: number;
    probesOk: number;
    probesFalha: number;
    fluxosSaudaveis: number;
    fluxosComRisco: number;
  };
  achados: DiagnosticoAchado[];
  probes: DiagnosticoProbeResultado[];
  fluxos: DiagnosticoFluxoResultado[];
}

export const DIAGNOSTICO_SEVERIDADE_LABEL: Record<DiagnosticoSeveridade, string> = {
  critica: 'Crítico',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Melhoria',
};

export const DIAGNOSTICO_CATEGORIA_LABEL: Record<DiagnosticoCategoria, string> = {
  conexao: 'Conexão / proxy',
  backend: 'Backend / API',
  frontend: 'Frontend',
  regra_negocio: 'Regra de negócio',
  fluxo_vago: 'Fluxo vago / parcial',
  sessao: 'Sessão / pátio',
};
