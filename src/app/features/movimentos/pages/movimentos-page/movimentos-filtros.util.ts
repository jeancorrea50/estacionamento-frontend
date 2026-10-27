/** Granularidade do período de filtros de Movimentações. */
export type MovimentosPeriodoGranularidade = 'dia' | 'semana' | 'mes' | 'ano';

export type MovimentosExcedenteFiltro = 'all' | 'sim' | 'nao';

export interface MovimentosFiltrosAvancados {
  placa: string;
  motoristaId: number | null;
  motoristaLabel: string;
  transportadoraId: number | null;
  transportadoraLabel: string;
  excedente: MovimentosExcedenteFiltro;
  /** Quando false, não envia DataInicial/DataFinal. */
  periodoAtivo: boolean;
  dataInicio: Date;
  dataFim: Date;
  granularidade: MovimentosPeriodoGranularidade;
}

export interface MovimentosPeriodoCelula {
  iso: string;
  day: number;
  inMonth: boolean;
  date: Date;
}

export function criarDataHoje(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function criarFiltrosAvancadosVazios(): MovimentosFiltrosAvancados {
  const hoje = criarDataHoje();
  return {
    placa: '',
    motoristaId: null,
    motoristaLabel: '',
    transportadoraId: null,
    transportadoraLabel: '',
    excedente: 'all',
    periodoAtivo: false,
    dataInicio: hoje,
    dataFim: hoje,
    granularidade: 'dia'
  };
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Início do dia em ISO local sem offset (`yyyy-MM-ddT00:00:00`). */
export function toIsoDateTimeStart(d: Date): string {
  return `${toIsoDate(d)}T00:00:00`;
}

export function toIsoDateTimeEnd(d: Date): string {
  return `${toIsoDate(d)}T23:59:59`;
}

export function inicioSemana(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day; // segunda-feira
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function fimSemana(d: Date): Date {
  const ini = inicioSemana(d);
  return new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6);
}

export function inicioMes(ano: number, mes: number): Date {
  return new Date(ano, mes, 1);
}

export function fimMes(ano: number, mes: number): Date {
  return new Date(ano, mes + 1, 0);
}

export function inicioAno(ano: number): Date {
  return new Date(ano, 0, 1);
}

export function fimAno(ano: number): Date {
  return new Date(ano, 11, 31);
}

export function montarGradeCalendario(ano: number, mes: number): MovimentosPeriodoCelula[] {
  const first = new Date(ano, mes, 1);
  const startOffset = (first.getDay() + 6) % 7; // segunda = 0
  const start = new Date(ano, mes, 1 - startOffset);
  const cells: MovimentosPeriodoCelula[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      iso: toIsoDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === mes,
      date
    });
  }
  return cells;
}

export function aplicarGranularidadeAoSelecionarDia(
  granularidade: MovimentosPeriodoGranularidade,
  dia: Date
): { inicio: Date; fim: Date } {
  if (granularidade === 'semana') {
    return { inicio: inicioSemana(dia), fim: fimSemana(dia) };
  }
  const d = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
  return { inicio: d, fim: d };
}

export function aplicarGranularidadeMes(ano: number, mes: number): { inicio: Date; fim: Date } {
  return { inicio: inicioMes(ano, mes), fim: fimMes(ano, mes) };
}

export function aplicarGranularidadeAno(ano: number): { inicio: Date; fim: Date } {
  return { inicio: inicioAno(ano), fim: fimAno(ano) };
}

export function formatarPeriodoLabel(inicio: Date, fim: Date, granularidade: MovimentosPeriodoGranularidade): string {
  const ini = toIsoDate(inicio);
  const fi = toIsoDate(fim);
  if (granularidade === 'ano') return String(inicio.getFullYear());
  if (granularidade === 'mes') {
    return inicio.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  }
  if (ini === fi) {
    return inicio.toLocaleDateString('pt-BR');
  }
  return `${inicio.toLocaleDateString('pt-BR')} – ${fim.toLocaleDateString('pt-BR')}`;
}

export function contarFiltrosAvancadosAtivos(f: MovimentosFiltrosAvancados): number {
  let n = 0;
  if (f.placa.trim()) n++;
  if (f.motoristaId != null && f.motoristaId > 0) n++;
  if (f.transportadoraId != null && f.transportadoraId > 0) n++;
  if (f.periodoAtivo) n++;
  if (f.excedente !== 'all') n++;
  return n;
}
