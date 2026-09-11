/** Módulo Agendamento — rota canônica (folha na sidebar). */
export const AGENDAMENTO_ROUTE = '/app/agendamento';
export const AGENDAMENTO_PATH = 'agendamento';

/**
 * Alias legado da lista (`/app/agendamento/agendamentos`).
 * Mantido igual à rota canônica para não quebrar menus/login antigos.
 */
export const AGENDAMENTOS_ROUTE = AGENDAMENTO_ROUTE;
export const AGENDAMENTOS_PATH = 'agendamentos';

/** Normaliza URL legada de agendamento para o canônico `/app/agendamento`. */
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
  return null;
}
