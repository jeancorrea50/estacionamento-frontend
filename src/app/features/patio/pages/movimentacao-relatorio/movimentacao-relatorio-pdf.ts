import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type {
  MovimentacaoRelatorioItem,
  MovimentacaoRelatorioResumo,
} from './movimentacao-relatorio.types';
import {
  formatarDataFiltro,
  formatarDataHoraRelatorio,
  formatarPermanenciaRelatorio,
  formatarValorRelatorio,
  minutosPermanenciaRelatorio,
  montarDemonstrativoQuantitativo,
  montarDetalhesRelatorio,
  resolverTransportadoraEscopo,
  rotuloCobertura,
  rotuloExcedente,
  rotuloFaturamento,
  rotuloPermanenciaRelatorio,
  rotuloSituacao,
} from './movimentacao-relatorio-pdf.helpers';

export {
  formatarDataFiltro,
  formatarDataHoraRelatorio,
  formatarPermanenciaRelatorio,
  formatarValorRelatorio,
  minutosPermanenciaRelatorio,
  montarDemonstrativoQuantitativo,
  montarDetalhesRelatorio,
  resolverTransportadoraEscopo,
  rotuloCobertura,
  rotuloExcedente,
  rotuloFaturamento,
  rotuloPermanenciaRelatorio,
  rotuloSituacao,
} from './movimentacao-relatorio-pdf.helpers';

const AZUL: [number, number, number] = [29, 78, 216];
const MARINHO: [number, number, number] = [10, 56, 144];
const TEXTO: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [71, 85, 105];
const ZEBRADO: [number, number, number] = [248, 250, 252];
const EXCEDENTE_BG: [number, number, number] = [255, 247, 237];
const LINHA: [number, number, number] = [226, 232, 240];
const CABECALHO_TABELA: [number, number, number] = [241, 245, 249];

const MARGEM_X = 12;
const LARGURA_UTIL = 273;

export interface MovimentacaoRelatorioPdfEntrada {
  estacionamentoNome: string;
  estacionamentoCnpj: string | null;
  /** Escopo de transportadora quando aplicável (nome único ou consolidado). Sem CNPJ inventado. */
  transportadoraEscopo: string | null;
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

type DocComAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export function criarPdfMovimentacoes(entrada: MovimentacaoRelatorioPdfEntrada): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  let y = desenharCabecalhoInstitucional(doc, entrada, true);

