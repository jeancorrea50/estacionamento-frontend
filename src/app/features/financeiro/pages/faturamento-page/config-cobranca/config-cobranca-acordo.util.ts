import { TipoCobrancaExcedente } from '../../../models/configuracao-cobranca.models';
import type {
  ConfigCobrancaAcordo,
  ConfigCobrancaAcordoListagem,
  ConfigCobrancaMesAcordo,
  ConfigCobrancaVagasAcordo
} from './faturamento-config-cobranca.types';

export const MESES_ACORDO: { mes: ConfigCobrancaMesAcordo; label: string; api: string; apiPascal: string }[] = [
  { mes: 1, label: 'Jan', api: 'vagasJaneiro', apiPascal: 'VagasJaneiro' },
  { mes: 2, label: 'Fev', api: 'vagasFevereiro', apiPascal: 'VagasFevereiro' },
  { mes: 3, label: 'Mar', api: 'vagasMarco', apiPascal: 'VagasMarco' },
  { mes: 4, label: 'Abr', api: 'vagasAbril', apiPascal: 'VagasAbril' },
  { mes: 5, label: 'Mai', api: 'vagasMaio', apiPascal: 'VagasMaio' },
  { mes: 6, label: 'Jun', api: 'vagasJunho', apiPascal: 'VagasJunho' },
  { mes: 7, label: 'Jul', api: 'vagasJulho', apiPascal: 'VagasJulho' },
  { mes: 8, label: 'Ago', api: 'vagasAgosto', apiPascal: 'VagasAgosto' },
  { mes: 9, label: 'Set', api: 'vagasSetembro', apiPascal: 'VagasSetembro' },
  { mes: 10, label: 'Out', api: 'vagasOutubro', apiPascal: 'VagasOutubro' },
  { mes: 11, label: 'Nov', api: 'vagasNovembro', apiPascal: 'VagasNovembro' },
  { mes: 12, label: 'Dez', api: 'vagasDezembro', apiPascal: 'VagasDezembro' }
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
  quantidade: number | null = null
): ConfigCobrancaAcordoListagem {
  listagemSeq += 1;
  return {
    id: `lst-${Date.now()}-${listagemSeq}`,
    meses: [...meses],
    quantidade
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
      quantidade: l.quantidade
    })),
    vagas: { ...vagasAcordoVazias(), ...origem.vagas },
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

export function sincronizarVagasDoAcordo(acordo: ConfigCobrancaAcordo): ConfigCobrancaAcordo {
  acordo.vagas = vagasFromListagens(acordo.listagens);
  return acordo;
}

/** Reconstrói listagens agrupando meses com a mesma quantidade (resposta da API). */
export function listagensAPartirDasVagas(vagas: ConfigCobrancaVagasAcordo | undefined): ConfigCobrancaAcordoListagem[] {
  if (!vagas) return [];
  const grupos = new Map<number, ConfigCobrancaMesAcordo[]>();
  for (const mes of MESES_ACORDO) {
    const qtd = vagas[mes.mes];
    if (qtd == null || !Number.isFinite(Number(qtd))) continue;
    const chave = Number(qtd);
    const atual = grupos.get(chave) ?? [];
    atual.push(mes.mes);
    grupos.set(chave, atual);
  }
  return [...grupos.entries()].map(([quantidade, meses]) => novaListagemAcordo(meses, quantidade));
}

export function normalizarAcordo(origem: ConfigCobrancaAcordo | null | undefined): ConfigCobrancaAcordo {
  const acordo = cloneAcordo(origem ?? acordoVazio());
  if (!acordo.listagens.length) {
    acordo.listagens = listagensAPartirDasVagas(acordo.vagas);
  }
  acordo.vagas = vagasFromListagens(acordo.listagens);
  return acordo;
}

export function acordoTemConteudo(acordo: ConfigCobrancaAcordo | null | undefined): boolean {
  if (!acordo) return false;
  if (acordo.dataInicio || acordo.dataFim) return true;
  if ((acordo.listagens ?? []).some((l) => l.meses.length > 0)) return true;
  return MESES_ACORDO.some((m) => acordo.vagas?.[m.mes] != null);
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

export function resumoListagemAcordo(listagem: ConfigCobrancaAcordoListagem): string {
  const meses = listagem.meses
    .slice()
    .sort((a, b) => a - b)
    .map((mes) => MESES_ACORDO.find((m) => m.mes === mes)?.label ?? mes)
    .join(', ');
  const qtd = listagem.quantidade == null ? '—' : String(listagem.quantidade);
  return meses ? `${meses} · ${qtd} vaga(s)` : 'Sem meses selecionados';
}

export function formatarPeriodoAcordo(inicio: string | null | undefined, fim: string | null | undefined): string {
  if (!inicio && !fim) return 'Período não informado';
  return `${formatarIsoBr(inicio)} até ${formatarIsoBr(fim)}`;
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
      for (const mes of listagem.meses) {
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
