import type { VagaReservaTransportadoraItem } from '../../models/vaga-disponibilidade.models';
import { normHoraLab } from './vaga-reserva-lab.util';

export type DestinacaoListaSituacao = 'todas' | 'ativas' | 'inativas';
export type DestinacaoListaModalidade = 'todas' | 1 | 2 | 3;

export interface DestinacaoListaFiltros {
  busca: string;
  modalidade: DestinacaoListaModalidade;
  situacao: DestinacaoListaSituacao;
}

export interface DestinacaoHorarioGrupo {
  id: number;
  horaInicio: string;
  horaFim: string;
  label: string;
  quantidade: number;
  ativo: boolean;
  transferenciaAutomaticaSaldo: boolean;
  responsavelFaturamentoId: number | null;
  responsavelFaturamentoNome: string | null;
  faturamentoLabel: string;
}

export interface DestinacaoPeriodoGrupo {
  key: string;
  dataInicio: string;
  dataFim: string | null;
  periodoLabel: string;
  modalidade: number;
  modalidadeLabel: string;
  horarios: DestinacaoHorarioGrupo[];
  totalVagasDia: number;
}

export interface DestinacaoTransportadoraGrupo {
  key: string;
  transportadoraId: number;
  nome: string;
  avulso: boolean;
  periodosAtivos: DestinacaoPeriodoGrupo[];
  periodosInativos: DestinacaoPeriodoGrupo[];
  horariosAtivosCount: number;
  vagasDiaAtivas: number;
  ativosCount: number;
  inativosCount: number;
}

function isoDateOnly(value: string | null | undefined): string {
  return (value || '').trim().slice(0, 10);
}

function formatDiaBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDateOnly(iso));
  if (!m) return iso || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function labelPeriodoDestinacao(
  dataInicio: string,
  dataFim: string | null | undefined
): string {
  const ini = formatDiaBr(dataInicio);
  const fimIso = isoDateOnly(dataFim);
  if (!fimIso || fimIso === isoDateOnly(dataInicio)) return ini;
  return `${ini} a ${formatDiaBr(fimIso)}`;
}

