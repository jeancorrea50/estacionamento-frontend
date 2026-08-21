import { acordoVazio, mensagensValidacaoAcordo, normalizarAcordo } from './config-cobranca-acordo.util';
import type {
  ConfigCobrancaAcordo,
  ConfigCobrancaListaItem,
  ConfigCobrancaModalidade,
  ConfigCobrancaServicoKey,
  ConfigCobrancaServicos,
  ConfigCobrancaStatus
} from './faturamento-config-cobranca.types';
import {
  ModalidadeCobranca,
  RegraFechamento,
  SERVICO_KEYS,
  SERVICO_LABELS,
  modalidadeFromLabel,
  prazoVencimentoLabel,
  regraFechamentoLabel,
  servicosCobradosLabel,
  servicosVazios,
  statusFromLabel
} from '../../../mappers/configuracao-cobranca.mapper';

export { ModalidadeCobranca, RegraFechamento, servicosVazios, statusFromLabel };

/**
 * Modalidades ofertadas na tela, em ordem de exibição.
 * `diaFechamento` (1–31) = dia da cobrança mensal / fechamento dia fixo;
 * `diaFechamento` (1–7) = dia da semana na modalidade Semanal (1=Domingo … 7=Sábado).
 */
export const MODALIDADE_OPCOES: { value: ConfigCobrancaModalidade; label: string; icon: string }[] = [
  { value: 'Diária', label: 'Diária', icon: 'today' },
  { value: 'Semanal', label: 'Semanal', icon: 'date_range' },
  { value: 'Mensal', label: 'Mensal', icon: 'calendar_month' },
  { value: 'Quinzenal', label: 'Quinzenal', icon: 'calendar_view_week' },
  { value: 'Personalizada', label: 'Data personalizada', icon: 'event' },
  { value: 'Acordo', label: 'Acordo', icon: 'handshake' }
];

const MODALIDADES_OFERTADAS: ConfigCobrancaModalidade[] = MODALIDADE_OPCOES.map((o) => o.value);

/** Cobrança diária não usa fechamento nem prazo de vencimento da fatura. */
export function modalidadeExigeVencimentoFatura(
  modalidade: ConfigCobrancaModalidade | '' | null | undefined
): boolean {
  return modalidade !== 'Diária';
}

/** Dia da semana persistido em `diaFechamento` quando a modalidade é Semanal. */
export type DiaSemanaCobranca = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIA_SEMANA_OPCOES: { value: DiaSemanaCobranca; label: string }[] = [
  { value: 1, label: 'Domingo' },
  { value: 2, label: 'Segunda-feira' },
  { value: 3, label: 'Terça-feira' },
  { value: 4, label: 'Quarta-feira' },
  { value: 5, label: 'Quinta-feira' },
  { value: 6, label: 'Sexta-feira' },
  { value: 7, label: 'Sábado' }
];

export function diaSemanaLabel(dia: number | null | undefined): string {
  const found = DIA_SEMANA_OPCOES.find((d) => d.value === dia);
  return found?.label ?? '—';
}

export function isDiaSemanaValido(dia: number | null | undefined): dia is DiaSemanaCobranca {
  return dia != null && Number.isInteger(dia) && dia >= 1 && dia <= 7;
}

export function isDiaMensalValido(dia: number | null | undefined): boolean {
  return dia != null && Number.isInteger(dia) && dia >= 1 && dia <= 31;
}

const VALOR_COBRANCA_LABELS: Partial<Record<ConfigCobrancaModalidade, string>> = {
  Diária: 'Valor da diária',
  Semanal: 'Valor da semana',
  Mensal: 'Valor Estadia',
  Quinzenal: 'Valor da quinzena',
  Personalizada: 'Valor da cobrança',
  Acordo: 'Valor da cobrança'
};

export function valorCobrancaLabel(modalidade: ConfigCobrancaModalidade | ''): string {
  return modalidade ? VALOR_COBRANCA_LABELS[modalidade] ?? 'Valor da cobrança' : 'Valor da cobrança';
}

/** Rótulo do campo de valor de cada serviço adicional. */
export const SERVICO_VALOR_LABELS: Record<ConfigCobrancaServicoKey, string> = {
  lavagem: 'Valor da lavagem',
  pernoite: 'Valor da pernoite',
  extras: 'Valor do serviço extra',
  beneficio: 'Valor do benefício'
};

export function servicosFromItem(item: ConfigCobrancaListaItem | undefined): ConfigCobrancaServicos {
  const base = servicosVazios();
  if (!item?.servicos) return base;
  for (const key of SERVICO_KEYS) {
    const atual = item.servicos[key];
    if (!atual) continue;
    base[key] = { habilitado: !!atual.habilitado, valor: atual.valor ?? null };
  }
  return base;
}

