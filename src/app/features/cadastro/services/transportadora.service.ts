import { Injectable, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  TransportadoraDTO,
  TransportadoraListItemDTO,
  TransportadoraBuscarParams,
  PagedResultDTO,
  TransportadoraObterPorIdResultDTO,
  TransportadoraContatoComplementarDTO
} from '../models/transportadora.dto';
import { parseObservacaoContato, TRSPC1_PREFIX } from '../mappers/transportadora-contato.mapper';

/** Base da API. Contrato: GET/POST/PUT em `/api/Transportadora`, GET/DELETE em `/api/Transportadora/{id}`. */
const API_BASE = environment.API_BASE_URL;
const TRANSPORTADORA = `${API_BASE}/Transportadora`;

@Injectable({
  providedIn: 'root'
})
export class TransportadoraService {
  constructor(private http: HttpClient) {}

  /**
   * GET /api/Transportadora — listagem paginada.
   */
  listarTransportadoras(params: TransportadoraBuscarParams): Observable<PagedResultDTO<TransportadoraListItemDTO>> {
    const query = new URLSearchParams();
    const termo = params.Termo?.trim();
    if (termo) query.set('Descricao', termo);
    if (params.Propriedade?.trim()) query.set('Propriedade', params.Propriedade.trim());
    query.set('NumeroPagina', String(params.NumeroPagina));
    query.set('TamanhoPagina', String(params.TamanhoPagina));
    const url = `${TRANSPORTADORA}?${query.toString()}`;
    return this.http.get<unknown>(url).pipe(
      timeout(15000),
      tap((body) => {
        if (isDevMode()) {
          console.log('RETORNO API', body);
        }
      }),
      map((body) => this.normalizeBuscarResponse(body, params.NumeroPagina, params.TamanhoPagina)),
      catchError((err) => throwError(() => err))
    );
  }

  /** @deprecated Use `listarTransportadoras`. */
  buscar(params: TransportadoraBuscarParams): Observable<PagedResultDTO<TransportadoraListItemDTO>> {
    return this.listarTransportadoras(params);
  }

