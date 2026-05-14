import type { ConfigCobrancaListaItem, ConfigCobrancaModalidade, ConfigCobrancaStatus } from './faturamento-config-cobranca.types';

export interface ServicosChecks {
  diaria: boolean;
  semanal: boolean;
  quinzenal: boolean;
  mensal: boolean;
  personal: boolean;
  lavagem: boolean;
  pernoite: boolean;
  extras: boolean;
  beneficio: boolean;
}

export interface AgrupamentoChecks {
  placa: boolean;
  periodo: boolean;
  transportadora: boolean;
}

export function servicosCobradosFromChecks(c: ServicosChecks): string {
  const parts: string[] = [];
  if (c.diaria) parts.push('Diária');
  if (c.semanal) parts.push('Semanal');
  if (c.quinzenal) parts.push('Quinzenal');
  if (c.mensal) parts.push('Mensal');
  if (c.personal) parts.push('Personalizado');
  if (c.lavagem) parts.push('Lavagem');
  if (c.pernoite) parts.push('Pernoite');
  if (c.extras) parts.push('Extras');
  if (c.beneficio) parts.push('Benefícios por abastecimento');
  return parts.length ? parts.join(', ') : '—';
}

export function agrupamentoFromChecks(c: AgrupamentoChecks): string {
  const parts: string[] = [];
  if (c.placa) parts.push('placa');
  if (c.periodo) parts.push('período');
  if (c.transportadora) parts.push('transportadora');
  if (!parts.length) return 'Sem agrupamento definido';
  return `Por ${parts.join(', ')}`;
}

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

export function validarFormularioConfig(input: {
  transportadora: string;
  estacionamento: string;
  modalidade: ConfigCobrancaModalidade | '';
  fechamento: string;
  prazoVencimento: string;
  email: string;
  precisaEmailFin: boolean;
  multa: boolean;
  multaPct: number;
  juros: boolean;
  jurosPct: number;
}): { ok: true } | { ok: false; mensagens: string[] } {
  const m: string[] = [];
  if (!input.transportadora?.trim()) m.push('Informe a transportadora.');
  if (!input.estacionamento?.trim()) m.push('Informe o estacionamento.');
  if (!input.modalidade) m.push('Informe a modalidade de cobrança.');
  if (!input.fechamento?.trim()) m.push('Informe a regra de fechamento.');
  if (!input.prazoVencimento?.trim()) m.push('Informe o prazo de vencimento.');
  if (input.precisaEmailFin && !input.email?.trim()) {
    m.push('Informe o e-mail financeiro (obrigatório com envio ou geração automática).');
  }
  if (input.multa && (input.multaPct === undefined || input.multaPct === null || Number(input.multaPct) <= 0)) {
    m.push('Informe o percentual de multa maior que zero.');
  }
  if (input.juros && (input.jurosPct === undefined || input.jurosPct === null || Number(input.jurosPct) <= 0)) {
    m.push('Informe o percentual de juros maior que zero.');
  }
  return m.length ? { ok: false, mensagens: m } : { ok: true };
}

export function montarRegistroDoFormularioExpansao(
  id: string,
  campos: {
    transportadora: string;
    estacionamento: string;
    status: ConfigCobrancaStatus;
    modalidade: ConfigCobrancaModalidade;
    fechamento: string;
    prazoVencimento: string;
    email: string;
    envioAuto: boolean;
    gerarAuto: boolean;
    pagamentoParcial: boolean;
    multa: boolean;
    multaPct: number;
    juros: boolean;
    jurosPct: number;
    serv: ServicosChecks;
    agr: AgrupamentoChecks;
  }
): ConfigCobrancaListaItem {
  const emailNorm = campos.email?.trim() || null;
  let status: ConfigCobrancaStatus = campos.status;
  if (!emailNorm) status = 'Sem e-mail financeiro';
  else if (status === 'Sem e-mail financeiro') status = 'Ativa';

  return {
    id,
    transportadora: campos.transportadora.trim(),
    estacionamento: campos.estacionamento.trim(),
    modalidade: campos.modalidade,
    fechamento: campos.fechamento.trim(),
    prazoVencimento: campos.prazoVencimento.trim(),
    envioAutomatico: campos.envioAuto || campos.gerarAuto,
    emailFinanceiro: emailNorm,
    status,
    multaAplicar: campos.multa,
    multaPercentual: campos.multa ? Number(campos.multaPct) || 0 : 0,
    jurosAplicar: campos.juros,
    jurosPercentual: campos.juros ? Number(campos.jurosPct) || 0 : 0,
    pagamentoParcial: campos.pagamentoParcial,
    servicosCobrados: servicosCobradosFromChecks(campos.serv),
    agrupamentoFatura: agrupamentoFromChecks(campos.agr)
  };
}
