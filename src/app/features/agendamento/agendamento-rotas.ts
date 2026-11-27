/**
 * Agrupador Pátio → Agendamentos (sem tela própria).
 * Filhos: Painel e Janelas.
 */
export const AGENDAMENTO_ROUTE = '/app/patio/agendamentos';
export const AGENDAMENTO_PATH = 'agendamentos';
export const AGENDAMENTO_LABEL = 'Agendamentos';

/**
 * Painel operacional de Agendamentos.
 * Canônico: `/app/patio/agendamentos/painel` — claims `agendamentos.*`.
 */
export const AGENDAMENTO_PAINEL_LABEL = 'Painel';
export const AGENDAMENTO_PAINEL_PATH = 'painel';
export const AGENDAMENTO_PAINEL_ROUTE = '/app/patio/agendamentos/painel';

/**
 * Janelas de agendamento (slots por modalidade) — submenu de Agendamentos.
 * Canônico: `/app/patio/agendamentos/janelas` — claims `janelas.*`.
 */
export const JANELAS_LABEL = 'Janelas';
export const JANELAS_PATH = 'janelas';
export const JANELAS_ROUTE = '/app/patio/agendamentos/janelas';

/**
 * Destinação de vagas por acordo — submenu de Agendamentos.
 * Canônico: `/app/patio/agendamentos/destinacao` — claims `destinacao.*`.
 * Calendário: mesma rota com `?view=calendario` (topbar).
 */
export const DESTINACAO_LABEL = 'Destinação';
export const DESTINACAO_PATH = 'destinacao';
export const DESTINACAO_ROUTE = '/app/patio/agendamentos/destinacao';

/** @deprecated Redireciona para {@link DESTINACAO_ROUTE}. */
export const DESTINACAO_LAB_LABEL = 'Destinação';
export const DESTINACAO_LAB_PATH = 'destinacao-lab';
export const DESTINACAO_LAB_ROUTE = '/app/patio/agendamentos/destinacao-lab';

/** @deprecated Redireciona para {@link DESTINACAO_ROUTE}?view=calendario. */
export const DESTINACAO_DASHBOARD_LABEL = 'Calendário';
export const DESTINACAO_DASHBOARD_PATH = 'destinacao-dashboard';
export const DESTINACAO_DASHBOARD_ROUTE = '/app/patio/agendamentos/destinacao-dashboard';

/** Alias legado da lista sob `/app/agendamento/...`. */
export const AGENDAMENTOS_ROUTE = AGENDAMENTO_PAINEL_ROUTE;
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

/** Singular legado sob Pátio (sem "s") — não confundir com o agrupador plural. */
const AGENDAMENTO_PATIO_SINGULAR_LEGACY = '/app/patio/agendamento';

/**
 * Normaliza URLs legadas de agendamento/agendar para as rotas canônicas.
 * - Pátio agrupador: `/app/patio/agendamentos` (mantém — nesting no Menu Admin)
 * - Pátio painel: `/app/patio/agendamentos/painel`
 * - Pátio janelas: `/app/patio/agendamentos/janelas`
 * - Filhos dinâmicos sob agendamentos: preserva path
 * - Agendar: `/app/agendar`
 */
export function normalizeAgendamentoAppRoute(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const lower = (trimmed.toLowerCase().split('?')[0]?.split('#')[0] ?? '').replace(/\/+$/, '');
  if (!lower) return null;

  if (lower === AGENDAR_LEGACY_ROUTE || lower.startsWith(`${AGENDAR_LEGACY_ROUTE}/`)) {
    return AGENDAR_ROUTE;
  }
  if (lower === AGENDAR_ROUTE || lower.startsWith(`${AGENDAR_ROUTE}/`)) {
    return AGENDAR_ROUTE;
  }
  // Folhas canônicas: exact match apenas.
  // Filhos sob painel/janelas (ex.: .../painel/foo) NÃO colapsam — nesting dinâmico.
  if (lower === JANELAS_ROUTE) {
    return JANELAS_ROUTE;
  }
  if (lower === AGENDAMENTO_PAINEL_ROUTE) {
    return AGENDAMENTO_PAINEL_ROUTE;
  }
  if (
    lower === DESTINACAO_LAB_ROUTE ||
    lower.startsWith(`${DESTINACAO_LAB_ROUTE}/`) ||
    lower === DESTINACAO_DASHBOARD_ROUTE ||
    lower.startsWith(`${DESTINACAO_DASHBOARD_ROUTE}/`)
  ) {
    return DESTINACAO_ROUTE;
  }
  if (lower === DESTINACAO_ROUTE || lower.startsWith(`${DESTINACAO_ROUTE}/`)) {
    return lower === DESTINACAO_ROUTE ? DESTINACAO_ROUTE : lower;
  }

  // Agrupador canônico — NÃO reescreve para painel (necessário para nestSubMenusByRoute).
  if (lower === AGENDAMENTO_ROUTE) {
    return AGENDAMENTO_ROUTE;
  }

  // Qualquer profundidade sob o agrupador: preserva path normalizado.
  if (lower.startsWith(`${AGENDAMENTO_ROUTE}/`)) {
    return lower;
  }

  // Legado singular `/app/patio/agendamento` — boundary-safe (não casa "agendamentos").
  if (
    lower === AGENDAMENTO_PATIO_SINGULAR_LEGACY ||
    (lower.startsWith(`${AGENDAMENTO_PATIO_SINGULAR_LEGACY}/`) &&
      !lower.startsWith(AGENDAMENTO_ROUTE))
  ) {
    return AGENDAMENTO_PAINEL_ROUTE;
  }

  if (
    lower === AGENDAMENTO_LEGACY_ROUTE ||
    lower === `${AGENDAMENTO_LEGACY_ROUTE}/agendamentos` ||
    lower.startsWith(`${AGENDAMENTO_LEGACY_ROUTE}/agendamentos/`) ||
    lower.startsWith(`${AGENDAMENTO_LEGACY_ROUTE}/`)
  ) {
    return AGENDAMENTO_PAINEL_ROUTE;
  }
  return null;
}