  /**
   * GET /api/Transportadora/{id} — detalhe para o formulário + corpo bruto para merge no PUT.
   */
  obterTransportadoraPorIdComCorpo(
    id: number
  ): Observable<{ dto: TransportadoraDTO; raw: Record<string, unknown> } | null> {
    return this.http.get<unknown>(`${TRANSPORTADORA}/${id}`).pipe(
      timeout(15000),
      map((body) => {
        const result = this.unwrapTransportadoraObterPorIdBody(body, id);
        if (result && typeof result === 'object') {
          const raw = result as Record<string, unknown>;
          const rid = Number(raw['id'] ?? raw['Id']) || id;
          if (rid > 0) {
            raw['id'] = rid;
            return { dto: this.mapToDto(result), raw };
          }
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * GET /api/Transportadora/{id} — apenas DTO mapeado (telas que não precisam do merge PUT).
   */
  obterTransportadoraPorId(id: number): Observable<TransportadoraDTO | null> {
    return this.obterTransportadoraPorIdComCorpo(id).pipe(map((x) => x?.dto ?? null));
  }

  /**
   * GET /api/Transportadora/cnpj/{cnpj} — consulta por CNPJ (apenas dígitos).
   */
  obterTransportadoraPorCnpj(cnpj: string): Observable<TransportadoraDTO | null> {
    const cnpjDigits = String(cnpj ?? '').replace(/\D/g, '');
    if (cnpjDigits.length !== 14) return of(null);
    return this.http.get<unknown>(`${TRANSPORTADORA}/cnpj/${cnpjDigits}`).pipe(
      timeout(15000),
      map((body) => {
        const result = this.unwrapTransportadoraPorCnpjBody(body);
        return result ? this.mapToDto(result) : null;
      }),
      catchError(() => of(null))
    );
  }

  /** @deprecated Use `obterTransportadoraPorId`. */
  obterPorId(id: number): Observable<TransportadoraDTO | null> {
    return this.obterTransportadoraPorId(id);
  }

  /**
   * Suporta envelope (`success` / `result`), `Result` PascalCase e payload só com `pessoaJuridica`
   * sem `id` na raiz — nesse caso usa o id da rota (mesmo padrão corrigido em Estacionamento).
   */
  private unwrapTransportadoraObterPorIdBody(
    body: unknown,
    fallbackTransportadoraId?: number
  ): (TransportadoraObterPorIdResultDTO & Record<string, unknown>) | null {
    let cur: unknown = body;
    for (let depth = 0; depth < 8 && cur != null && typeof cur === 'object'; depth++) {
      const o = cur as Record<string, unknown>;
      if (o['id'] != null || o['Id'] != null) {
        return o as TransportadoraObterPorIdResultDTO & Record<string, unknown>;
      }
      const inner = o['result'] ?? o['Result'];
      if (inner != null && typeof inner === 'object') {
        cur = inner;
        continue;
      }
      break;
    }
    if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) {
      return null;
    }
    const o = cur as Record<string, unknown>;
    if (o['id'] != null || o['Id'] != null) {
      return o as TransportadoraObterPorIdResultDTO & Record<string, unknown>;
    }
    const hasPessoa =
      o['pessoa'] ??
      o['Pessoa'] ??
      o['pessoaJuridica'] ??
      o['PessoaJuridica'];
    if (
      hasPessoa != null &&
      typeof hasPessoa === 'object' &&
      fallbackTransportadoraId != null &&
      fallbackTransportadoraId > 0
    ) {
      return {
        ...o,
        id: fallbackTransportadoraId,
      } as TransportadoraObterPorIdResultDTO & Record<string, unknown>;
    }
    return null;
  }

  private unwrapTransportadoraPorCnpjBody(
    body: unknown
  ): (TransportadoraObterPorIdResultDTO & Record<string, unknown>) | null {
    let cur: unknown = body;
    for (let depth = 0; depth < 8 && cur != null && typeof cur === 'object'; depth++) {
      const o = cur as Record<string, unknown>;
      if (o['id'] != null || o['Id'] != null) {
        return o as TransportadoraObterPorIdResultDTO & Record<string, unknown>;
      }
      const inner = o['result'] ?? o['Result'];
      if (inner != null && typeof inner === 'object') {
        cur = inner;
        continue;
      }
      break;
    }
    if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) {
      return null;
    }
    const o = cur as Record<string, unknown>;
    const pessoa =
      (o['pessoa'] as Record<string, unknown> | undefined) ??
      (o['Pessoa'] as Record<string, unknown> | undefined) ??
      (o['pessoaJuridica'] as Record<string, unknown> | undefined) ??
      (o['PessoaJuridica'] as Record<string, unknown> | undefined);
    const cnpj =
      String(o['cnpj'] ?? o['Cnpj'] ?? pessoa?.['cnpj'] ?? pessoa?.['Cnpj'] ?? pessoa?.['documento'] ?? '').replace(
        /\D/g,
        ''
      );
    if (cnpj.length === 14) {
      return o as TransportadoraObterPorIdResultDTO & Record<string, unknown>;
    }
    return null;
  }

  private normalizeBuscarResponse(
    body: unknown,
    numeroPagina: number,
    tamanhoPagina: number
  ): PagedResultDTO<TransportadoraListItemDTO> {
    const raw = body as { result?: unknown; results?: unknown[]; items?: unknown[]; itens?: unknown[] } | unknown[];
    let list: unknown[] = [];
    let total = 0;
    if (Array.isArray(raw)) {
      list = raw;
      total = raw.length;
    } else if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>;
      /** Envelope comum: { success, message, result: { results, rowCount, ... } } */
      const wrapped = r['result'];
      if (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped)) {
        const inner = wrapped as Record<string, unknown>;
        if (Array.isArray(inner['results'])) {
          list = inner['results'];
          const rc = inner['rowCount'] ?? inner['RowCount'];
          total = rc != null && String(rc).trim() !== '' ? Number(rc) : list.length;
        }
      }
      if (list.length === 0 && Array.isArray(r['results'])) {
        list = r['results'];
        total = Number((r as { rowCount?: number }).rowCount) ?? list.length;
      } else if (list.length === 0 && Array.isArray(r['items'])) {
        list = r['items'];
        total = Number(r['totalCount']) ?? list.length;
      } else if (list.length === 0 && Array.isArray(r['itens'])) {
        list = r['itens'];
        total = Number((r as { totalRegistros?: number }).totalRegistros) ?? list.length;
      } else if (list.length === 0 && Array.isArray(r['result'])) {
        list = r['result'];
        total = list.length;
      }
    }
    const items = list.map((row) => this.mapItem(row as Record<string, unknown>));
    return { items, totalCount: total, numeroPagina, tamanhoPagina };
  }

  private mapItem(row: Record<string, unknown>): TransportadoraListItemDTO {
    const getFrom = (obj: Record<string, unknown>, k: string): unknown =>
      obj[k] ?? obj[k.charAt(0).toUpperCase() + k.slice(1)];
    const bases: Record<string, unknown>[] = [row];
    for (const nestKey of ['transportadora', 'Transportadora', 'pessoaJuridica', 'PessoaJuridica', 'pessoa', 'Pessoa']) {
      const nested = row[nestKey];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        bases.push(nested as Record<string, unknown>);
      }
    }
    const firstStr = (...keys: string[]): string => {
      for (const base of bases) {
        for (const k of keys) {
          const v = getFrom(base, k);
          if (v == null || (typeof v === 'string' && v.trim() === '')) continue;
          return typeof v === 'string' ? v.trim() : String(v);
        }
      }
      return '';
    };
    const firstNum = (...keys: string[]): number | null => {
      for (const base of bases) {
        for (const k of keys) {
          const v = getFrom(base, k);
          if (v == null || v === '') continue;
          const n = Number(v);
          if (Number.isFinite(n)) return n;
        }
      }
      return null;
    };
    const get = (k: string) => getFrom(row, k);
    const ativoVal = (): boolean => {
      for (const base of bases) {
        const a = getFrom(base, 'ativo');
        if (a !== undefined && a !== null) return a !== false && a !== 0 && String(a).toLowerCase() !== 'false';
      }
      return true;
    };
    const dataRaw = firstStr(
      'dataAtualizacao',
      'DataAtualizacao',
      'dataAlteracao',
      'DataAlteracao',
      'updatedAt',
      'UpdatedAt'
    );
    return {
      id: Number(get('id') ?? get('Id')) || 0,
      razaoSocial: firstStr('razaoSocial', 'RazaoSocial', 'nomeRazaoSocial', 'NomeRazaoSocial'),
      nomeFantasia: firstStr(
        'nomeFantasia',
        'NomeFantasia',
        'descricaoPessoa',
        'DescricaoPessoa',
        'fantasia',
        'Fantasia',
        'descricao',
        'Descricao'
      ),
      cnpj: firstStr('cnpj', 'Cnpj', 'documento', 'Documento'),
      email: firstStr('email', 'Email'),
      ativo: ativoVal(),
      quantidadeVeiculos: firstNum(
        'quantidadeVeiculos',
        'QuantidadeVeiculos',
        'totalVeiculos',
        'TotalVeiculos',
        'qtdVeiculos',
        'frota',
        'Frota',
        'veiculosCount',
        'VeiculosCount'
      ),
      dataAtualizacao: dataRaw || null,
    };
  }

