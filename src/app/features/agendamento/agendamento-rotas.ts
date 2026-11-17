/** Módulo Agendamento — painel operador/estacionamento (submenu do Pátio). */
export const AGENDAMENTO_ROUTE = '/app/agendamento';
export const AGENDAMENTO_PATH = 'agendamento';
export const AGENDAMENTO_LABEL = 'Agendamento';

/**
 * Alias legado da lista (`/app/agendamento/agendamentos`).
 * Mantido igual à rota canônica para não quebrar menus/login antigos.
 */
export const AGENDAMENTOS_ROUTE = AGENDAMENTO_ROUTE;
export const AGENDAMENTOS_PATH = 'agendamentos';

/** Menu próprio: visão transportadora (próprios agendamentos + vagas liberadas). */
export const AGENDAR_ROUTE = '/app/agendar';
export const AGENDAR_PATH = 'agendar';
export const AGENDAR_LABEL = 'Agendar';

/** Legado: `/app/agendamento/agendar`. */
export const AGENDAR_LEGACY_ROUTE = '/app/agendamento/agendar';

/**
 * Normaliza URLs legadas de agendamento/agendar para as rotas canônicas.
 */
export function normalizeAgendamentoAppRoute(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase().split('?')[0]?.split('#')[0] ?? '';
  if (
    lower === '/app/agendamento/agendamentos' ||
    lower.startsWith('/app/agendamento/agendamentos/')
  ) {
    return AGENDAMENTO_ROUTE;
  }
  if (lower === AGENDAR_LEGACY_ROUTE || lower.startsWith(`${AGENDAR_LEGACY_ROUTE}/`)) {
    return AGENDAR_ROUTE;
  }
  return null;
}
