/**
 * Contrato do módulo Convite de Transportadora (Swagger GTS API).
 *
 * Autenticados (JWT + pátio da sessão):
 * - POST `/api/ConviteTransportadora`                 → criar + enviar e-mail
 * - GET  `/api/ConviteTransportadora`                 → listagem paginada
 * - POST `/api/ConviteTransportadora/{id}/reenviar`
 * - POST `/api/ConviteTransportadora/{id}/cancelar`
 *
 * Públicos (AllowAnonymous):
 * - GET `/api/public/convite-transportadora/{token}`
 * - PUT `/api/public/convite-transportadora/{token}/etapa/acesso`
 * - PUT `/api/public/convite-transportadora/{token}/etapa/responsavel`
 * - PUT `/api/public/convite-transportadora/{token}/etapa/empresa`
 * - PUT `/api/public/convite-transportadora/{token}/etapa/endereco`
 *
 * Status no wire da API de convite: Pendente | EmAndamento | Concluido | Expirado | Cancelado.
 * Na listagem de transportadoras, o front normaliza para StatusCadastroTransportadora.
 *
 * SPA pública: `/convite/transportadora/:token` (alias legado `/cadastro-transportadora/:token`)
 */

/** Status de onboarding — valores estáveis no wire; labels na UI. */
export type StatusCadastroTransportadora =
  | 'ConviteEnviado'
  | 'CadastroEmAndamento'
  | 'AguardandoConclusao'
  | 'Ativa'
  | 'ConviteExpirado'
  | 'Inativa';

export const STATUS_CADASTRO_TRANSPORTADORA_LABEL: Record<StatusCadastroTransportadora, string> = {
  ConviteEnviado: 'Convite enviado',
  CadastroEmAndamento: 'Cadastro em andamento',
  AguardandoConclusao: 'Aguardando conclusão',
  Ativa: 'Ativa',
  ConviteExpirado: 'Convite expirado',
  Inativa: 'Inativa',
};

/** POST criar convite — campos alinhados a ConviteTransportadoraCriarInput. */
export interface CriarConviteTransportadoraInput {
  responsavelNome: string;
  responsavelCpf: string;
  responsavelEmail: string;
  /** Obrigatório na API (`responsavelTelefone`, minLength 1). DDD + número. */
  responsavelTelefone: string;
}

/** Resposta de criar/reenviar (envelope `result` ou corpo direto). */
export interface ConviteTransportadoraResult {
  id: number;
  status: StatusCadastroTransportadora;
  responsavelNome: string;
  responsavelCpf: string;
  responsavelEmail: string;
  /** Link absoluto ou path SPA; em dev a API pode devolver para testes. */
  linkConviteFrontend?: string | null;
  emailEnviado?: boolean;
  /** wa.me com mensagem e link "Cadastrar Transportadora". */
  urlWhatsApp?: string | null;
  /** sms: com mensagem e link embutidos. */
  urlSms?: string | null;
  mensagemCompartilhamento?: string | null;
  expiresAt?: string | null;
  transportadoraId?: number | null;
  mensagem?: string | null;
}

/** GET público por token. */
export interface ConviteTransportadoraPublicoDto {
  tokenValido: boolean;
  status: StatusCadastroTransportadora;
  responsavelNome: string;
  responsavelCpf: string;
  responsavelEmail: string;
  /** Nome do pátio convidante (somente exibição). */
  estacionamentoNome?: string | null;
  transportadoraId?: number | null;
  progressoCadastro?: number | null;
  /** Rascunho já salvo (empresa/endereço), se houver. */
  rascunho?: CompletarCadastroTransportadoraInput | null;
  mensagem?: string | null;
  expiresAt?: string | null;
}

/** PUT rascunho / POST concluir (público). */
export interface CompletarCadastroTransportadoraInput {
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  inscricaoEstadual?: string | null;
  email?: string | null;
  telefone?: string | null;
  responsavelNome: string;
  responsavelCpf: string;
  responsavelEmail: string;
  responsavelTelefone?: string | null;
  endereco?: {
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
  } | null;
}

export interface ConcluirCadastroTransportadoraResult {
  transportadoraId: number;
  status: StatusCadastroTransportadora;
  mensagem?: string | null;
}

/** Status considerados “pendentes” (ações reenviar/cancelar). */
export function isStatusConvitePendente(status: StatusCadastroTransportadora | null | undefined): boolean {
  return (
    status === 'ConviteEnviado' ||
    status === 'CadastroEmAndamento' ||
    status === 'AguardandoConclusao' ||
    status === 'ConviteExpirado'
  );
}

export function parseStatusCadastroTransportadora(raw: unknown): StatusCadastroTransportadora | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const byNum: Record<number, StatusCadastroTransportadora> = {
      0: 'ConviteEnviado',
      1: 'CadastroEmAndamento',
      2: 'AguardandoConclusao',
      3: 'Ativa',
      4: 'ConviteExpirado',
      5: 'Inativa',
    };
    return byNum[Math.trunc(raw)] ?? null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const normalized = s.replace(/\s+/g, '');
  const aliases: Record<string, StatusCadastroTransportadora> = {
    ConviteEnviado: 'ConviteEnviado',
    conviteenviado: 'ConviteEnviado',
    /** Status da API `/api/ConviteTransportadora`. */
    Pendente: 'ConviteEnviado',
    pendente: 'ConviteEnviado',
    CadastroEmAndamento: 'CadastroEmAndamento',
    cadastroemandamento: 'CadastroEmAndamento',
    EmAndamento: 'CadastroEmAndamento',
    emandamento: 'CadastroEmAndamento',
    AguardandoConclusao: 'AguardandoConclusao',
    aguardandoconclusao: 'AguardandoConclusao',
    Ativa: 'Ativa',
    ativa: 'Ativa',
    Ativo: 'Ativa',
    ativo: 'Ativa',
    Concluido: 'Ativa',
    concluido: 'Ativa',
    ConviteExpirado: 'ConviteExpirado',
    conviteexpirado: 'ConviteExpirado',
    Expirado: 'ConviteExpirado',
    expirado: 'ConviteExpirado',
    Inativa: 'Inativa',
    inativa: 'Inativa',
    Inativo: 'Inativa',
    inativo: 'Inativa',
    /**
     * Convite cancelado não implica transportadora inativa na grade.
     * Mantém rótulo de “convite expirado/encerrado” para ações de reenvio não aparecerem como Ativa.
     */
    Cancelado: 'ConviteExpirado',
    cancelado: 'ConviteExpirado',
  };
  return aliases[normalized] ?? aliases[s] ?? null;
}
