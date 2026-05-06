import { stripUndefinedDeep } from '../pages/estacionamento-form/estacionamento-form.mapper';
import {
  buildContatoPayload,
  contatoDeveSerEnviado,
  Trspc1Meta
} from './transportadora-contato.mapper';

/** Form value espelhado do `transportadoraForm.getRawValue()`. */
export interface TransportadoraFormRawValue {
  id: number | null;
  pessoa: {
    razaoSocial?: string;
    nomeFantasia?: string;
    cnpj?: string;
    email?: string;
    ativo?: boolean;
  };
  responsavelLegal: {
    nome?: string;
    cpf?: string;
    telefone?: string;
    email?: string;
    cargo?: string;
  };
  contatosComplementares: Array<{
    nome?: string;
    cpf?: string;
    telefone?: string;
    email?: string;
  }>;
  endereco: Record<string, unknown>;
}

function onlyDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function ufNormalize(value: unknown): string {
  const s = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return s.slice(0, 2);
}

function getRaw(obj: Record<string, unknown> | null | undefined, key: string): unknown {
  if (!obj) return undefined;
  return obj[key] ?? obj[key.charAt(0).toUpperCase() + key.slice(1)];
}

function ordenarContatosPrincipalPrimeiro(contatos: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...contatos].sort((a, b) => {
    const pa = a['principal'] === true || a['Principal'] === true ? 1 : 0;
    const pb = b['principal'] === true || b['Principal'] === true ? 1 : 0;
    return pb - pa;
  });
}

/**
 * Monta o body de POST/PUT /api/Transportadora.
 * Contrato Swagger (GTS API v1): `TransportadoraPostInput` / `TransportadoraPutInput` =
 * `{ id?: number, pessoaJuridica: PessoaInput }` — sem wrapper `transportadora`.
 * `PessoaInput`: dados da PJ + `enderecos[]` + `contatos[]` (ver OpenAPI `PessoaEnderecoInput` / `PessoaContatoInput`).
 * - Em edição, `id` na raiz = transportadora; `pessoaJuridica.id` = pessoa (quando existir no merge).
 * - Remove `undefined` em profundidade antes do envio.
 */
