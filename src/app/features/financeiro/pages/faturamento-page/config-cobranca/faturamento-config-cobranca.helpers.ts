import type {
  ConfigCobrancaListaItem,
  ConfigCobrancaModalidade,
  ConfigCobrancaStatus
} from './faturamento-config-cobranca.types';
import {
  ModalidadeCobranca,
  RegraFechamento,
  emptyRegra,
  modalidadeFromLabel,
  prazoVencimentoLabel,
  regraFechamentoLabel,
  servicosChecksToRegra,
  statusFromLabel,
  agrupamentoFromChecks,
  servicosCobradosFromChecks,
  type AgrupamentoChecks,
  type ServicosChecks
} from '../../../mappers/configuracao-cobranca.mapper';

export type { AgrupamentoChecks, ServicosChecks };
export { ModalidadeCobranca, RegraFechamento, emptyRegra, statusFromLabel, agrupamentoFromChecks, servicosCobradosFromChecks };

export function checksFromServicos(s: string): ServicosChecks {
  return {
    diaria: s.includes('Diária'),
    semanal: s.includes('Semanal'),
    quinzenal: s.includes('Quinzenal'),
    mensal: s.includes('Mensal'),
    personal: s.includes('Personalizado'),
    lavagem: s.includes('Lavagem'),
    pernoite: s.includes('Pernoite'),
    extras: s.includes('Extras'),
    beneficio: s.includes('Benef') || s.includes('benefício')
  };
}

export function checksFromAgrupamento(a: string): AgrupamentoChecks {
  return {
    placa: a.toLowerCase().includes('placa'),
    periodo: a.toLowerCase().includes('período') || a.toLowerCase().includes('periodo'),
    transportadora: a.toLowerCase().includes('transportadora')
  };
}

export function checksFromRegraFlags(regra: ConfigCobrancaListaItem['regra']): ServicosChecks {
  return {
    diaria: !!regra?.cobrarDiaria,
    semanal: !!regra?.cobrarSemanal,
    quinzenal: !!regra?.cobrarQuinzenal,
    mensal: !!regra?.cobrarMensal,
    personal: !!regra?.cobrarDataPersonalizada,
    lavagem: !!regra?.cobrarLavagem,
    pernoite: !!regra?.cobrarPernoite,
    extras: !!regra?.cobrarServicosExtras,
    beneficio: !!regra?.considerarBeneficioAbastecimento
  };
}

export function validarFormularioConfig(input: {
  transportadoraId: number;
  estacionamentoId: number;
  modalidade: ConfigCobrancaModalidade | '';
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
  valorEstadia: number | null;
  serv: ServicosChecks;
}): { ok: true } | { ok: false; mensagens: string[] } {
  const m: string[] = [];
  if (!input.transportadoraId || input.transportadoraId <= 0) m.push('Informe a transportadora.');
  if (!input.estacionamentoId || input.estacionamentoId <= 0) m.push('Informe o estacionamento.');
  if (!input.modalidade) m.push('Informe a modalidade de cobrança.');
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

  const temRegra =
    input.serv.diaria ||
    input.serv.semanal ||
    input.serv.quinzenal ||
    input.serv.mensal ||
    input.serv.personal ||
    input.serv.lavagem ||
    input.serv.pernoite ||
    input.serv.extras ||
    input.serv.beneficio;
  if (!temRegra) m.push('Selecione ao menos uma regra de cobrança.');

  if (input.valorEstadia != null && Number.isFinite(Number(input.valorEstadia)) && Number(input.valorEstadia) < 0) {
    m.push('Valor da estadia não pode ser negativo.');
  }

  if (input.multa && (input.multaPct === undefined || input.multaPct === null || Number(input.multaPct) <= 0)) {
    m.push('Informe o percentual de multa maior que zero.');
  }
  if (input.juros && (input.jurosPct === undefined || input.jurosPct === null || Number(input.jurosPct) <= 0)) {
    m.push('Informe o percentual de juros maior que zero.');
  }
  if (input.descFixo && (!input.descValor || Number(input.descValor) <= 0)) {
    m.push('Informe o valor do desconto fixo maior que zero.');
  }
  if (input.acresFixo && (!input.acresValor || Number(input.acresValor) <= 0)) {
    m.push('Informe o valor do acréscimo fixo maior que zero.');
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
  valorEstadia: number | null;
  regraId: number;
  serv: ServicosChecks;
  agr: AgrupamentoChecks;
}): ConfigCobrancaListaItem {
  const emailNorm = campos.email?.trim() || null;
  let status: ConfigCobrancaStatus = campos.status === 'Inativa' ? 'Inativa' : 'Ativa';
  if (!emailNorm) status = 'Sem e-mail financeiro';

  const regra = servicosChecksToRegra(campos.serv, campos.regraId);
  const modalidadeCobranca = modalidadeFromLabel(campos.modalidade);
  const dia =
    campos.regraFechamento === RegraFechamento.DiaFixo && campos.diaFechamento && campos.diaFechamento > 0
      ? campos.diaFechamento
      : null;

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
    valorEstadia: campos.valorEstadia,
    pagamentoParcial: campos.pagamentoParcial,
    servicosCobrados: servicosCobradosFromChecks(campos.serv),
    agrupamentoFatura: agrupamentoFromChecks(campos.agr),
    agruparPorPlaca: campos.agr.placa,
    agruparPorPeriodo: campos.agr.periodo,
    agruparPorTransportadora: campos.agr.transportadora,
    regra
  };
}
