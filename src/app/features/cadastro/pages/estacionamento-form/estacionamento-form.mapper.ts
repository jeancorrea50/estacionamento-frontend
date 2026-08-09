/**
 * Mapeia o valor do formulário para o payload esperado pelo backend (Estacionamento/Gravar e Alterar).
 * Backend: resposanvelLegal, responsavelCpf, capacidadeVeiculo, tamanhoTerreno, tipoCobranca (0-3), etc.
 */

import type { EstacionamentoPayloadMergeContext } from '../../models/estacionamento.dto';
import { normalizeChavePixForApi } from '../../utils/chave-pix-format';

export interface FormValue {
  id: number;
  /** Legado / opcional: no fluxo atual `descricao` do estacionamento é derivada de Nome Fantasia / Razão Social no mapper. */
  descricao?: string;
  pessoaId: number;
  pessoa: {
    id: number;
    tipoPessoa: 1 | 2;
    nomeRazaoSocial: string;
    nomeFantasia: string;
    cnpj: string;
    email: string;
    ativo: boolean;
  };
  responsavelLegalNome?: string;
  responsavelLegalCpf?: string;
  responsavelLegalEmail?: string;
  contatoTelefone?: string;
  /** Até 5 contatos complementares (nome, cpf, telefone, email). */
  contatosComplementares?: Array<{ nome?: string; cpf?: string; telefone?: string; email?: string }>;
  /** Lista de endereços (pessoa.enderecos no backend). */
  enderecos?: Array<{
    principal?: boolean;
    tipoEndereco?: number;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  }>;
  capacidadeVeiculos?: number | null;
  tamanho?: string | number | null;
  possuiSeguranca?: boolean;
  possuiBanheiro?: boolean;
  tipoTaxaMensalidade?: 'taxa' | 'mensalidade' | null;
  taxaPercentual?: number | null;
  mensalidadeValor?: number | null;
  /** Configuração Valores — EstacionamentoConfiguracao via CRUD Estacionamento */
  tipoTarifaAvulsa?: 1 | 2 | null;
  valorAvulso?: number | null;
  minutosToleranciaPermanencia?: number | null;
  banco?: string;
  agenciaNumero?: string;
  agenciaDigito?: string;
  contaNumero?: string;
  contaDigito?: string;
  tipoConta?: string;
  chavePix?: string;
  /** TipoChave backend: 1=Cpf, 2=Cnpj, 3=Email, 4=Telefone, 5=Aleatoria */
  tipoChave?: 1 | 2 | 3 | 4 | 5 | null;
  contaBancariaId?: number | null;
  /** Titular da conta (padrão = pessoa responsável). */
  titularRazaoSocial?: string;
  titularCnpj?: string;
  /** Multi-tenant */
  codExportacao?: string;
  isolationMode?: 1 | 2;
  bancoDadosConexaoId?: number | null;
  ativoTenant?: boolean;
}

/** TipoCobranca no backend: 0 = nenhum, 1 = taxa, 2 = mensalidade (ajustar se o backend usar outros valores). */
function mapTipoCobranca(tipo: 'taxa' | 'mensalidade' | null | undefined): number {
  if (tipo === 'taxa') return 1;
  if (tipo === 'mensalidade') return 2;
  return 0;
}

/** Monta string única de agência para o backend: "numero" ou "numero-digito". */
export function buildAgencia(numero: string | null | undefined, digito: string | null | undefined): string {
  const n = String(numero ?? '').trim().replace(/\D/g, '');
  const d = String(digito ?? '').trim().replace(/\D/g, '').slice(0, 1);
  if (!n) return '';
  return d ? `${n}-${d}` : n;
}

/** Monta string única de conta para o backend: "numero" ou "numero-digito". */
export function buildConta(numero: string | null | undefined, digito: string | null | undefined): string {
  const n = String(numero ?? '').trim().replace(/\D/g, '');
  const d = String(digito ?? '').trim().replace(/\D/g, '').slice(0, 1);
  if (!n) return '';
  return d ? `${n}-${d}` : n;
}

