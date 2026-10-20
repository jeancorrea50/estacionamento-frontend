/** Tipos do Relatório de Movimentações. */

import { EntradaSaidaStatus, ENTRADA_SAIDA_STATUS_LABEL } from '../../../movimentos/models/entrada-saida.models';

export interface MovimentacaoRelatorioFiltro {
  dataInicial?: string | null;
  dataFinal?: string | null;
  dataSaidaInicial?: string | null;
  dataSaidaFinal?: string | null;
  placa?: string | null;
  motoristaId?: number | null;
  transportadoraId?: number | null;
  /** Alinha com query `SomenteEmAberto` do GET /api/MovimentacaoRelatorio. */
  somenteEmAberto?: boolean | null;
  status?: number | null;
  faturado?: boolean | null;
  ehExcedente?: boolean | null;
  avulso?: boolean | null;
  descricao?: string | null;
  limite?: number | null;
  estacionamentoId?: number | null;
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
  /**
   * Minutos da API (`tempoPermanenciaMinutos`).
   * `null` quando o relatório omite — o PDF deriva de entrada/saída (igual à lista).
   */
  tempoPermanenciaMinutos: number | null;
  faturado: boolean;
  avulso: boolean;
  ehExcedente: boolean;
  observacao: string | null;
  /**
   * Valor da linha quando o backend enviar (`valor`, `valorApurado`, etc.).
   * `null` = ausente no contrato/payload — não exibir R$ 0,00 inventado.
   */
  valor: number | null;
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