/** Valor monetário válido para cobrança/serviço (> 0). */
export function valorInformado(valor: number | null | undefined): boolean {
  return valor != null && Number.isFinite(Number(valor)) && Number(valor) > 0;
}

export function validarFormularioConfig(input: {
  transportadoraId: number;
  modalidade: ConfigCobrancaModalidade | '';
  dataCobranca: string | null;
  regraFechamento: number;
  diaFechamento: number | null;
  prazoVencimentoDias: number;
  email: string;
  /** Quando false, a regra de cobrança fica bloqueada e não exige dia/data/fechamento. */
  gerarFaturaAutomaticamente?: boolean;
  /** Quando false, o e-mail financeiro não é exigido. */
  envioAutomaticoEmail?: boolean;
  multa: boolean;
  multaPct: number;
  juros: boolean;
  jurosPct: number;
  descFixo: boolean;
  descValor: number;
  acresFixo: boolean;
  acresValor: number;
  valorEstacionamento: number | null;
  servicos: ConfigCobrancaServicos;
  acordo?: ConfigCobrancaAcordo;
}): { ok: true } | { ok: false; mensagens: string[] } {
  const m: string[] = [];
  const regraAtiva = input.gerarFaturaAutomaticamente !== false;

  if (!input.transportadoraId || input.transportadoraId <= 0) m.push('Informe a transportadora.');
  if (!input.modalidade || !MODALIDADES_OFERTADAS.includes(input.modalidade)) {
    m.push('Selecione a regra de cobrança.');
  }

  if (regraAtiva) {
    if (input.modalidade === 'Personalizada' && !input.dataCobranca?.trim()) {
      m.push('Informe a data da cobrança para a cobrança em data personalizada.');
    }

    if (input.modalidade === 'Acordo') {
      m.push(...mensagensValidacaoAcordo(input.acordo ?? acordoVazio()));
    }

    if (input.modalidade === 'Mensal' && !isDiaMensalValido(input.diaFechamento)) {
      m.push('Informe o dia da cobrança mensal (1 a 31).');
    }

    if (input.modalidade === 'Semanal' && !isDiaSemanaValido(input.diaFechamento)) {
      m.push('Selecione o dia da semana da cobrança.');
    }

    if (modalidadeExigeVencimentoFatura(input.modalidade)) {
      if (!input.regraFechamento) m.push('Informe a regra de fechamento.');
      if (
        input.modalidade !== 'Mensal' &&
        input.modalidade !== 'Semanal' &&
        input.regraFechamento === RegraFechamento.DiaFixo &&
        !isDiaMensalValido(input.diaFechamento)
      ) {
        m.push('Informe o dia de fechamento entre 1 e 31.');
      }
      if (!input.prazoVencimentoDias || input.prazoVencimentoDias <= 0) {
        m.push('Informe o prazo de vencimento em dias (maior que zero).');
      }
    }
  }

  if (input.envioAutomaticoEmail !== false) {
    if (!input.email?.trim()) m.push('Informe o e-mail financeiro.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      m.push('E-mail financeiro inválido.');
    }
  } else if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    m.push('E-mail financeiro inválido.');
  }

  if (!valorInformado(input.valorEstacionamento)) {
    m.push(`Informe o ${valorCobrancaLabel(input.modalidade).toLowerCase()} maior que zero.`);
  }

  if (input.multa && !valorInformado(input.multaPct)) m.push('Informe o percentual de multa maior que zero.');
  if (input.juros && !valorInformado(input.jurosPct)) m.push('Informe o percentual de juros maior que zero.');
  if (input.descFixo && !valorInformado(input.descValor)) m.push('Informe o valor do desconto fixo maior que zero.');
  if (input.acresFixo && !valorInformado(input.acresValor)) {
    m.push('Informe o valor do acréscimo fixo maior que zero.');
  }

  for (const key of SERVICO_KEYS) {
    const servico = input.servicos?.[key];
    if (servico?.habilitado && !valorInformado(servico.valor)) {
      m.push(`Informe o ${SERVICO_VALOR_LABELS[key].toLowerCase()} maior que zero.`);
    }
  }

  return m.length ? { ok: false, mensagens: m } : { ok: true };
}

