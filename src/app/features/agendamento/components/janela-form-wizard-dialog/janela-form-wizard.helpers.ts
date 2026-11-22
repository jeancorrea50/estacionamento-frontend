import {
  DIAS_SEMANA_OPCOES,
  PERIODICIDADE_OPCOES,
  type GranularidadeUnidade,
} from '../../models/janela-agendamento.models';
import { horaParaMinutos } from '../janela-form-dialog/janela-form.validation';
import type { FaixaForm, PeriodicidadeForm } from '../janela-form-dialog/janela-form.state';

export function formatIsoDateBr(iso: string | null | undefined): string {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export function formatVigenciaResumo(inicio: string, fim: string): string {
  if (!inicio) return '—';
  if (!fim) return `${formatIsoDateBr(inicio)} · Sem data final`;
  return `${formatIsoDateBr(inicio)} → ${formatIsoDateBr(fim)}`;
}

export function formatDuracaoSlot(
  unidade: GranularidadeUnidade,
  valor: number | null | undefined
): string {
  if (valor == null || !Number.isFinite(valor) || valor <= 0) return '—';
  const singular = unidade === 1 ? 'hora' : 'minuto';
  const plural = unidade === 1 ? 'horas' : 'minutos';
  return `${valor} ${valor === 1 ? singular : plural}`;
}

export function formatDuracaoFaixa(horaInicio: string, horaFim: string): string {
  const ini = horaParaMinutos(horaInicio);
  const fim = horaParaMinutos(horaFim);
  if (ini == null || fim == null || fim <= ini) return '—';
  const mins = fim - ini;
  if (mins % 60 === 0) {
    const h = mins / 60;
    return h === 1 ? '1 hora' : `${h} horas`;
  }
  return mins === 1 ? '1 minuto' : `${mins} minutos`;
}

export function formatPeriodicidadeResumo(lista: PeriodicidadeForm[]): string {
  if (!lista.length) return '—';
  const partes = lista.map((p) => {
    const tipo = PERIODICIDADE_OPCOES.find((o) => o.value === p.tipo)?.label ?? 'Regra';
    if ((p.tipo === 2 || p.tipo === 3) && p.dias.length) {
      const dias = p.dias
        .map((d) => DIAS_SEMANA_OPCOES.find((o) => o.value === d)?.abrev ?? String(d))
        .join(', ');
      return `${tipo} (${dias})`;
    }
    return tipo;
  });
  return partes.join(' · ');
}

/** Ordem de exibição Seg→Dom (API: 1…6,0). */
const ORDEM_DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 0] as const;

/** Compacto para lista: `Seg a Sáb`, `Diário`, `Dia 15`, etc. */
export function formatRecorrenciaCompacta(lista: PeriodicidadeForm[]): string {
  if (!lista.length) return '—';
  const p = lista[0];
  if (p.tipo === 1) return 'Diário';
  if ((p.tipo === 2 || p.tipo === 3) && p.dias.length) {
    return formatDiasSemanaCompacto(p.dias);
  }
  if (p.tipo === 4 && p.diaMes != null) return `Dia ${p.diaMes}`;
  if (p.tipo === 5 && p.diaMes != null && p.mes != null) return `${p.diaMes}/${p.mes}`;
  return PERIODICIDADE_OPCOES.find((o) => o.value === p.tipo)?.label ?? '—';
}

function formatDiasSemanaCompacto(dias: number[]): string {
  const ordem = [...ORDEM_DIAS_SEMANA];
  const unicos = [...new Set(dias.filter((d) => ordem.includes(d as (typeof ORDEM_DIAS_SEMANA)[number])))].sort(
    (a, b) => ordem.indexOf(a as (typeof ORDEM_DIAS_SEMANA)[number]) - ordem.indexOf(b as (typeof ORDEM_DIAS_SEMANA)[number])
  );
  if (!unicos.length) return '—';
  const abrev = (d: number) => DIAS_SEMANA_OPCOES.find((o) => o.value === d)?.abrev ?? String(d);
  if (unicos.length === 1) return abrev(unicos[0]);
  const indices = unicos.map((d) => ordem.indexOf(d as (typeof ORDEM_DIAS_SEMANA)[number]));
  const consecutivo = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
  if (consecutivo) return `${abrev(unicos[0])} a ${abrev(unicos[unicos.length - 1])}`;
  return unicos.map(abrev).join(', ');
}

/** Extremos das faixas: `06h às 18h`. */
export function formatHorarioExtremosFaixas(
  faixas: ReadonlyArray<{ horaInicio: string; horaFim: string }>
): string {
  const validas = faixas.filter((f) => f.horaInicio && f.horaFim);
  if (!validas.length) return '—';
  const ordenadas = [...validas].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const ini = ordenadas[0].horaInicio;
  const fim = ordenadas[ordenadas.length - 1].horaFim;
  return `${formatHoraCurta(ini)} às ${formatHoraCurta(fim)}`;
}

function formatHoraCurta(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = m[2];
  return min === '00' ? `${h}h` : `${h}h${min}`;
}

export function totalDisponibilizacoesJanela(vagasPorSlot: number, qtdFaixas: number): number {
  const v = Number(vagasPorSlot);
  const q = Number(qtdFaixas);
  if (!Number.isFinite(v) || !Number.isFinite(q) || v < 0 || q < 0) return 0;
  return Math.trunc(v) * Math.trunc(q);
}

export interface FaixaResumoLinha {
  uid: number;
  inicio: string;
  fim: string;
  duracao: string;
  horarioLabel: string;
}

export function mapFaixasResumo(faixas: FaixaForm[]): FaixaResumoLinha[] {
  return faixas.map((f) => ({
    uid: f.uid,
    inicio: f.horaInicio || '—',
    fim: f.horaFim || '—',
    duracao: formatDuracaoFaixa(f.horaInicio, f.horaFim),
    horarioLabel:
      f.horaInicio && f.horaFim ? `${f.horaInicio}–${f.horaFim}` : 'Faixa incompleta',
  }));
}
