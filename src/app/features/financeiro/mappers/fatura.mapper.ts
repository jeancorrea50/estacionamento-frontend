import {
  ModalidadeRecebimento,
  StatusFatura,
  TipoFatura,
  type FaturaInadimplenteItemOutput,
  type FaturaInadimplentesOutput,
  type FaturaFechamentoItemOutput,
  type FaturaFechamentosOutput,
  type FaturaOutput,
  type FaturaPutInput,
  type FaturaRecebimentoItemOutput,
  type FaturaRecebimentosOutput,
  type FaturaSearchOutput,
  type ResumoFechamentosOutput,
  type ResumoInadimplentesOutput,
  type ResumoRecebimentosOutput,
  SituacaoFechamento
} from '../models/fatura.models';
import { ModalidadeCobranca } from '../models/configuracao-cobranca.models';
import type {
  InadimplenciaListaItem,
  InadimplenciaStatusCobranca
} from '../pages/faturamento-page/inadimplencia/faturamento-inadimplencia.types';
import type {
  FaturaListaItem,
  FaturaStatusLabel,
  ModalidadeRecebimentoLabel,
  TipoFaturaLabel
} from '../pages/faturamento-page/faturas/faturamento-faturas.types';
import type {
  RecebimentoComprovanteEstado,
  RecebimentoListaItem,
  RecebimentoPagamentoStatus
} from '../pages/faturamento-page/recebimentos/faturamento-recebimentos.types';
import type {
  FechamentoListaItem,
  FechamentoModalidade,
  FechamentoSituacao
} from '../pages/faturamento-page/fechamentos/faturamento-fechamentos.types';
import {
  pickNumber,
  pickNumberOrNull,
  pickString,
  pickStringOrNull,
  toIsoDate,
  unwrapResult
} from './configuracao-cobranca.mapper';

export { unwrapResult, toIsoDate, pickNumber, pickNumberOrNull, pickString, pickStringOrNull };

export function statusFaturaLabel(value: StatusFatura | number): FaturaStatusLabel {
  switch (Number(value)) {
    case StatusFatura.EmAberto:
      return 'Em aberto';
    case StatusFatura.Parcial:
      return 'Parcial';
    case StatusFatura.Pago:
      return 'Pago';
    case StatusFatura.Vencido:
      return 'Vencido';
    case StatusFatura.Cancelada:
      return 'Cancelada';
    case StatusFatura.AguardandoEnvio:
    default:
      return 'Aguardando envio';
  }
}

export function statusFaturaFromLabel(label: FaturaStatusLabel | string): StatusFatura {
  switch (label) {
    case 'Em aberto':
      return StatusFatura.EmAberto;
    case 'Parcial':
      return StatusFatura.Parcial;
    case 'Pago':
      return StatusFatura.Pago;
    case 'Vencido':
      return StatusFatura.Vencido;
    case 'Cancelada':
      return StatusFatura.Cancelada;
    case 'Aguardando envio':
    default:
      return StatusFatura.AguardandoEnvio;
  }
}

export function modalidadeRecebimentoLabel(
  value: ModalidadeRecebimento | number | null | undefined
): ModalidadeRecebimentoLabel | '\u2014' {
  if (value == null || value === 0) return '\u2014';
  switch (Number(value)) {
    case ModalidadeRecebimento.Pix:
      return 'Pix';
    case ModalidadeRecebimento.Boleto:
      return 'Boleto';
    case ModalidadeRecebimento.Transferencia:
      return 'Transfer\u00eancia';
    case ModalidadeRecebimento.Cartao:
      return 'Cart\u00e3o';
    default:
      return '\u2014';
  }
}

export function modalidadeRecebimentoFromLabel(
  label: ModalidadeRecebimentoLabel | string | null | undefined
): ModalidadeRecebimento | null {
  switch (label) {
    case 'Pix':
      return ModalidadeRecebimento.Pix;
    case 'Boleto':
      return ModalidadeRecebimento.Boleto;
    case 'Transfer\u00eancia':
      return ModalidadeRecebimento.Transferencia;
    case 'Cart\u00e3o':
      return ModalidadeRecebimento.Cartao;
    default:
      return null;
  }
}

