import { ModalidadeRecebimento, StatusFatura } from '../models/fatura.models';
import type {
  PagamentoBuscarOutput,
  PagamentoItemOutput,
  ResumoPagamentosOutput
} from '../models/pagamento.models';
import type {
  RecebimentoComprovanteEstado,
  RecebimentoListaItem,
  RecebimentoPagamentoStatus
} from '../pages/faturamento-page/recebimentos/faturamento-recebimentos.types';
import {
  pickNumber,
  pickNumberOrNull,
  pickString,
  pickStringOrNull,
  toIsoDate,
  unwrapResult
} from './configuracao-cobranca.mapper';
import { parseTipoFatura, tipoFaturaLabel } from './fatura.mapper';

export function mapPagamentoStatus(value: StatusFatura | number): RecebimentoPagamentoStatus {
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

export function mapPagamentoFormaPagamento(
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

export function mapPagamentoComprovante(
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

export function mapRawPagamentoItem(row: Record<string, unknown>): PagamentoItemOutput {
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

export function mapPagamentoItemToLista(dto: PagamentoItemOutput): RecebimentoListaItem {
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
    formaPagamento: mapPagamentoFormaPagamento(dto.formaPagamento),
    comprovante: mapPagamentoComprovante(dto.comprovante),
    status: mapPagamentoStatus(dto.status),
    historico: []
  };
}

export function mapRawResumoPagamentos(
  row: Record<string, unknown> | null | undefined
): ResumoPagamentosOutput {
  if (!row) {
    return {
      totalRecebidoPeriodo: 0,
      pagamentosParciais: 0,
      quantidadePagamentosParciais: 0,
      valorPendente: 0,
      quantidadePendentes: 0,
      pagamentosDoDia: 0
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
    pagamentosDoDia: pickNumber(
      row,
      'pagamentosDoDia',
      'PagamentosDoDia',
      'recebimentosDoDia',
      'RecebimentosDoDia'
    )
  };
}

export function mapRawPagamentosOutput(
  body: unknown,
  numeroPagina: number,
  tamanhoPagina: number
): PagamentoBuscarOutput {
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
    .map((row) => mapRawPagamentoItem(row));

  return {
    resumo: mapRawResumoPagamentos(resumoRaw),
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