function splitNumeroDigito(valor: string): { numero: string; digito: string } {
  const raw = String(valor ?? '').trim();
  if (!raw) return { numero: '', digito: '' };
  if (raw.includes('-')) {
    const [n, d] = raw.split('-');
    return {
      numero: String(n ?? '').replace(/\D/g, ''),
      digito: String(d ?? '').replace(/\D/g, '').slice(0, 1)
    };
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 1) return { numero: digits, digito: '' };
  return { numero: digits.slice(0, -1), digito: digits.slice(-1) };
}

function mapTipoContaToBackend(value: string | null | undefined): string {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'corrente') return 'Corrente';
  if (v === 'poupanca' || v === 'poupança') return 'Poupanca';
  return String(value ?? '').trim();
}

/** Contrato `TipoChave`: 1=Cpf … 5=Aleatoria; null quando não informado. */
function mapTipoChaveToBackend(value: number | null | undefined): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return Math.trunc(n);
}

/** Contrato `ConfiguracaoValores` no POST/PUT Estacionamento. */
function buildConfiguracaoValoresPayload(value: FormValue): Record<string, unknown> {
  const tipoRaw = Number(value.tipoTarifaAvulsa);
  const tipo = tipoRaw === 1 || tipoRaw === 2 ? tipoRaw : null;
  const valorRaw = value.valorAvulso;
  const valor =
    valorRaw === null || valorRaw === undefined || valorRaw === ('' as unknown)
      ? null
      : Number(valorRaw);
  const tolRaw = value.minutosToleranciaPermanencia;
  const tolerancia =
    tolRaw === null || tolRaw === undefined || tolRaw === ('' as unknown)
      ? null
      : Math.trunc(Number(tolRaw));

  return {
    tipoTarifaAvulsa: tipo,
    valorAvulso: valor != null && Number.isFinite(valor) ? valor : null,
    minutosToleranciaPermanencia:
      tolerancia != null && Number.isFinite(tolerancia) ? tolerancia : null
  };
}


function gContaKey(obj: Record<string, unknown>, k: string): string {
  const pascal = k.charAt(0).toUpperCase() + k.slice(1);
  return String(obj[k] ?? obj[pascal] ?? '').trim();
}

/**
 * Indica se o registro de conta (payload ou resposta API) tem algum dado bancário relevante.
 */
export function contaBancariaRegistroComDadosRelevantes(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const o = item as Record<string, unknown>;
  return Boolean(
    gContaKey(o, 'banco') ||
      gContaKey(o, 'agencia') ||
      gContaKey(o, 'conta') ||
      gContaKey(o, 'chavePix') ||
      gContaKey(o, 'tipoConta') ||
      gContaKey(o, 'titular') ||
      gContaKey(o, 'cpfCnpj') ||
      Number(o['tipoChave'] ?? o['TipoChave'] ?? 0) > 0
  );
}

/**
 * Primeiro nível: `contaBancaria` do JSON do GET.
 * A API pode devolver lista ou um único objeto; normalizamos para array interno.
 */
