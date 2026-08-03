/**
 * Quantidade de diárias entre entrada e saída (datas locais, inclusivas).
 * Mesmo dia calendário = 1; mínimo sempre 1.
 */
export function calcularQuantidadeDiarias(
  dataHoraEntrada: string | null | undefined,
  dataHoraSaida: string | null | undefined
): number {
  const entrada = parseDataLocal(dataHoraEntrada);
  const saida = parseDataLocal(dataHoraSaida);
  if (!entrada || !saida) return 1;

  const inicio = inicioDoDiaLocal(entrada);
  const fim = inicioDoDiaLocal(saida);
  const diffMs = fim.getTime() - inicio.getTime();
  const dias = Math.floor(diffMs / 86_400_000) + 1;
  return Math.max(1, dias);
}

function parseDataLocal(raw: string | null | undefined): Date | null {
  const texto = String(raw ?? '').trim();
  if (!texto) return null;

  // datetime-local: YYYY-MM-DDTHH:mm[:ss]
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(texto)) {
    const d = new Date(texto);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inicioDoDiaLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Total = diária × quantidade, arredondado em 2 casas. */
export function calcularTotalDiarias(
  valorDiaria: number | null | undefined,
  quantidadeDiarias: number
): number | null {
  if (valorDiaria == null || !Number.isFinite(valorDiaria) || valorDiaria < 0) return null;
  const qtd = Math.max(1, Math.floor(quantidadeDiarias) || 1);
  return Math.round(valorDiaria * qtd * 100) / 100;
}
