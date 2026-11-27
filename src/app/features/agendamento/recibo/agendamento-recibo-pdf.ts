import { jsPDF } from 'jspdf';
import { formatPlacaDisplay } from '../../cadastro/utils/placa-br';

export interface AgendamentoReciboDados {
  id: number;
  placa: string;
  dataHoraAgendada: string;
  motoristaNome: string;
  motoristaCpf: string;
  transportadoraNome?: string | null;
  observacao?: string | null;
  estacionamentoNome: string;
  estacionamentoCnpj?: string | null;
  enderecoLinha1?: string | null;
  enderecoLinha2?: string | null;
}

function formatCpf(cpf: string | null | undefined): string {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return (cpf ?? '').trim() || '—';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatCnpj(cnpj: string | null | undefined): string {
  const d = String(cnpj ?? '').replace(/\D/g, '');
  if (d.length !== 14) return (cnpj ?? '').trim() || '';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

function linha(
  doc: jsPDF,
  y: number,
  label: string,
  valor: string,
  margin: number,
  pageW: number
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(label, margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  const lines = doc.splitTextToSize(valor || '—', pageW - margin * 2) as string[];
  doc.text(lines, margin, y);
  return y + lines.length * 6 + 4;
}

/** Recibo de agendamento em folha A4 (portrait). */
export function criarPdfReciboAgendamentoA4(dados: AgendamentoReciboDados): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);
  doc.text('COMPROVANTE DE AGENDAMENTO', pageW / 2, y, { align: 'center' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(`Nº ${dados.id}`, pageW / 2, y, { align: 'center' });
  y += 12;

  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  const nomePatio = (dados.estacionamentoNome || 'ESTACIONAMENTO').trim().toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  doc.text(nomePatio, margin, y);
  y += 7;

  const cnpj = formatCnpj(dados.estacionamentoCnpj);
  if (cnpj) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`CNPJ: ${cnpj}`, margin, y);
    y += 6;
  }

  if (dados.enderecoLinha1?.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const l1 = doc.splitTextToSize(dados.enderecoLinha1.trim(), pageW - margin * 2) as string[];
    doc.text(l1, margin, y);
    y += l1.length * 5 + 1;
  }
  if (dados.enderecoLinha2?.trim()) {
    const l2 = doc.splitTextToSize(dados.enderecoLinha2.trim(), pageW - margin * 2) as string[];
    doc.text(l2, margin, y);
    y += l2.length * 5 + 1;
  }

  y += 6;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  y = linha(doc, y, 'DATA E HORA DO AGENDAMENTO', formatDataHora(dados.dataHoraAgendada), margin, pageW);
  y = linha(doc, y, 'PLACA', formatPlacaDisplay(dados.placa) || dados.placa || '—', margin, pageW);
  y = linha(doc, y, 'MOTORISTA', dados.motoristaNome || '—', margin, pageW);
  y = linha(doc, y, 'CPF', formatCpf(dados.motoristaCpf), margin, pageW);

  if (dados.transportadoraNome?.trim()) {
    y = linha(doc, y, 'TRANSPORTADORA', dados.transportadoraNome.trim(), margin, pageW);
  }
  if (dados.observacao?.trim()) {
    y = linha(doc, y, 'OBSERVAÇÃO', dados.observacao.trim(), margin, pageW);
  }

  y = Math.max(y + 16, 270);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Emitido em ${new Date().toLocaleString('pt-BR')}`,
    pageW / 2,
    y,
    { align: 'center' }
  );

  return doc;
}

export function baixarPdfReciboAgendamento(dados: AgendamentoReciboDados): void {
  const doc = criarPdfReciboAgendamentoA4(dados);
  const placa = (formatPlacaDisplay(dados.placa) || dados.placa || 'agendamento').replace(/\s/g, '');
  doc.save(`recibo-agendamento-${dados.id}-${placa}.pdf`);
}