  if (entrada.truncado) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Exportação limitada a ${entrada.limiteAplicado} registros. Refine os filtros para o conjunto completo.`,
      MARGEM_X,
      y
    );
    y += 5;
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
          rotuloPermanenciaRelatorio(item, entrada.emitidoEm),
          rotuloExcedente(item),
          formatarValorRelatorio(item.valor),
        ])
      : [
          [
            '—',
            '—',
            '—',
            '—',
            '—',
            '—',
            '—',
            '—',
            'Nenhuma movimentação encontrada com os filtros informados.',
          ],
        ];

  autoTable(doc, {
    startY: y,
    tableWidth: LARGURA_UTIL,
    margin: { left: MARGEM_X, right: MARGEM_X, top: 18, bottom: 16 },
    theme: 'plain',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    head: [
      [
        'ID',
        'Placa',
        'Motorista',
        'Transportadora',
        'Entrada',
        'Saída',
        'Permanência',
        'Excedente',
        'Valor',
      ],
    ],
    body: corpo,
    styles: {
      fontSize: 7.5,
      textColor: TEXTO,
      cellPadding: 1.6,
      overflow: 'linebreak',
      valign: 'top',
      lineColor: LINHA,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: CABECALHO_TABELA,
      textColor: TEXTO,
      fontStyle: 'bold',
      fontSize: 7.5,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: ZEBRADO },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 28 },
      2: { cellWidth: 40 },
      3: { cellWidth: 42 },
      4: { cellWidth: 34 },
      5: { cellWidth: 34 },
      6: { cellWidth: 28 },
      7: { cellWidth: 24, halign: 'center' },
      8: { cellWidth: 25, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || entrada.itens.length === 0) return;
      const item = entrada.itens[data.row.index];
      if (item?.ehExcedente) data.cell.styles.fillColor = EXCEDENTE_BG;
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        desenharCabecalhoInstitucional(doc, entrada, false);
      }
    },
  });

  const notaY = ((doc as DocComAutoTable).lastAutoTable?.finalY ?? pageH - 28) + 5;
  if (notaY < pageH - 20) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    const nota = doc.splitTextToSize(
      'Critérios: dados do GET /api/MovimentacaoRelatorio. Excedente vem de ehExcedente. Valor só aparece se o backend enviar; caso contrário "—". Não calcula R$ no cliente nem altera registros.',
      LARGURA_UTIL
    );
    doc.text(nota, MARGEM_X, notaY);
  }

  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    desenharRodape(doc, entrada, pagina, total, pageW, pageH);
  }

  return doc;
}

function desenharCabecalhoInstitucional(
  doc: jsPDF,
  entrada: MovimentacaoRelatorioPdfEntrada,
  completo: boolean
): number {
  const pageW = doc.internal.pageSize.getWidth();
  let y = completo ? 12 : 10;

  doc.setFillColor(...AZUL);
  doc.rect(MARGEM_X, y - 4, 3, completo ? 18 : 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(completo ? 11 : 9);
  doc.setTextColor(...MARINHO);
  doc.text('GTS', MARGEM_X + 6, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Sistema de Estacionamento', MARGEM_X + 18, y);

  const emissao = formatarDataHoraRelatorio(entrada.emitidoEm.toISOString(), entrada.timeZoneId);
  doc.setFontSize(7.5);
  doc.text(`Emissão: ${emissao}`, pageW - MARGEM_X, y, { align: 'right' });

  y += completo ? 6 : 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(completo ? 13 : 10);
  doc.setTextColor(...TEXTO);
  doc.text('Relatório de Movimentações', MARGEM_X + 6, y);

  if (!completo) {
    doc.setDrawColor(...LINHA);
    doc.setLineWidth(0.3);
    doc.line(MARGEM_X, y + 3, pageW - MARGEM_X, y + 3);
    return y + 6;
  }

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXTO);
  doc.text(entrada.estacionamentoNome || 'Estacionamento', MARGEM_X + 6, y);
  if (entrada.estacionamentoCnpj) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text(`CNPJ ${entrada.estacionamentoCnpj}`, MARGEM_X + 6, y + 4);
    y += 4;
  }

  if (entrada.transportadoraEscopo) {
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Transportadora: ${entrada.transportadoraEscopo}`, MARGEM_X + 6, y);
  }

  y += 5;
  doc.setTextColor(...TEXTO);
  doc.setFontSize(8);
  doc.text(`Período de entrada: ${entrada.periodoEntrada}`, MARGEM_X + 6, y);
  if (entrada.periodoSaida) {
    doc.text(`Período de saída: ${entrada.periodoSaida}`, MARGEM_X + 100, y);
  }

  y += 4;
  const filtros = entrada.filtrosAplicados.length
    ? entrada.filtrosAplicados.join('  ·  ')
    : 'Nenhum filtro adicional';
  doc.setTextColor(...MUTED);
  const linhasFiltro = doc.splitTextToSize(`Filtros: ${filtros}`, LARGURA_UTIL - 6);
  doc.text(linhasFiltro, MARGEM_X + 6, y);
  y += linhasFiltro.length * 3.5 + 2;

  doc.setDrawColor(...LINHA);
  doc.setLineWidth(0.35);
  doc.line(MARGEM_X, y, pageW - MARGEM_X, y);
  return y + 5;
}

function desenharRodape(
  doc: jsPDF,
  entrada: MovimentacaoRelatorioPdfEntrada,
  pagina: number,
  total: number,
  pageW: number,
  pageH: number
): void {
  const y = pageH - 7;
  doc.setDrawColor(...LINHA);
  doc.setLineWidth(0.25);
  doc.line(MARGEM_X, y - 3, pageW - MARGEM_X, y - 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const esquerda = `GTS · ${entrada.estacionamentoNome || 'Estacionamento'}`;
  const centro = `Período entrada: ${entrada.periodoEntrada}`;
  doc.text(esquerda, MARGEM_X, y);
  doc.text(centro, pageW / 2, y, { align: 'center' });
  doc.text(`Página ${pagina} de ${total}`, pageW - MARGEM_X, y, { align: 'right' });
}
