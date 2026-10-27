/** Status canônicos da Central de Qualidade (sem “aprovado” sem evidência). */
export type QualidadeStatus =
  | 'nao_executado'
  | 'em_execucao'
  | 'aprovado'
  | 'falhou'
  | 'bloqueado'
  | 'nao_aplicavel'
  | 'nao_automatizado';

export type QualidadeCamada = 'frontend' | 'contrato' | 'e2e' | 'manual';

export type QualidadeSeveridade = 'baixa' | 'media' | 'alta' | 'critica';

/** Classificação de cobertura — não confundir renderização com validação. */
export type QualidadeTipoCobertura = 'manual' | 'automatizado' | 'hibrido' | 'sem_cobertura';

export const QUALIDADE_STATUS_LABEL: Record<QualidadeStatus, string> = {
  nao_executado: 'Não executado',
  em_execucao: 'Em execução',
  aprovado: 'Aprovado',
  falhou: 'Falhou',
  bloqueado: 'Bloqueado',
  nao_aplicavel: 'Não aplicável',
  nao_automatizado: 'Não automatizado',
};

export const QUALIDADE_CAMADA_LABEL: Record<QualidadeCamada, string> = {
  frontend: 'Frontend',
  contrato: 'Contrato/API',
  e2e: 'E2E',
  manual: 'Manual',
};

export const QUALIDADE_SEVERIDADE_LABEL: Record<QualidadeSeveridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const QUALIDADE_TIPO_LABEL: Record<QualidadeTipoCobertura, string> = {
  manual: 'Manual',
  automatizado: 'Automatizado',
  hibrido: 'Híbrido',
  sem_cobertura: 'Sem cobertura',
};

export interface QualidadeCaso {
  id: string;
  titulo: string;
  objetivo: string;
  preCondicoes: string[];
  passos: string[];
  resultadoEsperado: string;
  camada: QualidadeCamada;
  severidade: QualidadeSeveridade;
  /** Tipo declarado no inventário (automação mapeada ≠ artefato CI presente). */
  tipoCobertura: QualidadeTipoCobertura;
  rotas?: string[];
  arquivos?: string[];
  endpoints?: string[];
  /** Paths relativos ao repo dos specs vinculados. */
  automacaoSpecPaths?: string[];
  notas?: string;
}

export interface QualidadeFuncionalidade {
  id: string;
  titulo: string;
  casos: QualidadeCaso[];
}

export interface QualidadeTela {
  id: string;
  titulo: string;
  rota?: string;
  funcionalidades: QualidadeFuncionalidade[];
}

export interface QualidadeModulo {
  id: string;
  titulo: string;
  telas: QualidadeTela[];
}

export interface QualidadeExecucaoRegistro {
  id: string;
  casoId: string;
  status: QualidadeStatus;
  resultadoObtido: string;
  observacoes: string;
  evidenciaTexto: string;
  /** Origem do registro. */
  origem: 'manual' | 'artefato_ci';
  ambiente: string;
  versaoApp: string;
  responsavelLocal: string;
  criadoEm: string;
}

export interface QualidadeExecucaoStorePayload {
  version: 1;
  atualizadoEm: string;
  /** Último registro por casoId. */
  ultimosPorCaso: Record<string, QualidadeExecucaoRegistro>;
  /** Histórico (mais recente primeiro), limitado. */
  historico: QualidadeExecucaoRegistro[];
}

export interface QualidadeArtefatoSuite {
  ferramenta: 'vitest' | 'playwright' | 'outro';
  geradoEm: string | null;
  total: number;
  aprovados: number;
  falhos: number;
  /** Path do spec → status (apenas se o artefato informar). */
  porArquivo: Record<string, 'aprovado' | 'falhou' | 'nao_executado'>;
  /** Mensagem se o arquivo estiver ausente / inválido. */
  aviso?: string;
}

export interface QualidadeResumoIndicadores {
  inventariados: number;
  comAutomacaoMapeada: number;
  comArtefatoCi: number;
  manuaisRegistrados: number;
  aprovados: number;
  falhos: number;
  bloqueados: number;
  naoExecutados: number;
  naoAutomatizados: number;
  /** (aprovados + falhos com evidência) / inventariados — nunca “só renderizou”. */
  percentualCoberturaComprovada: number;
}

export interface QualidadeCasoView {
  caso: QualidadeCaso;
  moduloId: string;
  moduloTitulo: string;
  telaId: string;
  telaTitulo: string;
  funcionalidadeId: string;
  funcionalidadeTitulo: string;
  statusEfetivo: QualidadeStatus;
  ultimoRegistro: QualidadeExecucaoRegistro | null;
  artefatoStatus: 'aprovado' | 'falhou' | 'nao_executado' | null;
}