/** Default `Cobranca` alinhado ao DEFAULT do backend. */
export function parseTipoFatura(value: number | null | undefined): TipoFatura {
  return Number(value) === TipoFatura.Avulso ? TipoFatura.Avulso : TipoFatura.Cobranca;
}

export function tipoFaturaLabel(value: TipoFatura | number | null | undefined): TipoFaturaLabel {
  return parseTipoFatura(value) === TipoFatura.Avulso ? 'Avulso' : 'Cobran\u00e7a';
}

export function mapSearchToListaItem(dto: FaturaSearchOutput): FaturaListaItem {
  return {
    id: dto.id,
    numero: dto.numero || String(dto.id),
    transportadoraId: dto.transportadoraId,
    transportadora: dto.transportadoraNome || '\u2014',
    estacionamentoId: dto.estacionamentoId,
    estacionamento: dto.estacionamentoNome || '\u2014',
    tipoFatura: tipoFaturaLabel(dto.tipoFatura),
    tipoFaturaCodigo: parseTipoFatura(dto.tipoFatura),
    status: statusFaturaLabel(dto.status),
    statusCodigo: dto.status,
    modalidadeRecebimento: modalidadeRecebimentoLabel(dto.modalidadeRecebimento),
    modalidadeRecebimentoCodigo: dto.modalidadeRecebimento,
    valorTotal: Number(dto.valorTotal) || 0,
    valorRecebido: Number(dto.valorRecebido) || 0,
    valorEmAberto: Number(dto.valorEmAberto) || 0,
    dataEmissao: toIsoDate(dto.dataEmissao) ?? '',
    vencimento: toIsoDate(dto.dataVencimento) ?? '',
    dataPagamento: toIsoDate(dto.dataPagamento),
    periodoInicio: '',
    periodoFim: '',
    emailEnvio: null,
    observacao: null,
    configuracaoCobrancaId: null,
    valorDesconto: 0,
    valorAcrescimo: 0,
    valorJuros: 0,
    valorMulta: 0,
    parcial: true
  };
}

export function mapOutputToListaItem(dto: FaturaOutput): FaturaListaItem {
  return {
    id: dto.id,
    numero: dto.numero || String(dto.id),
    transportadoraId: dto.transportadoraId,
    transportadora: dto.transportadoraNome || '\u2014',
    estacionamentoId: dto.estacionamentoId,
    estacionamento: dto.estacionamentoNome || '\u2014',
    tipoFatura: tipoFaturaLabel(dto.tipoFatura),
    tipoFaturaCodigo: parseTipoFatura(dto.tipoFatura),
    status: statusFaturaLabel(dto.status),
    statusCodigo: dto.status,
    modalidadeRecebimento: modalidadeRecebimentoLabel(dto.modalidadeRecebimento),
    modalidadeRecebimentoCodigo: dto.modalidadeRecebimento,
    valorTotal: Number(dto.valorTotal) || 0,
    valorRecebido: Number(dto.valorRecebido) || 0,
    valorEmAberto: Number(dto.valorEmAberto) || 0,
    dataEmissao: toIsoDate(dto.dataEmissao) ?? '',
    vencimento: toIsoDate(dto.dataVencimento) ?? '',
    dataPagamento: toIsoDate(dto.dataPagamento),
    periodoInicio: toIsoDate(dto.periodoInicio) ?? '',
    periodoFim: toIsoDate(dto.periodoFim) ?? '',
    emailEnvio: dto.emailEnvio?.trim() || null,
    observacao: dto.observacao?.trim() || null,
    configuracaoCobrancaId: dto.configuracaoCobrancaId,
    valorDesconto: Number(dto.valorDesconto) || 0,
    valorAcrescimo: Number(dto.valorAcrescimo) || 0,
    valorJuros: Number(dto.valorJuros) || 0,
    valorMulta: Number(dto.valorMulta) || 0,
    parcial: false
  };
}