function periodoKey(r: VagaReservaTransportadoraItem): string {
  const dias = String(r.diasSemana ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .sort()
    .join(',');
  return [
    isoDateOnly(r.dataInicio),
    isoDateOnly(r.dataFim) || '',
    Number(r.modalidade) || 0,
    Number(r.periodicidade) || 0,
    dias,
  ].join('|');
}

function transportadoraKey(r: VagaReservaTransportadoraItem): string {
  if (r.avulso || Number(r.transportadoraId) <= 0) return 'avulso';
  return `t:${Number(r.transportadoraId)}`;
}

function transportadoraNome(r: VagaReservaTransportadoraItem): string {
  if (r.avulso || Number(r.transportadoraId) <= 0) return 'Avulso';
  return (r.transportadoraNome || '').trim() || `Transportadora #${r.transportadoraId}`;
}

function modalidadeFallback(m: number): string {
  if (m === 2) return 'Limpeza';
  if (m === 3) return 'Ambos';
  return 'Estacionamento';
}

function passaFiltroModalidade(
  r: VagaReservaTransportadoraItem,
  modalidade: DestinacaoListaModalidade
): boolean {
  if (modalidade === 'todas') return true;
  return Number(r.modalidade) === modalidade || Number(r.modalidade) === 3;
}

function passaFiltroBusca(r: VagaReservaTransportadoraItem, busca: string): boolean {
  const q = busca.trim().toLowerCase();
  if (!q) return true;
  return transportadoraNome(r).toLowerCase().includes(q);
}

function montarPeriodos(items: VagaReservaTransportadoraItem[]): DestinacaoPeriodoGrupo[] {
  const map = new Map<string, VagaReservaTransportadoraItem[]>();
  for (const r of items) {
    const key = periodoKey(r);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }

  const periodos: DestinacaoPeriodoGrupo[] = [];
  for (const [key, list] of map) {
    const base = list[0]!;
    const horarios: DestinacaoHorarioGrupo[] = list
      .map((r) => {
        const horaInicio = normHoraLab(r.horaInicio);
        const horaFim = normHoraLab(r.horaFim);
        const responsavelFaturamentoId =
          r.responsavelFaturamentoId != null && Number(r.responsavelFaturamentoId) > 0
            ? Number(r.responsavelFaturamentoId)
            : null;
        const responsavelFaturamentoNome = (r.responsavelFaturamentoNome || '').trim() || null;
        return {
          id: r.id,
          horaInicio,
          horaFim,
          label: horaInicio && horaFim ? `${horaInicio} – ${horaFim}` : 'Sem horário',
          quantidade: Math.max(0, Math.trunc(Number(r.quantidade) || 0)),
          ativo: !!r.ativo,
          transferenciaAutomaticaSaldo: !!r.transferenciaAutomaticaSaldo,
          responsavelFaturamentoId,
          responsavelFaturamentoNome,
          faturamentoLabel: responsavelFaturamentoId
            ? `Terceiro${responsavelFaturamentoNome ? `: ${responsavelFaturamentoNome}` : ''}`
            : 'Transportadora',
        };
      })
      .sort((a, b) => {
        const byIni = a.horaInicio.localeCompare(b.horaInicio);
        if (byIni !== 0) return byIni;
        return a.horaFim.localeCompare(b.horaFim);
      });

    periodos.push({
      key,
      dataInicio: isoDateOnly(base.dataInicio),
      dataFim: isoDateOnly(base.dataFim) || null,
      periodoLabel: labelPeriodoDestinacao(base.dataInicio, base.dataFim),
      modalidade: Number(base.modalidade) || 1,
      modalidadeLabel: (base.modalidadeLabel || '').trim() || modalidadeFallback(base.modalidade),
      horarios,
      totalVagasDia: horarios.reduce((acc, h) => acc + h.quantidade, 0),
    });
  }

  return periodos.sort((a, b) => {
    const byIni = a.dataInicio.localeCompare(b.dataInicio);
    if (byIni !== 0) return byIni;
    return a.modalidade - b.modalidade;
  });
}

/**
 * Agrupa reservas em Transportadora → Período → Horários (cronológico).
 * Inativas ficam em `periodosInativos` para histórico recolhido.
 */
export function agruparDestinacoesLista(
  reservas: ReadonlyArray<VagaReservaTransportadoraItem>,
  filtros: DestinacaoListaFiltros
): DestinacaoTransportadoraGrupo[] {
  const filtradas = reservas.filter(
    (r) => passaFiltroModalidade(r, filtros.modalidade) && passaFiltroBusca(r, filtros.busca)
  );

  const porTransp = new Map<string, VagaReservaTransportadoraItem[]>();
  for (const r of filtradas) {
    const key = transportadoraKey(r);
    const list = porTransp.get(key) ?? [];
    list.push(r);
    porTransp.set(key, list);
  }

  const grupos: DestinacaoTransportadoraGrupo[] = [];
  for (const [key, list] of porTransp) {
    const ativos = list.filter((r) => r.ativo);
    const inativos = list.filter((r) => !r.ativo);

    if (filtros.situacao === 'ativas' && ativos.length === 0) continue;
    if (filtros.situacao === 'inativas' && inativos.length === 0) continue;

    const periodosAtivos =
      filtros.situacao === 'inativas' ? [] : montarPeriodos(ativos);
    const periodosInativos =
      filtros.situacao === 'ativas' ? [] : montarPeriodos(inativos);

    const sample = list[0]!;
    grupos.push({
      key,
      transportadoraId: Number(sample.transportadoraId) || 0,
      nome: transportadoraNome(sample),
      avulso: !!sample.avulso || Number(sample.transportadoraId) <= 0,
      periodosAtivos,
      periodosInativos,
      horariosAtivosCount: periodosAtivos.reduce((acc, p) => acc + p.horarios.length, 0),
      vagasDiaAtivas: periodosAtivos.reduce((acc, p) => acc + p.totalVagasDia, 0),
      ativosCount: periodosAtivos.reduce((acc, p) => acc + p.horarios.length, 0),
      inativosCount: periodosInativos.reduce((acc, p) => acc + p.horarios.length, 0),
    });
  }

  return grupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
