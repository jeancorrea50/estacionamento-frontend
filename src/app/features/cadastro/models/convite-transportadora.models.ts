/**
 * Contrato mínimo do módulo Convite de Transportadora (front ↔ backend).
 *
 * Endpoints autenticados (JWT + EmpresaId do pátio convidante):
 * - POST   `/api/Transportadora/convite`                    → criar + enviar e-mail
 * - POST   `/api/Transportadora/convite/{id}/reenviar`      → reenviar e-mail
 * - POST   `/api/Transportadora/convite/{id}/cancelar`      → cancelar convite
 *
 * Endpoints públicos (AllowAnonymous, sem Bearer):
 * - GET    `/api/Transportadora/convite/publico/{token}`
 * - PUT    `/api/Transportadora/convite/publico/{token}/rascunho`
 * - POST   `/api/Transportadora/convite/publico/{token}/concluir`
 *
 * A listagem `GET /api/Transportadora` deve projetar `statusCadastro`, `progressoCadastro`,
 * `responsavelNome` e `conviteId` quando o registro for (ou tiver) convite.
 *
 * SPA pública: `/cadastro-transportadora/:token`
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

/** POST criar convite */
export interface CriarConviteTransportadoraInput {
  responsavelNome: string;
  responsavelCpf: string;
  responsavelEmail: string;
  /** Telefone com DDD — usado nos links WhatsApp/SMS. */
  responsavelTelefone?: string;
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
    CadastroEmAndamento: 'CadastroEmAndamento',
    cadastroemandamento: 'CadastroEmAndamento',
    AguardandoConclusao: 'AguardandoConclusao',
    aguardandoconclusao: 'AguardandoConclusao',
    Ativa: 'Ativa',
    ativa: 'Ativa',
    Ativo: 'Ativa',
    ativo: 'Ativa',
    ConviteExpirado: 'ConviteExpirado',
    conviteexpirado: 'ConviteExpirado',
    Inativa: 'Inativa',
    inativa: 'Inativa',
    Inativo: 'Inativa',
    inativo: 'Inativa',
  };
  return aliases[normalized] ?? aliases[s] ?? null;
}
