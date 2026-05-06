import { MotoristaPorPlacaAggregateVm } from '../models/motorista-por-placa.vm';

function unwrap(body: unknown): unknown {
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
    if (obj['data'] != null) {
      cur = obj['data'];
      continue;
    }
    break;
  }
  return cur;
}

function pickRecord(o: unknown): Record<string, unknown> | null {
  return o != null && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
}

function getNum(obj: Record<string, unknown> | null, keys: string[]): number {
  if (!obj) return 0;
  for (const k of keys) {
    const v = obj[k] ?? obj[k.charAt(0).toUpperCase() + k.slice(1)];
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function getStr(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) return '';
  for (const k of keys) {
    const v = obj[k] ?? obj[k.charAt(0).toUpperCase() + k.slice(1)];
    if (v != null && v !== '') return String(v).trim();
  }
  return '';
}

function primeiraContatoNumero(pessoa: Record<string, unknown> | null): string {
  if (!pessoa) return '';
  const contatos = pessoa['contatos'] ?? pessoa['Contatos'];
  if (Array.isArray(contatos) && contatos.length > 0) {
    const c0 = contatos[0];
    if (c0 && typeof c0 === 'object') {
      const r = c0 as Record<string, unknown>;
      const n = getStr(r, ['numero', 'Numero', 'telefone', 'Telefone']);
      if (n) return n;
    }
  }
  return getStr(pessoa, [
    'telefone',
    'Telefone',
    'celular',
    'Celular',
    'phone',
    'fone'
  ]);
}

/** Primeiro contato da pessoa (nome + telefone), se existir lista `contatos`. */
function primeiroContatoNomeTelefone(pessoa: Record<string, unknown> | null): {
  nome: string;
  telefone: string;
} {
  if (!pessoa) return { nome: '', telefone: '' };
  const contatos = pessoa['contatos'] ?? pessoa['Contatos'];
  if (Array.isArray(contatos) && contatos.length > 0) {
    const c0 = contatos[0];
    if (c0 && typeof c0 === 'object') {
      const r = c0 as Record<string, unknown>;
      return {
        nome: getStr(r, ['nome', 'Nome', 'contatoNome', 'nomeContato', 'NomeContato']),
        telefone: getStr(r, ['numero', 'Numero', 'telefone', 'Telefone', 'celular', 'Celular'])
      };
    }
  }
  return { nome: '', telefone: '' };
}

function splitMarcaModelo(mm: string): { marca: string; modelo: string } {
  const t = mm.trim();
  if (!t) return { marca: '', modelo: '' };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { marca: '', modelo: parts[0] ?? '' };
  return { marca: parts[0] ?? '', modelo: parts.slice(1).join(' ') };
}

function anoVeiculo(v: Record<string, unknown> | null): string {
  if (!v) return '';
  const af = Number(v['anoFabricacao'] ?? v['AnoFabricacao']);
  const am = Number(v['anoModelo'] ?? v['AnoModelo']);
  const anoUnico = Number(v['ano'] ?? v['Ano']);
  if (Number.isFinite(af) && af > 0 && Number.isFinite(am) && am > 0 && af !== am) {
    return `${af} / ${am}`;
  }
  const one =
    Number.isFinite(af) && af > 0
      ? af
      : Number.isFinite(am) && am > 0
        ? am
        : Number.isFinite(anoUnico) && anoUnico > 0
          ? anoUnico
          : 0;
  return one > 0 ? String(one) : '';
}

/**
 * Mapeia resposta do GET `/api/Veiculo/por-placa/{placa}` para o VM da Entrada/Saída.
 * Aceita objetos aninhados (motorista/veiculo/transportadora) ou campos na raiz.
 */
export function mapMotoristaPorPlacaResponse(body: unknown): MotoristaPorPlacaAggregateVm | null {
  const raw = unwrap(body);
  const root = pickRecord(raw);
  if (!root) return null;

  const mObj =
    pickRecord(root['motorista']) ??
    pickRecord(root['Motorista']) ??
    pickRecord(root['condutor']) ??
    pickRecord(root['Condutor']);
  const vObj =
    pickRecord(root['veiculo']) ??
    pickRecord(root['Veiculo']) ??
    pickRecord(root['veículo']);
  const tObj =
    pickRecord(root['transportadora']) ??
    pickRecord(root['Transportadora']) ??
    pickRecord(root['empresa']) ??
    pickRecord(root['Empresa']);

  /** Backend pode expor PF/PJ em `pessoa`, `pessoaFisica`, `pessoaJuridica` etc. */
  const pessoaM =
    pickRecord(mObj?.['pessoa']) ??
    pickRecord(mObj?.['Pessoa']) ??
    pickRecord(mObj?.['pessoaFisica']) ??
    pickRecord(mObj?.['PessoaFisica']) ??
    pickRecord(mObj?.['pessoaJuridica']) ??
    pickRecord(mObj?.['PessoaJuridica']) ??
    (mObj && pickRecord(mObj));

  const pessoaT =
    pickRecord(tObj?.['pessoa']) ??
    pickRecord(tObj?.['Pessoa']) ??
    pickRecord(tObj?.['pessoaJuridica']) ??
    pickRecord(tObj?.['PessoaJuridica']) ??
    pickRecord(tObj?.['pessoaFisica']) ??
    pickRecord(tObj?.['PessoaFisica']) ??
    (tObj && pickRecord(tObj));

  const motoristaId = getNum(mObj, ['id', 'Id']) || getNum(root, ['motoristaId', 'MotoristaId']);
  const veiculoId = getNum(vObj, ['id', 'Id']) || getNum(root, ['veiculoId', 'VeiculoId']);
  const transportadoraId =
    getNum(tObj, ['id', 'Id']) ||
    getNum(mObj, ['transportadoraId', 'TransportadoraId']) ||
    getNum(root, ['transportadoraId', 'TransportadoraId']);

  const marcaModeloFull = getStr(vObj, ['marcaModelo', 'MarcaModelo', 'descricao', 'Descricao']);
  const { marca: marcaSplit, modelo: modeloSplit } = splitMarcaModelo(marcaModeloFull);

  const razaoSocial =
    getStr(pessoaT, ['nomeRazaoSocial', 'NomeRazaoSocial']) ||
    getStr(tObj, ['razaoSocial', 'RazaoSocial', 'nomeRazaoSocial', 'NomeRazaoSocial']);
  const nomeFantasia =
    getStr(pessoaT, ['nomeFantasia', 'NomeFantasia']) ||
    getStr(tObj, ['nomeFantasia', 'NomeFantasia']);

  const respNested =
    pickRecord(tObj?.['responsavel']) ??
    pickRecord(tObj?.['Responsavel']) ??
    pickRecord(tObj?.['contatoPrincipal']) ??
    pickRecord(tObj?.['ContatoPrincipal']);

  let transportadoraResponsavelNome = getStr(respNested, [
    'nome',
    'Nome',
    'nomeCompleto',
    'NomeCompleto'
  ]);
  let transportadoraResponsavelTelefone = getStr(respNested, [
    'telefone',
    'Telefone',
    'celular',
    'Celular'
  ]);

  const contatoLista = primeiroContatoNomeTelefone(pessoaT);
  if (!transportadoraResponsavelNome && contatoLista.nome) {
    transportadoraResponsavelNome = contatoLista.nome;
  }
  if (!transportadoraResponsavelTelefone && contatoLista.telefone) {
    transportadoraResponsavelTelefone = contatoLista.telefone;
  }
  if (!transportadoraResponsavelNome) {
    transportadoraResponsavelNome = getStr(tObj, [
      'nomeResponsavel',
      'NomeResponsavel',
      'responsavelNome',
      'nomeContato',
      'contatoNome'
    ]);
  }
  if (!transportadoraResponsavelTelefone) {
    transportadoraResponsavelTelefone = getStr(tObj, [
      'telefoneResponsavel',
      'celularResponsavel',
      'telefoneContato'
    ]);
  }

  const nomeTransportadoraFallback =
    nomeFantasia ||
    razaoSocial ||
    getStr(tObj, ['descricao', 'Descricao']);

  const vm: MotoristaPorPlacaAggregateVm = {
    motoristaId,
    veiculoId,
    transportadoraId,
    motoristaNome:
      getStr(pessoaM, ['nomeRazaoSocial', 'NomeRazaoSocial', 'nome', 'Nome']) ||
      getStr(mObj, ['descricao', 'Descricao', 'nomeCompleto', 'NomeCompleto']) ||
      getStr(root, ['nomeMotorista', 'NomeMotorista', 'motoristaNome', 'MotoristaNome']),
    motoristaCpf:
      getStr(pessoaM, ['documento', 'Documento', 'cpf', 'Cpf']) ||
      getStr(root, ['cpfMotorista', 'CpfMotorista']),
    motoristaTelefone: primeiraContatoNumero(pessoaM ?? mObj),
    motoristaCnh: getStr(mObj, ['cnh', 'Cnh', 'CNH']),
    veiculoPlaca: getStr(vObj, ['placa', 'Placa']) || getStr(root, ['placa', 'Placa']),
    veiculoModelo: getStr(vObj, ['modelo', 'Modelo']) || modeloSplit,
    veiculoMarca: getStr(vObj, ['marca', 'Marca']) || marcaSplit,
    veiculoAno: anoVeiculo(vObj),
    transportadoraNome: nomeTransportadoraFallback,
    transportadoraRazaoSocial: razaoSocial,
    transportadoraNomeFantasia: nomeFantasia,
    transportadoraCnpj: getStr(pessoaT, ['documento', 'Documento', 'cnpj', 'Cnpj']),
    transportadoraContato:
      primeiraContatoNumero(pessoaT ?? tObj) ||
      getStr(tObj, ['telefone', 'Telefone', 'celular', 'Celular']),
    transportadoraResponsavelNome,
    transportadoraResponsavelTelefone
  };

  if (!motoristaId || !veiculoId || !transportadoraId) {
    return null;
  }

  return vm;
}
