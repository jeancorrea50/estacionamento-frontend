import type { AgendamentoTimelineSlot } from './agendamento-dashboard.util';

export interface AgendamentoPainelExportKpis {
  agendados: number;
  disponiveis: number;
  ocupados: number;
  limpeza: number;
}

export interface AgendamentoPainelExportEntrada {
  dataLabel: string;
  modalidadeLabel: string;
  transportadoraNome: string | null;
  busca: string | null;
  kpis: AgendamentoPainelExportKpis;
  slots: AgendamentoTimelineSlot[];
  emitidoEm?: Date;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlEscape(value: string | number): string {
  return xmlEscape(String(value ?? ''));
}

function nomeArquivoBase(entrada: AgendamentoPainelExportEntrada): string {
  const data = entrada.dataLabel.replace(/\//g, '-');
  const mod = entrada.modalidadeLabel.toLowerCase().replace(/\s+/g, '-');
  return `agendamentos-painel-${data}-${mod}`;
}

function montarLinhasMeta(entrada: AgendamentoPainelExportEntrada): string[] {
  const emitido = entrada.emitidoEm ?? new Date();
  return [
    `Data: ${entrada.dataLabel}`,
    `Modalidade: ${entrada.modalidadeLabel}`,
    entrada.transportadoraNome
      ? `Transportadora: ${entrada.transportadoraNome}`
      : 'Transportadora: Todas',
    entrada.busca ? `Busca: ${entrada.busca}` : null,
    `Emitido em: ${emitido.toLocaleString('pt-BR')}`,
  ].filter((x): x is string => !!x);
}

/**
 * PDF via janela de impressão do navegador (Save as PDF).
 * Evita jspdf — dep listada no package.json mas quebrada no build atual do repo.
 */
export function exportarPainelAgendamentosPdf(entrada: AgendamentoPainelExportEntrada): void {
  const meta = montarLinhasMeta(entrada)
    .map((l) => `<p>${htmlEscape(l)}</p>`)
    .join('');

  const corpo =
    entrada.slots.length > 0
      ? entrada.slots
          .map(
            (s) => `<tr>
              <td>${htmlEscape(s.label)}</td>
              <td class="num">${htmlEscape(s.cadastrado)}</td>
              <td class="num">${htmlEscape(s.agendado)}</td>
              <td class="num">${htmlEscape(s.disponiveis)}</td>
              <td class="num">${htmlEscape(s.ocupacaoPct)}%</td>
            </tr>`
          )
          .join('')
      : `<tr><td colspan="5">Nenhuma janela para o dia.</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${htmlEscape(nomeArquivoBase(entrada))}</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; color: #0f172a; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    .meta p { margin: 2px 0; font-size: 12px; color: #475569; }
    .kpis { margin: 14px 0; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>Agendamentos — Painel do dia</h1>
  <div class="meta">${meta}</div>
  <p class="kpis"><strong>KPIs</strong> —
    Agendados: ${htmlEscape(entrada.kpis.agendados)} |
    Disponíveis: ${htmlEscape(entrada.kpis.disponiveis)} |
    Ocupados: ${htmlEscape(entrada.kpis.ocupados)} |
    Limpeza: ${htmlEscape(entrada.kpis.limpeza)}
  </p>
  <table>
    <thead>
      <tr>
        <th>Horário</th>
        <th>Cadastrado</th>
        <th>Agendado</th>
        <th>Disponível</th>
        <th>Ocupação</th>
      </tr>
    </thead>
    <tbody>${corpo}</tbody>
  </table>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 50);
    });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Popup bloqueado para impressão/PDF.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/**
 * Excel compatível sem lib extra: SpreadsheetML (.xls).
 */
export function exportarPainelAgendamentosExcel(entrada: AgendamentoPainelExportEntrada): void {
  const rows: string[][] = [
    ['Agendamentos — Painel do dia'],
    ['Data', entrada.dataLabel],
    ['Modalidade', entrada.modalidadeLabel],
    ['Transportadora', entrada.transportadoraNome || 'Todas'],
    ['Busca', entrada.busca || '—'],
    [],
    ['KPI', 'Valor'],
    ['Agendados', String(entrada.kpis.agendados)],
    ['Vagas disponíveis', String(entrada.kpis.disponiveis)],
    ['Ocupados', String(entrada.kpis.ocupados)],
    ['Limpeza agendada', String(entrada.kpis.limpeza)],
    [],
    ['Horário', 'Cadastrado', 'Agendado', 'Disponível', 'Ocupação %'],
    ...entrada.slots.map((s) => [
      s.label,
      String(s.cadastrado),
      String(s.agendado),
      String(s.disponiveis),
      String(s.ocupacaoPct),
    ]),
  ];

  if (entrada.slots.length === 0) {
    rows.push(['—', '—', '—', '—', 'Nenhuma janela']);
  }

  const xmlRows = rows
    .map((cols) => {
      const cells = cols
        .map((c) => `<Cell><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`)
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Painel">
  <Table>${xmlRows}</Table>
 </Worksheet>
</Workbook>`;

  downloadBlob(
    new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }),
    `${nomeArquivoBase(entrada)}.xls`
  );
}
