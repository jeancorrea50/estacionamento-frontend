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
