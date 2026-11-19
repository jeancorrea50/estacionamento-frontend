import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, throwError, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { throwIfServiceFailure } from '../../../core/api/utils/service-result.util';
import {
  PagedResultDTO,
  ResponsavelFaturamentoBuscarParams,
  ResponsavelFaturamentoDTO,
  ResponsavelFaturamentoListItemDTO,
} from '../models/responsavel-faturamento.dto';

const API = `${environment.API_BASE_URL}/ResponsavelFaturamento`;

@Injectable({ providedIn: 'root' })
export class ResponsavelFaturamentoService {
  constructor(private http: HttpClient) {}

  buscar(params: ResponsavelFaturamentoBuscarParams): Observable<PagedResultDTO<ResponsavelFaturamentoListItemDTO>> {
    const query = new URLSearchParams();
    const desc = params.Descricao?.trim();
    if (desc) query.set('Descricao', desc);
    const cnpj = String(params.Cnpj ?? '').replace(/\D/g, '');
    if (cnpj) query.set('Cnpj', cnpj);
    if (params.Ativo === true || params.Ativo === false) query.set('Ativo', String(params.Ativo));
    query.set('NumeroPagina', String(params.NumeroPagina));
    query.set('TamanhoPagina', String(params.TamanhoPagina));

    return this.http.get<unknown>(`${API}?${query}`).pipe(
      timeout(15000),
      map((body) => this.normalizeBuscar(body, params.NumeroPagina, params.TamanhoPagina)),
      catchError((err) => throwError(() => err))
    );
  }

  obterPorId(id: number): Observable<ResponsavelFaturamentoDTO | null> {
    return this.obterPorIdComRaw(id).pipe(map((x) => x?.dto ?? null));
  }

  /** Detalhe + corpo bruto (merge de ids no PUT). */
  obterPorIdComRaw(
    id: number
  ): Observable<{ dto: ResponsavelFaturamentoDTO; raw: Record<string, unknown> } | null> {
    return this.http.get<unknown>(`${API}/${id}`).pipe(
      timeout(15000),
      map((body) => {
        const raw = this.unwrapEntity(body, id);
        if (!raw) return null;
        return { dto: this.mapToDto(raw), raw };
      }),
      catchError(() => of(null))
    );
  }

  gravar(payload: Record<string, unknown>): Observable<ResponsavelFaturamentoDTO> {
    return this.http.post<unknown>(API, payload).pipe(
      timeout(15000),
      map((res) => {
        throwIfServiceFailure(res);
        const raw = this.unwrapEntity(res) ?? payload;
        return this.mapToDto(raw as Record<string, unknown>);
      }),
      catchError((err) => throwError(() => err))
    );
  }

  alterar(payload: Record<string, unknown>): Observable<ResponsavelFaturamentoDTO> {
    return this.http.put<unknown>(API, payload).pipe(
      timeout(15000),
      map((res) => {
        throwIfServiceFailure(res);
        const raw = this.unwrapEntity(res) ?? payload;
        return this.mapToDto(raw as Record<string, unknown>);
      }),
      catchError((err) => throwError(() => err))
    );
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<unknown>(`${API}/${id}`).pipe(
      timeout(15000),
      map((res) => {
        throwIfServiceFailure(res);
      }),
      catchError((err) => throwError(() => err))
    );
  }

