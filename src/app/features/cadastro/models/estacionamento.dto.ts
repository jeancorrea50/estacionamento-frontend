/** 1 = Pessoa Física, 2 = Pessoa Jurídica */
export type TipoPessoa = 1 | 2;

export interface PessoaDTO {
  id: number;
  tipoPessoa: TipoPessoa;
  nomeRazaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  email: string;
  ativo: boolean;
}

export interface EstacionamentoDTO {
  id: number;
  descricao: string;
  pessoaId: number;
  pessoa: PessoaDTO;
}

/** Item resumido para listagem (conforme retorno da API de listagem) */
export interface EstacionamentoListItemDTO {
  id: number;
  pessoaId?: number | null;
  descricao: string;
  tipoPessoa: TipoPessoa;
  nomeRazaoSocial: string;
  cnpj: string;
  email: string;
  ativo: boolean;
  capacidadeVeiculo?: number | null;
  tamanhoTerreno?: string | null;
}

/** Endereço retornado em ObterPorId (pessoa.enderecos) */
export interface EnderecoDTO {
  pessoaId: number;
  principal: boolean;
  tipoEndereco: number;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/** Contato retornado em ObterPorId (pessoa.contatos) */
export interface ContatoDTO {
  pessoaId: number;
  principal: boolean;
  tipoContato?: number;
  /** Legado UI — API usa `telefone`. */
  numero?: string;
  telefone?: string;
  email?: string;
  observacao?: string;
}

/** Pessoa aninhada no resultado de ObterPorId */
export interface PessoaObterPorIdDTO {
  tipoPessoa: TipoPessoa;
  nomeRazaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  email: string;
  ativo: boolean;
  enderecos?: EnderecoDTO[];
  contatos?: ContatoDTO[];
  id: number;
  dataCriacao: string;
  dataAtualizacao: string | null;
}

/** Contexto vindo do GET /Estacionamento/{id} para preservar datas e ids no PUT completo. */
export interface EstacionamentoPayloadMergeContext {
  estacionamentoDataCriacao?: string;
  estacionamentoDataAtualizacao?: string | null;
  /** Objeto bruto de contaBancaria da API (ou primeiro item se vier em lista; clone superficial). */
  contaBancariaPreserved?: Record<string, unknown> | null;
  pessoaDescricao?: string | null;
  pessoaDataCriacao?: string;
  pessoaDataAtualizacao?: string | null;
}

/** Resultado bruto de GET /api/Estacionamento/{id} (campo result) */
export interface EstacionamentoObterPorIdResultDTO {
  pessoaId: number;
  capacidadeVeiculo: number;
  tamanhoTerreno: string;
  resposanvelLegal: string;
  responsavelCpf: string;
  possuiSeguranca: boolean;
  possuiBanheiro: boolean;
  tipoCobranca: number;
  cobrancaPorcentagem: number;
  cobrancaValor: number;
  pessoa: PessoaObterPorIdDTO;
  id: number;
  dataCriacao: string;
  dataAtualizacao: string | null;
  /** Dados bancários (integração backend) */
  banco?: string;
  agencia?: string;
  conta?: string;
  tipoConta?: string;
  chavePix?: string;
  tipoChave?: 1 | 2 | 3 | 4 | 5 | null;
  /** Fotos em base64 ou URLs (integração backend) */
  fotos?: string[];

  /** Multi-tenant / GtCentral */
  codExportacao?: string | null;
  isolationMode?: number | null;
  bancoDadosConexaoId?: number | null;
  ativo?: boolean | null;
  nomeRazaoSocialCatalogo?: string | null;
  fantasiaCatalogo?: string | null;
  cidadeCatalogo?: string | null;
  estadoCatalogo?: string | null;
  bairroCatalogo?: string | null;
  bancoDadosConexao?: {
    id?: number;
    nome?: string;
    host?: string;
    nomeBanco?: string;
  } | null;
}

/** Resposta da API (wrapper success / result) */
export interface ApiResponseDTO<T> {
  success: boolean;
  message: string;
  result: T;
}

/** Parâmetros para GET /api/Estacionamento?... (`Termo` é enviado como `Descricao` quando o backend não expõe `Termo` no OpenAPI). */
export interface EstacionamentoBuscarParams {
  /** Mapeado para `Descricao` no HttpClient. */
  Termo?: string;
  Descricao?: string;
  DataInicial?: string;
  DataFinal?: string;
  NumeroPagina: number;
  TamanhoPagina: number;
  Propriedade?: string;
  Sort?: string;
}

/** Resultado paginado (backend pode retornar result como array ou como este objeto) */
export interface PagedResultDTO<T> {
  items: T[];
  totalCount: number;
  numeroPagina: number;
  tamanhoPagina: number;
}
