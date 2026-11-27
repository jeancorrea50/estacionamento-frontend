import type { ModoRecibo, TipoTarifaEstacionamento } from '../models/entrada-saida.models';

/** Dados já resolvidos para montar o PDF térmico 80mm (sem inventar campos). */
export interface ReciboPdfDados {
  modo: ModoRecibo;
  ticketId: number;
  placa: string;
  /** Nome fantasia / razão social do pátio. */
  estacionamentoNome: string;
  cnpj: string | null;
  /** Linha 1 do endereço (logradouro + número). */
  enderecoLinha1: string | null;
  /** Linha 2 do endereço (bairro - cidade/UF). */
  enderecoLinha2: string | null;
  dataHoraEntrada: string | null;
  dataHoraSaida: string | null;
  /** Minutos de permanência (API ou diferença entrada→saída). */
  permanenciaMinutos: number | null;
  /**
   * Modalidade principal: Avulso | Faturamento.
   * Em faturamento o bloco monetário não é impresso.
   */
  modalidade: string | null;
  /**
   * Cobertura do veículo no contrato quando a API indica
   * (`Acordo` | `Excedente`).
   */
  cobertura: string | null;
  /** True quando `ehExcedente` veio da API. */
  ehExcedente: boolean;
  /** Total de minutos em suspensão — só preenchido se houve (> 0). */
  suspensaoMinutos: number | null;
  /** Descrição da tarifa (hora/diária) quando houver e for avulso. */
  cobrancaDescricao: string | null;
  /** Valor total do recibo (modo saída + avulso). */
  valorTotal: number | null;
  /** Quando true, omite VALOR/TOTAL (modalidade faturamento/contrato). */
  ocultarValores: boolean;
  /** Usuário responsável pela emissão (API ou sessão). */
  usuarioResponsavel: string | null;
}

export interface ReciboGerarOpts {
  id: number;
  modo: ModoRecibo;
  placa: string;
  /** Obrigatório no modo saída avulso (mesmo contrato do backend). */
  valor?: number | null;
  tipoCobranca?: string | null;
  tipoTarifa?: TipoTarifaEstacionamento | null;
  /** Hints da listagem; o detalhe GET prevalece quando disponível. */
  ehExcedente?: boolean | null;
  avulso?: boolean | null;
  acordoCobrancaId?: number | null;
}