export function montarRegistroDoFormulario(campos: {
  id: number;
  transportadoraId: number;
  transportadoraNome: string;
  estacionamentoId?: number;
  estacionamentoNome?: string;
  status: ConfigCobrancaStatus;
  modalidade: ConfigCobrancaModalidade;
  dataCobranca: string | null;
  regraFechamento: number;
  diaFechamento: number | null;
  prazoVencimentoDias: number;
  email: string;
  envioAuto: boolean;
  gerarAuto: boolean;
  multa: boolean;
  multaPct: number;
  juros: boolean;
  jurosPct: number;
  descFixo: boolean;
  descValor: number;
  acresFixo: boolean;
  acresValor: number;
  valorEstacionamento: number | null;
  servicos: ConfigCobrancaServicos;
  acordo?: ConfigCobrancaAcordo;
}): ConfigCobrancaListaItem {
  const emailNorm = campos.email?.trim() || null;
  let status: ConfigCobrancaStatus = campos.status === 'Inativa' ? 'Inativa' : 'Ativa';
  if (campos.envioAuto && !emailNorm) status = 'Sem e-mail financeiro';

  const modalidadeCobranca = modalidadeFromLabel(campos.modalidade);

  // Mensal/Semanal usam diaFechamento com regra Dia fixo (contrato atual sem campo dedicado).
  // Diária não fecha ciclo: campos de vencimento são neutralizados no payload.
  let regraFechamento = campos.regraFechamento || RegraFechamento.UltimoDiaDoMes;
  let dia: number | null = null;
  if (campos.modalidade === 'Diária') {
    regraFechamento = RegraFechamento.UltimoDiaDoMes;
    dia = null;
  } else if (campos.modalidade === 'Mensal') {
    regraFechamento = RegraFechamento.DiaFixo;
    dia = isDiaMensalValido(campos.diaFechamento) ? Number(campos.diaFechamento) : null;
  } else if (campos.modalidade === 'Semanal') {
    regraFechamento = RegraFechamento.DiaFixo;
    dia = isDiaSemanaValido(campos.diaFechamento) ? Number(campos.diaFechamento) : null;
  } else if (
    regraFechamento === RegraFechamento.DiaFixo &&
    isDiaMensalValido(campos.diaFechamento)
  ) {
    dia = Number(campos.diaFechamento);
  }

  const fechamento =
    campos.modalidade === 'Diária'
      ? '—'
      : campos.modalidade === 'Semanal'
        ? `Toda ${diaSemanaLabel(dia).toLowerCase()}`
        : regraFechamentoLabel(regraFechamento, dia);

  // Serviço desligado não leva valor adiante, evitando resíduo no payload.
  const servicos = servicosVazios();
  for (const key of SERVICO_KEYS) {
    const atual = campos.servicos?.[key];
    if (!atual?.habilitado) continue;
    servicos[key] = { habilitado: true, valor: atual.valor ?? null };
  }

  return {
    id: campos.id,
    transportadoraId: campos.transportadoraId,
    estacionamentoId: campos.estacionamentoId ?? 0,
    transportadora: campos.transportadoraNome.trim(),
    estacionamento: (campos.estacionamentoNome ?? '').trim() || '—',
    modalidade: campos.modalidade,
    modalidadeCobranca,
    diaFechamento: dia,
    regraFechamento,
    fechamento,
    prazoVencimentoDias: Number(campos.prazoVencimentoDias) || 0,
    prazoVencimento:
      campos.modalidade === 'Diária' ? '—' : prazoVencimentoLabel(Number(campos.prazoVencimentoDias) || 0),
    dataCobranca: modalidadeCobranca === ModalidadeCobranca.Personalizado ? campos.dataCobranca || null : null,
    envioAutomatico: campos.envioAuto,
    gerarFaturaAutomaticamente: campos.gerarAuto,
    emailFinanceiro: emailNorm,
    status,
    multaAplicar: campos.multa,
    multaPercentual: campos.multa ? Number(campos.multaPct) || 0 : 0,
    jurosAplicar: campos.juros,
    jurosPercentual: campos.juros ? Number(campos.jurosPct) || 0 : 0,
    aplicarDescontoFixo: campos.descFixo,
    valorDescontoFixo: campos.descFixo ? Number(campos.descValor) || 0 : 0,
    aplicarAcrescimoFixo: campos.acresFixo,
    valorAcrescimoFixo: campos.acresFixo ? Number(campos.acresValor) || 0 : 0,
    valorEstacionamento: campos.valorEstacionamento,
    pagamentoParcial: false,
    servicos,
    servicosCobrados: servicosCobradosLabel(servicos),
    acordo: campos.modalidade === 'Acordo' ? normalizarAcordo(campos.acordo) : acordoVazio()
  };
}

export { SERVICO_KEYS, SERVICO_LABELS };
