// Conversões entre as reservas da API (uma linha por horário) e as destinações da tela.
import type {
  ModalidadeVagaAgendamento,
  PeriodicidadeVagaReserva,
  VagaReservaTransportadoraInput,
  VagaReservaTransportadoraItem,
} from '../../../models/vaga-disponibilidade.models';
import type {
  Destinacao,
  Empresa,
  Faturamento,
  GrupoDestinacao,
  ItemDestinacao,
  Janela,
  Modalidade,
  Recorrencia,
  StatusRegra,
} from './destinacao.models';

const DIAS_UTEIS = '1,2,3,4,5';
const FIM_DE_SEMANA = '0,6';

// ─── Datas ───────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');

/** Hoje local `yyyy-MM-dd`. */
export function hojeISO(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return hojeISO(d);
}

export function isoDia(raw: string | null | undefined): string {
  const s = (raw ?? '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

export function normHora(raw: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw ?? '').trim());
  return m ? `${pad(Number(m[1]))}:${m[2]}` : '';
}

export function janelaKey(inicio: string, fim: string): string {
  return `${normHora(inicio)}|${normHora(fim)}`;
}

// ─── Enums ───────────────────────────────────────────────────────────────
export function modalidadeDaApi(m: ModalidadeVagaAgendamento): Modalidade {
  return m === 2 ? 'limpeza' : m === 3 ? 'ambos' : 'estacionamento';
}

export function modalidadeParaApi(m: Modalidade): ModalidadeVagaAgendamento {
  return m === 'limpeza' ? 2 : m === 'ambos' ? 3 : 1;
}

function normalizarDias(csv: string | null | undefined): string {
  const dias = new Set<number>();
  for (const p of String(csv ?? '').split(',')) {
    const n = Number(p.trim());
    if (p.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 6) dias.add(n);
  }
  return [...dias].sort((a, b) => a - b).join(',');
}

export function recorrenciaDaApi(
  periodicidade: PeriodicidadeVagaReserva,
  diasSemana: string | null | undefined,
): Recorrencia {
  if (periodicidade !== 2) return 'todos';
  const dias = normalizarDias(diasSemana);
  if (!dias || dias === '0,1,2,3,4,5,6') return 'todos';
  if (dias === DIAS_UTEIS) return 'uteis';
  if (dias === FIM_DE_SEMANA) return 'fds';
  return 'personalizado';
}

/** `personalizado` mantém o CSV original da destinação. */
export function recorrenciaParaApi(
  r: Recorrencia,
  diasOriginais: string | null = null,
): { periodicidade: PeriodicidadeVagaReserva; diasSemana: string | null } {
  switch (r) {
    case 'uteis':
      return { periodicidade: 2, diasSemana: DIAS_UTEIS };
    case 'fds':
      return { periodicidade: 2, diasSemana: FIM_DE_SEMANA };
    case 'personalizado':
      return diasOriginais
        ? { periodicidade: 2, diasSemana: normalizarDias(diasOriginais) }
        : { periodicidade: 1, diasSemana: null };
    default:
      return { periodicidade: 1, diasSemana: null };
  }
}

/** True quando a reserva vale no dia (vigência + dias da semana). */
export function reservaCobreDia(r: VagaReservaTransportadoraItem, dia: string): boolean {
  const ini = isoDia(r.dataInicio);
  const fim = isoDia(r.dataFim);
  if (!ini || ini > dia || (fim && fim < dia)) return false;
  if (r.periodicidade !== 2) return true;
  const dias = normalizarDias(r.diasSemana);
  if (!dias) return true;
  const dow = new Date(`${dia}T12:00:00`).getDay();
  return dias.split(',').includes(String(dow));
}

// ─── Agrupamento ─────────────────────────────────────────────────────────
function faturamentoDe(r: VagaReservaTransportadoraItem): Faturamento {
  const id = r.responsavelFaturamentoId ?? null;
  return id && id > 0
    ? { tipo: 'terceiro', pagador: { id, nome: r.responsavelFaturamentoNome || `Pagador #${id}` } }
    : { tipo: 'transportadora', pagador: null };
}

export function grupoIdDe(transportadoraId: number | null | undefined): string {
  return transportadoraId && transportadoraId > 0 ? `t${transportadoraId}` : 'avulso';
}