export function extrairContaBancariaDaRespostaApi(raw: unknown): unknown[] {
  if (raw == null || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  const list = o['contaBancaria'] ?? o['ContaBancaria'];
  if (Array.isArray(list)) return list;
  if (list != null && typeof list === 'object') return [list];
  return [];
}

/**
 * Monta um item de `contaBancaria`: merge do que veio no GET (`contaAtual`) com o formulário.
 * Nomes alinhados ao Swagger (`agencia`, `agenciaDigito`, `conta`, `contaDigito`, …).
 */
export function buildContaBancariaMerged(
  contaAtual: Record<string, unknown> | null | undefined,
  value: FormValue,
  estacionamentoId: number,
  nowIso: string
): Record<string, unknown> {
  const base = contaAtual && typeof contaAtual === 'object' ? { ...contaAtual } : {};
  const agenciaStr = buildAgencia(value.agenciaNumero, value.agenciaDigito);
  const contaStr = buildConta(value.contaNumero, value.contaDigito);
  const agenciaSplit = splitNumeroDigito(agenciaStr);
  const contaSplit = splitNumeroDigito(contaStr);
  const tipoContaBackend = mapTipoContaToBackend(value.tipoConta);
  const titularRazaoSocial = String(value.titularRazaoSocial ?? '').trim();
  const titularCnpj = String(value.titularCnpj ?? '').replace(/\D/g, '');

  const idNum =
    (Number(value.contaBancariaId ?? 0) || 0) > 0
      ? Number(value.contaBancariaId)
      : Number(base['id'] ?? base['Id'] ?? 0) || 0;

  const descricao =
    String(base['descricao'] ?? base['Descricao'] ?? '').trim() ||
    titularRazaoSocial ||
    String(value.pessoa?.nomeFantasia ?? '').trim() ||
    '';

  const dataCriacao =
    String(base['dataCriacao'] ?? base['DataCriacao'] ?? '').trim() || nowIso;

  const ativaBase = base['ativa'] ?? base['Ativa'];
  const ativa = ativaBase === false ? false : true;

  const out: Record<string, unknown> = {
    ...base,
    id: idNum,
    descricao,
    dataCriacao,
    dataAtualizacao: nowIso,
    titular: titularRazaoSocial,
    cpfCnpj: titularCnpj,
    banco: String(value.banco ?? '').trim(),
    agencia: agenciaSplit.numero,
    agenciaDigito: agenciaSplit.digito,
    conta: contaSplit.numero,
    contaDigito: contaSplit.digito,
    tipoConta: tipoContaBackend,
    ativa,
    chavePix: normalizeChavePixForApi(value.chavePix, value.tipoChave),
    tipoChave: mapTipoChaveToBackend(value.tipoChave)
  };

  const estacionamentoIdNum = Number(estacionamentoId) || 0;
  if (estacionamentoIdNum > 0) {
    // Contrato do backend usa EstacionamentoId; só enviar quando já houver id persistido.
    out['EstacionamentoId'] = estacionamentoIdNum;
  }

  return out;
}

/** Compatibilidade / testes — preferir {@link buildContaBancariaMerged}. */
export function formValueToContaBancariaItem(
  value: FormValue,
  estacionamentoId: number
): Record<string, unknown> | null {
  const now = new Date().toISOString();
  const m = buildContaBancariaMerged(null, value, estacionamentoId, now);
  return contaBancariaRegistroComDadosRelevantes(m) ? m : null;
}

/** Endereço no formato do backend (para preservar ao editar). */
export type EnderecoPayload = Record<string, unknown>;

/** Remove propriedades `undefined` em profundidade (JSON não serializa undefined). */
export function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep).filter((v) => v !== undefined);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const next = stripUndefinedDeep(v);
    if (next === undefined) continue;
    out[k] = next;
  }
  return out;
}

/**
 * Monta o body completo de POST/PUT /api/Estacionamento (merge do GET + formulário).
 * @param merge contexto de ObterPorId (datas e conta preservada); omitir em cadastro novo.
 */
