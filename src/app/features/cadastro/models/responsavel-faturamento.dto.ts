/** Resposta paginada genérica. */
export interface PagedResultDTO<T> {
  items: T[];
  totalCount: number;
  numeroPagina?: number;
  tamanhoPagina?: number;
}

/** Filtros GET /api/ResponsavelFaturamento. */
export interface ResponsavelFaturamentoBuscarParams {
  Descricao?: string;
  Cnpj?: string;
  Ativo?: boolean | null;
  NumeroPagina: number;
  TamanhoPagina: number;
}

/** Item da listagem (SearchOutput). */
export interface ResponsavelFaturamentoListItemDTO {
  id: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  email: string;
  telefone?: string;
  ativo: boolean;
  pessoaId?: number | null;
  responsavelLegal?: string | null;
  responsavelEmail?: string | null;
  responsavelTelefone?: string | null;
  dataAtualizacao?: string | null;
}

export interface ResponsavelFaturamentoEnderecoDTO {
  id?: number;
  pessoaId?: number;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  complemento: string;
}

/** Detalhe / formulário (ObterPorId + POST/PUT). */
export interface ResponsavelFaturamentoDTO {
  id?: number;
  pessoaId?: number | null;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ativo: boolean;
  responsavelLegal?: string;
  responsavelEmail?: string;
  responsavelTelefone?: string;
  endereco?: ResponsavelFaturamentoEnderecoDTO;
}
