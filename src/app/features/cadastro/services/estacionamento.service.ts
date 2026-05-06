import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, timeout, throwError } from 'rxjs';
import {
  EstacionamentoDTO,
  EstacionamentoListItemDTO,
  EstacionamentoObterPorIdResultDTO,
  ApiResponseDTO,
  EstacionamentoBuscarParams,
  PagedResultDTO,
  EnderecoDTO,
  EstacionamentoPayloadMergeContext
} from '../models/estacionamento.dto';
import { environment } from '../../../../environments/environment';
import { EstacionamentoPaths } from '../constants/estacionamento-api.paths';

/** Base da API do backend (dev: /api com proxy; prod: URL completa). */
const API_BASE = environment.API_BASE_URL;
const Estacionamento = `${API_BASE}/Estacionamento`;

/** Objeto no formato do formulário (para patchValue) após carregar ObterPorId */
export interface EstacionamentoFormValue {
  id: number;
  descricao: string;
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
  responsavelLegalNome: string;
  responsavelLegalCpf: string;
  contatoTelefone: string;
  capacidadeVeiculos: number | null;
  tamanho: string;
  possuiSeguranca: boolean;
  possuiBanheiro: boolean;
  tipoTaxaMensalidade: 'taxa' | 'mensalidade' | null;
  taxaPercentual: number | null;
  mensalidadeValor: number | null;
  latitude?: number | null;
  longitude?: number | null;
  responsavelLegalEmail?: string;
  contatoComplementarNome?: string;
  contatoComplementarCpf?: string;
  contatoComplementarTelefone?: string;
  contatoComplementarEmail?: string;
  /** Preservar ao alterar (payload pessoa.enderecos). */
  enderecos?: EnderecoDTO[];
  /** Dados bancários (backend) */
  banco?: string;
  agencia?: string;
  conta?: string;
  tipoConta?: string;
  chavePix?: string;
  contaBancariaId?: number | null;
  titularRazaoSocial?: string;
  titularCnpj?: string;
  /** Fotos retornadas pela API (base64 ou URL); exibidas no passo Fotos. */
  loadedFotosBase64?: string[];
  /** Dados do GET para montar PUT completo (datas, conta preservada). */
  payloadMerge?: EstacionamentoPayloadMergeContext;
}

@Injectable({
  providedIn: 'root'
})
export class EstacionamentoService {
  constructor(private http: HttpClient) {}

  /** POST /api/Estacionamento (body: EstacionamentoPostInput). */
  gravar(dto: EstacionamentoDTO | Record<string, unknown>): Observable<EstacionamentoDTO> {
    const url = EstacionamentoPaths.gravar
      ? `${Estacionamento}/${EstacionamentoPaths.gravar}`
      : Estacionamento;
    return this.http.post<unknown>(url, dto).pipe(
      map((body) => this.unwrapGravarAlterarResponse(body))
    );
  }

  /** PUT /api/Estacionamento (body: EstacionamentoPutInput). */
  alterar(dto: EstacionamentoDTO | Record<string, unknown>): Observable<EstacionamentoDTO> {
    const url = EstacionamentoPaths.alterar
      ? `${Estacionamento}/${EstacionamentoPaths.alterar}`
      : Estacionamento;
    return this.http.put<unknown>(url, dto).pipe(
      map((body) => this.unwrapGravarAlterarResponse(body))
    );
  }

  /** API GTS costuma devolver `{ success, result: { id, ... } }`; o formulário usa `res.id`. */
  private unwrapGravarAlterarResponse(body: unknown): EstacionamentoDTO {
    if (body != null && typeof body === 'object') {
      const o = body as Record<string, unknown>;
      const inner = o['result'] ?? o['Result'];
      if (inner != null && typeof inner === 'object') {
        return inner as unknown as EstacionamentoDTO;
      }
      if ('id' in o) {
        return o as unknown as EstacionamentoDTO;
      }
    }
    return body as EstacionamentoDTO;
  }

