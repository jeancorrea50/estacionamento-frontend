import {
  ConfiguracaoCobrancaAcordo,
  ConfiguracaoCobrancaOutput,
  ConfiguracaoCobrancaPostInput,
  ConfiguracaoCobrancaSearchOutput,
  ModalidadeCobranca,
  RegraFechamento,
  StatusConfiguracaoCobranca,
  TipoCobrancaExcedente
} from '../models/configuracao-cobranca.models';

export { ModalidadeCobranca, RegraFechamento, StatusConfiguracaoCobranca };
import type {
  ConfigCobrancaAcordo,
  ConfigCobrancaListaItem,
  ConfigCobrancaModalidade,
  ConfigCobrancaServicoKey,
  ConfigCobrancaServicos,
  ConfigCobrancaStatus
} from '../pages/faturamento-page/config-cobranca/faturamento-config-cobranca.types';
import { acordoVazio, listagensAPartirDasVagas, MESES_ACORDO, vagasFromListagens } from '../pages/faturamento-page/config-cobranca/config-cobranca-acordo.util';

/** Rótulo de cada serviço adicional, usado no resumo textual e nas telas de visualização. */
export const SERVICO_LABELS: Record<ConfigCobrancaServicoKey, string> = {
  lavagem: 'Lavagem',
  pernoite: 'Pernoite',
  extras: 'Serviços extras',
  beneficio: 'Benefício por abastecimento'
};

export const SERVICO_KEYS: ConfigCobrancaServicoKey[] = ['lavagem', 'pernoite', 'extras', 'beneficio'];

export function servicosVazios(): ConfigCobrancaServicos {
  return {
    lavagem: { habilitado: false, valor: null },
    pernoite: { habilitado: false, valor: null },
    extras: { habilitado: false, valor: null },
    beneficio: { habilitado: false, valor: null }
  };
}

export function servicosCobradosLabel(servicos: ConfigCobrancaServicos): string {
  const parts = SERVICO_KEYS.filter((k) => servicos[k]?.habilitado).map((k) => SERVICO_LABELS[k]);
  return parts.length ? parts.join(', ') : '—';
}

export function modalidadeLabel(value: ModalidadeCobranca | number): ConfigCobrancaModalidade {
  switch (Number(value)) {
    case ModalidadeCobranca.Diaria:
      return 'Diária';
    case ModalidadeCobranca.Semanal:
      return 'Semanal';
    case ModalidadeCobranca.Quinzenal:
      return 'Quinzenal';
    case ModalidadeCobranca.Personalizado:
      return 'Personalizada';
    case ModalidadeCobranca.Acordo:
      return 'Acordo';
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
    case 'Personalizada':
      return ModalidadeCobranca.Personalizado;
    case 'Acordo':
      return ModalidadeCobranca.Acordo;
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
    if (diaFechamento && diaFechamento > 0) {
      const dia = String(diaFechamento).padStart(2, '0');
      return `Todo dia ${dia}`;
    }
    return 'Dia fixo';
  }
  return 'Último dia do mês';
}

const DIA_SEMANA_NOMES: Record<number, string> = {
  1: 'domingo',
  2: 'segunda-feira',
  3: 'terça-feira',
  4: 'quarta-feira',
  5: 'quinta-feira',
  6: 'sexta-feira',
  7: 'sábado'
};

/** Resumo de fechamento/cobrança para listagem (Semanal usa dia 1–7). */
export function fechamentoResumoLabel(
  modalidade: ModalidadeCobranca | number,
  regra: RegraFechamento | number,
  diaFechamento: number | null | undefined
): string {
  if (Number(modalidade) === ModalidadeCobranca.Diaria) {
    return '—';
  }
  if (Number(modalidade) === ModalidadeCobranca.Semanal) {
    const nome = diaFechamento != null ? DIA_SEMANA_NOMES[diaFechamento] : undefined;
    return nome ? `Toda ${nome}` : 'Semanal';
  }
  return regraFechamentoLabel(regra, diaFechamento);
}

/** Rótulo amigável da modalidade para badges na listagem. */
export function modalidadeBadgeLabel(modalidade: ConfigCobrancaModalidade | string): string {
  return modalidade === 'Personalizada' ? 'Data personalizada' : modalidade;
}