/**
 * Agrupa as reservas em destinações (mesma transportadora, quem destina, período,
 * modalidade, recorrência e transferência). `patio` nomeia o destinador nulo.
 */
export function agruparDestinacoes(
  reservas: ReadonlyArray<VagaReservaTransportadoraItem>,
  patio: Empresa,
  hoje: string = hojeISO(),
): Destinacao[] {
  const mapa = new Map<string, Destinacao>();

  for (const r of reservas) {
    const avulso = r.avulso || !(r.transportadoraId > 0);
    const transportadoraId = avulso ? null : r.transportadoraId;
    const inicio = isoDia(r.dataInicio);
    const fim = isoDia(r.dataFim) || null;
    const recorrencia = recorrenciaDaApi(r.periodicidade, r.diasSemana);
    const diasSemana = r.periodicidade === 2 ? normalizarDias(r.diasSemana) || null : null;
    const destinadorId = r.destinadorId && r.destinadorId > 0 ? r.destinadorId : 0;

    const key = [
      grupoIdDe(transportadoraId),
      destinadorId,
      inicio,
      fim ?? '',
      r.modalidade,
      recorrencia,
      diasSemana ?? '',
      r.transferenciaAutomaticaSaldo ? 1 : 0,
    ].join('|');

    let d = mapa.get(key);
    if (!d) {
      d = {
        id: key,
        transportadoraId,
        transportadoraNome: avulso
          ? 'Avulso'
          : r.transportadoraNome || `Transportadora #${r.transportadoraId}`,
        destinador: destinadorId
          ? { id: destinadorId, nome: r.destinadorNome || `Empresa #${destinadorId}` }
          : patio,
        inicio,
        fim,
        modalidade: modalidadeDaApi(r.modalidade),
        recorrencia,
        diasSemana,
        transferenciaSaldo: !!r.transferenciaAutomaticaSaldo,
        status: 'ativa',
        registradoPor: r.usuarioCriacao || '—',
        registradoEm: r.dataCriacao ?? null,
        itens: [],
      };
      mapa.set(key, d);
    }

    // Auditoria do período = registro mais antigo.
    if (r.dataCriacao && (!d.registradoEm || r.dataCriacao < d.registradoEm)) {
      d.registradoEm = r.dataCriacao;
      d.registradoPor = r.usuarioCriacao || d.registradoPor;
    }

    const horaInicio = normHora(r.horaInicio);
    const horaFim = normHora(r.horaFim);
    const item: ItemDestinacao = {
      id: r.id,
      horaInicio,
      horaFim,
      janela: horaInicio && horaFim ? `${horaInicio}–${horaFim}` : r.periodoDiaLabel || '—',
      vagas: r.quantidade,
      usadasHoje: r.usadasNoDia ?? 0,
      faturamento: faturamentoDe(r),
      status: r.ativo ? 'ativa' : 'pausada',
    };
    d.itens.push(item);
  }

  for (const d of mapa.values()) {
    d.itens.sort(
      (a, b) => a.horaInicio.localeCompare(b.horaInicio) || a.horaFim.localeCompare(b.horaFim),
    );
    d.status = statusDestinacao(d, hoje);
  }
  return [...mapa.values()];
}

export function statusDestinacao(d: Pick<Destinacao, 'fim' | 'itens'>, hoje: string): StatusRegra {
  if (d.fim && d.fim < hoje) return 'encerrada';
  return d.itens.some((i) => i.status === 'ativa') ? 'ativa' : 'pausada';
}

export function vagasAtivas(d: Destinacao): number {
  return d.status !== 'ativa'
    ? 0
    : d.itens.filter((i) => i.status === 'ativa').reduce((s, i) => s + i.vagas, 0);
}

