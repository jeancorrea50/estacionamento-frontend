import type { components } from '../../../core/api/generated/api-types';

/** Contrato Swagger: POST/PUT `/api/Transportadora` */
export type TransportadoraPostInput = components['schemas']['TransportadoraPostInput'];
export type TransportadoraPutInput = components['schemas']['TransportadoraPutInput'];

/** Resposta paginada genérica da API */
export interface PagedResultDTO<T> {
  items: T[];
  totalCount: number;
  numeroPagina?: number;
  tamanhoPagina?: number;
}

/** Parâmetros para GET /api/Transportadora?... (`Termo` mapeia para `Descricao` no client). */
export interface TransportadoraBuscarParams {
  Termo?: string;
  Propriedade?: string;
  NumeroPagina: number;
  TamanhoPagina: number;
}

/** Item da listagem (Buscar) */
export interface TransportadoraListItemDTO {
  id: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  email: string;
  ativo: boolean;
  /** Contagem exibida na coluna Frota quando a API enviar o campo */
  quantidadeVeiculos?: number | null;
  /** ISO ou string da API para coluna Atualização */
  dataAtualizacao?: string | null;
}

/** Endereço no formulário de transportadora */
export interface TransportadoraEnderecoDTO {
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  complemento: string;
}

/** Contato complementar (UI / GET com lista em `pessoa.contatos`) */
export interface TransportadoraContatoComplementarDTO {
  nome?: string;
  cpf?: string;
  telefone?: string;
  email?: string;
}

/** Dados principais da transportadora (formulário / API) */
export interface TransportadoraDTO {
  id?: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  email: string;
  telefone?: string;
  ativo: boolean;
  /** Responsável principal */
  responsavelNome?: string;
  responsavelCpf?: string;
  responsavelCelular?: string;
  responsavelEmail?: string;
  responsavelCargo?: string;
  /** Contatos adicionais (além do responsável legal) */
  contatosComplementares?: TransportadoraContatoComplementarDTO[];
  /** Endereço */
  endereco?: TransportadoraEnderecoDTO;
}

/** Alinhado a `PessoaContatoInput` — `pessoaId` omitido no POST de novos vínculos. */
export interface TransportadoraContatoPayload {
  pessoaId?: number;
  id?: number;
  principal: boolean;
  descricao?: string;
  cpf?: string;
  telefone: string;
  email?: string;
  observacao: string;
}

export interface TransportadoraEnderecoPayload {
  pessoaId?: number;
  principal: boolean;
  tipoEndereco: 1 | 2 | 3 | 4;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/** @deprecated Use `TransportadoraPostInput`. Mantido para compatibilidade de imports antigos. */
export type TransportadoraPostPayload = TransportadoraPostInput;

/** Resposta de ObterPorId (pode vir em result ou direto) */
export interface TransportadoraObterPorIdResultDTO {
  id: number;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
  responsavelNome?: string;
  responsavelCpf?: string;
  responsavelCelular?: string;
  responsavelEmail?: string;
  responsavelCargo?: string;
  endereco?: TransportadoraEnderecoDTO;
  [key: string]: unknown;
}
