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
  existeEntradaEmAberto?: boolean;
  suspensoes: EntradaSaidaSuspensaoOutput[];
  motorista?: unknown;
  transportadora?: unknown;
  veiculo?: unknown;
}

export interface EntradaSaidaPostInput {
  /** Enum byte do backend (`EntradaSaidaStatus`). */
  status?: 0 | 1 | 2 | 3 | 4;
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
