import {
  ConfiguracaoCobrancaOutput,
  ConfiguracaoCobrancaPostInput,
  ConfiguracaoCobrancaRegraDto,
  ConfiguracaoCobrancaSearchOutput,
  ModalidadeCobranca,
  RegraFechamento,
  StatusConfiguracaoCobranca
} from '../models/configuracao-cobranca.models';

export { ModalidadeCobranca, RegraFechamento, StatusConfiguracaoCobranca };
import type {
  ConfigCobrancaListaItem,
  ConfigCobrancaModalidade,
  ConfigCobrancaStatus
} from '../pages/faturamento-page/config-cobranca/faturamento-config-cobranca.types';

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

export function modalidadeLabel(value: ModalidadeCobranca | number): ConfigCobrancaModalidade {
  switch (Number(value)) {
    case ModalidadeCobranca.Diaria:
      return 'Diária';
    case ModalidadeCobranca.Semanal:
      return 'Semanal';
    case ModalidadeCobranca.Quinzenal:
      return 'Quinzenal';
    case ModalidadeCobranca.Mensal:
    default:
      return 'Mensal';
  }
}

export function modalidadeFromLabel(label: ConfigCobrancaModalidade | string): ModalidadeCobranca {
  switch (label) {
    case 'Diária':
      return ModalidadeCobranca.Diaria;
    case 'Semanal':
      return ModalidadeCobranca.Semanal;
    case 'Quinzenal':
      return ModalidadeCobranca.Quinzenal;
    case 'Mensal':
    default:
      return ModalidadeCobranca.Mensal;
  }
}

export function statusLabel(value: StatusConfiguracaoCobranca | number): ConfigCobrancaStatus {
  return Number(value) === StatusConfiguracaoCobranca.Inativa ? 'Inativa' : 'Ativa';
}

export function statusFromLabel(label: ConfigCobrancaStatus | string): StatusConfiguracaoCobranca {
  return label === 'Inativa' ? StatusConfiguracaoCobranca.Inativa : StatusConfiguracaoCobranca.Ativa;
}

export function regraFechamentoLabel(
  regra: RegraFechamento | number,
  diaFechamento: number | null | undefined
): string {
  if (Number(regra) === RegraFechamento.DiaFixo) {
    return diaFechamento && diaFechamento > 0 ? `Dia ${diaFechamento}` : 'Dia fixo';
  }
  return 'Último dia do mês';
}

export function prazoVencimentoLabel(dias: number): string {
  if (!dias || dias <= 0) return '—';
  return dias === 1 ? '1 dia após fechamento' : `${dias} dias após fechamento`;
}

