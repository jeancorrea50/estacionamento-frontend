/**
 * Quantidade de diárias entre entrada e saída (datas locais, inclusivas).
 * Mesmo dia calendário = 1; mínimo sempre 1.
 * @deprecated Preferir {@link calcularQuantidadeUnidades} alinhado ao backend.
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

/**
 * Unidades cobradas (hora ou diária), espelhando o backend:
 * `Math.Ceiling(TotalHours|TotalDays)` com mínimo 1.
 * Tipo: 1=Hora, 2=Diaria (default Diaria).
 */
export function calcularQuantidadeUnidades(
  dataHoraEntrada: string | null | undefined,
  dataHoraSaida: string | null | undefined,
  tipoTarifa: 1 | 2 | null | undefined
): number {
  const entrada = parseDataLocal(dataHoraEntrada);
  const saida = parseDataLocal(dataHoraSaida);
  if (!entrada || !saida) return 1;

  let ini = entrada;
  let fim = saida;
  if (fim.getTime() < ini.getTime()) {
    [ini, fim] = [fim, ini];
  }

  const spanMs = fim.getTime() - ini.getTime();
  const tipo = tipoTarifa === 1 ? 1 : 2;
  const quantidade =
    tipo === 1
      ? Math.ceil(spanMs / 3_600_000)
      : Math.ceil(spanMs / 86_400_000);

  return Math.max(1, quantidade || 0);
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

/** Total = unitário × quantidade, arredondado em 2 casas. */
export function calcularTotalDiarias(
  valorUnitario: number | null | undefined,
  quantidadeUnidades: number
): number | null {
  if (valorUnitario == null || !Number.isFinite(valorUnitario) || valorUnitario < 0) return null;
  const qtd = Math.max(0, Math.floor(quantidadeUnidades) || 0);
  return Math.round(valorUnitario * qtd * 100) / 100;
}