export function prazoVencimentoLabel(dias: number): string {
  if (!dias || dias <= 0) return '—';
  return dias === 1 ? '1 dia após fechamento' : `${dias} dias após fechamento`;
}

function prazoVencimentoResumoLabel(modalidade: ModalidadeCobranca | number, dias: number): string {
  if (Number(modalidade) === ModalidadeCobranca.Diaria) return '—';
  return prazoVencimentoLabel(dias);
}

/** Normaliza o `DateTime` do backend para `yyyy-MM-dd`, formato aceito por `input[type=date]`. */
export function toIsoDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (match) return match[1];
  }
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return null;
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function numeroOuNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function acordoFromDto(dto: ConfiguracaoCobrancaOutput): ConfigCobrancaAcordo {
  const acordo = acordoVazio();
  for (const mes of MESES_ACORDO) {
    acordo.vagas[mes.mes] = numeroOuNull(dto[mes.api as keyof ConfiguracaoCobrancaOutput]);
  }
  acordo.custoExcedente = numeroOuNull(dto.custoExcedente);
  acordo.tipoCobrancaExcedente = Number(dto.tipoCobrancaExcedente) || TipoCobrancaExcedente.PorVaga;
  acordo.dataInicio = toIsoDate(dto.dataInicioAcordo);
  acordo.dataFim = toIsoDate(dto.dataFimAcordo);
  acordo.listagens = listagensAPartirDasVagas(acordo.vagas);
  return acordo;
}

function acordoToPayload(item: ConfigCobrancaListaItem, isAcordo: boolean): ConfiguracaoCobrancaAcordo {
  const vazio = acordoVazio();
  const origem = isAcordo ? (item.acordo ?? vazio) : vazio;
  const vagas = isAcordo
    ? origem.listagens?.length
      ? vagasFromListagens(origem.listagens)
      : origem.vagas
    : vazio.vagas;
  return {
    vagasJaneiro: vagas[1] ?? null,
    vagasFevereiro: vagas[2] ?? null,
    vagasMarco: vagas[3] ?? null,
    vagasAbril: vagas[4] ?? null,
    vagasMaio: vagas[5] ?? null,
    vagasJunho: vagas[6] ?? null,
    vagasJulho: vagas[7] ?? null,
    vagasAgosto: vagas[8] ?? null,
    vagasSetembro: vagas[9] ?? null,
    vagasOutubro: vagas[10] ?? null,
    vagasNovembro: vagas[11] ?? null,
    vagasDezembro: vagas[12] ?? null,
    custoExcedente: isAcordo ? origem.custoExcedente : null,
    tipoCobrancaExcedente: isAcordo ? origem.tipoCobrancaExcedente : null,
    dataInicioAcordo: isAcordo ? origem.dataInicio || null : null,
    dataFimAcordo: isAcordo ? origem.dataFim || null : null
  };
}

export function servicosFromOutput(dto: ConfiguracaoCobrancaOutput): ConfigCobrancaServicos {
  return {
    lavagem: { habilitado: !!dto.cobrarLavagem, valor: numeroOuNull(dto.valorLavagem) },
    pernoite: { habilitado: !!dto.cobrarPernoite, valor: numeroOuNull(dto.valorPernoite) },
    extras: { habilitado: !!dto.cobrarServicosExtras, valor: numeroOuNull(dto.valorServicosExtras) },
    beneficio: {
      habilitado: !!dto.considerarBeneficioAbastecimento,
      valor: numeroOuNull(dto.valorBeneficioAbastecimento)
    }
  };
}

