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
  /** Inclui no pátio, concluídos e cancelados (tela Meus agendamentos). */
  incluirTodosStatus?: boolean;
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
  /** Quem paga a fatura (1 = a própria, 2 = terceiro; 0 = segue a regra de cobrança). */
  tipoPagador?: number;
  pagadorNome?: string | null;
  veiculoId: number;
  placaVeiculo: string;
  /** Data/hora agendada (backend: DataHoraEntrada com Status=Agendado). */
  dataHoraEntrada: string;
  status?: EntradaSaidaStatus | number | string;
  observacao?: string | null;
  /** Saída do pátio (quando já concluído). */
  dataHoraSaida?: string | null;
  /** Serviço: 1 Estacionamento, 2 Limpeza, 3 Ambos. */
  modalidadeAgendamento?: 1 | 2 | 3;
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
  /** Quem paga a fatura (1 = a própria transportadora, 2 = terceiro). Vaga e movimento seguem da transportadora. */
  tipoPagador?: 1 | 2 | null;
  responsavelFaturamentoId?: number | null;
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