  /** Monta body POST/PUT alinhado ao contrato do backend. */
  montarPayload(
    dto: ResponsavelFaturamentoDTO,
    mergeRaw?: Record<string, unknown> | null
  ): Record<string, unknown> {
    const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
    const uf = String(dto.endereco?.estado ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    const razao = String(dto.razaoSocial ?? '').trim();
    const fantasia = String(dto.nomeFantasia ?? '').trim();
    const descricao = (fantasia || razao).trim();
    const cnpj = onlyDigits(dto.cnpj);

    const mergePessoa = this.pickPessoa(mergeRaw);
    const pessoaId =
      Number(mergePessoa?.['id'] ?? mergePessoa?.['Id'] ?? dto.pessoaId ?? 0) || 0;
    const mergeEnd0 = ((mergePessoa?.['enderecos'] ?? mergePessoa?.['Enderecos']) as
      | Record<string, unknown>[]
      | undefined)?.[0];

    const endereco: Record<string, unknown> = {
      principal: true,
      tipoEndereco: 1,
      cep: onlyDigits(dto.endereco?.cep),
      logradouro: String(dto.endereco?.logradouro ?? '').trim(),
      numero: String(dto.endereco?.numero ?? '').trim(),
      complemento: String(dto.endereco?.complemento ?? '').trim(),
      bairro: String(dto.endereco?.bairro ?? '').trim(),
      cidade: String(dto.endereco?.cidade ?? '').trim(),
      estado: uf,
    };
    const endId = Number(mergeEnd0?.['id'] ?? mergeEnd0?.['Id'] ?? dto.endereco?.id ?? 0);
    if (endId > 0) endereco['id'] = endId;
    const endPessoaId = Number(mergeEnd0?.['pessoaId'] ?? mergeEnd0?.['PessoaId'] ?? pessoaId);
    if (endPessoaId > 0) endereco['pessoaId'] = endPessoaId;

    const pessoaJuridica: Record<string, unknown> = {
      tipoPessoa: 1,
      nomeRazaoSocial: razao,
      descricao,
      cnpj,
      ativo: dto.ativo !== false,
    };
    if (pessoaId > 0) pessoaJuridica['id'] = pessoaId;

    // Só envia endereço quando há conteúdo; evita wipe de Pessoa reutilizada por CNPJ.
    const temEndereco =
      Boolean(String(endereco['cep'] ?? '').trim()) ||
      Boolean(String(endereco['logradouro'] ?? '').trim()) ||
      Boolean(String(endereco['cidade'] ?? '').trim());
    if (temEndereco) pessoaJuridica['enderecos'] = [endereco];

    const rootId = Number(dto.id ?? mergeRaw?.['id'] ?? mergeRaw?.['Id'] ?? 0) || 0;
    return {
      id: rootId,
      nomeFantasia: fantasia || razao,
      responsavelLegal: String(dto.responsavelLegal ?? '').trim(),
      responsavelEmail: String(dto.responsavelEmail ?? '').trim(),
      responsavelTelefone: onlyDigits(dto.responsavelTelefone),
      pessoaJuridica,
    };
  }

  private normalizeBuscar(
    body: unknown,
    numeroPagina: number,
    tamanhoPagina: number
  ): PagedResultDTO<ResponsavelFaturamentoListItemDTO> {
    let list: unknown[] = [];
    let total = 0;
    const root = body as Record<string, unknown> | unknown[];

    if (Array.isArray(root)) {
      list = root;
      total = root.length;
    } else if (root && typeof root === 'object') {
      // Envelope: { success, result: { results|Results, rowCount } } ou página na raiz.
      const wrapped = root['result'] ?? root['Result'];
      const candidates: unknown[] = [];
      if (wrapped != null) candidates.push(wrapped);
      candidates.push(root);

      for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
          list = candidate;
          total = candidate.length;
          break;
        }
        if (!candidate || typeof candidate !== 'object') continue;
        const source = candidate as Record<string, unknown>;
        const results = source['results'] ?? source['Results'] ?? source['items'] ?? source['Items'];
        if (Array.isArray(results)) {
          list = results;
          total =
            Number(
              source['rowCount'] ??
                source['RowCount'] ??
                source['totalCount'] ??
                source['TotalCount'] ??
                list.length
            ) || list.length;
          break;
        }
      }
    }