  private mapToDto(r: TransportadoraObterPorIdResultDTO & Record<string, unknown>): TransportadoraDTO {
    const get = (key: string) => r[key] ?? r[key.charAt(0).toUpperCase() + key.slice(1)];
    /** API pode enviar `pessoa` ou `PessoaJuridica` / `pessoaJuridica` (get cobre PascalCase). */
    const pessoaRaw = (get('pessoa') ?? get('pessoaJuridica')) as unknown;
    const pessoa =
      pessoaRaw != null && typeof pessoaRaw === 'object'
        ? (pessoaRaw as Record<string, unknown>)
        : undefined;
    const end = (r.endereco as Record<string, unknown> | undefined) ??
      ((pessoa?.['enderecos'] as Record<string, unknown>[] | undefined)?.[0]);
    const getPessoa = (key: string) => pessoa?.[key] ?? pessoa?.[key.charAt(0).toUpperCase() + key.slice(1)];
    const getEnd = (key: string) => end?.[key] ?? end?.[key.charAt(0).toUpperCase() + key.slice(1)];

    const pickMetaOuFlat = (metaVal: string | undefined, flatKey: string): string | undefined => {
      const m = metaVal?.trim();
      if (m) return m;
      const f = get(flatKey);
      return f != null && String(f).trim() !== '' ? String(f).trim() : undefined;
    };

    const pickFlat = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const value = get(key);
        if (value == null) continue;
        const str = String(value).trim();
        if (str) return str;
      }
      return undefined;
    };

    const contatosRaw = (pessoa?.['contatos'] as Record<string, unknown>[] | undefined) ?? [];
    const sorted = this.ordenarContatosPrincipalPrimeiro(contatosRaw);

    const nomeRaiz = pickFlat('responsavelLegal', 'responsavelNome', 'nomeResponsavel');
    const telRaizStr = pickFlat('responsavelTelefone', 'responsavelCelular', 'telefoneResponsavel') ?? '';
    const telRaizDigits = telRaizStr.replace(/\D/g, '');
    const cpfRaiz = (pickFlat('responsavelCpf', 'cpfResponsavel') ?? '').replace(/\D/g, '');
    const emailRaiz = pickFlat('responsavelEmail') ?? '';
    const temResponsavelNaRaiz = !!(
      (nomeRaiz && nomeRaiz.trim()) ||
      telRaizDigits.length >= 10 ||
      (cpfRaiz && cpfRaiz.length >= 11) ||
      (emailRaiz && emailRaiz.trim())
    );

    let legal: Record<string, unknown> | undefined;
    let complementRows: Record<string, unknown>[];

    if (temResponsavelNaRaiz) {
      legal = undefined;
      complementRows = contatosRaw.filter(
        (c) => !(c['principal'] === true || c['Principal'] === true)
      );
    } else {
      legal = sorted[0];
      complementRows = sorted.slice(1);
    }

    const obsLegal = temResponsavelNaRaiz
      ? ''
      : String(legal?.['observacao'] ?? legal?.['Observacao'] ?? '');
    const parsedLegal = parseObservacaoContato(obsLegal);
    const metaLegal: { n?: string; c?: string; e?: string; g?: string } = {
      n: parsedLegal.n,
      c: parsedLegal.c,
      e: parsedLegal.e,
      g: parsedLegal.g
    };
    const numeroLegal = temResponsavelNaRaiz
      ? telRaizStr.trim() || String(parsedLegal.t ?? '').trim()
      : String(legal?.['telefone'] ?? legal?.['Telefone'] ?? legal?.['numero'] ?? legal?.['Numero'] ?? '').trim() ||
        String(parsedLegal.t ?? '').trim();
    const nomeLegalFlat = temResponsavelNaRaiz
      ? (nomeRaiz ?? '').trim()
      : String(legal?.['descricao'] ?? legal?.['Descricao'] ?? '').trim();
    const primeiroContatoEhNovoFormato =
      temResponsavelNaRaiz ||
      obsLegal.startsWith(TRSPC1_PREFIX) ||
      obsLegal.trim().startsWith('{') ||
      !!String(legal?.['telefone'] ?? legal?.['Telefone'] ?? '').trim() ||
      !!nomeLegalFlat ||
      complementRows.length > 0;

    const cpfLegalFlat = temResponsavelNaRaiz
      ? cpfRaiz
      : String(legal?.['cpf'] ?? legal?.['Cpf'] ?? '').replace(/\D/g, '');
    const emailLegalFlat = temResponsavelNaRaiz
      ? emailRaiz.trim()
      : String(legal?.['email'] ?? legal?.['Email'] ?? '').trim();

    const complementares: TransportadoraContatoComplementarDTO[] = complementRows.map((row) => {
      const parsed = parseObservacaoContato(String(row['observacao'] ?? row['Observacao'] ?? ''));
      const tel = String(row['telefone'] ?? row['Telefone'] ?? row['numero'] ?? row['Numero'] ?? '').trim();
      const telFinal = tel || String(parsed.t ?? '').trim();
      const nomeFlat = String(row['descricao'] ?? row['Descricao'] ?? '').trim();
      const cpfFlat = String(row['cpf'] ?? row['Cpf'] ?? '').replace(/\D/g, '');
      const emailFlat = String(row['email'] ?? row['Email'] ?? '').trim();
      return {
        nome: nomeFlat || parsed.n?.trim() || undefined,
        cpf: cpfFlat || parsed.c || undefined,
        email: emailFlat || parsed.e?.trim() || undefined,
        telefone: telFinal || undefined
      };
    });

    const telefoneRaiz = get('telefone') != null ? String(get('telefone')).trim() : '';
    const celularFlat = pickFlat('responsavelCelular', 'telefoneResponsavel', 'responsavelTelefone') ?? '';

    let telefoneDto: string | undefined;
    let responsavelCelularDto: string | undefined;

    if (primeiroContatoEhNovoFormato) {
      telefoneDto = numeroLegal || undefined;
      responsavelCelularDto = numeroLegal || celularFlat || undefined;
    } else {
      telefoneDto = numeroLegal || telefoneRaiz || undefined;
      responsavelCelularDto = celularFlat || undefined;
    }

    return {
      id: Number(get('id')) || 0,
      razaoSocial: String(get('razaoSocial') ?? getPessoa('nomeRazaoSocial') ?? ''),
      nomeFantasia: String(get('nomeFantasia') ?? getPessoa('nomeFantasia') ?? ''),
      cnpj: String(get('cnpj') ?? getPessoa('cnpj') ?? getPessoa('documento') ?? ''),
      inscricaoEstadual: get('inscricaoEstadual') != null ? String(get('inscricaoEstadual')) : undefined,
      email: String(get('email') ?? getPessoa('email') ?? ''),
      telefone: telefoneDto,
      ativo: (get('ativo') ?? getPessoa('ativo')) !== false,
      responsavelNome: nomeLegalFlat || (pickMetaOuFlat(metaLegal.n, 'responsavelNome') ?? pickFlat('nomeResponsavel')),
      responsavelCpf: cpfLegalFlat || (pickMetaOuFlat(metaLegal.c, 'responsavelCpf') ?? pickFlat('cpfResponsavel')),
      responsavelCelular: responsavelCelularDto,
      responsavelEmail: emailLegalFlat || pickMetaOuFlat(metaLegal.e, 'responsavelEmail'),
      responsavelCargo: pickMetaOuFlat(metaLegal.g, 'responsavelCargo'),
      contatosComplementares: complementares.length > 0 ? complementares : undefined,
      endereco: end && typeof end === 'object'
        ? {
            cep: String(getEnd('cep') ?? ''),
            logradouro: String(getEnd('logradouro') ?? ''),
            numero: String(getEnd('numero') ?? ''),
            bairro: String(getEnd('bairro') ?? ''),
            cidade: String(getEnd('cidade') ?? ''),
            estado: String(getEnd('estado') ?? ''),
            complemento: String(getEnd('complemento') ?? '')
          }
        : undefined
    };
  }

  private ordenarContatosPrincipalPrimeiro(contatos: Record<string, unknown>[]): Record<string, unknown>[] {
    return [...contatos].sort((a, b) => {
      const pa = a['principal'] === true || a['Principal'] === true ? 1 : 0;
      const pb = b['principal'] === true || b['Principal'] === true ? 1 : 0;
      return pb - pa;
    });
  }

  /**
   * POST /api/Transportadora
   */
  criarTransportadora(payload: Record<string, unknown>): Observable<TransportadoraDTO> {
    if (isDevMode()) {
      console.log('PAYLOAD TRANSPORTADORA', payload);
    }
    return this.http.post<unknown>(TRANSPORTADORA, payload).pipe(
      timeout(15000),
      map((res) => this.normalizeSalvarResponse(payload, res)),
      catchError((err) => throwError(() => err))
    );
  }

  /** @deprecated Use `criarTransportadora`. */
  gravar(payload: Record<string, unknown>): Observable<TransportadoraDTO> {
    return this.criarTransportadora(payload);
  }

  /**
   * PUT /api/Transportadora
   */
  atualizarTransportadora(payload: Record<string, unknown>): Observable<TransportadoraDTO> {
    if (isDevMode()) {
      console.log('PAYLOAD TRANSPORTADORA', payload);
    }
    return this.http.put<unknown>(TRANSPORTADORA, payload).pipe(
      timeout(15000),
      map((res) => this.normalizeSalvarResponse(payload, res)),
      catchError((err) => throwError(() => err))
    );
  }

  /** @deprecated Use `atualizarTransportadora`. */
  alterar(payload: Record<string, unknown>): Observable<TransportadoraDTO> {
    return this.atualizarTransportadora(payload);
  }

  /**
   * DELETE /api/Transportadora/{id}
   */
  excluirTransportadora(id: number): Observable<void> {
    return this.http.delete<void>(`${TRANSPORTADORA}/${id}`).pipe(
      timeout(15000),
      catchError((err) => throwError(() => err))
    );
  }

  /** @deprecated Use `excluirTransportadora`. */
  excluir(id: number): Observable<void> {
    return this.excluirTransportadora(id);
  }

  private normalizeSalvarResponse(payload: Record<string, unknown>, res: unknown): TransportadoraDTO {
    const returnedId =
      res && typeof res === 'object'
        ? (res as { id?: number }).id ?? (res as { Id?: number }).Id
        : undefined;
    return this.mapPayloadToDto(payload, returnedId != null ? Number(returnedId) : undefined);
  }

  /**
   * Suporta `{ pessoaJuridica: … }` (Swagger), legado `{ transportadora: … }` ou `pessoa`.
   */
  private mapPayloadToDto(payload: Record<string, unknown>, returnedId?: number): TransportadoraDTO {
    const body =
      (payload['transportadora'] as Record<string, unknown> | undefined) ??
      (payload as Record<string, unknown>);
    const pessoaNested =
      (body['pessoa'] as Record<string, unknown> | undefined) ??
      (body['pessoaJuridica'] as Record<string, unknown> | undefined) ??
      (body['PessoaJuridica'] as Record<string, unknown> | undefined);
    const pessoa =
      pessoaNested && typeof pessoaNested === 'object'
        ? pessoaNested
        : (body as Record<string, unknown>);
    const enderecos = pessoa['enderecos'] as Record<string, unknown>[] | undefined;
    const endereco = enderecos?.[0];
    const contatos =
      (pessoa['contatos'] as
        | {
            principal?: boolean;
            observacao?: string;
            numero?: string;
            telefone?: string;
            descricao?: string;
            cpf?: string;
            email?: string;
          }[]
        | undefined) ?? [];
    const sorted = [...contatos].sort(
      (a, b) => (b.principal === true ? 1 : 0) - (a.principal === true ? 1 : 0)
    );
    const getB = (key: string) =>
      body[key] ?? body[key.charAt(0).toUpperCase() + key.slice(1)];
    const nomeRoot = String(getB('responsavelLegal') ?? getB('responsavelNome') ?? '').trim();
    const telRoot = String(getB('responsavelTelefone') ?? getB('responsavelCelular') ?? '').trim();
    const cpfRoot = String(getB('responsavelCpf') ?? '').replace(/\D/g, '');
    const emailRoot = String(getB('responsavelEmail') ?? '').trim();
    const telRootDigits = telRoot.replace(/\D/g, '');
    const useRootResponsavel = !!(
      nomeRoot ||
      telRootDigits.length >= 10 ||
      (cpfRoot && cpfRoot.length >= 11) ||
      (emailRoot && emailRoot.trim())
    );

    const legal = sorted[0] as
      | {
          principal?: boolean;
          observacao?: string;
          numero?: string;
          telefone?: string;
          descricao?: string;
          cpf?: string;
          email?: string;
        }
      | undefined;
    const compPayload = useRootResponsavel
      ? contatos
      : sorted.slice(1);

    const obsLegalStr = useRootResponsavel ? '' : String(legal?.observacao ?? '');
    const parsedLegalSave = parseObservacaoContato(obsLegalStr);
    const nomeLegalFlatSave = useRootResponsavel
      ? nomeRoot
      : String(legal?.descricao ?? '').trim();
    const cpfLegalFlatSave = useRootResponsavel ? cpfRoot : String(legal?.cpf ?? '').replace(/\D/g, '');
    const emailLegalFlatSave = useRootResponsavel ? emailRoot : String(legal?.email ?? '').trim();

    const complementares: TransportadoraContatoComplementarDTO[] = compPayload.map((row) => {
      const r = row as {
        observacao?: string;
        numero?: string;
        telefone?: string;
        descricao?: string;
        cpf?: string;
        email?: string;
      };
      const parsed = parseObservacaoContato(String(r.observacao ?? ''));
      const tel = String(r.telefone ?? r.numero ?? '').trim() || String(parsed.t ?? '').trim();
      const nomeFlat = String(r.descricao ?? '').trim();
      const cpfFlat = String(r.cpf ?? '').replace(/\D/g, '');
      const emailFlat = String(r.email ?? '').trim();
      return {
        nome: nomeFlat || parsed.n?.trim(),
        cpf: cpfFlat || parsed.c,
        email: emailFlat || parsed.e?.trim(),
        telefone: tel || undefined
      };
    });

    const pid = Number(body['id'] ?? payload['id'] ?? 0) || 0;

    return {
      id: returnedId ?? pid,
      razaoSocial: String(pessoa['nomeRazaoSocial'] ?? ''),
      nomeFantasia: String(pessoa['nomeFantasia'] ?? ''),
      cnpj: String(pessoa['cnpj'] ?? pessoa['documento'] ?? ''),
      email: String(pessoa['email'] ?? ''),
      telefone:
        useRootResponsavel && telRoot
          ? telRoot
          : legal?.telefone != null && String(legal.telefone).trim() !== ''
            ? String(legal.telefone)
            : legal?.numero != null && String(legal.numero).trim() !== ''
              ? String(legal.numero)
              : undefined,
      ativo: pessoa['ativo'] !== false,
      responsavelNome: nomeLegalFlatSave || parsedLegalSave.n,
      responsavelCpf: cpfLegalFlatSave || parsedLegalSave.c,
      responsavelCelular:
        useRootResponsavel && telRoot
          ? telRoot
          : legal?.telefone != null && String(legal.telefone).trim() !== ''
            ? String(legal.telefone)
            : legal?.numero != null
              ? String(legal.numero)
              : undefined,
      responsavelEmail: emailLegalFlatSave || parsedLegalSave.e,
      responsavelCargo: parsedLegalSave.g,
      contatosComplementares: complementares.length > 0 ? complementares : undefined,
      endereco: endereco
        ? {
            cep: String(endereco['cep'] ?? ''),
            logradouro: String(endereco['logradouro'] ?? ''),
            numero: String(endereco['numero'] ?? ''),
            bairro: String(endereco['bairro'] ?? ''),
            cidade: String(endereco['cidade'] ?? ''),
            estado: String(endereco['estado'] ?? ''),
            complemento: String(endereco['complemento'] ?? '')
          }
        : undefined
    };
  }
}