export function mapListaItemToPutInput(item: FaturaListaItem): FaturaPutInput {
  const dataEmissao = toApiDateTime(item.dataEmissao);
  const dataVencimento = toApiDateTime(item.vencimento);
  if (!dataEmissao || !dataVencimento) {
    throw new Error('Emiss\u00e3o e vencimento s\u00e3o obrigat\u00f3rios para alterar a fatura.');
  }

  return {
    id: item.id,
    transportadoraId: item.transportadoraId,
    estacionamentoId: item.estacionamentoId,
    configuracaoCobrancaId: item.configuracaoCobrancaId,
    numero: item.numero || null,
    status: item.statusCodigo || statusFaturaFromLabel(item.status),
    modalidadeRecebimento:
      item.modalidadeRecebimentoCodigo ?? modalidadeRecebimentoFromLabel(item.modalidadeRecebimento),
    valorTotal: Number(item.valorTotal) || 0,
    valorRecebido: Number(item.valorRecebido) || 0,
    valorDesconto: Number(item.valorDesconto) || 0,
    valorAcrescimo: Number(item.valorAcrescimo) || 0,
    valorJuros: Number(item.valorJuros) || 0,
    valorMulta: Number(item.valorMulta) || 0,
    dataEmissao,
    dataVencimento,
    dataPagamento: toApiDateTime(item.dataPagamento),
    periodoInicio: toApiDateTime(item.periodoInicio) || dataEmissao,
    periodoFim: toApiDateTime(item.periodoFim) || dataVencimento,
    emailEnvio: item.emailEnvio,
    observacao: item.observacao
  };
}

/** Converte `yyyy-MM-dd` (ou ISO) para DateTime ISO aceito pelo backend. */
export function toApiDateTime(value: string | null | undefined): string | null {
  const iso = toIsoDate(value);
  if (!iso) return null;
  return `${iso}T00:00:00`;
}

export function mapRawSearchItem(row: Record<string, unknown>): FaturaSearchOutput {
  return {
    id: pickNumber(row, 'id', 'Id'),
    numero: pickString(row, 'numero', 'Numero'),
    transportadoraId: pickNumber(row, 'transportadoraId', 'TransportadoraId'),
    transportadoraNome: pickString(row, 'transportadoraNome', 'TransportadoraNome'),
    estacionamentoId: pickNumber(row, 'estacionamentoId', 'EstacionamentoId'),
    estacionamentoNome: pickString(row, 'estacionamentoNome', 'EstacionamentoNome'),
    tipoFatura: parseTipoFatura(pickNumber(row, 'tipoFatura', 'TipoFatura')),
    status: pickNumber(row, 'status', 'Status') as StatusFatura,
    modalidadeRecebimento: pickNumberOrNull(row, 'modalidadeRecebimento', 'ModalidadeRecebimento') as
      | ModalidadeRecebimento
      | null,
    valorTotal: pickNumber(row, 'valorTotal', 'ValorTotal'),
    valorRecebido: pickNumber(row, 'valorRecebido', 'ValorRecebido'),
    valorEmAberto: pickNumber(row, 'valorEmAberto', 'ValorEmAberto'),
    dataEmissao: pickString(row, 'dataEmissao', 'DataEmissao'),
    dataVencimento: pickString(row, 'dataVencimento', 'DataVencimento'),
    dataPagamento: pickStringOrNull(row, 'dataPagamento', 'DataPagamento')
  };
}

