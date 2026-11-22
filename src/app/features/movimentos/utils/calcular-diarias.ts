import { parsePatioWallClock } from '../../../shared/utils/local-iso-datetime';

/**
 * Quantidade de diárias entre entrada e saída (datas locais, inclusivas).
 * Mesmo dia calendário = 1; mínimo sempre 1.
 * @deprecated Preferir {@link calcularQuantidadeUnidades} alinhado ao backend.
 */
export function calcularQuantidadeDiarias(
  dataHoraEntrada: string | null | undefined,
  dataHoraSaida: string | null | undefined,
  timeZoneId?: string | null
): number {
  const entrada = parsePatioWallClock(dataHoraEntrada, timeZoneId);
  const saida = parsePatioWallClock(dataHoraSaida, timeZoneId);
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
 *
 * @param timeZoneId Fuso de Gerenciamento → Horário (ex.: America/Cuiaba).
 */
export function calcularQuantidadeUnidades(
  dataHoraEntrada: string | null | undefined,
  dataHoraSaida: string | null | undefined,
  tipoTarifa: 1 | 2 | null | undefined,
  timeZoneId?: string | null
): number {
  const entrada = parsePatioWallClock(dataHoraEntrada, timeZoneId);
  const saida = parsePatioWallClock(dataHoraSaida, timeZoneId);
  if (!entrada || !saida) return 1;

  let ini = entrada;
  let fim = saida;
  if (fim.getTime() < ini.getTime()) {
    [ini, fim] = [fim, ini];
  }

  const spanMs = fim.getTime() - ini.getTime();
  const tipo = tipoTarifa === 1 ? 1 : 2;
  const quantidade =
    tipo === 1 ? Math.ceil(spanMs / 3_600_000) : Math.ceil(spanMs / 86_400_000);

  return Math.max(1, quantidade || 0);
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
