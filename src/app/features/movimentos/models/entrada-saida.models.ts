import type {
  EntradaSaidaBuscarPorPlacaMotorista,
  EntradaSaidaBuscarPorPlacaTransportadora,
  EntradaSaidaBuscarPorPlacaVeiculo
} from './entrada-saida-buscar-por-placa.models';

/** Espelha `EntradaSaidaStatus` (byte) do backend. */
export enum EntradaSaidaStatus {
  Entrada = 0,
  Saida = 1,
  Suspenso = 2,
  Agendado = 3,
  Cancelado = 4
}

/** Labels alinhados aos `[Description]` do enum no backend. */
export const ENTRADA_SAIDA_STATUS_LABEL: Record<EntradaSaidaStatus, string> = {
  [EntradaSaidaStatus.Entrada]: 'Entrada',
  [EntradaSaidaStatus.Saida]: 'Saida',
  [EntradaSaidaStatus.Suspenso]: 'Suspenso',
  [EntradaSaidaStatus.Agendado]: 'Agendado',
  [EntradaSaidaStatus.Cancelado]: 'Cancelado'
};

const ENTRADA_SAIDA_STATUS_VALUES = new Set<number>([
  EntradaSaidaStatus.Entrada,
  EntradaSaidaStatus.Saida,
  EntradaSaidaStatus.Suspenso,
  EntradaSaidaStatus.Agendado,
  EntradaSaidaStatus.Cancelado
]);

/** Converte valor numérico/string da API para o enum tipado. */
export function parseEntradaSaidaStatus(
  value: number | string | null | undefined
): EntradaSaidaStatus | undefined {
  if (value == null || value === '') return undefined;

  if (typeof value === 'number') {
    return ENTRADA_SAIDA_STATUS_VALUES.has(value) ? (value as EntradaSaidaStatus) : undefined;
  }

  const trimmed = String(value).trim();
  const asNum = Number(trimmed);
  if (trimmed !== '' && Number.isInteger(asNum) && ENTRADA_SAIDA_STATUS_VALUES.has(asNum)) {
    return asNum as EntradaSaidaStatus;
  }

  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const byName: Record<string, EntradaSaidaStatus> = {
    entrada: EntradaSaidaStatus.Entrada,
    saida: EntradaSaidaStatus.Saida,
    suspenso: EntradaSaidaStatus.Suspenso,
    agendado: EntradaSaidaStatus.Agendado,
    cancelado: EntradaSaidaStatus.Cancelado
  };

  return byName[normalized];
}

export function entradaSaidaStatusLabel(
  value: number | string | null | undefined
): string | undefined {
  const status = parseEntradaSaidaStatus(value);
  return status == null ? undefined : ENTRADA_SAIDA_STATUS_LABEL[status];
}

export interface EntradaSaidaFiltro {
  placa?: string;
  motoristaId?: number;
  transportadoraId?: number;
  somenteEmAberto?: boolean;
  numeroPagina: number;
  tamanhoPagina: number;
  page?: number;
  size?: number;
}

export interface EntradaSaidaSearchOutput {
  id: number;
  descricao: string;
  motoristaId: number;
  nomeMotorista: string;
  transportadoraId: number;
  nomeTransportadora: string;
  veiculoId: number;
  placaVeiculo: string;
  dataHoraEntrada: string;
  dataHoraSaida?: string | null;
  /** Enum byte do backend (`EntradaSaidaStatus` / Situacao). */
  status?: EntradaSaidaStatus | number | string;
}

export interface EntradaSaidaSuspensaoOutput {
  id: number;
  dataHoraInicioSuspensao: string;
  dataHoraFimSuspensao?: string | null;
  tempoSuspensaoMinutos: number;
  usuarioSuspensaoId: number;
  usuarioSuspensaoNome: string;
}

export interface EntradaSaidaOutput {
  id: number;
  descricao: string;
  motoristaId: number;
  transportadoraId: number;
  veiculoId: number;
  /** Texto livre; API pode expor como `observao` (contrato legado). */
  observacao?: string | null;
  dataHoraEntrada: string;
  dataHoraSaida?: string | null;
  dataHoraUltimaEntradaPatio?: string | null;
  dataHoraFinalizacao?: string | null;
  tempoPermanenciaMinutos: number;
  tempoTotalSuspensaoMinutos: number;
  permanenciaSuspensa: boolean;
  finalizado: boolean;
  usuarioRegistroEntradaId: number;
  usuarioRegistroEntradaNome: string;
  usuarioFinalizacaoId?: number | null;
  usuarioFinalizacaoNome?: string | null;
  existeEntradaEmAberto?: boolean;
  suspensoes: EntradaSaidaSuspensaoOutput[];
  /** Objetos aninhados do GET buscar-por-placa / detalhe (contrato Registro Rápido). */
  motorista?: EntradaSaidaBuscarPorPlacaMotorista | null;
  transportadora?: EntradaSaidaBuscarPorPlacaTransportadora | null;
  veiculo?: EntradaSaidaBuscarPorPlacaVeiculo | null;
}

export interface EntradaSaidaPostInput {
  /** Enum byte do backend (`EntradaSaidaStatus`). */
  status?: EntradaSaidaStatus;
  motoristaId?: number;
  transportadoraId?: number;
  veiculoId?: number;
  dataHoraEntrada: string;
  dataHoraSaida?: string;
  /** Campo atual do contrato do POST /EntradaSaida. */
  observacao?: string;
  /** Campo legado mantido por compatibilidade. */
  observao?: string;
  motorista?: {
    id?: number;
    cpf?: string;
    nome?: string;
  };
  transportadora?: {
    id?: number;
    cnpj?: string;
    razaoSocial?: string;
    responsavelLegal?: string;
    responsavelCpf?: string;
    responsavelEmail?: string;
    responsavelTelefone?: string;
  };
  veiculo?: {
    id?: number;
    placa?: string;
    /** Enum byte do backend (`TipoCarga`). */
    tipoCarga?: 1 | 2 | 3 | 4 | 5;
  };
}

export interface EntradaSaidaPutInput extends EntradaSaidaPostInput {
  id: number;
}

export interface EntradaSaidaPermanenciaInput {
  dataHoraEvento?: string;
  retornarAoPatio: boolean;
}

export interface EntradaSaidaPagedResult<T> {
  items: T[];
  totalCount: number;
  numeroPagina: number;
  tamanhoPagina: number;
}
