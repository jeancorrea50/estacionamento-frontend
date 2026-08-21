export interface MotoristaDTO {
  id?: number;
  /**
   * Transportadora vinculada.
   * `null` = desvincular explicitamente no PUT (transferência de vínculo).
   */
  transportadoraId?: number | null;
  /** Nome da transportadora atualmente vinculada (quando a API informar). */
  transportadoraNome?: string;
  nomeCompleto: string;
  cpf: string;
  email?: string;
  /** Celular BR (DDD + 9 dígitos); UI mascarada, API com dígitos no contato.telefone. */
  celular?: string;
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
  /** Nome da transportadora atualmente vinculada (quando a API informar). */
  transportadoraNome?: string;
  nomeCompleto: string;
  cpf: string;
  email?: string;
  celular?: string;
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
