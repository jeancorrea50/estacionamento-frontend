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