  /** DELETE /api/Estacionamento/{id} */
  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${Estacionamento}/${EstacionamentoPaths.excluir(id)}`);
  }

  /**
   * GET /api/Estacionamento?... (query: Descricao, DataInicial, DataFinal, paginação, etc.)
   * Termo do formulário é mapeado para Descricao (campo do OpenAPI).
   */
  buscar(params: EstacionamentoBuscarParams): Observable<PagedResultDTO<EstacionamentoListItemDTO>> {
    const query = new URLSearchParams();
    const fromTermo = params.Termo != null && params.Termo.trim() !== '' ? params.Termo.trim() : '';
    const fromDesc = params.Descricao != null && params.Descricao.trim() !== '' ? params.Descricao.trim() : '';
    const desc = fromDesc || fromTermo;
    if (desc !== '') {
      query.set('Descricao', desc);
    }
    if (params.DataInicial != null) query.set('DataInicial', params.DataInicial);
    if (params.DataFinal != null) query.set('DataFinal', params.DataFinal);
    query.set('NumeroPagina', String(params.NumeroPagina));
    query.set('TamanhoPagina', String(params.TamanhoPagina));
    if (params.Propriedade != null) query.set('Propriedade', params.Propriedade);
    if (params.Sort != null) query.set('Sort', params.Sort);

    const listUrl = EstacionamentoPaths.buscar
      ? `${Estacionamento}/${EstacionamentoPaths.buscar}`
      : Estacionamento;
    const url = `${listUrl}?${query.toString()}`;
    return this.http.get<unknown>(url).pipe(
      timeout(15000),
      map((body) => {
        try {
          return this.normalizeBuscarResponse(body, params.NumeroPagina, params.TamanhoPagina);
        } catch {
          return {
            items: [],
            totalCount: 0,
            numeroPagina: params.NumeroPagina,
            tamanhoPagina: params.TamanhoPagina
          } as PagedResultDTO<EstacionamentoListItemDTO>;
        }
      }),
      catchError((err) => throwError(() => err))
    );
  }

  /** Remove um ou dois níveis `{ result / Result }` típicos da API. */
  private peelApiEnvelope(body: unknown): unknown {
    let cur: unknown = body;
    for (let depth = 0; depth < 2; depth++) {
      if (cur == null || typeof cur !== 'object' || Array.isArray(cur)) break;
      const o = cur as Record<string, unknown>;
      if ('result' in o && o['result'] != null) {
        cur = o['result'];
        continue;
      }
      if ('Result' in o && o['Result'] != null) {
        cur = o['Result'];
        continue;
      }
      break;
    }
    return cur;
  }

  private normalizeBuscarResponse(
    body: unknown,
    numeroPagina: number,
    tamanhoPagina: number
  ): PagedResultDTO<EstacionamentoListItemDTO> {
    const result = this.peelApiEnvelope(body);

    const empty = (): PagedResultDTO<EstacionamentoListItemDTO> => ({
      items: [],
      totalCount: 0,
      numeroPagina,
      tamanhoPagina
    });

    const toList = (arr: unknown[]): EstacionamentoListItemDTO[] => {
      const list: EstacionamentoListItemDTO[] = [];
      for (const row of arr) {
        if (row != null && typeof row === 'object') {
          try {
            list.push(this.mapBuscarItemToListItem(row as Record<string, unknown>));
          } catch {
            // ignora item com formato inesperado
          }
        }
      }
      return list;
    };

    // API retorna result.results / Results + rowCount / RowCount
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      const resultsArr = r['results'] ?? r['Results'];
      if (Array.isArray(resultsArr)) {
        const list = toList(resultsArr);
        const rowCount = r['rowCount'] ?? r['RowCount'];
        const currentPage = r['currentPage'] ?? r['CurrentPage'];
        const pageSize = r['pageSize'] ?? r['PageSize'];
        return {
          items: list,
          totalCount: Number(rowCount) || list.length,
          numeroPagina: Number(currentPage) || numeroPagina,
          tamanhoPagina: Number(pageSize) || tamanhoPagina
        };
      }
    }
    if (Array.isArray(result)) {
      const list = toList(result);
      return { items: list, totalCount: list.length, numeroPagina, tamanhoPagina };
    }
    if (result && typeof result === 'object' && 'items' in result) {
      const r = result as { items?: unknown[]; totalCount?: number };
      const list = Array.isArray(r.items) ? toList(r.items) : [];
      return {
        items: list,
        totalCount: r.totalCount ?? list.length,
        numeroPagina,
        tamanhoPagina
      };
    }
    if (result && typeof result === 'object' && 'itens' in result) {
      const r = result as { itens?: unknown[]; totalRegistros?: number };
      const items = Array.isArray(r.itens) ? toList(r.itens) : [];
      return {
        items,
        totalCount: (r as { totalRegistros?: number }).totalRegistros ?? items.length,
        numeroPagina,
        tamanhoPagina
      };
    }
    // result.data / list / value (formatos alternativos)
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      if (Array.isArray(r['data'])) {
        const list = toList(r['data'] as unknown[]);
        return { items: list, totalCount: list.length, numeroPagina, tamanhoPagina };
      }
      if (Array.isArray(r['list'])) {
        const list = toList(r['list'] as unknown[]);
        return { items: list, totalCount: list.length, numeroPagina, tamanhoPagina };
      }
      if (Array.isArray(r['value'])) {
        const list = toList(r['value'] as unknown[]);
        return { items: list, totalCount: list.length, numeroPagina, tamanhoPagina };
      }
    }
    return empty();
  }

  /** Mapeia item do Buscar para EstacionamentoListItemDTO (aceita PascalCase, aninhamentos e tipo/tipoPessoa). */
  private mapBuscarItemToListItem(row: Record<string, unknown>): EstacionamentoListItemDTO {
    if (!row || typeof row !== 'object') {
      return {
        id: 0,
        pessoaId: null,
        descricao: '',
        tipoPessoa: 2,
        nomeRazaoSocial: '',
        cnpj: '',
        email: '',
        ativo: true,
        capacidadeVeiculo: null,
        tamanhoTerreno: ''
      };
    }
    const getKey = (obj: Record<string, unknown>, k: string): unknown =>
      obj[k] ?? obj[k.charAt(0).toUpperCase() + k.slice(1)];
    const rowBases = (): Record<string, unknown>[] => {
      const bases: Record<string, unknown>[] = [row];
      for (const nestKey of ['estacionamento', 'Estacionamento']) {
        const nested = row[nestKey];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          bases.push(nested as Record<string, unknown>);
        }
      }
      return bases;
    };
    const firstOfKeys = (keys: string[]): unknown => {
      for (const base of rowBases()) {
        for (const k of keys) {
          const v = getKey(base, k);
          if (v == null) continue;
          if (typeof v === 'string' && v.trim() === '') continue;
          return v;
        }
      }
      return undefined;
    };
    const g = (k: string) => getKey(row, k);
    const pessoaRow = row['pessoa'] ?? row['Pessoa'];
    const pessoaObj =
      pessoaRow && typeof pessoaRow === 'object' && !Array.isArray(pessoaRow)
        ? (pessoaRow as Record<string, unknown>)
        : null;
    const gPessoa = (k: string) => (pessoaObj ? getKey(pessoaObj, k) : undefined);
    const tipoRaw = g('tipo') ?? g('tipoPessoa');
    const tipoNum = Number(tipoRaw);
    const capacidadeRaw = firstOfKeys([
      'capacidadeVeiculo',
      'capacidade',
      'qtdVeiculos',
      'quantidadeVeiculos',
      'vagas'
    ]);
    const capacidade =
      capacidadeRaw == null || String(capacidadeRaw).trim() === ''
        ? null
        : Number(capacidadeRaw);
    const tamanhoRaw = firstOfKeys(['tamanhoTerreno', 'tamanho', 'areaTerreno', 'metrosQuadrados', 'area']);
    const nomeRazao =
      String(g('nomeRazaoSocial') ?? gPessoa('nomeRazaoSocial') ?? gPessoa('nome') ?? '').trim();
    const cnpj = String(g('cnpj') ?? g('documento') ?? gPessoa('cnpj') ?? gPessoa('documento') ?? '').trim();
    const email = String(g('email') ?? gPessoa('email') ?? '').trim();
    const descricao =
      String(g('descricao') ?? gPessoa('nomeFantasia') ?? gPessoa('descricao') ?? '').trim();
    return {
      id: Number(g('id')) || 0,
      pessoaId: Number(g('pessoaId')) || Number(gPessoa('id')) || null,
      descricao,
      tipoPessoa: (tipoNum === 1 ? 1 : 2) as 1 | 2,
      nomeRazaoSocial: nomeRazao,
      cnpj,
      email,
      ativo: g('ativo') !== false && (pessoaObj ? getKey(pessoaObj, 'ativo') !== false : true),
      capacidadeVeiculo: Number.isFinite(capacidade as number) ? (capacidade as number) : null,
      tamanhoTerreno: tamanhoRaw != null ? String(tamanhoRaw).trim() : ''
    };
  }

  /**
   * GET /api/Estacionamento/{id}
   * Retorna o valor já mapeado para o formulário de edição.
   */
  obterPorId(id: number): Observable<EstacionamentoFormValue | null> {
    return this.http.get<unknown>(`${Estacionamento}/${EstacionamentoPaths.obterPorId(id)}`).pipe(
      timeout(15000),
      map((body) => {
        const result = this.extractObterPorIdPayload(body);
        if (result && typeof result === 'object' && 'pessoa' in result && result.pessoa) {
          return this.mapResultToFormValue(result as EstacionamentoObterPorIdResultDTO);
        }
        return null;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * GET /api/Estacionamento/{id} — retorna DTO do formulário e o objeto bruto (validar contaBancaria após PUT).
   */
  obterPorIdDetalhado(id: number): Observable<{
    dto: EstacionamentoFormValue | null;
    raw: EstacionamentoObterPorIdResultDTO | null;
  }> {
    return this.http.get<unknown>(`${Estacionamento}/${EstacionamentoPaths.obterPorId(id)}`).pipe(
      timeout(15000),
      map((body) => {
        const result = this.extractObterPorIdPayload(body);
        if (result && typeof result === 'object' && 'pessoa' in result && result.pessoa) {
          const r = result as EstacionamentoObterPorIdResultDTO;
          return { dto: this.mapResultToFormValue(r), raw: r };
        }
        return { dto: null, raw: null };
      }),
      catchError((err: unknown) => throwError(() => err))
    );
  }

  private extractObterPorIdPayload(body: unknown): EstacionamentoObterPorIdResultDTO | null {
    const peeled = this.peelApiEnvelope(body);
    if (peeled && typeof peeled === 'object' && 'pessoa' in peeled) {
      return peeled as EstacionamentoObterPorIdResultDTO;
    }
    const res = body as ApiResponseDTO<EstacionamentoObterPorIdResultDTO> | undefined;
    if (res?.result && typeof res.result === 'object' && 'pessoa' in res.result) {
      return res.result;
    }
    return null;
  }

  private mapResultToFormValue(r: EstacionamentoObterPorIdResultDTO): EstacionamentoFormValue {
    const p = r.pessoa;
    const telefone = p?.contatos?.find((c) => c.principal)?.numero ?? p?.contatos?.[0]?.numero ?? '';
    const raw = r as unknown as Record<string, unknown>;
    const contaBancariaRaw = (raw['contaBancaria'] ?? raw['ContaBancaria']) as unknown;
    const contaBancaria =
      Array.isArray(contaBancariaRaw) && contaBancariaRaw.length > 0
        ? (contaBancariaRaw[0] as Record<string, unknown>)
        : contaBancariaRaw != null && typeof contaBancariaRaw === 'object' && !Array.isArray(contaBancariaRaw)
          ? (contaBancariaRaw as Record<string, unknown>)
          : undefined;
    const banco = contaBancaria?.['banco'] ?? contaBancaria?.['Banco'] ?? r.banco ?? '';
    const agenciaNumero = contaBancaria?.['agencia'] ?? contaBancaria?.['Agencia'] ?? r.agencia ?? '';
    const agenciaDigito = contaBancaria?.['agenciaDigito'] ?? contaBancaria?.['AgenciaDigito'] ?? '';
    const contaNumero = contaBancaria?.['conta'] ?? contaBancaria?.['Conta'] ?? r.conta ?? '';
    const contaDigito = contaBancaria?.['contaDigito'] ?? contaBancaria?.['ContaDigito'] ?? '';
    const titular = contaBancaria?.['titular'] ?? contaBancaria?.['Titular'] ?? '';
    const cpfCnpj = contaBancaria?.['cpfCnpj'] ?? contaBancaria?.['CpfCnpj'] ?? '';
    const agencia = [String(agenciaNumero ?? '').trim(), String(agenciaDigito ?? '').trim()].filter(Boolean).join('-');
    const conta = [String(contaNumero ?? '').trim(), String(contaDigito ?? '').trim()].filter(Boolean).join('-');
    const tipoContaRaw = String(contaBancaria?.['tipoConta'] ?? contaBancaria?.['TipoConta'] ?? r.tipoConta ?? '').trim();
    const tipoContaNorm =
      tipoContaRaw.toLowerCase() === 'corrente'
        ? 'corrente'
        : tipoContaRaw.toLowerCase() === 'poupanca' || tipoContaRaw.toLowerCase() === 'poupança'
          ? 'poupanca'
          : tipoContaRaw;
    const tipoTaxa = r.tipoCobranca === 1 ? 'taxa' : r.tipoCobranca === 2 ? 'mensalidade' : null;

    const pessoaRaw = raw['pessoa'] ?? raw['Pessoa'];
    const pObj = pessoaRaw && typeof pessoaRaw === 'object' ? (pessoaRaw as Record<string, unknown>) : {};

    const contaClone =
      contaBancaria && typeof contaBancaria === 'object'
        ? ({ ...(contaBancaria as Record<string, unknown>) } as Record<string, unknown>)
        : null;

    const payloadMerge: EstacionamentoPayloadMergeContext = {
      estacionamentoDataCriacao: r.dataCriacao,
      estacionamentoDataAtualizacao: r.dataAtualizacao ?? null,
      contaBancariaPreserved: contaClone,
      pessoaDescricao:
        String((pObj['descricao'] ?? pObj['Descricao'] ?? '') || '').trim() ||
        (p?.nomeFantasia ?? p?.nomeRazaoSocial ?? '') ||
        null,
      pessoaDataCriacao: String(pObj['dataCriacao'] ?? pObj['DataCriacao'] ?? p?.dataCriacao ?? ''),
      pessoaDataAtualizacao:
        (pObj['dataAtualizacao'] ?? pObj['DataAtualizacao'] ?? p?.dataAtualizacao ?? null) as string | null
    };

    const descricaoRoot =
      String(raw['descricao'] ?? raw['Descricao'] ?? '').trim() ||
      String(p?.nomeFantasia ?? '').trim() ||
      String(p?.nomeRazaoSocial ?? '').trim();

    const responsavelEmailRaw =
      raw['responsavelLegalEmail'] ??
      raw['ResponsavelLegalEmail'] ??
      raw['emailResponsavel'] ??
      raw['EmailResponsavel'];

    return {
      id: r.id,
      descricao: descricaoRoot,
      pessoaId: r.pessoaId,
      pessoa: {
        id: p?.id ?? 0,
        tipoPessoa: (p?.tipoPessoa === 1 ? 1 : 2) as 1 | 2,
        nomeRazaoSocial: p?.nomeRazaoSocial ?? '',
        nomeFantasia:
          String(raw['descricao'] ?? raw['Descricao'] ?? '').trim() ||
          String(p?.nomeFantasia ?? pObj['nomeFantasia'] ?? pObj['NomeFantasia'] ?? '').trim(),
        cnpj: p?.cnpj ?? String((pObj['documento'] ?? pObj['Documento'] ?? '') || ''),
        email: p?.email ?? '',
        ativo: p?.ativo ?? true
      },
      responsavelLegalNome: r.resposanvelLegal ?? '',
      responsavelLegalCpf: r.responsavelCpf ?? '',
      responsavelLegalEmail: String(responsavelEmailRaw ?? '').trim(),
      contatoTelefone: telefone,
      capacidadeVeiculos: r.capacidadeVeiculo ?? null,
      tamanho: r.tamanhoTerreno ?? '',
      possuiSeguranca: r.possuiSeguranca ?? false,
      possuiBanheiro: r.possuiBanheiro ?? false,
      tipoTaxaMensalidade: tipoTaxa,
      taxaPercentual: r.cobrancaPorcentagem != null ? r.cobrancaPorcentagem : null,
      mensalidadeValor: r.cobrancaValor != null ? r.cobrancaValor : null,
      latitude: (r as unknown as Record<string, unknown>)['latitude'] as number | null ?? null,
      longitude: (r as unknown as Record<string, unknown>)['longitude'] as number | null ?? null,
      enderecos: p?.enderecos ?? [],
      banco: String(banco ?? ''),
      agencia: String(agencia ?? ''),
      conta: String(conta ?? ''),
      tipoConta: String(tipoContaNorm),
      chavePix: String(contaBancaria?.['chavePix'] ?? contaBancaria?.['ChavePix'] ?? r.chavePix ?? ''),
      contaBancariaId: Number(contaBancaria?.['id'] ?? contaBancaria?.['Id']) || null,
      titularRazaoSocial: String(titular ?? ''),
      titularCnpj: String(cpfCnpj ?? ''),
      loadedFotosBase64: r.fotos ?? [],
      payloadMerge
    };
  }
}