export function mapRawOutput(row: Record<string, unknown>, fallbackId = 0): FaturaOutput {
  const transportadoraRaw = row['transportadora'] ?? row['Transportadora'];
  const estacionamentoRaw = row['estacionamento'] ?? row['Estacionamento'];
  const transportadoraNome =
    pickString(row, 'transportadoraNome', 'TransportadoraNome') ||
    (transportadoraRaw && typeof transportadoraRaw === 'object'
      ? pickString(transportadoraRaw as Record<string, unknown>, 'descricao', 'Descricao')
      : '');
  const estacionamentoNome =
    pickString(row, 'estacionamentoNome', 'EstacionamentoNome') ||
    (estacionamentoRaw && typeof estacionamentoRaw === 'object'
      ? pickString(estacionamentoRaw as Record<string, unknown>, 'descricao', 'Descricao', 'nomeFantasia', 'NomeFantasia')
      : '');

  return {
    id: pickNumber(row, 'id', 'Id') || fallbackId,
    dataCriacao: pickString(row, 'dataCriacao', 'DataCriacao') || undefined,
    dataAtualizacao: pickStringOrNull(row, 'dataAtualizacao', 'DataAtualizacao'),
    transportadoraId: pickNumber(row, 'transportadoraId', 'TransportadoraId'),
    transportadoraNome,
    estacionamentoId: pickNumber(row, 'estacionamentoId', 'EstacionamentoId'),
    estacionamentoNome,
    configuracaoCobrancaId: pickNumberOrNull(row, 'configuracaoCobrancaId', 'ConfiguracaoCobrancaId'),
    numero: pickString(row, 'numero', 'Numero'),
    tipoFatura: parseTipoFatura(pickNumber(row, 'tipoFatura', 'TipoFatura')),
    status: pickNumber(row, 'status', 'Status') as StatusFatura,
    modalidadeRecebimento: pickNumberOrNull(row, 'modalidadeRecebimento', 'ModalidadeRecebimento') as
      | ModalidadeRecebimento
      | null,
    valorTotal: pickNumber(row, 'valorTotal', 'ValorTotal'),
    valorRecebido: pickNumber(row, 'valorRecebido', 'ValorRecebido'),
    valorEmAberto: pickNumber(row, 'valorEmAberto', 'ValorEmAberto'),
    valorDesconto: pickNumber(row, 'valorDesconto', 'ValorDesconto'),
    valorAcrescimo: pickNumber(row, 'valorAcrescimo', 'ValorAcrescimo'),
    valorJuros: pickNumber(row, 'valorJuros', 'ValorJuros'),
    valorMulta: pickNumber(row, 'valorMulta', 'ValorMulta'),
    dataEmissao: pickString(row, 'dataEmissao', 'DataEmissao'),
    dataVencimento: pickString(row, 'dataVencimento', 'DataVencimento'),
    dataPagamento: pickStringOrNull(row, 'dataPagamento', 'DataPagamento'),
    periodoInicio: pickString(row, 'periodoInicio', 'PeriodoInicio'),
    periodoFim: pickString(row, 'periodoFim', 'PeriodoFim'),
    emailEnvio: pickStringOrNull(row, 'emailEnvio', 'EmailEnvio'),
    observacao: pickStringOrNull(row, 'observacao', 'Observacao')
  };
}

const STATUS_COBRANCA_VALIDOS: readonly InadimplenciaStatusCobranca[] = [
  'N\u00e3o enviada',
  'Enviada',
  'Reenviada',
  'Em negocia\u00e7\u00e3o',
  'Acordo realizado',
  'Sem retorno'
];

export function mapStatusCobrancaInadimplencia(
  value: string | null | undefined
): InadimplenciaStatusCobranca {
  if (value && (STATUS_COBRANCA_VALIDOS as readonly string[]).includes(value)) {
    return value as InadimplenciaStatusCobranca;
  }
  return 'N\u00e3o enviada';
}

export function mapRawInadimplenteItem(row: Record<string, unknown>): FaturaInadimplenteItemOutput {
  return {
    id: pickNumber(row, 'id', 'Id'),
    numero: pickString(row, 'numero', 'Numero'),
    transportadoraId: pickNumber(row, 'transportadoraId', 'TransportadoraId'),
    transportadoraNome: pickString(row, 'transportadoraNome', 'TransportadoraNome'),
    tipoFatura: parseTipoFatura(pickNumber(row, 'tipoFatura', 'TipoFatura')),
    status: pickNumber(row, 'status', 'Status') as StatusFatura,
    valorTotal: pickNumber(row, 'valorTotal', 'ValorTotal'),
    valorRecebido: pickNumber(row, 'valorRecebido', 'ValorRecebido'),
    valorEmAberto: pickNumber(row, 'valorEmAberto', 'ValorEmAberto'),
    dataVencimento: pickString(row, 'dataVencimento', 'DataVencimento'),
    diasEmAtraso: pickNumber(row, 'diasEmAtraso', 'DiasEmAtraso'),
    quantidadeMovimentos: pickNumber(row, 'quantidadeMovimentos', 'QuantidadeMovimentos'),
    ultimaCobranca: pickStringOrNull(row, 'ultimaCobranca', 'UltimaCobranca'),
    statusCobranca: pickStringOrNull(row, 'statusCobranca', 'StatusCobranca')
  };
}

