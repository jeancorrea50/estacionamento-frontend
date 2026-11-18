/**
 * Painel operacional de Agendamentos (submenu do Pátio).
 * Canônico: `/app/patio/agendamentos` — claims `agendamentos.*`.
 */
export const AGENDAMENTO_ROUTE = '/app/patio/agendamentos';
export const AGENDAMENTO_PATH = 'agendamentos';
export const AGENDAMENTO_LABEL = 'Agendamentos';

/**
 * Janelas de agendamento (slots por modalidade) — submenu de Agendamentos.
 * Canônico: `/app/patio/agendamentos/janelas` — claims `janelas.*`.
 */
export const JANELAS_LABEL = 'Janelas';
export const JANELAS_PATH = 'janelas';
export const JANELAS_ROUTE = '/app/patio/agendamentos/janelas';
/** Alias legado da lista sob `/app/agendamento/...`. */
export const AGENDAMENTOS_ROUTE = AGENDAMENTO_ROUTE;
export const AGENDAMENTOS_PATH = 'agendamentos';

/**
 * Menu Agendar — foco transportadora, mas qualquer perfil com menu/claim `agendar.*`.
 * Canônico: `/app/agendar`.
 */
export const AGENDAR_ROUTE = '/app/agendar';
export const AGENDAR_PATH = 'agendar';
export const AGENDAR_LABEL = 'Agendar';

/** Legado: `/app/agendamento/agendar`. */
export const AGENDAR_LEGACY_ROUTE = '/app/agendamento/agendar';

/** Legado: painel em `/app/agendamento` (antes do move para o Pátio). */
export const AGENDAMENTO_LEGACY_ROUTE = '/app/agendamento';

/**
 * Normaliza URLs legadas de agendamento/agendar para as rotas canônicas.
 * - Pátio: `/app/patio/agendamentos`
 * - Agendar: `/app/agendar`
 */
export function normalizeAgendamentoAppRoute(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase().split('?')[0]?.split('#')[0] ?? '';

  if (lower === AGENDAR_LEGACY_ROUTE || lower.startsWith(`${AGENDAR_LEGACY_ROUTE}/`)) {
    return AGENDAR_ROUTE;
  }
  if (lower === AGENDAR_ROUTE || lower.startsWith(`${AGENDAR_ROUTE}/`)) {
    return AGENDAR_ROUTE;
  }
  // Janelas antes do painel: `/app/patio/agendamentos/janelas` ≠ `/app/patio/agendamentos`.
  if (lower === JANELAS_ROUTE || lower.startsWith(`${JANELAS_ROUTE}/`)) {
    return JANELAS_ROUTE;
  }
  if (
    lower === AGENDAMENTO_ROUTE ||
    lower.startsWith(`${AGENDAMENTO_ROUTE}/`) ||
    lower === '/app/patio/agendamento' ||
    lower.startsWith('/app/patio/agendamento/')
  ) {
    return AGENDAMENTO_ROUTE;
  }
  if (
    lower === AGENDAMENTO_LEGACY_ROUTE ||
    lower === `${AGENDAMENTO_LEGACY_ROUTE}/agendamentos` ||
    lower.startsWith(`${AGENDAMENTO_LEGACY_ROUTE}/agendamentos/`) ||
    lower.startsWith(`${AGENDAMENTO_LEGACY_ROUTE}/`)
  ) {
    // `/app/agendamento/agendar` já tratado acima; restante → painel do pátio.
    return AGENDAMENTO_ROUTE;
  }
  return null;
}
