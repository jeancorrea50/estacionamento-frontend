/** Tipos alinhados ao backend BancoDadosConexao / EstacionamentoTenant. */

export type TipoBancoDados = 1 | 2 | 3 | 4; // SqlServer, Oracle, PostgreSql, MySql
export type AmbienteBancoDados = 1 | 2 | 3; // Desenvolvimento, Homologacao, Producao
export type IsolationModeEstacionamento = 1 | 2; // Shared, Dedicated

export interface SelectItem {
  value: string;
  label: string;
}

export interface BancoDadosConexaoEstacionamento {
  codExportacao: string;
  estacionamentoId: number;
  descricao: string;
  nomeRazaoSocial?: string | null;
  fantasia?: string | null;
  cidade?: string | null;
  estado?: string | null;
  bairro?: string | null;
  isolationMode: IsolationModeEstacionamento;
  ativo: boolean;
}

/** Status alinhado ao enum backend StatusBancoDadosConexaoMigration. */
export type StatusBancoDadosConexaoMigration = 1 | 2 | 3 | 4;

export const STATUS_MIGRATION_LABEL: Record<number, string> = {
  1: 'Pendente',
  2: 'Em andamento',
  3: 'Sucesso',
  4: 'Falhou',
};

export interface BancoDadosConexaoMigration {
  id: number;
  bancoDadosConexaoId: number;
  ambiente: AmbienteBancoDados;
  host: string;
  porta: number;
  nomeBanco: string;
  migrationName: string;
  status: StatusBancoDadosConexaoMigration;
  statusDescricao?: string;
  detalheFalhaJson?: string | null;
  dataCriacao: string;
  dataUltimaAtualizacao: string;
  dataAplicacao?: string | null;
}

export interface BancoDadosConexao {
  id: number;
  nome: string;
  descricao?: string | null;
  tipoBanco: TipoBancoDados;
  ambiente: AmbienteBancoDados;
  host: string;
  porta: number;
  nomeBanco: string;
  usuario: string;
  senhaMascarada?: string;
  trustServerCertificate: boolean;
  encrypt: boolean;
  parametrosExtras?: string | null;
  ativo: boolean;
  connectionStringMascarada?: string | null;
  quantidadeEstacionamentos?: number;
  estacionamentos?: BancoDadosConexaoEstacionamento[];
  /** Histórico GtCentral.BancoDadosConexaoMigration */
  migration?: BancoDadosConexaoMigration[];
}

export interface BancoDadosConexaoSelect {
  id: number;
  nome: string;
  host: string;
  porta: number;
  nomeBanco: string;
  tipoBanco: number;
  ambiente: number;
  ativo: boolean;
  label: string;
}

export interface BancoDadosNomeSelect {
  host: string;
  nomeBanco: string;
  label: string;
}

export interface EstacionamentoSelect {
  codExportacao: string;
  estacionamentoId: number;
  descricao: string;
  fantasia?: string | null;
  nomeRazaoSocial?: string | null;
  cidade?: string | null;
  estado?: string | null;
  bancoDadosConexaoId?: number | null;
  ativo: boolean;
  label: string;
}

export interface BancoDadosConexaoOpcoes {
  tiposBanco: SelectItem[];
  ambientes: SelectItem[];
  isolationModes: SelectItem[];
  hosts: SelectItem[];
  bancos: BancoDadosNomeSelect[];
  conexoes: BancoDadosConexaoSelect[];
  estacionamentos: EstacionamentoSelect[];
}

export interface BancoDadosConexaoFormPayload {
  id?: number;
  nome: string;
  descricao?: string | null;
  tipoBanco: TipoBancoDados;
  ambiente: AmbienteBancoDados;
  host: string;
  porta: number;
  nomeBanco: string;
  usuario: string;
  senha?: string | null;
  trustServerCertificate: boolean;
  encrypt: boolean;
  parametrosExtras?: string | null;
  ativo: boolean;
}

export interface BancoDadosConexaoTestarResult {
  valido: boolean;
  mensagem: string;
  tempoMs: number;
  connectionStringMascarada?: string | null;
  detalheErro?: string | null;
}

/** GET `/api/BancoDadosConexao/sugerir-nome` */
export interface BancoDadosNomeSugerido {
  nomeBanco: string;
  descricaoSlug: string;
  ambienteCodigo: string;
  maxLength: number;
  padrao?: string;
}

/** Limites oficiais usados na UI (alinhados ao backend). */
export const NOME_BANCO_MAX_LENGTH: Record<number, number> = {
  1: 128, // SQL Server
  2: 30, // Oracle
  3: 63, // PostgreSQL
  4: 64, // MySQL
};

/** Status alinhado ao enum backend StatusTransferenciaBanco. */
export type StatusTransferenciaBanco = 1 | 2 | 3 | 4 | 5;

export const STATUS_TRANSFERENCIA_LABEL: Record<number, string> = {
  1: 'Pendente',
  2: 'Em andamento',
  3: 'Concluída',
  4: 'Falhou',
  5: 'Cancelada',
};

export interface BancoDadosConexaoTransferirPayload {
  bancoDadosConexaoId: number;
  hostFuturo: string;
  portaFuturo: number;
  nomeBancoFuturo?: string | null;
  usuarioFuturo: string;
  senhaFuturo: string;
  trustServerCertificate?: boolean;
  encrypt?: boolean;
  sobrescreverDestinoSeExistir?: boolean;
}

export interface TransferenciaBancoDados {
  id: number;
  codExportacao: string;
  estacionamentoId: number;
  bancoDadosConexaoId: number;
  hostAnterior: string;
  portaAnterior: number;
  nomeBancoAnterior: string;
  hostFuturo: string;
  portaFuturo: number;
  nomeBancoFuturo: string;
  status: StatusTransferenciaBanco;
  statusDescricao?: string;
  mensagemErro?: string | null;
  etapaAtual?: string | null;
  solicitadoPorUsuarioId?: number | null;
  dataCriacao: string;
  dataInicio?: string | null;
  dataFim?: string | null;
}

export interface TransferenciaEnfileiradaResult {
  sucesso?: boolean;
  mensagem?: string;
  hangfireJobId?: string;
  data?: TransferenciaBancoDados;
}

/** PUT `/api/Estacionamento/conexao` */
export interface EstacionamentoConexaoPutPayload {
  codExportacao: string;
  estacionamentoId?: number | null;
  isolationMode: IsolationModeEstacionamento;
  bancoDadosConexaoId?: number | null;
  ativo: boolean;
}

export const TIPO_BANCO_LABEL: Record<number, string> = {
  1: 'SQL Server',
  2: 'Oracle',
  3: 'PostgreSQL',
  4: 'MySQL',
};

export const AMBIENTE_LABEL: Record<number, string> = {
  1: 'Desenvolvimento',
  2: 'Homologação',
  3: 'Produção',
};

export const ISOLATION_LABEL: Record<number, string> = {
  1: 'Shared',
  2: 'Dedicated',
};