export function mapInadimplenteItemToLista(dto: FaturaInadimplenteItemOutput): InadimplenciaListaItem {
  const valorEmAberto = Number(dto.valorEmAberto);
  const valor =
    Number.isFinite(valorEmAberto) && valorEmAberto > 0
      ? valorEmAberto
      : Math.max(0, (Number(dto.valorTotal) || 0) - (Number(dto.valorRecebido) || 0));

  return {
    faturaId: dto.id,
    id: dto.numero?.trim() || String(dto.id),
    transportadoraId: dto.transportadoraId,
    transportadora: dto.transportadoraNome || '\u2014',
    estacionamento: '\u2014',
    tipoFatura: tipoFaturaLabel(dto.tipoFatura),
    tipoFaturaCodigo: parseTipoFatura(dto.tipoFatura),
    valor,
    vencimento: toIsoDate(dto.dataVencimento) ?? '',
    diasAtraso: Math.max(0, Number(dto.diasEmAtraso) || 0),
    ultimaCobranca: toIsoDate(dto.ultimaCobranca),
    statusCobranca: mapStatusCobrancaInadimplencia(dto.statusCobranca),
    emailFinanceiro: '',
    contato: '',
    historicoCobranca: [],
    quantidadeMovimentos: Number(dto.quantidadeMovimentos) || 0
  };
}

export function mapRawResumoInadimplentes(
  row: Record<string, unknown> | null | undefined
): ResumoInadimplentesOutput {
  if (!row) {
    return {
      totalVencido: 0,
      faturasVencidas: 0,
      transportadorasInadimplentes: 0,
      acordosRealizados: 0
    };
  }
  return {
    totalVencido: pickNumber(row, 'totalVencido', 'TotalVencido'),
    faturasVencidas: pickNumber(row, 'faturasVencidas', 'FaturasVencidas'),
    transportadorasInadimplentes: pickNumber(
      row,
      'transportadorasInadimplentes',
      'TransportadorasInadimplentes'
    ),
    acordosRealizados: pickNumber(row, 'acordosRealizados', 'AcordosRealizados')
  };
}

export function mapRawInadimplentesOutput(
  body: unknown,
  numeroPagina: number,
  tamanhoPagina: number
): FaturaInadimplentesOutput {
  const source = unwrapResult(body);
  const root = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  const resumoRaw = (root['resumo'] ?? root['Resumo']) as Record<string, unknown> | undefined;
  const itensRaw = (root['itens'] ?? root['Itens']) as Record<string, unknown> | undefined;

  const rows =
    (itensRaw && Array.isArray(itensRaw['results']) && itensRaw['results']) ||
    (itensRaw && Array.isArray(itensRaw['Results']) && itensRaw['Results']) ||
    (itensRaw && Array.isArray(itensRaw['items']) && itensRaw['items']) ||
    [];

  const items = (rows as unknown[])
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    .map((row) => mapRawInadimplenteItem(row));

  return {
    resumo: mapRawResumoInadimplentes(resumoRaw),
    itens: {
      items,
      totalCount:
        Number(
          itensRaw?.['rowCount'] ??
            itensRaw?.['RowCount'] ??
            itensRaw?.['totalCount'] ??
            items.length
        ) || items.length,
      numeroPagina:
        Number(
          itensRaw?.['currentPage'] ??
            itensRaw?.['CurrentPage'] ??
            itensRaw?.['numeroPagina'] ??
            numeroPagina
        ) || numeroPagina,
      tamanhoPagina:
        Number(
          itensRaw?.['pageSize'] ??
            itensRaw?.['PageSize'] ??
            itensRaw?.['tamanhoPagina'] ??
            tamanhoPagina
        ) || tamanhoPagina
    }
  };
}


export function mapRecebimentoStatus(value: StatusFatura | number): RecebimentoPagamentoStatus {
  switch (Number(value)) {
    case StatusFatura.Pago:
      return 'Pago';
    case StatusFatura.Parcial:
      return 'Parcial';
    case StatusFatura.Vencido:
      return 'Vencido';
    case StatusFatura.Cancelada:
      return 'Cancelada';
    case StatusFatura.EmAberto:
    case StatusFatura.AguardandoEnvio:
    default:
      return 'Em aberto';
  }
}

