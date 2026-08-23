/**
 * Item de listagem — alinhar ao JSON real do `GET /api/auth/Usuario`.
 * @see environment + `/swagger/v1/swagger.json` (paths `/api/auth/Usuario`, `/api/auth/Usuario/{id}`).
 */
export interface UsuarioOutput {
  /** Swagger: `Usuario/{id}` usa int32; a listagem costuma repetir o mesmo tipo. */
  id?: string | number;
  userName?: string | null;
  email?: string | null;
  nome?: string | null;
  EstacionamentoId?: number | null;
  /** Nome do perfil/role. */
  role?: string | null;
}

export interface PessoaUsuarioOutput {
  id?: number;
  nome?: string | null;
  cpf?: string | null;
  /** 1 = Física, 2 = Jurídica. */
  tipoPessoa?: number;
}

export type TipoPapelUsuario = 0 | 1 | 2 | 3 | 4;
export type TipoPessoaUsuario = 1 | 2;

export interface UsuarioPapelOpcao {
  value: TipoPapelUsuario;
  label: string;
  tipoPessoaPadrao: TipoPessoaUsuario;
  tiposPessoaPermitidos: TipoPessoaUsuario[];
}

export interface UsuarioTipoPessoaOpcao {
  value: TipoPessoaUsuario;
  label: string;
}

/** GET api/auth/Usuario/opcoes-cadastro */
export interface UsuarioCadastroOpcoes {
  podeCadastrar: boolean;
  papelLogado?: TipoPapelUsuario | null;
  papelLogadoLabel?: string | null;
  mensagem?: string | null;
  tiposPapel: UsuarioPapelOpcao[];
  tiposPessoa: UsuarioTipoPessoaOpcao[];
}

export interface PerfilRoleOutput {
  id?: string;
  name?: string | null;
  normalizedName?: string | null;
  concurrencyStamp?: string | null;
}

/** GET api/auth/Usuario/{id} */
export interface UsuarioDetalheOutput {
  /** Contrato atual pode retornar `usuarioId` no lugar de `id`. */
  usuarioId?: number | string;
  id?: string;
  userName?: string | null;
  email?: string | null;
  nome?: string | null;
  cpf?: string | null;
  pessoaId?: number | null;
  perfilId?: number | string | null;
  empresaId?: number | null;
  empresa?: string | null;
  estacionamentoId?: number | null;
  estacionamento?: string | null;
  transportadoraId?: number | null;
  transportadora?: string | null;
  /** 1 = Física, 2 = Jurídica. */
  tipoPessoa?: number | null;
  tipoPapel?: number | null;
  /** Alguns fluxos ainda usam `perfil` string diretamente. */
  perfil?: PerfilRoleOutput | string | null;
  EstacionamentoId?: number;
  pessoa?: PessoaUsuarioOutput | null;
}

/**
 * PUT `api/auth/Usuario/{id}` — mesmo shape que Register no Swagger; senha opcional na edição.
 * Alinhado a `components.schemas.RegisterInput` em api-types.ts (`EstacionamentoId` opcional).
 */
export interface RegisterInputUpdate {
  userName: string;
  password?: string;
  confirmPassword?: string;
  email?: string;
  EstacionamentoId?: number;
  TransportadoraId?: number;
  tipoPapel?: number;
  pessoa: {
    id: number;
    nome: string;
    cpf: string;
    tipoPessoa: number;
  };
  perfil: {
    name: string;
  };
}

/**
 * POST `api/auth/Usuario/Register` — o OpenAPI marca `password` como obrigatório no cadastro.
 */
export type RegisterInputRegister = RegisterInputUpdate & { password: string };

/** Alias legado — use {@link RegisterInputUpdate} ou {@link RegisterInputRegister} conforme o verbo HTTP. */
export type RegisterInput = RegisterInputUpdate;

/** Resposta de POST Register (quando a API retorna detalhe do fluxo de e-mail). */
export interface RegistroResult {
  mensagem?: string;
  message?: string;
  email?: string;
  linkConfirmacaoNoFrontend?: string;
  linkConfirmacaoNoFrontend1?: string;
  emailDeConfirmacaoEnviado?: boolean;
  EmailDeConfirmacaoEnviado?: boolean;
}

export interface ConfirmarEmailRequest {
  userId: number;
  token: string;
}

export interface LoginEnvelopeBody {
  success?: boolean;
  Success?: boolean;
  result?: unknown;
  Result?: unknown;
  message?: string;
  Message?: string;
  notifications?: string[] | string;
}

/** POST esqueci-senha — conteúdo típico de `result` / `Result`. */
export interface EsqueciSenhaResultDto {
  mensagem?: string | null;
  Mensagem?: string | null;
  linkRedefinicaoNoFrontend?: string | null;
  LinkRedefinicaoNoFrontend?: string | null;
  emailEnviado?: boolean;
  EmailEnviado?: boolean;
}

/** Resposta amigável mapeada para a tela (mensagem genérica de segurança). */
export interface EsqueciSenhaFlowResult {
  userMessage: string;
  devLink: string | null;
  emailEnviado?: boolean;
}

/** POST redefinir-senha — corpo (camelCase, alinhado ao Login). */
export interface RedefinirSenhaRequest {
  email: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/** Conteúdo de `result` em redefinir-senha (anonymous type no backend pode usar camelCase). */
export interface RedefinirSenhaResultDto {
  senhaAlterada?: boolean;
  SenhaAlterada?: boolean;
}
