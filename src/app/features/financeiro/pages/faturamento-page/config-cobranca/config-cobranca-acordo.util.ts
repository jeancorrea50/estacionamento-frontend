import { TipoCobrancaExcedente } from '../../../models/configuracao-cobranca.models';
import type {
  ConfigCobrancaAcordo,
  ConfigCobrancaAcordoListagem,
  ConfigCobrancaMesAcordo,
  ConfigCobrancaVagasAcordo
} from './faturamento-config-cobranca.types';

export const MESES_ACORDO: {
  mes: ConfigCobrancaMesAcordo;
  label: string;
  api: string;
  apiPascal: string;
  apiCif: string;
  apiCifPascal: string;
}[] = [
  {
    mes: 1,
    label: 'Jan',
    api: 'vagasJaneiro',
    apiPascal: 'VagasJaneiro',
    apiCif: 'vagasCifJaneiro',
    apiCifPascal: 'VagasCifJaneiro'
  },
  {
    mes: 2,
    label: 'Fev',
    api: 'vagasFevereiro',
    apiPascal: 'VagasFevereiro',
    apiCif: 'vagasCifFevereiro',
    apiCifPascal: 'VagasCifFevereiro'
  },
  {
    mes: 3,
    label: 'Mar',
    api: 'vagasMarco',
    apiPascal: 'VagasMarco',
    apiCif: 'vagasCifMarco',
    apiCifPascal: 'VagasCifMarco'
  },
  {
    mes: 4,
    label: 'Abr',
    api: 'vagasAbril',
    apiPascal: 'VagasAbril',
    apiCif: 'vagasCifAbril',
    apiCifPascal: 'VagasCifAbril'
  },
  {
    mes: 5,
    label: 'Mai',
    api: 'vagasMaio',
    apiPascal: 'VagasMaio',
    apiCif: 'vagasCifMaio',
    apiCifPascal: 'VagasCifMaio'
  },
  {
    mes: 6,
    label: 'Jun',
    api: 'vagasJunho',
    apiPascal: 'VagasJunho',
    apiCif: 'vagasCifJunho',
    apiCifPascal: 'VagasCifJunho'
  },
  {
    mes: 7,
    label: 'Jul',
    api: 'vagasJulho',
    apiPascal: 'VagasJulho',
    apiCif: 'vagasCifJulho',
    apiCifPascal: 'VagasCifJulho'
  },
  {
    mes: 8,
    label: 'Ago',
    api: 'vagasAgosto',
    apiPascal: 'VagasAgosto',
    apiCif: 'vagasCifAgosto',
    apiCifPascal: 'VagasCifAgosto'
  },
  {
    mes: 9,
    label: 'Set',
    api: 'vagasSetembro',
    apiPascal: 'VagasSetembro',
    apiCif: 'vagasCifSetembro',
    apiCifPascal: 'VagasCifSetembro'
  },
  {
    mes: 10,
    label: 'Out',
    api: 'vagasOutubro',
    apiPascal: 'VagasOutubro',
    apiCif: 'vagasCifOutubro',
    apiCifPascal: 'VagasCifOutubro'
  },
  {
    mes: 11,
    label: 'Nov',
    api: 'vagasNovembro',
    apiPascal: 'VagasNovembro',
    apiCif: 'vagasCifNovembro',
    apiCifPascal: 'VagasCifNovembro'
  },
  {
    mes: 12,
    label: 'Dez',
    api: 'vagasDezembro',
    apiPascal: 'VagasDezembro',
    apiCif: 'vagasCifDezembro',
    apiCifPascal: 'VagasCifDezembro'
  }
];

export const TIPO_COBRANCA_EXCEDENTE_OPCOES: { value: TipoCobrancaExcedente; label: string }[] = [
  { value: TipoCobrancaExcedente.PorVaga, label: 'Por vaga' },
  { value: TipoCobrancaExcedente.PorHora, label: 'Por hora' },
  { value: TipoCobrancaExcedente.PorPernoite, label: 'Por pernoite' },
  { value: TipoCobrancaExcedente.PorDiaria, label: 'Por diária' }
];

let listagemSeq = 0;

export function novaListagemAcordo(
  meses: ConfigCobrancaMesAcordo[] = [],
  quantidade: number | null = null,
  quantidadeCif: number | null = null
): ConfigCobrancaAcordoListagem {
  listagemSeq += 1;
  return {
    id: `lst-${Date.now()}-${listagemSeq}`,
    meses: [...meses],
    quantidade,
    quantidadeCif
  };
}

export function vagasAcordoVazias(): ConfigCobrancaVagasAcordo {
  return {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null,
    10: null,
    11: null,
    12: null
  };
}

