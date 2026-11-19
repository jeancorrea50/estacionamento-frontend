/** Situação da evidência no código / documentação acessível. */
export type EvidenciaStatus = 'identificado' | 'parcial' | 'proposto' | 'nao_verificado';

export type GrupoEcossistema = 'plataforma' | 'estacionamento' | 'transportadora';

/** Semântica visual da aresta. */
export type TipoConexao = 'dependencia' | 'consulta' | 'evento' | 'integracao_externa';

export type EscopoConexoes = 'diretas' | 'fluxo';

export interface EcossistemaNo {
  id: string;
  label: string;
  grupo: GrupoEcossistema;
  finalidade: string;
  quemUsa: string[];
  /** Rota SPA se existir tela. */
  rota: string | null;
  /** Claim típico para “Abrir módulo” (quando aplicável). */
  permissionKey: string | null;
  informacoesNecessarias: string[];
  acoes: string[];
  resultados: string[];
  regras: string[];
  evidencia: EvidenciaStatus;
  evidenciaDetalhe: string;
  pendencias: string[];
  /** Filhos colapsáveis (ids). */
  childrenIds: string[];
  /** Layout padrão (mundo). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EcossistemaAresta {
  id: string;
  from: string;
  to: string;
  /** Rótulo curto da relação. */
  label: string;
  tipo: TipoConexao;
  evidencia: EvidenciaStatus;
}

export interface EcossistemaLayoutPersistido {
  /** 2 = layout canônico com Entrada e Saída no centro (print operacional). */
  version: 2;
  positions: Record<string, { x: number; y: number }>;
  view: { x: number; y: number; scale: number };
  expanded: string[];
}

export const EVIDENCIA_LABEL: Record<EvidenciaStatus, string> = {
  identificado: 'Identificado no código',
  parcial: 'Parcialmente implementado',
  proposto: 'Proposto',
  nao_verificado: 'Não verificado',
};

export const GRUPO_LABEL: Record<GrupoEcossistema, string> = {
  plataforma: 'Plataforma',
  estacionamento: 'Estacionamento',
  transportadora: 'Transportadora',
};

export const TIPO_CONEXAO_LABEL: Record<TipoConexao, string> = {
  dependencia: 'Dependência',
  consulta: 'Consulta / compartilhamento',
  evento: 'Evento / atualização',
  integracao_externa: 'Integração externa',
};