    return {
      items: list.map((row) => this.mapListItem(row as Record<string, unknown>)),
      totalCount: total,
      numeroPagina,
      tamanhoPagina,
    };
  }

  private unwrapEntity(body: unknown, fallbackId?: number): Record<string, unknown> | null {
    let cur: unknown = body;
    for (let depth = 0; depth < 6 && cur != null && typeof cur === 'object'; depth++) {
      const o = cur as Record<string, unknown>;
      if (o['id'] != null || o['Id'] != null || o['pessoa'] != null || o['Pessoa'] != null || o['pessoaJuridica'] != null) {
        if (fallbackId != null && fallbackId > 0 && o['id'] == null && o['Id'] == null) {
          return { ...o, id: fallbackId };
        }
        return o;
      }
      const inner = o['result'] ?? o['Result'];
      if (inner != null && typeof inner === 'object') {
        cur = inner;
        continue;
      }
      break;
    }
    return cur != null && typeof cur === 'object' && !Array.isArray(cur)
      ? (cur as Record<string, unknown>)
      : null;
  }

  private pickPessoa(raw?: Record<string, unknown> | null): Record<string, unknown> | undefined {
    if (!raw) return undefined;
    const p =
      raw['pessoa'] ?? raw['Pessoa'] ?? raw['pessoaJuridica'] ?? raw['PessoaJuridica'];
    return p && typeof p === 'object' ? (p as Record<string, unknown>) : undefined;
  }

  private get(obj: Record<string, unknown>, key: string): unknown {
    return obj[key] ?? obj[key.charAt(0).toUpperCase() + key.slice(1)];
  }

  private mapListItem(row: Record<string, unknown>): ResponsavelFaturamentoListItemDTO {
    const g = (k: string) => this.get(row, k);
    const ativoRaw = g('ativo');
    return {
      id: Number(g('id')) || 0,
      razaoSocial: String(g('razaoSocial') ?? ''),
      nomeFantasia: String(g('nomeFantasia') ?? ''),
      cnpj: String(g('cnpj') ?? ''),
      email: String(g('email') ?? g('responsavelEmail') ?? ''),
      telefone: String(g('telefone') ?? g('responsavelTelefone') ?? '') || undefined,
      ativo: ativoRaw === undefined || ativoRaw === null ? true : ativoRaw !== false && ativoRaw !== 0 && String(ativoRaw).toLowerCase() !== 'false',
      pessoaId: Number(g('pessoaId')) || null,
      responsavelLegal: String(g('responsavelLegal') ?? '') || null,
      responsavelEmail: String(g('responsavelEmail') ?? '') || null,
      responsavelTelefone: String(g('responsavelTelefone') ?? '') || null,
      dataAtualizacao: g('dataAtualizacao') != null ? String(g('dataAtualizacao')) : null,
    };
  }

  private mapToDto(r: Record<string, unknown>): ResponsavelFaturamentoDTO {
    const g = (k: string) => this.get(r, k);
    const pessoa = this.pickPessoa(r);
    const gp = (k: string) => (pessoa ? this.get(pessoa, k) : undefined);
    const ends = (pessoa?.['enderecos'] ?? pessoa?.['Enderecos']) as Record<string, unknown>[] | undefined;
    const end = ends?.[0];
    const ge = (k: string) => (end ? this.get(end, k) : undefined);
    const ativoRaw = g('ativo') ?? gp('ativo');

    return {
      id: Number(g('id')) || 0,
      pessoaId: Number(gp('id') ?? g('pessoaId')) || null,
      razaoSocial: String(g('razaoSocial') ?? gp('nomeRazaoSocial') ?? ''),
      nomeFantasia: String(g('nomeFantasia') ?? gp('nomeFantasia') ?? gp('descricao') ?? ''),
      cnpj: String(g('cnpj') ?? gp('cnpj') ?? ''),
      ativo: ativoRaw === undefined || ativoRaw === null ? true : ativoRaw !== false && ativoRaw !== 0 && String(ativoRaw).toLowerCase() !== 'false',
      responsavelLegal: String(g('responsavelLegal') ?? '') || undefined,
      responsavelEmail: String(g('responsavelEmail') ?? '') || undefined,
      responsavelTelefone: String(g('responsavelTelefone') ?? '') || undefined,
      endereco: end
        ? {
            id: Number(ge('id')) || undefined,
            pessoaId: Number(ge('pessoaId')) || undefined,
            cep: String(ge('cep') ?? ''),
            logradouro: String(ge('logradouro') ?? ''),
            numero: String(ge('numero') ?? ''),
            bairro: String(ge('bairro') ?? ''),
            cidade: String(ge('cidade') ?? ''),
            estado: String(ge('estado') ?? ''),
            complemento: String(ge('complemento') ?? ''),
          }
        : undefined,
    };
  }
}