export function regraToServicosChecks(regra: ConfiguracaoCobrancaRegraDto | null | undefined): ServicosChecks {
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

export function servicosChecksToRegra(
  checks: ServicosChecks,
  regraId = 0
): ConfiguracaoCobrancaRegraDto {
  return {
    id: regraId,
    cobrarDiaria: !!checks.diaria,
    cobrarSemanal: !!checks.semanal,
    cobrarQuinzenal: !!checks.quinzenal,
    cobrarMensal: !!checks.mensal,
    cobrarDataPersonalizada: !!checks.personal,
    cobrarLavagem: !!checks.lavagem,
    cobrarPernoite: !!checks.pernoite,
    cobrarServicosExtras: !!checks.extras,
    considerarBeneficioAbastecimento: !!checks.beneficio
  };
}

export function agrupamentoToChecks(item: {
  agruparPorPlaca: boolean;
  agruparPorPeriodo: boolean;
  agruparPorTransportadora: boolean;
}): AgrupamentoChecks {
  return {
    placa: !!item.agruparPorPlaca,
    periodo: !!item.agruparPorPeriodo,
    transportadora: !!item.agruparPorTransportadora
  };
}

export function mapSearchToListaItem(dto: ConfiguracaoCobrancaSearchOutput): ConfigCobrancaListaItem {
  const modalidade = modalidadeLabel(dto.modalidadeCobranca);
  const status = statusLabel(dto.status);
  return {
    id: dto.id,
    transportadoraId: dto.transportadoraId,
    estacionamentoId: dto.estacionamentoId,
    transportadora: dto.transportadoraNome || '—',
    estacionamento: dto.estacionamentoNome || '—',
    modalidade,
    modalidadeCobranca: dto.modalidadeCobranca,
    diaFechamento: null,
    regraFechamento: RegraFechamento.UltimoDiaDoMes,
    fechamento: '—',
    prazoVencimentoDias: 0,
    prazoVencimento: '—',
    envioAutomatico: false,
    gerarFaturaAutomaticamente: false,
    emailFinanceiro: dto.emailFinanceiro?.trim() || null,
    status,
    multaAplicar: false,
    multaPercentual: 0,
    jurosAplicar: false,
    jurosPercentual: 0,
    aplicarDescontoFixo: false,
    valorDescontoFixo: 0,
    aplicarAcrescimoFixo: false,
    valorAcrescimoFixo: 0,
    valorEstadia: dto.valorEstadia,
    pagamentoParcial: false,
    servicosCobrados: '—',
    agrupamentoFatura: '—',
    agruparPorPlaca: false,
    agruparPorPeriodo: false,
    agruparPorTransportadora: false,
    regra: emptyRegra(),
    parcial: true
  };
}

export function mapOutputToListaItem(dto: ConfiguracaoCobrancaOutput): ConfigCobrancaListaItem {
  const serv = regraToServicosChecks(dto.regra);
  const agr = agrupamentoToChecks(dto);
  return {
    id: dto.id,
    transportadoraId: dto.transportadoraId,
    estacionamentoId: dto.estacionamentoId,
    transportadora: dto.transportadoraNome || '—',
    estacionamento: dto.estacionamentoNome || '—',
    modalidade: modalidadeLabel(dto.modalidadeCobranca),
    modalidadeCobranca: dto.modalidadeCobranca,
    diaFechamento: dto.diaFechamento,
    regraFechamento: dto.regraFechamento,
    fechamento: regraFechamentoLabel(dto.regraFechamento, dto.diaFechamento),
    prazoVencimentoDias: dto.prazoVencimentoDias,
    prazoVencimento: prazoVencimentoLabel(dto.prazoVencimentoDias),
    envioAutomatico: !!dto.envioAutomaticoEmail,
    gerarFaturaAutomaticamente: !!dto.gerarFaturaAutomaticamente,
    emailFinanceiro: dto.emailFinanceiro?.trim() || null,
    status: statusLabel(dto.status),
    multaAplicar: !!dto.aplicarMulta,
    multaPercentual: Number(dto.multaPercentual) || 0,
    jurosAplicar: !!dto.aplicarJuros,
    jurosPercentual: Number(dto.jurosPercentual) || 0,
    aplicarDescontoFixo: !!dto.aplicarDescontoFixo,
    valorDescontoFixo: Number(dto.valorDescontoFixo) || 0,
    aplicarAcrescimoFixo: !!dto.aplicarAcrescimoFixo,
    valorAcrescimoFixo: Number(dto.valorAcrescimoFixo) || 0,
    valorEstadia: dto.valorEstadia,
    pagamentoParcial: !!dto.permitirPagamentoParcial,
    servicosCobrados: servicosCobradosFromChecks(serv),
    agrupamentoFatura: agrupamentoFromChecks(agr),
    agruparPorPlaca: !!dto.agruparPorPlaca,
    agruparPorPeriodo: !!dto.agruparPorPeriodo,
    agruparPorTransportadora: !!dto.agruparPorTransportadora,
    regra: dto.regra
      ? {
          id: dto.regra.id,
          cobrarDiaria: !!dto.regra.cobrarDiaria,
          cobrarSemanal: !!dto.regra.cobrarSemanal,
          cobrarQuinzenal: !!dto.regra.cobrarQuinzenal,
          cobrarMensal: !!dto.regra.cobrarMensal,
          cobrarDataPersonalizada: !!dto.regra.cobrarDataPersonalizada,
          cobrarLavagem: !!dto.regra.cobrarLavagem,
          cobrarPernoite: !!dto.regra.cobrarPernoite,
          cobrarServicosExtras: !!dto.regra.cobrarServicosExtras,
          considerarBeneficioAbastecimento: !!dto.regra.considerarBeneficioAbastecimento
        }
      : emptyRegra(),
    parcial: false
  };
}

export function mapListaItemToPostInput(item: ConfigCobrancaListaItem): ConfiguracaoCobrancaPostInput {
  const dia =
    item.regraFechamento === RegraFechamento.DiaFixo && item.diaFechamento && item.diaFechamento > 0
      ? item.diaFechamento
      : null;

  return {
    id: item.id > 0 ? item.id : 0,
    transportadoraId: item.transportadoraId,
    estacionamentoId: item.estacionamentoId,
    status: statusFromLabel(item.status),
    modalidadeCobranca: item.modalidadeCobranca || modalidadeFromLabel(item.modalidade),
    diaFechamento: dia,
    regraFechamento: item.regraFechamento || RegraFechamento.UltimoDiaDoMes,
    prazoVencimentoDias: item.prazoVencimentoDias,
    emailFinanceiro: (item.emailFinanceiro ?? '').trim(),
    envioAutomaticoEmail: !!item.envioAutomatico,
    gerarFaturaAutomaticamente: !!item.gerarFaturaAutomaticamente,
    permitirPagamentoParcial: !!item.pagamentoParcial,
    aplicarMulta: !!item.multaAplicar,
    multaPercentual: item.multaAplicar ? Number(item.multaPercentual) || 0 : 0,
    aplicarJuros: !!item.jurosAplicar,
    jurosPercentual: item.jurosAplicar ? Number(item.jurosPercentual) || 0 : 0,
    aplicarDescontoFixo: !!item.aplicarDescontoFixo,
    valorDescontoFixo: item.aplicarDescontoFixo ? Number(item.valorDescontoFixo) || 0 : 0,
    aplicarAcrescimoFixo: !!item.aplicarAcrescimoFixo,
    valorAcrescimoFixo: item.aplicarAcrescimoFixo ? Number(item.valorAcrescimoFixo) || 0 : 0,
    valorEstadia: item.valorEstadia,
    agruparPorPlaca: !!item.agruparPorPlaca,
    agruparPorPeriodo: !!item.agruparPorPeriodo,
    agruparPorTransportadora: !!item.agruparPorTransportadora,
    regra: {
      id: item.regra?.id ?? 0,
      cobrarDiaria: !!item.regra?.cobrarDiaria,
      cobrarSemanal: !!item.regra?.cobrarSemanal,
      cobrarQuinzenal: !!item.regra?.cobrarQuinzenal,
      cobrarMensal: !!item.regra?.cobrarMensal,
      cobrarDataPersonalizada: !!item.regra?.cobrarDataPersonalizada,
      cobrarLavagem: !!item.regra?.cobrarLavagem,
      cobrarPernoite: !!item.regra?.cobrarPernoite,
      cobrarServicosExtras: !!item.regra?.cobrarServicosExtras,
      considerarBeneficioAbastecimento: !!item.regra?.considerarBeneficioAbastecimento
    }
  };
}

export function emptyRegra(): ConfiguracaoCobrancaRegraDto {
  return {
    id: 0,
    cobrarDiaria: false,
    cobrarSemanal: false,
    cobrarQuinzenal: false,
    cobrarMensal: true,
    cobrarDataPersonalizada: false,
    cobrarLavagem: false,
    cobrarPernoite: false,
    cobrarServicosExtras: false,
    considerarBeneficioAbastecimento: false
  };
}

export function pickNumber(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

export function pickString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

export function pickStringOrNull(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value == null) {
      if (key in row) return null;
      continue;
    }
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function pickBool(row: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    if (key in row) return Boolean(row[key]);
  }
  return false;
}

export function unwrapResult(body: unknown): unknown {
  let cur: unknown = body;
  for (let i = 0; i < 3; i++) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const obj = cur as Record<string, unknown>;
    if (obj['result'] != null) {
      cur = obj['result'];
      continue;
    }
    if (obj['Result'] != null) {
      cur = obj['Result'];
      continue;
    }
    break;
  }
  return cur;
}