export function mapRecebimentoFormaPagamento(
  value: ModalidadeRecebimento | number | null | undefined
): string | null {
  if (value == null || value === 0) return null;
  switch (Number(value)) {
    case ModalidadeRecebimento.Pix:
      return 'PIX';
    case ModalidadeRecebimento.Boleto:
      return 'Boleto';
    case ModalidadeRecebimento.Transferencia:
      return 'Transfer\u00eancia';
    case ModalidadeRecebimento.Cartao:
      return 'Cart\u00e3o';
    default:
      return null;
  }
}

export function mapRecebimentoComprovante(
  value: string | null | undefined
): RecebimentoComprovanteEstado {
  const v = (value || '').trim();
  if (v === 'Anexado') return 'Anexado';
  if (v === 'Aguardando confer\u00eancia' || v === 'Aguardando conferencia') {
    return 'Aguardando confer\u00eancia';
  }
  if (!v || v === 'Sem comprovante') return 'Sem comprovante';
  return 'Sem comprovante';
}

export function mapRawRecebimentoItem(row: Record<string, unknown>): FaturaRecebimentoItemOutput {
  return {
    id: pickNumber(row, 'id', 'Id'),
    numero: pickString(row, 'numero', 'Numero'),
    transportadoraId: pickNumber(row, 'transportadoraId', 'TransportadoraId'),
    transportadoraNome: pickString(row, 'transportadoraNome', 'TransportadoraNome'),
    valorTotal: pickNumber(row, 'valorTotal', 'ValorTotal'),
    valorRecebido: pickNumber(row, 'valorRecebido', 'ValorRecebido'),
    saldoRestante: pickNumber(row, 'saldoRestante', 'SaldoRestante'),
    dataPagamento: pickStringOrNull(row, 'dataPagamento', 'DataPagamento'),
    formaPagamento: pickNumberOrNull(row, 'formaPagamento', 'FormaPagamento') as
      | ModalidadeRecebimento
      | null,
    tipoFatura: parseTipoFatura(pickNumber(row, 'tipoFatura', 'TipoFatura')),
    status: pickNumber(row, 'status', 'Status') as StatusFatura,
    comprovante: pickStringOrNull(row, 'comprovante', 'Comprovante')
  };
}

export function mapRecebimentoItemToLista(dto: FaturaRecebimentoItemOutput): RecebimentoListaItem {
  const saldo =
    Number.isFinite(Number(dto.saldoRestante))
      ? Math.max(0, Number(dto.saldoRestante))
      : Math.max(0, (Number(dto.valorTotal) || 0) - (Number(dto.valorRecebido) || 0));

  return {
    faturaId: dto.id,
    id: dto.numero?.trim() || String(dto.id),
    transportadoraId: dto.transportadoraId,
    transportadora: dto.transportadoraNome || '\u2014',
    estacionamento: '\u2014',
    tipoFatura: tipoFaturaLabel(dto.tipoFatura),
    tipoFaturaCodigo: parseTipoFatura(dto.tipoFatura),
    valorFatura: Number(dto.valorTotal) || 0,
    valorRecebido: Number(dto.valorRecebido) || 0,
    saldoRestante: saldo,
    dataPagamento: toIsoDate(dto.dataPagamento),
    formaPagamento: mapRecebimentoFormaPagamento(dto.formaPagamento),
    comprovante: mapRecebimentoComprovante(dto.comprovante),
    status: mapRecebimentoStatus(dto.status),
    historico: []
  };
}

