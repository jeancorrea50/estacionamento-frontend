import type {
  ModalidadeVagaAgendamento,
  PeriodoDiaVaga,
  VagaDisponibilidadeResumo,
  VagaReservaTransportadoraItem,
} from '../../models/vaga-disponibilidade.models';
import type { AgendamentoSearchItem } from '../../models/agendamento.models';

export type AgendamentoModalidadeUi = 'estacionamento' | 'limpeza';

export interface AgendamentoCalendarioDia {
  iso: string;
  dia: number;
  foraDoMes: boolean;
  hoje: boolean;
  selecionado: boolean;
}

export interface AgendamentoFaixaHoraria {
  inicio: number;
  fim: number;
  label: string;
  total: number;
  disponiveis: number;
  reservadas: number;
  ocupadas: number;
  ocupacaoPct: number;
}

const FAIXAS: ReadonlyArray<{ inicio: number; fim: number }> = [
  { inicio: 6, fim: 8 },
  { inicio: 8, fim: 10 },
  { inicio: 10, fim: 12 },
  { inicio: 12, fim: 14 },
  { inicio: 14, fim: 16 },
  { inicio: 16, fim: 18 },
  { inicio: 18, fim: 20 },
  { inicio: 20, fim: 22 },
];

export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map((x) => Number(x));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatIsoDateBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function modalidadeApi(ui: AgendamentoModalidadeUi): ModalidadeVagaAgendamento {
  return ui === 'limpeza' ? 2 : 1;
}

export function capacidadeDaModalidade(
  resumo: VagaDisponibilidadeResumo | null,
  ui: AgendamentoModalidadeUi
): number {
  if (!resumo) return 0;
  const raw =
    ui === 'limpeza' ? resumo.capacidadeLimpeza : resumo.capacidadeEstacionamento;
  return Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;
}

export function disponiveisDaModalidade(
  resumo: VagaDisponibilidadeResumo | null,
  ui: AgendamentoModalidadeUi
): number {
  if (!resumo) return 0;
  const raw =
    ui === 'limpeza'
      ? resumo.vagasDisponiveisLimpeza
      : resumo.vagasDisponiveisEstacionamento;
  return Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;
}

export function reservadasDaModalidade(
  resumo: VagaDisponibilidadeResumo | null,
  ui: AgendamentoModalidadeUi
): number {
  if (!resumo) return 0;
  return ui === 'limpeza'
    ? resumo.vagasReservadasLimpeza
    : resumo.vagasReservadasEstacionamento;
}

function periodoCobreHora(periodo: PeriodoDiaVaga, hora: number): boolean {
  if (periodo == null) return true;
  if (periodo === 1) return hora >= 6 && hora < 12;
  if (periodo === 2) return hora >= 12 && hora < 18;
  if (periodo === 3) return hora >= 18 || hora < 6;
  return true;
}

function reservaCobreData(r: VagaReservaTransportadoraItem, iso: string): boolean {
  if (!r.ativo) return false;
  const ini = String(r.dataInicio ?? '').slice(0, 10);
  const fim = r.dataFim ? String(r.dataFim).slice(0, 10) : null;
  if (ini && iso < ini) return false;
  if (fim && iso > fim) return false;
  return true;
}

function reservaNaModalidade(
  r: VagaReservaTransportadoraItem,
  ui: AgendamentoModalidadeUi
): boolean {
  const m = r.modalidade;
  if (ui === 'limpeza') return m === 2 || m === 3;
  return m === 1 || m === 3;
}

function horaDoItem(item: AgendamentoSearchItem): number | null {
  const raw = String(item.dataHoraEntrada ?? '');
  const m = raw.match(/T(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) ? h : null;
}

export function montarFaixasHorarias(input: {
  isoData: string;
  ui: AgendamentoModalidadeUi;
  resumo: VagaDisponibilidadeResumo | null;
  items: AgendamentoSearchItem[];
}): AgendamentoFaixaHoraria[] {
  const total = capacidadeDaModalidade(input.resumo, input.ui);
  const reservas = (input.resumo?.reservas ?? []).filter(
    (r) => reservaNaModalidade(r, input.ui) && reservaCobreData(r, input.isoData)
  );

  return FAIXAS.map(({ inicio, fim }) => {
    const reservadas = reservas
      .filter((r) => periodoCobreHora(r.periodoDia, inicio))
      .reduce((acc, r) => acc + Math.max(0, Number(r.quantidade) || 0), 0);

    const ocupadas = input.items.filter((item) => {
      const h = horaDoItem(item);
      return h != null && h >= inicio && h < fim;
    }).length;

    const disponiveis =
      total > 0 ? Math.max(0, total - Math.max(reservadas, ocupadas)) : Math.max(0, total - ocupadas);
    const ocupacaoPct = total > 0 ? Math.min(100, Math.round((ocupadas / total) * 100)) : 0;

    return {
      inicio,
      fim,
      label: `${String(inicio).padStart(2, '0')}:00-${String(fim).padStart(2, '0')}:00`,
      total,
      disponiveis,
      reservadas,
      ocupadas,
      ocupacaoPct,
    };
  });
}

export function montarCalendarioMes(
  referencia: Date,
  selecionadoIso: string
): AgendamentoCalendarioDia[] {
  const ano = referencia.getFullYear();
  const mes = referencia.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const inicioGrade = new Date(ano, mes, 1 - ((primeiro.getDay() + 6) % 7)); // segunda
  const hojeIso = toIsoDateLocal(new Date());
  const dias: AgendamentoCalendarioDia[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(inicioGrade);
    d.setDate(inicioGrade.getDate() + i);
    const iso = toIsoDateLocal(d);
    dias.push({
      iso,
      dia: d.getDate(),
      foraDoMes: d.getMonth() !== mes,
      hoje: iso === hojeIso,
      selecionado: iso === selecionadoIso,
    });
  }
  return dias;
}

export function nomeMesAno(referencia: Date): string {
  return referencia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