export function montarPayloadEstacionamento(
  value: FormValue,
  enderecosCarregados?: EnderecoPayload[] | null,
  fotosBase64?: string[],
  merge?: EstacionamentoPayloadMergeContext | null
): Record<string, unknown> {
  const nowIso = new Date().toISOString();
  const cnpj = String(value.pessoa?.cnpj ?? '').replace(/\D/g, '');
  const cpf = String(value.responsavelLegalCpf ?? '').replace(/\D/g, '');
  const telefone = String(value.contatoTelefone ?? '').replace(/\D/g, '').trim();

  const pessoaId = value.pessoaId ?? value.pessoa?.id ?? 0;
  const contatos: Record<string, unknown>[] = [];
  if (telefone.length >= 10) {
    contatos.push({
      pessoaId,
      principal: true,
      tipoContato: 1,
      numero: telefone,
      observacao: ''
    });
  }
  const complementares = value.contatosComplementares ?? [];
  for (const c of complementares) {
    const num = String(c.telefone ?? '').replace(/\D/g, '').trim();
    if (num.length >= 10) {
      contatos.push({
        pessoaId,
        principal: false,
        tipoContato: 1,
        numero: num,
        observacao: ''
      });
    }
  }

  const enderecosForm = value.enderecos ?? [];
  const enderecos = enderecosForm.length > 0
    ? enderecosForm.map((e) => ({
        pessoaId,
        principal: e.principal ?? false,
        tipoEndereco: e.tipoEndereco ?? 1,
        cep: e.cep ?? '',
        logradouro: e.logradouro ?? '',
        numero: e.numero ?? '',
        complemento: e.complemento ?? '',
        bairro: e.bairro ?? '',
        cidade: e.cidade ?? '',
        estado: e.estado ?? ''
      }))
    : (enderecosCarregados && enderecosCarregados.length > 0 ? enderecosCarregados : []);

  const pessoaDcMerged =
    merge?.pessoaDataCriacao != null && String(merge.pessoaDataCriacao).trim() !== ''
      ? String(merge.pessoaDataCriacao).trim()
      : nowIso;

  const pessoaDescricao =
    (merge?.pessoaDescricao != null && String(merge.pessoaDescricao).trim() !== ''
      ? String(merge.pessoaDescricao).trim()
      : '') ||
    String(value.pessoa?.nomeFantasia ?? '').trim() ||
    String(value.pessoa?.nomeRazaoSocial ?? '').trim() ||
    '';

  const emailPessoa =
    String(value.responsavelLegalEmail ?? '').trim() ||
    String(value.pessoa?.email ?? '').trim();

  const pessoa: Record<string, unknown> = {
    id: value.pessoa?.id ?? 0,
    descricao: pessoaDescricao,
    dataCriacao: pessoaDcMerged,
    dataAtualizacao: nowIso,
    tipoPessoa: value.pessoa?.tipoPessoa ?? 2,
    nomeRazaoSocial: value.pessoa?.nomeRazaoSocial ?? '',
    nomeFantasia: value.pessoa?.nomeFantasia ?? '',
    cnpj,
    // Compatibilidade com contratos legados de PessoaInput.
    documento: cnpj,
    email: emailPessoa,
    ativo: value.pessoa?.ativo ?? true,
    enderecos,
    contatos
  };

  const tipoCobranca = mapTipoCobranca(value.tipoTaxaMensalidade ?? null);
  const capacidade = value.capacidadeVeiculos != null ? Number(value.capacidadeVeiculos) : 0;
  const estacionamentoIdRoot = Number(value.id ?? 0) || 0;

  const descricaoEstacionamento =
    String(value.pessoa?.nomeFantasia ?? '').trim() ||
    String(value.pessoa?.nomeRazaoSocial ?? '').trim() ||
    String(value.descricao ?? '').trim();

  const preservedConta = merge?.contaBancariaPreserved ?? null;
  const mergedConta = buildContaBancariaMerged(preservedConta, value, estacionamentoIdRoot, nowIso);
  const contaBancariaPayload = contaBancariaRegistroComDadosRelevantes(mergedConta) ? mergedConta : undefined;

  const estDataCriacao =
    merge?.estacionamentoDataCriacao != null && String(merge.estacionamentoDataCriacao).trim() !== ''
      ? String(merge.estacionamentoDataCriacao).trim()
      : nowIso;

  const isolationMode = (value.isolationMode === 2 ? 2 : 1) as 1 | 2;
  const bancoDadosConexaoId =
    value.bancoDadosConexaoId != null && Number(value.bancoDadosConexaoId) > 0
      ? Number(value.bancoDadosConexaoId)
      : 0;

  const payload: Record<string, unknown> = {
    id: value.id ?? 0,
    descricao: descricaoEstacionamento,
    dataCriacao: estDataCriacao,
    dataAtualizacao: nowIso,
    pessoaId,
    capacidadeVeiculo: capacidade,
    tamanhoTerreno: value.tamanho != null ? String(value.tamanho) : '',
    // Contrato atual: ResponsavelLegal; tipografia legada mantida por compatibilidade.
    responsavelLegal: value.responsavelLegalNome ?? '',
    resposanvelLegal: value.responsavelLegalNome ?? '',
    responsavelCpf: cpf || '',
    responsavelEmail: emailPessoa,
    responsavelTelefone: String(value.contatoTelefone ?? '').replace(/\D/g, ''),
    possuiSeguranca: value.possuiSeguranca ?? false,
    possuiBanheiro: value.possuiBanheiro ?? false,
    tipoCobranca,
    cobrancaPorcentagem: value.tipoTaxaMensalidade === 'taxa' ? (value.taxaPercentual ?? 0) : 0,
    cobrancaValor: value.tipoTaxaMensalidade === 'mensalidade' ? (value.mensalidadeValor ?? 0) : 0,
    // Contrato EstacionamentoPostInput/PutInput usa PessoaJuridica (não `pessoa` na raiz).
    pessoaJuridica: pessoa,
    /** Legado — alguns consumidores ainda leem `pessoa`. */
    pessoa,
    /**
     * Contrato obrigatório: objeto aninhado `bancoDados` (não campos flat na raiz).
     * @see EstacionamentoBancoDadosInput
     */
    bancoDados: {
      isolationMode,
      bancoDadosConexaoId
    },
    /**
     * Tarifa avulsa + tolerância (persistido em EstacionamentoConfiguracao).
     * TipoTarifaAvulsa: 1=Hora, 2=Diaria.
     */
    configuracaoValores: buildConfiguracaoValoresPayload(value),
    /** Tenant GtCentral permanece ativo (UI bloqueia alteração). */
    ativo: true,
  };

  const cod = String(value.codExportacao ?? '').trim();
  if (cod) {
    payload['codExportacao'] = cod;
  }

  if (contaBancariaPayload) {
    payload['contaBancaria'] = contaBancariaPayload;
  }

  const fotos = fotosBase64?.filter((f) => typeof f === 'string' && f.length > 0) ?? [];
  if (fotos.length > 0) {
    payload['fotos'] = fotos;
  }

  return stripUndefinedDeep(payload) as Record<string, unknown>;
}