export function mapRawResumoRecebimentos(
  row: Record<string, unknown> | null | undefined
): ResumoRecebimentosOutput {
  if (!row) {
    return {
      totalRecebidoPeriodo: 0,
      pagamentosParciais: 0,
      quantidadePagamentosParciais: 0,
      valorPendente: 0,
      quantidadePendentes: 0,
      recebimentosDoDia: 0
    };
  }
  return {
    totalRecebidoPeriodo: pickNumber(row, 'totalRecebidoPeriodo', 'TotalRecebidoPeriodo'),
    pagamentosParciais: pickNumber(row, 'pagamentosParciais', 'PagamentosParciais'),
    quantidadePagamentosParciais: pickNumber(
      row,
      'quantidadePagamentosParciais',
      'QuantidadePagamentosParciais'
    ),
    valorPendente: pickNumber(row, 'valorPendente', 'ValorPendente'),
    quantidadePendentes: pickNumber(row, 'quantidadePendentes', 'QuantidadePendentes'),
    recebimentosDoDia: pickNumber(row, 'recebimentosDoDia', 'RecebimentosDoDia')
  };
}

export function mapRawRecebimentosOutput(
  body: unknown,
  numeroPagina: number,
  tamanhoPagina: number
): FaturaRecebimentosOutput {
  const source = unwrapResult(body);
  const root = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  const resumoRaw = (root['resumo'] ?? root['Resumo']) as Record<string, unknown> | undefined;
  const itensRaw = (root['itens'] ?? root['Itens']) as Record<string, unknown> | undefined;

  const rows =
    (itensRaw && Array.isArray(itensRaw['results']) && itensRaw['results']) ||
    (itensRaw && Array.isArray(itensRaw['Results']) && itensRaw['Results']) ||
    (itensRaw && Array.isArray(itensRaw['items']) && itensRaw['items']) ||
    [];

  const items = (rows as unknown[])
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    .map((row) => mapRawRecebimentoItem(row));

  return {
    resumo: mapRawResumoRecebimentos(resumoRaw),
    itens: {
      items,
      totalCount:
        Number(
          itensRaw?.['rowCount'] ??
            itensRaw?.['RowCount'] ??
            itensRaw?.['totalCount'] ??
            items.length
        ) || items.length,
      numeroPagina:
        Number(
          itensRaw?.['currentPage'] ??
            itensRaw?.['CurrentPage'] ??
            itensRaw?.['numeroPagina'] ??
            numeroPagina
        ) || numeroPagina,
      tamanhoPagina:
        Number(
          itensRaw?.['pageSize'] ??
            itensRaw?.['PageSize'] ??
            itensRaw?.['tamanhoPagina'] ??
            tamanhoPagina
        ) || tamanhoPagina
    }
  };
}

export function mapFechamentoSituacao(value: SituacaoFechamento | number): FechamentoSituacao {
  switch (Number(value)) {
    case SituacaoFechamento.ProntoParaFaturar:
      return 'Pronto para faturar';
    case SituacaoFechamento.ComDivergencia:
      return 'Com diverg\u00eancia';
    case SituacaoFechamento.Faturado:
      return 'Faturado';
    case SituacaoFechamento.Cancelado:
      return 'Cancelado';
    case SituacaoFechamento.EmAndamento:
    default:
      return 'Em andamento';
  }
}

export function mapFechamentoModalidade(
  value: ModalidadeCobranca | number | null | undefined
): FechamentoModalidade | string {
  if (value == null || value === 0) return '\u2014';
  switch (Number(value)) {
    case ModalidadeCobranca.Diaria:
      return 'Di\u00e1ria';
    case ModalidadeCobranca.Semanal:
      return 'Semanal';
    case ModalidadeCobranca.Quinzenal:
      return 'Quinzenal';
    case ModalidadeCobranca.Mensal:
      return 'Mensal';
    case ModalidadeCobranca.Personalizado:
      return 'Por data personalizada';
    default:
      return '\u2014';
  }
}

function formatPeriodoApuradoBr(inicio: string | null, fim: string | null): string {
  const a = toBrDate(inicio);
  const b = toBrDate(fim);
  if (!a && !b) return '\u2014';
  if (a && b && a === b) return a;
  if (a && b) return `${a} - ${b}`;
  return a || b || '\u2014';
}