export function montarPayloadTransportadoraApi(
  raw: TransportadoraFormRawValue,
  mergeRaw: Record<string, unknown> | null,
  nowIso: string
): Record<string, unknown> {
  const p = raw.pessoa ?? {};
  const leg = raw.responsavelLegal ?? {};
  const razaoSocial = String(p.razaoSocial ?? '').trim();
  const nomeFantasia = String(p.nomeFantasia ?? '').trim();
  const cnpj = onlyDigits(p.cnpj);
  const email = String(p.email ?? '').trim();
  const descricao = (nomeFantasia || razaoSocial).trim();
  const end = (raw.endereco ?? {}) as Record<string, unknown>;

  const metaLegal: Trspc1Meta = {
    n: String(leg.nome ?? '').trim() || undefined,
    c: onlyDigits(leg.cpf) || undefined,
    e: String(leg.email ?? '').trim() || undefined,
    g: String(leg.cargo ?? '').trim() || undefined
  };
  const telefoneLegal = onlyDigits(leg.telefone);

  const contatosPayload: Record<string, unknown>[] = [];
  let principalFeito = false;

  if (contatoDeveSerEnviado(telefoneLegal, metaLegal)) {
    contatosPayload.push(
      stripUndefinedDeep(buildContatoPayload({
        principal: true,
        telefoneDigits: telefoneLegal,
        meta: metaLegal
      })) as Record<string, unknown>
    );
    principalFeito = true;
  }

  for (const c of raw.contatosComplementares ?? []) {
    const metaC: Trspc1Meta = {
      n: String(c.nome ?? '').trim() || undefined,
      c: onlyDigits(c.cpf) || undefined,
      e: String(c.email ?? '').trim() || undefined
    };
    const telC = onlyDigits(c.telefone);
    if (!contatoDeveSerEnviado(telC, metaC)) continue;
    const principal = !principalFeito;
    contatosPayload.push(
      stripUndefinedDeep(
        buildContatoPayload({
          principal,
          telefoneDigits: telC,
          meta: metaC
        })
      ) as Record<string, unknown>
    );
    if (principal) principalFeito = true;
  }

  const cepDigits = onlyDigits(end['cep']);

  const enderecoBase: Record<string, unknown> = {
    principal: true,
    tipoEndereco: 1,
    cep: cepDigits,
    logradouro: String(end['logradouro'] ?? '').trim(),
    numero: String(end['numero'] ?? '').trim(),
    complemento: String(end['complemento'] ?? '').trim(),
    bairro: String(end['bairro'] ?? '').trim(),
    cidade: String(end['cidade'] ?? '').trim(),
    estado: ufNormalize(end['estado'])
  };

  /** Merge: GET atual `{ id, PessoaJuridica }`, legado `{ transportadora: {...} }` ou `pessoa`. */
  const mergeRaiz =
    mergeRaw && typeof mergeRaw === 'object' ? (mergeRaw as Record<string, unknown>) : null;
  const mergeTa =
    mergeRaiz && mergeRaiz['transportadora'] != null && typeof mergeRaiz['transportadora'] === 'object'
      ? (mergeRaiz['transportadora'] as Record<string, unknown>)
      : mergeRaiz;
  const mergePessoaNested = mergeTa
    ? ((getRaw(mergeTa, 'pessoa') as Record<string, unknown> | undefined) ??
        (getRaw(mergeTa, 'pessoaJuridica') as Record<string, unknown> | undefined) ??
        (mergeTa['PessoaJuridica'] as Record<string, unknown> | undefined))
    : undefined;
  const mergeSource =
    mergePessoaNested && typeof mergePessoaNested === 'object'
      ? mergePessoaNested
      : mergeTa ?? undefined;
  const mergeEndsRaw = (mergeSource?.['enderecos'] as Record<string, unknown>[] | undefined) ?? [];
  const mergeEnd0 = mergeEndsRaw[0];
  if (mergeEnd0 && typeof mergeEnd0 === 'object') {
    const eid = mergeEnd0['id'] ?? mergeEnd0['Id'];
    if (eid != null) enderecoBase['id'] = Number(eid);
    const epid = mergeEnd0['pessoaId'] ?? mergeEnd0['PessoaId'];
    if (epid != null) enderecoBase['pessoaId'] = Number(epid);
  }

  const mergeContatosRaw = ordenarContatosPrincipalPrimeiro(
    ((mergeSource?.['contatos'] as Record<string, unknown>[] | undefined) ?? []).filter(Boolean)
  );

  const contatosMerged = contatosPayload.map((c, i) => {
    const row = { ...c };
    const rawC = mergeContatosRaw[i];
    if (rawC && typeof rawC === 'object') {
      const cid = rawC['id'] ?? rawC['Id'];
      if (cid != null) row['id'] = Number(cid);
      const cpid = rawC['pessoaId'] ?? rawC['PessoaId'];
      if (cpid != null) row['pessoaId'] = Number(cpid);
    }
    return row;
  });

  const pessoaBase: Record<string, unknown> = {
    descricao: razaoSocial || descricao,
    tipoPessoa: 2,
    nomeRazaoSocial: razaoSocial,
    nomeFantasia,
    cnpj,
    // Compatibilidade com contratos antigos que ainda usam `documento` para PJ.
    documento: cnpj,
    email,
    ativo: p.ativo !== false,
    enderecos: [stripUndefinedDeep(enderecoBase) as Record<string, unknown>],
    contatos: contatosMerged.map((x) => stripUndefinedDeep(x) as Record<string, unknown>)
  };

  const isEdit =
    mergeTa != null &&
    (Number(getRaw(mergeTa, 'id')) > 0 || Number(getRaw(mergeTa, 'Id')) > 0);

  if (isEdit && mergeTa) {
    const tid = Number(getRaw(mergeTa, 'id') ?? getRaw(mergeTa, 'Id')) || 0;
    const pessoaIdMerge =
      Number(getRaw(mergeSource ?? {}, 'id') ?? getRaw(mergeSource ?? {}, 'Id')) ||
      Number(getRaw(mergeTa, 'pessoaId') ?? getRaw(mergeTa, 'PessoaId')) ||
      0;

    const dcP = getRaw(mergeSource ?? {}, 'dataCriacao') ?? getRaw(mergeSource ?? {}, 'DataCriacao');

    const dataCriacaoMerged =
      dcP != null && String(dcP).trim() !== '' && String(dcP).trim() !== '0001-01-01T00:00:00'
        ? String(dcP)
        : undefined;

    const pessoaJuridicaEdit: Record<string, unknown> = {
      descricao,
      dataAtualizacao: nowIso,
      tipoPessoa: pessoaBase['tipoPessoa'],
      nomeRazaoSocial: pessoaBase['nomeRazaoSocial'],
      nomeFantasia: pessoaBase['nomeFantasia'],
      cnpj: pessoaBase['cnpj'],
      documento: pessoaBase['documento'],
      email: pessoaBase['email'],
      ativo: pessoaBase['ativo'],
      enderecos: pessoaBase['enderecos'],
      contatos: pessoaBase['contatos']
    };
    if (dataCriacaoMerged != null) {
      pessoaJuridicaEdit['dataCriacao'] = dataCriacaoMerged;
    }
    if (pessoaIdMerge > 0) {
      pessoaJuridicaEdit['id'] = pessoaIdMerge;
    }

    return stripUndefinedDeep({
      id: tid > 0 ? tid : undefined,
      pessoaJuridica: pessoaJuridicaEdit
    }) as Record<string, unknown>;
  }

  const pessoaJuridicaCreate: Record<string, unknown> = {
    descricao,
    dataCriacao: nowIso,
    dataAtualizacao: nowIso,
    tipoPessoa: pessoaBase['tipoPessoa'],
    nomeRazaoSocial: pessoaBase['nomeRazaoSocial'],
    nomeFantasia: pessoaBase['nomeFantasia'],
    cnpj: pessoaBase['cnpj'],
    documento: pessoaBase['documento'],
    email: pessoaBase['email'],
    ativo: pessoaBase['ativo'],
    enderecos: pessoaBase['enderecos'],
    contatos: pessoaBase['contatos']
  };

  return stripUndefinedDeep({ pessoaJuridica: pessoaJuridicaCreate }) as Record<string, unknown>;
}
