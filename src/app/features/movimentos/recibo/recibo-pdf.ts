import { jsPDF } from 'jspdf';
import { ModoRecibo } from '../models/entrada-saida.models';
import {
  formatarCnpjRecibo,
  formatarDataHoraRecibo,
  formatarMoedaRecibo,
  formatarPermanenciaRecibo,
  formatarPlacaRecibo
} from './recibo-pdf.helpers';
import type { ReciboPdfDados } from './recibo-pdf.types';

const LARGURA_MM = 80;
const MARGEM_X = 5;
const TEXTO: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [71, 85, 105];
const LINHA: [number, number, number] = [148, 163, 184];
const DESTAQUE: [number, number, number] = [180, 83, 9];

/**
 * Gera PDF térmico 80mm alinhado ao layout de referência GTSistemas
 * (comprovante estreito para impressora térmica).
 */
export function criarPdfReciboTermico(dados: ReciboPdfDados): jsPDF {
  const alturaEstimada = estimarAlturaMm(dados);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [LARGURA_MM, alturaEstimada]
  });

  const pageW = LARGURA_MM;
  const centro = pageW / 2;
  let y = 8;

  const nome = (dados.estacionamentoNome || 'ESTACIONAMENTO').trim().toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEXTO);
  doc.text(nome, centro, y, { align: 'center', maxWidth: pageW - MARGEM_X * 2 });
  y += doc.getTextDimensions(nome, { maxWidth: pageW - MARGEM_X * 2 }).h + 2;

  const cnpjFmt = formatarCnpjRecibo(dados.cnpj);
  if (cnpjFmt) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`CNPJ: ${cnpjFmt}`, centro, y, { align: 'center' });
    y += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  if (dados.enderecoLinha1) {
    doc.text(dados.enderecoLinha1, centro, y, { align: 'center', maxWidth: pageW - MARGEM_X * 2 });
    y += 3.5;
  }
  if (dados.enderecoLinha2) {
    doc.text(dados.enderecoLinha2, centro, y, { align: 'center', maxWidth: pageW - MARGEM_X * 2 });
    y += 3.5;
  }

  y += 2;
  y = desenharSeparador(doc, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...TEXTO);
  doc.text('COMPROVANTE DE ESTACIONAMENTO', centro, y, { align: 'center' });
  y += 6;

  doc.setFontSize(10);
  doc.text(`TICKET Nº ${dados.ticketId}`, centro, y, { align: 'center' });
  y += 6;

  if (dados.ehExcedente) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DESTAQUE);
    doc.text('EXCEDENTE', centro, y, { align: 'center' });
    y += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('PLACA DO VEÍCULO', centro, y, { align: 'center' });
  y += 6;

  const placa = formatarPlacaRecibo(dados.placa);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...TEXTO);
  doc.text(placa, centro, y, { align: 'center' });
  y += 7;

  y = desenharSeparador(doc, y);

  y = linhaCampo(doc, y, 'ENTRADA', formatarDataHoraRecibo(dados.dataHoraEntrada));
  y = linhaCampo(
    doc,
    y,
    'SAÍDA',
    dados.modo === ModoRecibo.Entrada && !dados.dataHoraSaida
      ? '—'
      : formatarDataHoraRecibo(dados.dataHoraSaida)
  );
  y = linhaCampo(doc, y, 'PERMANÊNCIA', formatarPermanenciaRecibo(dados.permanenciaMinutos));

  if (dados.suspensaoMinutos != null && dados.suspensaoMinutos > 0) {
    y = linhaCampo(
      doc,
      y,
      'SUSPENSÃO',
      formatarPermanenciaRecibo(dados.suspensaoMinutos)
    );
  }

  if (dados.modalidade?.trim()) {
    y = linhaCampo(doc, y, 'MODALIDADE', dados.modalidade.trim());
  }

  if (dados.cobertura?.trim()) {
    y = linhaCampo(doc, y, 'COBERTURA', dados.cobertura.trim());
  }

  const mostrarValores = dados.modo === ModoRecibo.Saida && !dados.ocultarValores;

  if (mostrarValores) {
    y += 1.5;
    y = desenharSeparador(doc, y, true);

    if (dados.cobrancaDescricao?.trim()) {
      y = linhaCampo(doc, y, 'COBRANÇA', dados.cobrancaDescricao.trim());
    }
    y = linhaCampo(doc, y, 'VALOR', formatarMoedaRecibo(dados.valorTotal));

    y += 2;
    y = desenharSeparador(doc, y, true);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...TEXTO);
    doc.text('TOTAL', MARGEM_X, y);
    const totalTxt = formatarMoedaRecibo(dados.valorTotal);
    const totalW = doc.getTextWidth(totalTxt);
    doc.setFontSize(14);
    doc.text(totalTxt, pageW - MARGEM_X - totalW, y);
    y += 7;
  }

  y += 1;
  y = desenharSeparador(doc, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXTO);
  doc.text('USUÁRIO RESPONSÁVEL', MARGEM_X, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(dados.usuarioResponsavel?.trim() || '—', MARGEM_X, y, {
    maxWidth: pageW - MARGEM_X * 2
  });
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...TEXTO);
  doc.text('Obrigado pela preferência!', centro, y, { align: 'center' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('Gerado pelo GTSistemas', centro, y, { align: 'center' });

  return doc;
}

function estimarAlturaMm(dados: ReciboPdfDados): number {
  let h = 140;
  if (dados.enderecoLinha1) h += 4;
  if (dados.enderecoLinha2) h += 4;
  if (dados.ehExcedente) h += 6;
  if (dados.suspensaoMinutos) h += 6;
  if (dados.modalidade) h += 6;
  if (dados.cobertura) h += 6;
  if (dados.modo === ModoRecibo.Saida && !dados.ocultarValores) h += 28;
  return Math.max(145, Math.min(230, h));
}

function desenharSeparador(doc: jsPDF, y: number, fino = false): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...LINHA);
  doc.setLineWidth(fino ? 0.15 : 0.25);
  if (fino) {
    doc.setLineDashPattern([0.6, 0.6], 0);
  } else {
    doc.setLineDashPattern([], 0);
  }
  doc.line(MARGEM_X, y, pageW - MARGEM_X, y);
  doc.setLineDashPattern([], 0);
  return y + (fino ? 4 : 5);
}

function linhaCampo(doc: jsPDF, y: number, label: string, value: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(label, MARGEM_X, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...TEXTO);
  const valor = value || '—';
  const vw = doc.getTextWidth(valor);
  doc.text(valor, pageW - MARGEM_X - vw, y);

  doc.setFont('helvetica', 'normal');
  const labelWReal = doc.getTextWidth(label);
  const x1 = MARGEM_X + labelWReal + 1.2;
  const x2 = pageW - MARGEM_X - vw - 1.2;
  if (x2 - x1 > 3) {
    doc.setDrawColor(...LINHA);
    doc.setLineWidth(0.12);
    doc.setLineDashPattern([0.4, 0.55], 0);
    doc.line(x1, y - 0.4, x2, y - 0.4);
    doc.setLineDashPattern([], 0);
  }

  return y + 6;
}