function toBrDate(value: string | null | undefined): string | null {
  const iso = toIsoDate(value ?? null);
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

export function mapRawFechamentoItem(row: Record<string, unknown>): FaturaFechamentoItemOutput {
  return {
    transportadoraId: pickNumber(row, 'transportadoraId', 'TransportadoraId'),
    transportadoraNome: pickString(row, 'transportadoraNome', 'TransportadoraNome'),
    configuracaoCobrancaId: pickNumberOrNull(row, 'configuracaoCobrancaId', 'ConfiguracaoCobrancaId'),
    modalidade: pickNumberOrNull(row, 'modalidade', 'Modalidade'),
    periodoInicio: pickStringOrNull(row, 'periodoInicio', 'PeriodoInicio'),
    periodoFim: pickStringOrNull(row, 'periodoFim', 'PeriodoFim'),
    quantidadeMovimentos: pickNumber(row, 'quantidadeMovimentos', 'QuantidadeMovimentos'),
    valorEstimado: pickNumber(row, 'valorEstimado', 'ValorEstimado'),
    quantidadeDivergencias: pickNumber(row, 'quantidadeDivergencias', 'QuantidadeDivergencias'),
    situacao: pickNumber(row, 'situacao', 'Situacao') as SituacaoFechamento
  };
}

export function mapFechamentoItemToLista(dto: FaturaFechamentoItemOutput): FechamentoListaItem {
  return {
    id: String(dto.transportadoraId),
    transportadoraId: dto.transportadoraId,
    configuracaoCobrancaId: dto.configuracaoCobrancaId,
    transportadora: dto.transportadoraNome?.trim() || '\u2014',
    estacionamento: '\u2014',
    modalidade: mapFechamentoModalidade(dto.modalidade),
    periodoApurado: formatPeriodoApuradoBr(dto.periodoInicio, dto.periodoFim),
    movimentacoes: Number(dto.quantidadeMovimentos) || 0,
    valorEstimado: Number(dto.valorEstimado) || 0,
    divergencias: Number(dto.quantidadeDivergencias) || 0,
    situacao: mapFechamentoSituacao(dto.situacao)
  };
}

export function mapRawResumoFechamentos(
  row: Record<string, unknown> | null | undefined
): ResumoFechamentosOutput {
  if (!row) {
    return {
      fechamentosDisponiveis: 0,
      prontosParaFaturar: 0,
      valorEstimadoTotal: 0,
      comDivergencia: 0
    };
  }
  return {
    fechamentosDisponiveis: pickNumber(row, 'fechamentosDisponiveis', 'FechamentosDisponiveis'),
    prontosParaFaturar: pickNumber(row, 'prontosParaFaturar', 'ProntosParaFaturar'),
    valorEstimadoTotal: pickNumber(row, 'valorEstimadoTotal', 'ValorEstimadoTotal'),
    comDivergencia: pickNumber(row, 'comDivergencia', 'ComDivergencia')
  };
}

export function mapRawFechamentosOutput(
  body: unknown,
  numeroPagina: number,
  tamanhoPagina: number
): FaturaFechamentosOutput {
  const source = unwrapResult(body);
  const root = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  const resumoRaw = (root['resumo'] ?? root['Resumo']) as Record<string, unknown> | undefined;
  const itensRaw = (root['itens'] ?? root['Itens']) as Record<string, unknown> | undefined;

  const rows =
    (itensRaw && Array.isArray(itensRaw['results']) && itensRaw['results']) ||
    (itensRaw && Array.isArray(itensRaw['Results']) && itensRaw['Results']) ||
    (itensRaw && Array.isArray(itensRaw['items']) && itensRaw['items']) ||
    [];

  const items = (rows as unknown[])
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    .map((row) => mapRawFechamentoItem(row));

  return {
    resumo: mapRawResumoFechamentos(resumoRaw),
    itens: {
      items,
      totalCount:
        Number(
          itensRaw?.['rowCount'] ??
            itensRaw?.['RowCount'] ??
            itensRaw?.['totalCount'] ??
            items.length
        ) || items.length,
      numeroPagina:
        Number(
          itensRaw?.['currentPage'] ??
            itensRaw?.['CurrentPage'] ??
            itensRaw?.['numeroPagina'] ??
            numeroPagina
        ) || numeroPagina,
      tamanhoPagina:
        Number(
          itensRaw?.['pageSize'] ??
            itensRaw?.['PageSize'] ??
            itensRaw?.['tamanhoPagina'] ??
            tamanhoPagina
        ) || tamanhoPagina
    }
  };
}