export function mapSearchToListaItem(dto: ConfiguracaoCobrancaSearchOutput): ConfigCobrancaListaItem {
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
    fechamento: fechamentoResumoLabel(dto.modalidadeCobranca, dto.regraFechamento, dto.diaFechamento),
    prazoVencimentoDias: dto.prazoVencimentoDias,
    prazoVencimento: prazoVencimentoResumoLabel(dto.modalidadeCobranca, dto.prazoVencimentoDias),
    dataCobranca: null,
    envioAutomatico: dto.envioAutomaticoEmail,
    gerarFaturaAutomaticamente: dto.gerarFaturaAutomaticamente,
    emailFinanceiro: dto.emailFinanceiro?.trim() || null,
    status: statusLabel(dto.status),
    multaAplicar: false,
    multaPercentual: 0,
    jurosAplicar: false,
    jurosPercentual: 0,
    aplicarDescontoFixo: false,
    valorDescontoFixo: 0,
    aplicarAcrescimoFixo: false,
    valorAcrescimoFixo: 0,
    valorEstacionamento: dto.valorEstacionamento,
    pagamentoParcial: false,
    servicos: servicosVazios(),
    servicosCobrados: '—',
    parcial: true,
    acordo: acordoVazio()
  };
}

export function mapOutputToListaItem(dto: ConfiguracaoCobrancaOutput): ConfigCobrancaListaItem {
  const servicos = servicosFromOutput(dto);
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
    fechamento: fechamentoResumoLabel(dto.modalidadeCobranca, dto.regraFechamento, dto.diaFechamento),
    prazoVencimentoDias: dto.prazoVencimentoDias,
    prazoVencimento: prazoVencimentoResumoLabel(dto.modalidadeCobranca, dto.prazoVencimentoDias),
    dataCobranca: toIsoDate(dto.dataCobranca),
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
    valorEstacionamento: dto.valorEstacionamento,
    pagamentoParcial: !!dto.permitirPagamentoParcial,
    servicos,
    servicosCobrados: servicosCobradosLabel(servicos),
    parcial: false,
    acordo: acordoFromDto(dto)
  };
}

export function mapListaItemToPostInput(item: ConfigCobrancaListaItem): ConfiguracaoCobrancaPostInput {
  const modalidadeCobranca = item.modalidadeCobranca || modalidadeFromLabel(item.modalidade);
  const isAcordo = modalidadeCobranca === ModalidadeCobranca.Acordo;
  const isDiaria = modalidadeCobranca === ModalidadeCobranca.Diaria;
  const dia = isDiaria
    ? null
    : item.regraFechamento === RegraFechamento.DiaFixo && item.diaFechamento && item.diaFechamento > 0
      ? item.diaFechamento
      : null;
  const servicos = item.servicos ?? servicosVazios();
  const acordo = acordoToPayload(item, isAcordo);

  return {
    id: item.id > 0 ? item.id : 0,
    transportadoraId: item.transportadoraId,
    status: statusFromLabel(item.status),
    modalidadeCobranca,
    diaFechamento: dia,
    regraFechamento: isDiaria
      ? RegraFechamento.UltimoDiaDoMes
      : item.regraFechamento || RegraFechamento.UltimoDiaDoMes,
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
    valorEstacionamento: item.valorEstacionamento,
    dataCobranca: modalidadeCobranca === ModalidadeCobranca.Personalizado ? item.dataCobranca : null,
    ...acordo,
    cobrarLavagem: servicos.lavagem.habilitado,
    valorLavagem: servicos.lavagem.habilitado ? servicos.lavagem.valor : null,
    cobrarPernoite: servicos.pernoite.habilitado,
    valorPernoite: servicos.pernoite.habilitado ? servicos.pernoite.valor : null,
    cobrarServicosExtras: servicos.extras.habilitado,
    valorServicosExtras: servicos.extras.habilitado ? servicos.extras.valor : null,
    considerarBeneficioAbastecimento: servicos.beneficio.habilitado,
    valorBeneficioAbastecimento: servicos.beneficio.habilitado ? servicos.beneficio.valor : null,
    // Agrupamento foi removido do cadastro; o contrato mantém as colunas, sempre falsas.
    agruparPorPlaca: false,
    agruparPorPeriodo: false,
    agruparPorTransportadora: false
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

export function pickNumberOrNull(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in row)) continue;
    return numeroOuNull(row[key]);
  }
  return null;
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
    diaFechamento: pickNumberOrNull(row, 'diaFechamento', 'DiaFechamento'),
    regraFechamento: pickNumber(row, 'regraFechamento', 'RegraFechamento') as RegraFechamento,
    prazoVencimentoDias: pickNumber(row, 'prazoVencimentoDias', 'PrazoVencimentoDias'),
    valorEstacionamento: pickNumberOrNull(row, 'valorEstacionamento', 'ValorEstacionamento'),
    emailFinanceiro: pickStringOrNull(row, 'emailFinanceiro', 'EmailFinanceiro'),
    envioAutomaticoEmail: pickBool(row, 'envioAutomaticoEmail', 'EnvioAutomaticoEmail'),
    gerarFaturaAutomaticamente: pickBool(row, 'gerarFaturaAutomaticamente', 'GerarFaturaAutomaticamente'),
    dataCriacao: pickString(row, 'dataCriacao', 'DataCriacao')
  };
}