export function mapRawSearchItem(row: Record<string, unknown>): ConfiguracaoCobrancaSearchOutput {
  return {
    id: pickNumber(row, 'id', 'Id'),
    transportadoraId: pickNumber(row, 'transportadoraId', 'TransportadoraId'),
    transportadoraNome: pickString(row, 'transportadoraNome', 'TransportadoraNome'),
    estacionamentoId: pickNumber(row, 'estacionamentoId', 'EstacionamentoId'),
    estacionamentoNome: pickString(row, 'estacionamentoNome', 'EstacionamentoNome'),
    status: pickNumber(row, 'status', 'Status') as StatusConfiguracaoCobranca,
    modalidadeCobranca: pickNumber(row, 'modalidadeCobranca', 'ModalidadeCobranca') as ModalidadeCobranca,
    valorEstadia: (() => {
      const raw = row['valorEstadia'] ?? row['ValorEstadia'];
      if (raw == null || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    })(),
    emailFinanceiro: pickStringOrNull(row, 'emailFinanceiro', 'EmailFinanceiro'),
    dataCriacao: pickString(row, 'dataCriacao', 'DataCriacao')
  };
}

export function mapRawRegra(row: Record<string, unknown> | null | undefined): ConfiguracaoCobrancaRegraDto | null {
  if (!row) return null;
  return {
    id: pickNumber(row, 'id', 'Id'),
    configuracaoCobrancaId: pickNumber(row, 'configuracaoCobrancaId', 'ConfiguracaoCobrancaId') || undefined,
    cobrarDiaria: pickBool(row, 'cobrarDiaria', 'CobrarDiaria'),
    cobrarSemanal: pickBool(row, 'cobrarSemanal', 'CobrarSemanal'),
    cobrarQuinzenal: pickBool(row, 'cobrarQuinzenal', 'CobrarQuinzenal'),
    cobrarMensal: pickBool(row, 'cobrarMensal', 'CobrarMensal'),
    cobrarDataPersonalizada: pickBool(row, 'cobrarDataPersonalizada', 'CobrarDataPersonalizada'),
    cobrarLavagem: pickBool(row, 'cobrarLavagem', 'CobrarLavagem'),
    cobrarPernoite: pickBool(row, 'cobrarPernoite', 'CobrarPernoite'),
    cobrarServicosExtras: pickBool(row, 'cobrarServicosExtras', 'CobrarServicosExtras'),
    considerarBeneficioAbastecimento: pickBool(
      row,
      'considerarBeneficioAbastecimento',
      'ConsiderarBeneficioAbastecimento'
    )
  };
}

export function mapRawOutput(row: Record<string, unknown>, fallbackId = 0): ConfiguracaoCobrancaOutput {
  const regraRaw = row['regra'] ?? row['Regra'];
  const regra =
    regraRaw && typeof regraRaw === 'object' && !Array.isArray(regraRaw)
      ? mapRawRegra(regraRaw as Record<string, unknown>)
      : null;

  const transportadoraRaw = row['transportadora'] ?? row['Transportadora'];
  const estacionamentoRaw = row['estacionamento'] ?? row['Estacionamento'];
  const transportadoraNome =
    pickString(row, 'transportadoraNome', 'TransportadoraNome') ||
    (transportadoraRaw && typeof transportadoraRaw === 'object'
      ? pickString(transportadoraRaw as Record<string, unknown>, 'descricao', 'Descricao', 'razaoSocial', 'RazaoSocial')
      : '');
  const estacionamentoNome =
    pickString(row, 'estacionamentoNome', 'EstacionamentoNome') ||
    (estacionamentoRaw && typeof estacionamentoRaw === 'object'
      ? pickString(estacionamentoRaw as Record<string, unknown>, 'descricao', 'Descricao', 'nomeFantasia', 'NomeFantasia')
      : '');

  const diaRaw = row['diaFechamento'] ?? row['DiaFechamento'];
  const diaFechamento =
    diaRaw == null || diaRaw === ''
      ? null
      : Number.isFinite(Number(diaRaw))
        ? Number(diaRaw)
        : null;

  const valorEstadiaRaw = row['valorEstadia'] ?? row['ValorEstadia'];
  const valorEstadia =
    valorEstadiaRaw == null || valorEstadiaRaw === ''
      ? null
      : Number.isFinite(Number(valorEstadiaRaw))
        ? Number(valorEstadiaRaw)
        : null;

  return {
    id: pickNumber(row, 'id', 'Id') || fallbackId,
    dataCriacao: pickString(row, 'dataCriacao', 'DataCriacao') || undefined,
    dataAtualizacao: pickStringOrNull(row, 'dataAtualizacao', 'DataAtualizacao'),
    transportadoraId: pickNumber(row, 'transportadoraId', 'TransportadoraId'),
    transportadoraNome,
    estacionamentoId: pickNumber(row, 'estacionamentoId', 'EstacionamentoId'),
    estacionamentoNome,
    status: pickNumber(row, 'status', 'Status') as StatusConfiguracaoCobranca,
    modalidadeCobranca: pickNumber(row, 'modalidadeCobranca', 'ModalidadeCobranca') as ModalidadeCobranca,
    diaFechamento,
    regraFechamento: pickNumber(row, 'regraFechamento', 'RegraFechamento') as RegraFechamento,
    prazoVencimentoDias: pickNumber(row, 'prazoVencimentoDias', 'PrazoVencimentoDias'),
    emailFinanceiro: pickStringOrNull(row, 'emailFinanceiro', 'EmailFinanceiro'),
    envioAutomaticoEmail: pickBool(row, 'envioAutomaticoEmail', 'EnvioAutomaticoEmail'),
    gerarFaturaAutomaticamente: pickBool(row, 'gerarFaturaAutomaticamente', 'GerarFaturaAutomaticamente'),
    permitirPagamentoParcial: pickBool(row, 'permitirPagamentoParcial', 'PermitirPagamentoParcial'),
    aplicarMulta: pickBool(row, 'aplicarMulta', 'AplicarMulta'),
    multaPercentual: pickNumber(row, 'multaPercentual', 'MultaPercentual'),
    aplicarJuros: pickBool(row, 'aplicarJuros', 'AplicarJuros'),
    jurosPercentual: pickNumber(row, 'jurosPercentual', 'JurosPercentual'),
    aplicarDescontoFixo: pickBool(row, 'aplicarDescontoFixo', 'AplicarDescontoFixo'),
    valorDescontoFixo: pickNumber(row, 'valorDescontoFixo', 'ValorDescontoFixo'),
    aplicarAcrescimoFixo: pickBool(row, 'aplicarAcrescimoFixo', 'AplicarAcrescimoFixo'),
    valorAcrescimoFixo: pickNumber(row, 'valorAcrescimoFixo', 'ValorAcrescimoFixo'),
    valorEstadia,
    agruparPorPlaca: pickBool(row, 'agruparPorPlaca', 'AgruparPorPlaca'),
    agruparPorPeriodo: pickBool(row, 'agruparPorPeriodo', 'AgruparPorPeriodo'),
    agruparPorTransportadora: pickBool(row, 'agruparPorTransportadora', 'AgruparPorTransportadora'),
    regra
  };
}
