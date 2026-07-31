import type {
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
 * Modalidades ofertadas na tela, em ordem de exibição. `Semanal` continua no
 * contrato para registros antigos, mas não pode ser mantida ao salvar: sem
 * opção correspondente, o usuário precisa reescolher.
 */
export const MODALIDADE_OPCOES: { value: ConfigCobrancaModalidade; label: string; icon: string }[] = [
  { value: 'Diária', label: 'Cobrança diária', icon: 'today' },
  { value: 'Mensal', label: 'Cobrança mensal', icon: 'calendar_month' },
  { value: 'Quinzenal', label: 'Cobrança quinzenal', icon: 'calendar_view_week' },
  { value: 'Personalizada', label: 'Cobrança em data personalizada', icon: 'event' }
];

const MODALIDADES_OFERTADAS: ConfigCobrancaModalidade[] = MODALIDADE_OPCOES.map((o) => o.value);

const VALOR_COBRANCA_LABELS: Partial<Record<ConfigCobrancaModalidade, string>> = {
  Diária: 'Valor da diária',
  Mensal: 'Valor da mensalidade',
  Quinzenal: 'Valor da quinzena',
  Personalizada: 'Valor da cobrança'
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
  estacionamentoId: number;
  modalidade: ConfigCobrancaModalidade | '';
  dataCobranca: string | null;
  regraFechamento: number;
  diaFechamento: number | null;
  prazoVencimentoDias: number;
  email: string;
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
}): { ok: true } | { ok: false; mensagens: string[] } {
  const m: string[] = [];

  if (!input.transportadoraId || input.transportadoraId <= 0) m.push('Informe a transportadora.');
  if (!input.estacionamentoId || input.estacionamentoId <= 0) m.push('Informe o estacionamento.');
  if (!input.modalidade || !MODALIDADES_OFERTADAS.includes(input.modalidade)) {
    m.push('Selecione a regra de cobrança.');
  }

  if (input.modalidade === 'Personalizada' && !input.dataCobranca?.trim()) {
    m.push('Informe a data da cobrança para a cobrança em data personalizada.');
  }

  if (!input.regraFechamento) m.push('Informe a regra de fechamento.');
  if (
    input.regraFechamento === RegraFechamento.DiaFixo &&
    (!input.diaFechamento || input.diaFechamento < 1 || input.diaFechamento > 31)
  ) {
    m.push('Informe o dia de fechamento entre 1 e 31.');
  }
  if (!input.prazoVencimentoDias || input.prazoVencimentoDias <= 0) {
    m.push('Informe o prazo de vencimento em dias (maior que zero).');
  }

  if (!input.email?.trim()) m.push('Informe o e-mail financeiro.');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
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
  estacionamentoId: number;
  estacionamentoNome: string;
  status: ConfigCobrancaStatus;
  modalidade: ConfigCobrancaModalidade;
  dataCobranca: string | null;
  regraFechamento: number;
  diaFechamento: number | null;
  prazoVencimentoDias: number;
  email: string;
  envioAuto: boolean;
  gerarAuto: boolean;
  pagamentoParcial: boolean;
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
}): ConfigCobrancaListaItem {
  const emailNorm = campos.email?.trim() || null;
  let status: ConfigCobrancaStatus = campos.status === 'Inativa' ? 'Inativa' : 'Ativa';
  if (!emailNorm) status = 'Sem e-mail financeiro';

  const modalidadeCobranca = modalidadeFromLabel(campos.modalidade);
  const dia =
    campos.regraFechamento === RegraFechamento.DiaFixo && campos.diaFechamento && campos.diaFechamento > 0
      ? campos.diaFechamento
      : null;

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
    estacionamentoId: campos.estacionamentoId,
    transportadora: campos.transportadoraNome.trim(),
    estacionamento: campos.estacionamentoNome.trim(),
    modalidade: campos.modalidade,
    modalidadeCobranca,
    diaFechamento: dia,
    regraFechamento: campos.regraFechamento || RegraFechamento.UltimoDiaDoMes,
    fechamento: regraFechamentoLabel(campos.regraFechamento, dia),
    prazoVencimentoDias: Number(campos.prazoVencimentoDias) || 0,
    prazoVencimento: prazoVencimentoLabel(Number(campos.prazoVencimentoDias) || 0),
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
    pagamentoParcial: campos.pagamentoParcial,
    servicos,
    servicosCobrados: servicosCobradosLabel(servicos)
  };
}

export { SERVICO_KEYS, SERVICO_LABELS };
