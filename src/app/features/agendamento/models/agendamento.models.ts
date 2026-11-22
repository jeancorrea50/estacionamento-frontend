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
  /** Celular/telefone do motorista (contato principal). */
  celularMotorista?: string | null;
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
  /** 1 = Estacionamento, 2 = Limpeza, 3 = Ambos (padrão backend = 1). */
  modalidadeAgendamento?: number;
  /** Hold temporário do passo 1 (`POST /Agendamento/vagas/holds`). */
  holdId?: number | null;
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

/** Hold temporário de vagas (30 min) — `POST/GET/DELETE /Agendamento/vagas/holds`. */
export interface AgendamentoSlotHold {
  id: number;
  token: string;
  estacionamentoId: number;
  transportadoraId: number;
  usuarioId?: number | null;
  data: string;
  modalidadeAgendamento: number;
  horaInicio: string;
  horaFim: string;
  janelaAgendamentoId?: number | null;
  quantidade: number;
  /** 1 Ativo, 2 Confirmado, 3 Cancelado, 4 Expirado */
  status: number;
  criadoEm: string;
  expiraEm: string;
}

export interface AgendamentoSlotHoldPostInput {
  data: string;
  modalidadeAgendamento: number;
  horaInicio: string;
  horaFim: string;
  janelaAgendamentoId?: number | null;
  quantidade: number;
  transportadoraId?: number | null;
}

export type DestinoFreteAgendamento = 'cif' | 'fob';