export function acordoVazio(): ConfigCobrancaAcordo {
  return {
    dataInicio: null,
    dataFim: null,
    listagens: [],
    vagas: vagasAcordoVazias(),
    vagasCif: vagasAcordoVazias(),
    custoExcedente: null,
    tipoCobrancaExcedente: TipoCobrancaExcedente.PorVaga
  };
}

export function cloneAcordo(origem: ConfigCobrancaAcordo): ConfigCobrancaAcordo {
  return {
    dataInicio: origem.dataInicio ?? null,
    dataFim: origem.dataFim ?? null,
    listagens: (origem.listagens ?? []).map((l) => ({
      id: l.id,
      meses: [...l.meses],
      quantidade: l.quantidade,
      quantidadeCif: l.quantidadeCif ?? null
    })),
    vagas: { ...vagasAcordoVazias(), ...origem.vagas },
    vagasCif: { ...vagasAcordoVazias(), ...(origem.vagasCif ?? {}) },
    custoExcedente: origem.custoExcedente,
    tipoCobrancaExcedente: origem.tipoCobrancaExcedente || TipoCobrancaExcedente.PorVaga
  };
}

export function isQuantidadeVagasValida(valor: number | null | undefined): boolean {
  return valor != null && Number.isInteger(Number(valor)) && Number(valor) >= 0;
}

export function vagasFromListagens(listagens: ConfigCobrancaAcordoListagem[] | undefined): ConfigCobrancaVagasAcordo {
  const vagas = vagasAcordoVazias();
  for (const listagem of listagens ?? []) {
    if (!isQuantidadeVagasValida(listagem.quantidade)) continue;
    for (const mes of listagem.meses) {
      vagas[mes] = Number(listagem.quantidade);
    }
  }
  return vagas;
}

export function vagasCifFromListagens(
  listagens: ConfigCobrancaAcordoListagem[] | undefined
): ConfigCobrancaVagasAcordo {
  const vagas = vagasAcordoVazias();
  for (const listagem of listagens ?? []) {
    if (!isQuantidadeVagasValida(listagem.quantidade)) continue;
    const cif =
      listagem.quantidadeCif == null || !isQuantidadeVagasValida(listagem.quantidadeCif)
        ? Number(listagem.quantidade)
        : Number(listagem.quantidadeCif);
    for (const mes of listagem.meses) {
      vagas[mes] = cif;
    }
  }
  return vagas;
}

export function sincronizarVagasDoAcordo(acordo: ConfigCobrancaAcordo): ConfigCobrancaAcordo {
  acordo.vagas = vagasFromListagens(acordo.listagens);
  acordo.vagasCif = vagasCifFromListagens(acordo.listagens);
  return acordo;
}

/** FOB derivado: Total − CIF (compat: CIF nulo ⇒ FOB 0). */
export function vagasFobDoMes(
  total: number | null | undefined,
  cif: number | null | undefined
): number | null {
  if (total == null || !Number.isFinite(Number(total))) return null;
  const cifEfetivo = cif == null || !Number.isFinite(Number(cif)) ? Number(total) : Number(cif);
  return Math.max(0, Number(total) - cifEfetivo);
}

/** Reconstrói listagens agrupando meses com a mesma quantidade total + CIF. */
export function listagensAPartirDasVagas(
  vagas: ConfigCobrancaVagasAcordo | undefined,
  vagasCif?: ConfigCobrancaVagasAcordo | undefined
): ConfigCobrancaAcordoListagem[] {
  if (!vagas) return [];
  const grupos = new Map<string, { quantidade: number; quantidadeCif: number | null; meses: ConfigCobrancaMesAcordo[] }>();
  for (const mes of MESES_ACORDO) {
    const qtd = vagas[mes.mes];
    if (qtd == null || !Number.isFinite(Number(qtd))) continue;
    const cifRaw = vagasCif?.[mes.mes];
    const cif =
      cifRaw == null || !Number.isFinite(Number(cifRaw)) ? Number(qtd) : Number(cifRaw);
    const chave = `${Number(qtd)}|${cif}`;
    const atual = grupos.get(chave) ?? {
      quantidade: Number(qtd),
      quantidadeCif: cif,
      meses: []
    };
    atual.meses.push(mes.mes);
    grupos.set(chave, atual);
  }
  return [...grupos.values()].map((g) => novaListagemAcordo(g.meses, g.quantidade, g.quantidadeCif));
}

export function normalizarAcordo(origem: ConfigCobrancaAcordo | null | undefined): ConfigCobrancaAcordo {
  const acordo = cloneAcordo(origem ?? acordoVazio());
  if (!acordo.listagens.length) {
    acordo.listagens = listagensAPartirDasVagas(acordo.vagas, acordo.vagasCif);
  }
  podarMesesForaDoPeriodoAcordo(acordo);
  acordo.vagas = vagasFromListagens(acordo.listagens);
  acordo.vagasCif = vagasCifFromListagens(acordo.listagens);
  return acordo;
}