/** Filtra e agrupa por transportadora (avulso primeiro, depois por nome). */
export function agruparPorTransportadora(
  destinacoes: ReadonlyArray<Destinacao>,
  filtro: { termo: string; modalidade: Modalidade | 'todas'; status: StatusRegra | 'todas' },
): GrupoDestinacao[] {
  const termo = filtro.termo.trim().toLowerCase();
  const mapa = new Map<string, GrupoDestinacao>();

  for (const d of destinacoes) {
    if (filtro.modalidade !== 'todas' && d.modalidade !== filtro.modalidade) continue;
    if (filtro.status !== 'todas' && d.status !== filtro.status) continue;
    if (termo) {
      const alvo = [
        d.transportadoraNome,
        d.destinador.nome,
        ...d.itens.map((i) => i.faturamento.pagador?.nome ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      if (!alvo.includes(termo)) continue;
    }

    const id = grupoIdDe(d.transportadoraId);
    let g = mapa.get(id);
    if (!g) {
      g = {
        id,
        transportadoraId: d.transportadoraId,
        nome: d.transportadoraNome,
        avulso: !d.transportadoraId,
        destinacoes: [],
        horariosAtivos: 0,
        vagasDia: 0,
        temTerceiro: false,
      };
      mapa.set(id, g);
    }
    g.destinacoes.push(d);
    if (d.status === 'ativa') {
      for (const i of d.itens) {
        if (i.status !== 'ativa') continue;
        g.horariosAtivos++;
        g.vagasDia += i.vagas;
      }
    }
    g.temTerceiro ||= d.itens.some((i) => i.faturamento.tipo === 'terceiro');
  }

  for (const g of mapa.values()) {
    g.destinacoes.sort((a, b) => b.inicio.localeCompare(a.inicio));
  }
  return [...mapa.values()].sort(
    (a, b) => Number(b.avulso) - Number(a.avulso) || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
}

// ─── Janelas / saldo livre ───────────────────────────────────────────────
/**
 * Saldo livre por janela = capacidade do slot menos o já destinado (ativo, cobrindo o dia,
 * mesma modalidade ou "Ambos"). `ignorarIds` exclui a própria destinação em edição.
 */
export function calcularJanelas(
  slots: ReadonlyArray<{ horaInicio: string; horaFim: string; capacidade: number }>,
  reservas: ReadonlyArray<VagaReservaTransportadoraItem>,
  dia: string,
  modalidade: Modalidade,
  ignorarIds: ReadonlySet<number> = new Set(),
): Janela[] {
  const mod = modalidadeParaApi(modalidade);
  const porKey = new Map<string, Janela>();

  for (const s of slots) {
    const inicio = normHora(s.horaInicio);
    const fim = normHora(s.horaFim);
    if (!inicio || !fim) continue;
    const id = janelaKey(inicio, fim);
    const atual = porKey.get(id);
    // "Ambos": o mesmo horário vem das duas modalidades — vale a menor capacidade.
    const capacidade = atual ? Math.min(atual.capacidade, s.capacidade) : s.capacidade;
    porKey.set(id, { id, inicio, fim, capacidade, livres: capacidade });
  }

  for (const j of porKey.values()) {
    const destinadas = reservas
      .filter(
        (r) =>
          r.ativo &&
          !ignorarIds.has(r.id) &&
          janelaKey(r.horaInicio ?? '', r.horaFim ?? '') === j.id &&
          (mod === 3 || r.modalidade === mod || r.modalidade === 3) &&
          reservaCobreDia(r, dia),
      )
      .reduce((s, r) => s + r.quantidade, 0);
    j.livres = Math.max(0, j.capacidade - destinadas);
  }

  return [...porKey.values()].sort(
    (a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim),
  );
}

// ─── Payload ─────────────────────────────────────────────────────────────
export function montarInput(p: {
  transportadoraId: number | null;
  destinadorId: number;
  modalidade: Modalidade;
  inicio: string;
  fim: string | null;
  recorrencia: Recorrencia;
  diasOriginais: string | null;
  janela: Pick<Janela, 'inicio' | 'fim'>;
  quantidade: number;
  faturamento: Faturamento;
  transferencia: boolean;
}): VagaReservaTransportadoraInput {
  const rec = recorrenciaParaApi(p.recorrencia, p.diasOriginais);
  const avulso = !p.transportadoraId;
  return {
    transportadoraId: p.transportadoraId ?? 0,
    avulso,
    modalidade: modalidadeParaApi(p.modalidade),
    quantidade: p.quantidade,
    dataInicio: p.inicio,
    dataFim: p.fim || null,
    periodicidade: rec.periodicidade,
    diasSemana: rec.diasSemana,
    horaInicio: p.janela.inicio,
    horaFim: p.janela.fim,
    responsavelFaturamentoId:
      p.faturamento.tipo === 'terceiro' && p.faturamento.pagador ? p.faturamento.pagador.id : null,
    destinadorId: p.destinadorId > 0 ? p.destinadorId : null,
    transferenciaAutomaticaSaldo: p.transferencia,
  };
}
