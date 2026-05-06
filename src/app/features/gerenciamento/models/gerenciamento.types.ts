/**
 * Tipos da tela Gerenciamento / Acessos, alinhados a GET/POST/PUT/DELETE
 * de `api/auth/Usuario` e RegisterInputUpdate.
 */

/** Item da grid (após mapear UsuarioOutput). */
export interface UsuarioGerenciamentoItem {
  id?: string;
  userName?: string | null;
  nome?: string | null;
  email?: string | null;
  emailOuLogin?: string | null;
  perfil?: string | null;
  EstacionamentoId?: number | null;
  EstacionamentoNome?: string | null;
  ativo?: boolean;
}

export interface GerenciamentoFiltros {
  nomeOuEmail: string;
  /** Nome do role (como exibido no select), vazio = todos. */
  perfilNome: string;
}

export interface UsuarioGerenciamentoForm {
  nome: string;
  email: string;
  login: string;
  senha: string;
  confirmarSenha: string;
  /** 0 = sem vínculo (contrato API). */
  EstacionamentoId: number;
  EstacionamentoLabel: string;
  vinculoTipo: 'estacionamento' | 'transportadora';
  transportadoraId: number;
  transportadoraLabel: string;
  cpf: string;
  tipoPessoa: 1 | 2;
  pessoaId: number | null;
  perfilId: string;
  ativo: boolean;
}
