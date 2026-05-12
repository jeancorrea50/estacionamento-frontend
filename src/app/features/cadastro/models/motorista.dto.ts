export interface MotoristaDTO {
  id?: number;
  transportadoraId?: number;
  nomeCompleto: string;
  cpf: string;
  email?: string;
  cnh?: string;
  vencimentoCnh?: string;
  ativo: boolean;
  /** Resposta GET / PUT — para remontar o body com os mesmos ids */
  pessoaId?: number;
  pessoaFisicaId?: number;
  primeiroEnderecoId?: number;
  primeiroContatoId?: number;
}

export interface MotoristaListItemDTO {
  id: number;
  transportadoraId?: number;
  nomeCompleto: string;
  cpf: string;
  email?: string;
  cnh?: string;
  vencimentoCnh?: string;
  ativo: boolean;
  pessoaId?: number;
  pessoaFisicaId?: number;
  primeiroEnderecoId?: number;
  primeiroContatoId?: number;
}

export interface MotoristaBuscarParams {
  Termo?: string;
  TransportadoraId?: number;
  NumeroPagina: number;
  TamanhoPagina: number;
}

export interface PagedResultMotoristaDTO {
  items: MotoristaListItemDTO[];
  totalCount: number;
  numeroPagina: number;
  tamanhoPagina: number;
}
