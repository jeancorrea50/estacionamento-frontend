/** Tipos do Relatório de Movimentações. */

import { EntradaSaidaStatus, ENTRADA_SAIDA_STATUS_LABEL } from '../../../movimentos/models/entrada-saida.models';

export interface MovimentacaoRelatorioFiltro {
  dataInicial?: string | null;
  dataFinal?: string | null;
  dataSaidaInicial?: string | null;
  dataSaidaFinal?: string | null;
  placa?: string | null;
  transportadoraId?: number | null;
  status?: number | null;
  faturado?: boolean | null;
  ehExcedente?: boolean | null;
  avulso?: boolean | null;
  descricao?: string | null;
  limite?: number | null;
}

export interface MovimentacaoRelatorioResumo {
  quantidade: number;
  qtdEntrada: number;
  qtdSaida: number;
  qtdSuspenso: number;
  qtdAgendado: number;
  qtdCancelado: number;
  qtdFaturado: number;
  qtdExcedente: number;
}

export interface MovimentacaoRelatorioItem {
  id: number;
  placaVeiculo: string;
  nomeMotorista: string;
  nomeTransportadora: string;
  status: number;
  statusDescricao: string;
  dataHoraEntrada: string | null;
  dataHoraSaida: string | null;
  faturado: boolean;
  avulso: boolean;
  ehExcedente: boolean;
  observacao: string | null;
}

export interface MovimentacaoRelatorioOutput {
  resumo: MovimentacaoRelatorioResumo;
  itens: MovimentacaoRelatorioItem[];
  truncado: boolean;
  limiteAplicado: number;
}

export const RELATORIO_MOV_STATUS_OPCOES: { value: number; label: string }[] = [
  { value: EntradaSaidaStatus.Entrada, label: ENTRADA_SAIDA_STATUS_LABEL[EntradaSaidaStatus.Entrada] },
  { value: EntradaSaidaStatus.Saida, label: 'Saída' },
  { value: EntradaSaidaStatus.Suspenso, label: ENTRADA_SAIDA_STATUS_LABEL[EntradaSaidaStatus.Suspenso] },
  { value: EntradaSaidaStatus.Agendado, label: ENTRADA_SAIDA_STATUS_LABEL[EntradaSaidaStatus.Agendado] },
  { value: EntradaSaidaStatus.Cancelado, label: ENTRADA_SAIDA_STATUS_LABEL[EntradaSaidaStatus.Cancelado] },
];

export const RELATORIO_BOOL_OPCOES: { value: boolean | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: true, label: 'Sim' },
  { value: false, label: 'Não' },
];
