import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { ENTRADA_SAIDA_STATUS_LABEL, EntradaSaidaStatus } from '../../../movimentos/models/entrada-saida.models';
import type {
  MovimentacaoRelatorioItem,
  MovimentacaoRelatorioResumo,
} from './movimentacao-relatorio.types';

const AZUL: [number, number, number] = [29, 78, 216];
const TEXTO: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [71, 85, 105];
const ZEBRADO: [number, number, number] = [248, 250, 252];
const EXCEDENTE: [number, number, number] = [255, 247, 237];

export interface MovimentacaoRelatorioPdfEntrada {
  estacionamentoNome: string;
  estacionamentoCnpj: string | null;
  timeZoneId: string | null;
  periodoEntrada: string;
  periodoSaida: string | null;
  filtrosAplicados: string[];
  resumo: MovimentacaoRelatorioResumo;
  itens: MovimentacaoRelatorioItem[];
  truncado: boolean;
  limiteAplicado: number;
  emitidoEm: Date;
}

/** Mesma forma de `formatarMinutos` da tela de movimentos. Não recalcula suspensão. */
export function formatarPermanenciaRelatorio(minutos: number | null): string {
  if (minutos == null) return '—';
  if (minutos <= 0) return '0 min';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
}

export function formatarDataFiltro(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const [data] = iso.trim().split('T');
  const [ano, mes, dia] = data.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHoraRelatorio(iso: string | null, timeZoneId: string | null): string {
  if (!iso?.trim()) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  const opcoes: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  if (timeZoneId) opcoes.timeZone = timeZoneId;
  try {
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(data);
  } catch {
    const { timeZone: _ignorado, ...semFuso } = opcoes;
    return new Intl.DateTimeFormat('pt-BR', semFuso).format(data);
  }
}

export function rotuloSituacao(item: MovimentacaoRelatorioItem): string {
  if (item.statusDescricao?.trim()) return item.statusDescricao.trim();
  const label = ENTRADA_SAIDA_STATUS_LABEL[item.status as EntradaSaidaStatus];
  return label || '—';
}

/** Situação, cobrança, faturamento e excedente permanecem em rótulos separados. */
export function montarDetalhesRelatorio(item: MovimentacaoRelatorioItem): string {
  const linhas = [
    `Situação: ${rotuloSituacao(item)}`,
    `Avulso: ${item.avulso ? 'Sim' : 'Não'}`,
    `Faturado: ${item.faturado ? 'Sim' : 'Não'}`,
    `Excedente: ${item.ehExcedente ? 'Sim' : 'Não'}`,
  ];
  if (item.observacao?.trim()) linhas.push(`Obs.: ${item.observacao.trim()}`);
  return linhas.join('\n');
}

export function criarPdfMovimentacoes(entrada: MovimentacaoRelatorioPdfEntrada): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margemX = 10;
  let y = desenharCabecalho(doc, entrada, margemX, 10, true);

  const resumo = entrada.resumo;
  const indicadores = [
    ['Movimentações', String(resumo.quantidade)],
    ['Entrada', String(resumo.qtdEntrada)],
    ['Saída', String(resumo.qtdSaida)],
    ['Suspenso', String(resumo.qtdSuspenso)],
    ['Agendado', String(resumo.qtdAgendado)],
    ['Cancelado', String(resumo.qtdCancelado)],
    ['Faturado', String(resumo.qtdFaturado)],
    ['Excedente', String(resumo.qtdExcedente)],
  ];

  autoTable(doc, {
    startY: y,
    tableWidth: 277,
    margin: { left: margemX, right: margemX, top: 16, bottom: 14 },
    theme: 'plain',
    head: [indicadores.map(([rotulo]) => rotulo)],
    body: [indicadores.map(([, valor]) => valor)],
    styles: { fontSize: 8, textColor: TEXTO, halign: 'center', cellPadding: 1.4 },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', fontSize: 7 },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 12;
  if (entrada.truncado) {
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Exportação limitada a ${entrada.limiteAplicado} registros. Refine os filtros para o conjunto completo.`,
      margemX,
      y
    );
    y += 3;
  }

  const corpo =
    entrada.itens.length > 0
      ? entrada.itens.map((item) => [
          String(item.id || '—'),
          item.placaVeiculo || '—',
          item.nomeMotorista || '—',
          item.nomeTransportadora || '—',
          formatarDataHoraRelatorio(item.dataHoraEntrada, entrada.timeZoneId),
          formatarDataHoraRelatorio(item.dataHoraSaida, entrada.timeZoneId),
          formatarPermanenciaRelatorio(item.tempoPermanenciaMinutos),
          rotuloSituacao(item),
          montarDetalhesRelatorio(item),
        ])
      : [['—', '—', '—', '—', '—', '—', '—', '—', 'Nenhuma movimentação encontrada com os filtros informados.']];

  autoTable(doc, {
    startY: y + 3,
    tableWidth: 277,
    margin: { left: margemX, right: margemX, top: 16, bottom: 14 },
    theme: 'plain',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    head: [['ID', 'Placa', 'Motorista', 'Transportadora', 'Entrada', 'Saída', 'Permanência', 'Situação', 'Detalhes']],
    body: corpo,
    styles: {
      fontSize: 7.5,
      textColor: TEXTO,
      cellPadding: 1.5,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', fontSize: 7.5, valign: 'middle' },
    alternateRowStyles: { fillColor: ZEBRADO },
    columnStyles: {
      0: { cellWidth: 16 },
      6: { cellWidth: 24 },
      7: { cellWidth: 22 },
      8: { cellWidth: 58 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const item = entrada.itens[data.row.index];
      if (item?.ehExcedente) data.cell.styles.fillColor = EXCEDENTE;
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) desenharCabecalho(doc, entrada, margemX, 8, false);
    },
  });

  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    const altura = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('GTSistemas', margemX, altura - 6);
    doc.text(`Página ${pagina}/${total}`, doc.internal.pageSize.getWidth() - margemX, altura - 6, {
      align: 'right',
    });
  }

  return doc;
}

function desenharCabecalho(
  doc: jsPDF,
  entrada: MovimentacaoRelatorioPdfEntrada,
  x: number,
  y: number,
  completo: boolean
): number {
  const largura = doc.internal.pageSize.getWidth();
  doc.setTextColor(...AZUL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(completo ? 14 : 10);
  doc.text(entrada.estacionamentoNome || 'Estacionamento', x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXTO);
  doc.text('Relatório de Movimentações', x, y + (completo ? 6 : 4));

  const emissao = formatarDataHoraRelatorio(entrada.emitidoEm.toISOString(), entrada.timeZoneId);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const cnpj = entrada.estacionamentoCnpj ? `CNPJ ${entrada.estacionamentoCnpj}` : '';
  const meta = [cnpj, `Emissão ${emissao}`].filter(Boolean).join('  ·  ');
  doc.text(meta, largura - x, y, { align: 'right' });

  if (!completo) return y + 8;

  doc.setTextColor(...TEXTO);
  doc.text(`Período de entrada: ${entrada.periodoEntrada}`, x, y + 12);
  if (entrada.periodoSaida) {
    doc.text(`Período de saída: ${entrada.periodoSaida}`, x + 90, y + 12);
  }
  const filtros = entrada.filtrosAplicados.length
    ? entrada.filtrosAplicados.join('  ·  ')
    : 'Nenhum filtro adicional';
  const linhas = doc.splitTextToSize(`Filtros: ${filtros}`, largura - x * 2);
  doc.text(linhas, x, y + 17);
  return y + 18 + linhas.length * 4;
}