export function mapRawOutput(row: Record<string, unknown>, fallbackId = 0): ConfiguracaoCobrancaOutput {
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
    diaFechamento: pickNumberOrNull(row, 'diaFechamento', 'DiaFechamento'),
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
    valorEstacionamento: pickNumberOrNull(row, 'valorEstacionamento', 'ValorEstacionamento'),
    dataCobranca: pickStringOrNull(row, 'dataCobranca', 'DataCobranca'),
    cobrarLavagem: pickBool(row, 'cobrarLavagem', 'CobrarLavagem'),
    valorLavagem: pickNumberOrNull(row, 'valorLavagem', 'ValorLavagem'),
    cobrarPernoite: pickBool(row, 'cobrarPernoite', 'CobrarPernoite'),
    valorPernoite: pickNumberOrNull(row, 'valorPernoite', 'ValorPernoite'),
    cobrarServicosExtras: pickBool(row, 'cobrarServicosExtras', 'CobrarServicosExtras'),
    valorServicosExtras: pickNumberOrNull(row, 'valorServicosExtras', 'ValorServicosExtras'),
    considerarBeneficioAbastecimento: pickBool(
      row,
      'considerarBeneficioAbastecimento',
      'ConsiderarBeneficioAbastecimento'
    ),
    valorBeneficioAbastecimento: pickNumberOrNull(
      row,
      'valorBeneficioAbastecimento',
      'ValorBeneficioAbastecimento'
    ),
    agruparPorPlaca: pickBool(row, 'agruparPorPlaca', 'AgruparPorPlaca'),
    agruparPorPeriodo: pickBool(row, 'agruparPorPeriodo', 'AgruparPorPeriodo'),
    agruparPorTransportadora: pickBool(row, 'agruparPorTransportadora', 'AgruparPorTransportadora'),
    vagasJaneiro: pickNumberOrNull(row, 'vagasJaneiro', 'VagasJaneiro'),
    vagasFevereiro: pickNumberOrNull(row, 'vagasFevereiro', 'VagasFevereiro'),
    vagasMarco: pickNumberOrNull(row, 'vagasMarco', 'VagasMarco'),
    vagasAbril: pickNumberOrNull(row, 'vagasAbril', 'VagasAbril'),
    vagasMaio: pickNumberOrNull(row, 'vagasMaio', 'VagasMaio'),
    vagasJunho: pickNumberOrNull(row, 'vagasJunho', 'VagasJunho'),
    vagasJulho: pickNumberOrNull(row, 'vagasJulho', 'VagasJulho'),
    vagasAgosto: pickNumberOrNull(row, 'vagasAgosto', 'VagasAgosto'),
    vagasSetembro: pickNumberOrNull(row, 'vagasSetembro', 'VagasSetembro'),
    vagasOutubro: pickNumberOrNull(row, 'vagasOutubro', 'VagasOutubro'),
    vagasNovembro: pickNumberOrNull(row, 'vagasNovembro', 'VagasNovembro'),
    vagasDezembro: pickNumberOrNull(row, 'vagasDezembro', 'VagasDezembro'),
    custoExcedente: pickNumberOrNull(row, 'custoExcedente', 'CustoExcedente'),
    tipoCobrancaExcedente: pickNumberOrNull(row, 'tipoCobrancaExcedente', 'TipoCobrancaExcedente') as
      | TipoCobrancaExcedente
      | null,
    dataInicioAcordo: toIsoDate(pickStringOrNull(row, 'dataInicioAcordo', 'DataInicioAcordo')),
    dataFimAcordo: toIsoDate(pickStringOrNull(row, 'dataFimAcordo', 'DataFimAcordo'))
  };
}
