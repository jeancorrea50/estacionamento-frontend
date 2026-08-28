/**
 * Fonte única das rotas do módulo Cadastro.
 * Canônico (API/login): `/app/cadastro/{transportadoras|veiculos|motoristas|estacionamentos}`.
 */

export const CADASTRO_ROUTE = '/app/cadastro';

export const CADASTRO_TRANSPORTADORAS_ROUTE = '/app/cadastro/transportadoras';
export const CADASTRO_TRANSPORTADORAS_PATH = 'transportadoras';

export const CADASTRO_VEICULOS_ROUTE = '/app/cadastro/veiculos';
export const CADASTRO_VEICULOS_PATH = 'veiculos';

export const CADASTRO_MOTORISTAS_ROUTE = '/app/cadastro/motoristas';
export const CADASTRO_MOTORISTAS_PATH = 'motoristas';

export const CADASTRO_ESTACIONAMENTOS_ROUTE = '/app/cadastro/estacionamentos';
export const CADASTRO_ESTACIONAMENTOS_PATH = 'estacionamentos';

/** @deprecated Use {@link CADASTRO_ESTACIONAMENTOS_ROUTE}. */
export const CADASTRO_ESTACIONAMENTO_ROUTE = CADASTRO_ESTACIONAMENTOS_ROUTE;
/** @deprecated Use {@link CADASTRO_ESTACIONAMENTOS_PATH}. */
export const CADASTRO_ESTACIONAMENTO_PATH = CADASTRO_ESTACIONAMENTOS_PATH;

const LEGACY_TRANSPORTADORA = '/app/cadastro/transportadora';
const LEGACY_MOTORISTA = '/app/cadastro/motorista';
const LEGACY_VEICULO = '/app/cadastro/veiculo';
const LEGACY_ESTACIONAMENTO = '/app/cadastro/estacionamento';

function normalizePath(raw: string): string {
  let path = raw.replace(/\/{2,}/g, '/');
  if (!path.startsWith('/')) {
    path = /^app\//i.test(path) ? `/${path}` : `/app/${path.replace(/^\/+/, '')}`;
  }
  return path.replace(/\/+$/, '') || '/app';
}

/**
 * Converte rotas legadas do Cadastro (singular) para o canônico (plural).
 */
export function normalizeCadastroAppRoute(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  let path = normalizePath(trimmed);
  const lower = path.toLowerCase();

  if (lower === CADASTRO_ROUTE) {
    return CADASTRO_ROUTE;
  }

  if (lower === LEGACY_TRANSPORTADORA || lower.startsWith(`${LEGACY_TRANSPORTADORA}/`)) {
    return `${CADASTRO_TRANSPORTADORAS_ROUTE}${path.slice(LEGACY_TRANSPORTADORA.length)}`;
  }

  if (lower === LEGACY_MOTORISTA || lower.startsWith(`${LEGACY_MOTORISTA}/`)) {
    return `${CADASTRO_MOTORISTAS_ROUTE}${path.slice(LEGACY_MOTORISTA.length)}`;
  }

  if (lower === LEGACY_VEICULO || lower.startsWith(`${LEGACY_VEICULO}/`)) {
    return `${CADASTRO_VEICULOS_ROUTE}${path.slice(LEGACY_VEICULO.length)}`;
  }

  if (lower === LEGACY_ESTACIONAMENTO || lower.startsWith(`${LEGACY_ESTACIONAMENTO}/`)) {
    return `${CADASTRO_ESTACIONAMENTOS_ROUTE}${path.slice(LEGACY_ESTACIONAMENTO.length)}`;
  }

  if (lower === '/app/gerenciamento/estacionamento' || lower.startsWith('/app/gerenciamento/estacionamento/')) {
    return `${CADASTRO_ESTACIONAMENTOS_ROUTE}${path.slice('/app/gerenciamento/estacionamento'.length)}`;
  }

  return path === '/app' ? null : path;
}
