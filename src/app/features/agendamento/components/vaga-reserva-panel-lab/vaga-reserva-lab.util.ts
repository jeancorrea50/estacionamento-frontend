import type { JanelaFaixa } from '../../models/janela-agendamento.models';
import type { VagaReservaTransportadoraItem } from '../../models/vaga-disponibilidade.models';
import type { ConfigCobrancaMesAcordo, ConfigCobrancaVagasAcordo } from '../../../financeiro/pages/faturamento-page/config-cobranca/faturamento-config-cobranca.types';

function isoDateOnly(value: string | null | undefined): string {
  return (value || '').trim().slice(0, 10);
}

export interface FaixaHorarioLab {
  key: string;
  horaInicio: string;
  horaFim: string;
  label: string;
}

export interface CotaTransportadoraDia {
  /** Vagas do acordo no mês (capacidade diária contratada). */
  cotaMes: number | null;
  /** Já destinadas ativas cobrindo o dia. */
  destinadas: number;
  /** Restante liberável no dia (null = sem acordo para calcular). */
  livres: number | null;
  temAcordo: boolean;
}

/** Janela ativa cobrindo o dia (vigência início/fim; fim nulo = aberto). */
export function janelaCobreDia(
  janela: { ativo?: boolean; dataVigenciaInicio?: string | null; dataVigenciaFim?: string | null },
  dataIso: string
): boolean {
  if (janela.ativo === false) return false;
  const dia = isoDateOnly(dataIso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const inicio = isoDateOnly(janela.dataVigenciaInicio);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || inicio > dia) return false;
  const fim = isoDateOnly(janela.dataVigenciaFim);
  if (!fim) return true;
  return fim >= dia;
}

export function normHoraLab(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
}

export function faixaKey(horaInicio: string, horaFim: string): string {
  return `${normHoraLab(horaInicio)}|${normHoraLab(horaFim)}`;
}

/** Une faixas de janelas ativas em opções únicas de horário. */
export function coletarFaixasUnicas(faixas: ReadonlyArray<Pick<JanelaFaixa, 'horaInicio' | 'horaFim'>>): FaixaHorarioLab[] {
  const map = new Map<string, FaixaHorarioLab>();
  for (const f of faixas ?? []) {
    const horaInicio = normHoraLab(f.horaInicio);
    const horaFim = normHoraLab(f.horaFim);
    if (!horaInicio || !horaFim) continue;
    const key = faixaKey(horaInicio, horaFim);
    if (map.has(key)) continue;
    map.set(key, {
      key,
      horaInicio,
      horaFim,
      label: `${horaInicio} – ${horaFim}`,
    });
  }
  return [...map.values()].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.horaFim.localeCompare(b.horaFim));
}

export function mesDeIso(iso: string | null | undefined): ConfigCobrancaMesAcordo | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim().slice(0, 10));
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return mes as ConfigCobrancaMesAcordo;
}

export function cotaAcordoDoMes(
  vagas: ConfigCobrancaVagasAcordo | null | undefined,
  mes: ConfigCobrancaMesAcordo | null
): number | null {
  if (!vagas || mes == null) return null;
  const raw = vagas[mes];
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  return Math.max(0, Math.trunc(Number(raw)));
}

/** Reserva ativa cobrindo o dia (vigência início/fim; fim nulo = aberto). */
export function reservaCobreDiaLab(
  reserva: Pick<VagaReservaTransportadoraItem, 'ativo' | 'dataInicio' | 'dataFim'>,
  dataIso: string
): boolean {
  if (!reserva?.ativo) return false;
  const dia = isoDateOnly(dataIso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const inicio = isoDateOnly(reserva.dataInicio);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || inicio > dia) return false;
  const fim = isoDateOnly(reserva.dataFim);
  if (!fim) return true;
  return fim >= dia;
}

/** Soma destinadas ativas da transportadora no dia (CIF + FOB). */
export function destinadasNoDia(
  reservas: ReadonlyArray<VagaReservaTransportadoraItem>,
  dataIso: string,
  transportadoraId: number
): number {
  if (!transportadoraId || transportadoraId <= 0) return 0;
  let total = 0;
  for (const r of reservas ?? []) {
    if (!reservaCobreDiaLab(r, dataIso)) continue;
    if (Number(r.transportadoraId) !== transportadoraId) continue;
    total += Math.max(0, Math.trunc(Number(r.quantidade) || 0));
  }
  return total;
}

export function calcularCotaDia(opts: {
  vagasAcordo: ConfigCobrancaVagasAcordo | null | undefined;
  temAcordo: boolean;
  dataIso: string;
  transportadoraId: number;
  reservas: ReadonlyArray<VagaReservaTransportadoraItem>;
}): CotaTransportadoraDia {
  const mes = mesDeIso(opts.dataIso);
  const cotaMes = opts.temAcordo ? cotaAcordoDoMes(opts.vagasAcordo, mes) : null;
  const destinadas = destinadasNoDia(opts.reservas, opts.dataIso, opts.transportadoraId);
  const livres =
    cotaMes != null ? Math.max(0, cotaMes - destinadas) : null;
  return {
    cotaMes,
    destinadas,
    livres,
    temAcordo: opts.temAcordo && cotaMes != null,
  };
}

/** Quantidade máxima permitida (hard stop). Sem acordo → null (não bloqueia por cota). */
export function maxQuantidadePermitida(cota: CotaTransportadoraDia | null): number | null {
  if (!cota?.temAcordo || cota.livres == null) return null;
  return cota.livres;
}
