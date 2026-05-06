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
  suspensoes: EntradaSaidaSuspensaoOutput[];
  motorista?: unknown;
  transportadora?: unknown;
  veiculo?: unknown;
}

export interface EntradaSaidaPostInput {
  motoristaId: number;
  transportadoraId: number;
  veiculoId: number;
  dataHoraEntrada: string;
  dataHoraSaida?: string;
  observao?: string;
  /** Telefone do responsável pela transportadora — apenas dígitos (DDD obrigatório). Opcional conforme API. */
  telefoneResponsavel?: string;
  motorista?: unknown;
  transportadora?: unknown;
  veiculo?: unknown;
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
