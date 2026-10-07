/**
 * Resposta da BrasilAPI CNPJ: https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 * Campos usados para preenchimento automático do formulário de transportadora.
 */
export interface BrasilApiCnpjResponse {
  cnpj?: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  descricao_situacao_cadastral?: string | null;
  situacao_cadastral?: number;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  email?: string | null;
  ddd_telefone_1?: string | null;
  [key: string]: unknown;
}

/**
 * Dados mapeados da consulta de CNPJ para o formulário de transportadora.
 * Preenchemos apenas quando a API retorna; inscricaoEstadual pode vir em lista (usamos a primeira válida).
 */
export interface CnpjFormValue {
  razaoSocial: string;
  nomeFantasia: string;
  ativo: boolean;
  situacaoCadastral?: string;
  inscricaoEstadual?: string;
  email?: string;
  telefone?: string;
  endereco?: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
}

/**
 * Lê string do objeto aceitando snake_case ou camelCase (backend pode devolver em qualquer formato).
 */
function getStr(r: Record<string, unknown>, snake: string, camel?: string): string {
  const v = r[camel ?? snake] ?? r[snake];
  return v != null && typeof v === 'string' ? v.trim() : '';
}

/**
 * Obtém primeira string não vazia de um array ou valor único (inscrições estaduais).
 */
function firstInscricaoEstadual(r: Record<string, unknown>): string {
  const single = getStr(r, 'inscricao_estadual', 'inscricaoEstadual');
  if (single) return single;
  const arr = r['inscricoes_estaduais'] ?? r['inscricoesEstaduais'];
  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr[0];
    if (first != null && typeof first === 'string' && first.trim()) return first.trim();
    if (typeof first === 'object' && first !== null && 'numero' in first) {
      const n = (first as { numero?: string }).numero;
      if (n != null && String(n).trim()) return String(n).trim();
    }
  }
  return '';
}

/**
 * Mapeia a resposta do backend (BrasilAPI ou DTO próprio) para o valor do formulário.
 * Aceita snake_case ou camelCase. Inscrição estadual: campo único ou primeira da lista.
 * Email/telefone: preenchidos quando a API retornar. Suporta MEI.
 */
export function mapCnpjResponseToFormValue(res: unknown): CnpjFormValue {
  if (res == null || typeof res !== 'object') {
    return { razaoSocial: '', nomeFantasia: '', ativo: true };
  }
  const r = res as Record<string, unknown>;
  const situacao = (getStr(r, 'descricao_situacao_cadastral') || getStr(r, 'situacao_cadastral', 'situacaoCadastral')).toUpperCase();
  const ativo = situacao === 'ATIVA';

  const value: CnpjFormValue = {
    razaoSocial: getStr(r, 'razao_social', 'razaoSocial'),
    nomeFantasia: getStr(r, 'nome_fantasia', 'nomeFantasia'),
    ativo
  };
  if (situacao) value.situacaoCadastral = situacao;
  const ie = firstInscricaoEstadual(r);
  if (ie) value.inscricaoEstadual = ie;
  const email = getStr(r, 'email');
  if (email) value.email = email;
  const tel = getStr(r, 'ddd_telefone_1', 'dddTelefone1') || getStr(r, 'telefone');
  if (tel) value.telefone = tel;

  const logradouro = getStr(r, 'logradouro');
  const numero = getStr(r, 'numero');
  const bairro = getStr(r, 'bairro');
  const municipio = getStr(r, 'municipio') || getStr(r, 'cidade');
  const uf = getStr(r, 'uf') || getStr(r, 'estado');
  const cepRaw = (getStr(r, 'cep') || '').replace(/\D/g, '');
  const cep = cepRaw.length === 8 ? `${cepRaw.slice(0, 5)}-${cepRaw.slice(5)}` : cepRaw;
  const complemento = getStr(r, 'complemento');

  if (logradouro || numero || bairro || municipio || uf || cep || complemento) {
    value.endereco = {
      logradouro,
      numero,
      complemento,
      bairro,
      cidade: municipio,
      estado: uf,
      cep
    };
  }

  return value;
}

/** @deprecated Use mapCnpjResponseToFormValue. Mantido por compatibilidade. */
export function mapBrasilApiCnpjToFormValue(res: unknown): CnpjFormValue {
  return mapCnpjResponseToFormValue(res);
}