export function acordoTemConteudo(acordo: ConfigCobrancaAcordo | null | undefined): boolean {
  if (!acordo) return false;
  if (acordo.dataInicio || acordo.dataFim) return true;
  if ((acordo.listagens ?? []).some((l) => l.meses.length > 0)) return true;
  return MESES_ACORDO.some((m) => acordo.vagas?.[m.mes] != null);
}

/**
 * Meses (1–12) cobertos pelo período ISO `yyyy-MM-dd` (granularidade mensal: o dia é ignorado).
 * Ex.: 01/02/2026–31/03/2026 → [2, 3]. Sem período válido → [].
 * Períodos multi-ano deduplicam o mês (domínio sem ano na vaga).
 */
export function mesesNoPeriodoAcordo(
  dataInicio: string | null | undefined,
  dataFim: string | null | undefined
): ConfigCobrancaMesAcordo[] {
  const ini = parseIsoAnoMes(dataInicio);
  const fim = parseIsoAnoMes(dataFim);
  if (!ini || !fim) return [];
  if (fim.ano < ini.ano || (fim.ano === ini.ano && fim.mes < ini.mes)) return [];

  const vistos = new Set<ConfigCobrancaMesAcordo>();
  let y = ini.ano;
  let m = ini.mes;
  // Limite defensivo: no máx. 120 meses (10 anos).
  for (let i = 0; i < 120; i++) {
    vistos.add(m as ConfigCobrancaMesAcordo);
    if (y === fim.ano && m === fim.mes) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return [...vistos].sort((a, b) => a - b);
}

function parseIsoAnoMes(iso: string | null | undefined): { ano: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (!Number.isFinite(ano) || mes < 1 || mes > 12) return null;
  return { ano, mes };
}

/**
 * Remove das listagens meses fora do período.
 * Sem período válido, não altera as listagens (evita apagar rascunho incompleto).
 */
export function podarMesesForaDoPeriodoAcordo(acordo: ConfigCobrancaAcordo): void {
  const noPeriodo = mesesNoPeriodoAcordo(acordo.dataInicio, acordo.dataFim);
  if (!noPeriodo.length) return;
  const permitidos = new Set(noPeriodo);
  for (const listagem of acordo.listagens ?? []) {
    listagem.meses = listagem.meses.filter((mes) => permitidos.has(mes));
  }
}

export function mesesOcupados(acordo: ConfigCobrancaAcordo, listagemId?: string): Set<number> {
  const usados = new Set<number>();
  for (const listagem of acordo.listagens ?? []) {
    if (listagemId && listagem.id === listagemId) continue;
    for (const mes of listagem.meses) usados.add(mes);
  }
  return usados;
}

export function toggleMesListagem(
  listagem: ConfigCobrancaAcordoListagem,
  mes: ConfigCobrancaMesAcordo,
  ocupados: Set<number>
): void {
  if (ocupados.has(mes)) return;
  const idx = listagem.meses.indexOf(mes);
  if (idx >= 0) listagem.meses = listagem.meses.filter((m) => m !== mes);
  else listagem.meses = [...listagem.meses, mes].sort((a, b) => a - b);
}

export function tipoCobrancaExcedenteLabel(tipo: TipoCobrancaExcedente | number | null | undefined): string {
  const found = TIPO_COBRANCA_EXCEDENTE_OPCOES.find((o) => o.value === Number(tipo));
  return found?.label ?? '—';
}

export function resumoVagasAcordo(vagas: ConfigCobrancaVagasAcordo | undefined): string {
  if (!vagas) return '—';
  const partes = MESES_ACORDO.filter((m) => vagas[m.mes] != null).map((m) => `${m.label} ${vagas[m.mes]}`);
  return partes.length ? partes.join(' · ') : '—';
}

const MESES_NOME_COMPLETO: Record<ConfigCobrancaMesAcordo, string> = {
  1: 'Janeiro',
  2: 'Fevereiro',
  3: 'Março',
  4: 'Abril',
  5: 'Maio',
  6: 'Junho',
  7: 'Julho',
  8: 'Agosto',
  9: 'Setembro',
  10: 'Outubro',
  11: 'Novembro',
  12: 'Dezembro'
};

/** Rótulo de período da listagem (ex.: "Junho" ou "Julho a novembro"). */
export function rotuloPeriodoListagemAcordo(meses: ConfigCobrancaMesAcordo[] | undefined): string {
  const sorted = [...(meses ?? [])].sort((a, b) => a - b);
  if (!sorted.length) return '—';
  if (sorted.length === 1) return MESES_NOME_COMPLETO[sorted[0]!];
  const consecutivo = sorted.every((mes, idx) => idx === 0 || mes === sorted[idx - 1]! + 1);
  if (consecutivo) {
    const ini = MESES_NOME_COMPLETO[sorted[0]!];
    const fim = MESES_NOME_COMPLETO[sorted[sorted.length - 1]!];
    return `${ini} a ${fim.toLowerCase()}`;
  }
  return sorted.map((mes) => MESES_ACORDO.find((m) => m.mes === mes)?.label ?? mes).join(', ');
}

export function distribuicaoListagemAcordo(listagem: ConfigCobrancaAcordoListagem): string {
  if (listagem.quantidade == null) return '—';
  const cif =
    listagem.quantidadeCif == null || !Number.isFinite(Number(listagem.quantidadeCif))
      ? Number(listagem.quantidade)
      : Number(listagem.quantidadeCif);
  const fob = vagasFobDoMes(listagem.quantidade, listagem.quantidadeCif) ?? 0;
  return `CIF ${cif} / FOB ${fob}`;
}

export function resumoListagemAcordo(listagem: ConfigCobrancaAcordoListagem): string {
  const meses = listagem.meses
    .slice()
    .sort((a, b) => a - b)
    .map((mes) => MESES_ACORDO.find((m) => m.mes === mes)?.label ?? mes)
    .join(', ');
  const qtd = listagem.quantidade == null ? '—' : String(listagem.quantidade);
  const cif =
    listagem.quantidadeCif == null ? qtd : String(listagem.quantidadeCif);
  const fob =
    listagem.quantidade == null
      ? '—'
      : String(
          vagasFobDoMes(listagem.quantidade, listagem.quantidadeCif) ?? 0
        );
  return meses ? `${meses} · ${qtd} (CIF ${cif} / FOB ${fob})` : 'Sem meses selecionados';
}

export function formatarPeriodoAcordo(inicio: string | null | undefined, fim: string | null | undefined): string {
  if (!inicio && !fim) return 'Período não informado';
  return `${formatarIsoBr(inicio)} a ${formatarIsoBr(fim)}`;
}

export interface ValidacaoAcordoOptions {
  /** Quando false, ignora custo/tipo de excedente (preenchidos na aba Valores). Default: true. */
  validarExcedente?: boolean;
}

export function mensagensValidacaoAcordo(
  acordo: ConfigCobrancaAcordo,
  options: ValidacaoAcordoOptions = {}
): string[] {
  const validarExcedente = options.validarExcedente !== false;
  const m: string[] = [];
  const inicio = acordo.dataInicio?.trim() || '';
  const fim = acordo.dataFim?.trim() || '';
  if (!inicio || !fim) m.push('Informe a data de início e a data de fim do acordo.');
  else if (inicio > fim) m.push('A data de início do acordo deve ser anterior ou igual à data de fim.');

  const mesesPermitidos =
    inicio && fim && inicio <= fim ? new Set(mesesNoPeriodoAcordo(inicio, fim)) : null;

  const listagens = (acordo.listagens ?? []).filter((l) => l.meses.length > 0);
  if (!listagens.length) {
    m.push('Selecione os meses e a quantidade de vagas de ao menos uma listagem.');
  } else {
    const usados = new Set<number>();
    for (const listagem of listagens) {
      if (!isQuantidadeVagasValida(listagem.quantidade)) {
        m.push('Informe a quantidade de vagas de cada listagem (zero ou mais).');
        break;
      }
      const total = Number(listagem.quantidade);
      if (listagem.quantidadeCif != null) {
        if (!isQuantidadeVagasValida(listagem.quantidadeCif)) {
          m.push('Vagas CIF devem ser um número inteiro ≥ 0.');
          break;
        }
        if (Number(listagem.quantidadeCif) > total) {
          m.push('Vagas CIF não podem ultrapassar o total da listagem.');
          break;
        }
      }
      for (const mes of listagem.meses) {
        if (mesesPermitidos && !mesesPermitidos.has(mes)) {
          m.push('Os meses da listagem devem estar dentro do período do acordo.');
          return m;
        }
        if (usados.has(mes)) {
          m.push('O mesmo mês não pode aparecer em mais de uma listagem.');
          return m;
        }
        usados.add(mes);
      }
    }
  }

  if (validarExcedente) {
    if (acordo.custoExcedente == null || !Number.isFinite(Number(acordo.custoExcedente)) || Number(acordo.custoExcedente) <= 0) {
      m.push('Informe o custo do excedente maior que zero.');
    }
    if (!acordo.tipoCobrancaExcedente) m.push('Selecione o tipo de cobrança do excedente.');
  }
  return m;
}

function formatarIsoBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}
