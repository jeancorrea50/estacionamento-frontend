import {
  EntradaSaidaStatus,
  entradaSaidaStatusLabel,
  parseEntradaSaidaStatus,
} from '../../movimentos/models/entrada-saida.models';

export { EntradaSaidaStatus, entradaSaidaStatusLabel, parseEntradaSaidaStatus };

export interface AgendamentoFiltro {
  /** Busca livre: placa, nome do motorista ou CPF (enviado como Descricao na API). */
  busca?: string;
  placa?: string;
  dataInicial?: string;
  dataFinal?: string;
  transportadoraId?: number;
  numeroPagina: number;
  tamanhoPagina: number;
}

export interface AgendamentoSearchItem {
  id: number;
  descricao: string;
  motoristaId: number;
  nomeMotorista: string;
  cpfMotorista?: string | null;
  transportadoraId: number;
  nomeTransportadora: string;
  veiculoId: number;
  placaVeiculo: string;
  /** Data/hora agendada (backend: DataHoraEntrada com Status=Agendado). */
  dataHoraEntrada: string;
  status?: EntradaSaidaStatus | number | string;
  observacao?: string | null;
}

export interface AgendamentoPagedResult {
  items: AgendamentoSearchItem[];
  totalCount: number;
  numeroPagina: number;
  tamanhoPagina: number;
}

export interface AgendamentoPostInput {
  dataAgendamento: string;
  observacao?: string | null;
  transportadoraId?: number | null;
  motorista: {
    id?: number | null;
    cpf?: string | null;
    nome?: string | null;
  };
  veiculo: {
    id?: number | null;
    placa?: string | null;
  };
}