/**
 * Alias de {@link montarPayloadEstacionamento} para POST/PUT completo.
 * @param merge opcional: contexto do GET na edição (datas e conta preservadas).
 */
export function formValueToEstacionamentoPayload(
  value: FormValue,
  enderecosCarregados?: EnderecoPayload[] | null,
  fotosBase64?: string[],
  merge?: EstacionamentoPayloadMergeContext | null
): Record<string, unknown> {
  return montarPayloadEstacionamento(value, enderecosCarregados ?? null, fotosBase64 ?? [], merge ?? null);
}

/**
 * PUT da aba Dados Bancários: reforça `contaBancaria` com merge explícito (GET + form) e alinha `dataAtualizacao`.
 */
export function montarPayloadSalvarAbaDadosBancarios(
  value: FormValue,
  enderecosCarregados: EnderecoPayload[] | null | undefined,
  merge: EstacionamentoPayloadMergeContext | null,
  estacionamentoId: number
): Record<string, unknown> {
  const nowIso = new Date().toISOString();
  const base = montarPayloadEstacionamento(value, enderecosCarregados ?? null, [], merge);
  const merged = buildContaBancariaMerged(merge?.contaBancariaPreserved ?? null, value, estacionamentoId, nowIso);
  if (!contaBancariaRegistroComDadosRelevantes(merged)) {
    delete base['contaBancaria'];
  } else {
    base['contaBancaria'] = merged;
    base['dataAtualizacao'] = nowIso;
  }
  return stripUndefinedDeep(base) as Record<string, unknown>;
}
