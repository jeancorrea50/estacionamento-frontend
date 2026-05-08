import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, throwError, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  MotoristaBuscarParams,
  MotoristaDTO,
  MotoristaListItemDTO,
  PagedResultMotoristaDTO
} from '../models/motorista.dto';

const API_BASE = environment.API_BASE_URL;
const MOTORISTA = `${API_BASE}/Motorista`;

@Injectable({
  providedIn: 'root'
})
export class MotoristaService {
  constructor(private http: HttpClient) {}

  buscar(params: MotoristaBuscarParams): Observable<PagedResultMotoristaDTO> {
    const query = new URLSearchParams();
    const termo = params.Termo?.trim();
    if (termo) query.set('Descricao', termo);
    if (params.TransportadoraId != null) query.set('TransportadoraId', String(params.TransportadoraId));
    query.set('NumeroPagina', String(params.NumeroPagina));
    query.set('TamanhoPagina', String(params.TamanhoPagina));
    const url = `${MOTORISTA}?${query.toString()}`;
    return this.http.get<unknown>(url).pipe(
      timeout(15000),
      map((body) => this.normalizeBuscar(body, params.NumeroPagina, params.TamanhoPagina)),
      catchError((err) => throwError(() => err))
    );
  }

  obterPorId(id: number): Observable<MotoristaDTO | null> {
    return this.http.get<unknown>(`${MOTORISTA}/${id}`).pipe(
      timeout(15000),
      map((body) => {
        const source = body as Record<string, unknown>;
        const result = source && typeof source === 'object' && 'result' in source ? source['result'] : source;
        if (!result || typeof result !== 'object') return null;
        return this.mapMotorista(result as Record<string, unknown>);
      }),
      catchError(() => of(null))
    );
  }

  obterPorCpf(cpf: string): Observable<MotoristaDTO | null> {
    const cpfDigits = String(cpf ?? '').replace(/\D/g, '');
    if (cpfDigits.length !== 11) return of(null);
    return this.http.get<unknown>(`${MOTORISTA}/cpf/${cpfDigits}`).pipe(
      timeout(15000),
      map((body) => {
        const source = body as Record<string, unknown>;
        const result = source && typeof source === 'object' && 'result' in source ? source['result'] : source;
        if (!result || typeof result !== 'object') return null;
        return this.mapMotorista(result as Record<string, unknown>);
      }),
      catchError(() => of(null))
    );
  }

  gravar(dto: MotoristaDTO): Observable<MotoristaDTO> {
    const payload = this.dtoToPayload(dto);
    return this.http.post<unknown>(MOTORISTA, payload).pipe(
      timeout(15000),
      map((res) => {
        const response = res as Record<string, unknown>;
        const generatedId = Number(response?.['id'] ?? response?.['Id']);
        return { ...dto, id: Number.isFinite(generatedId) && generatedId > 0 ? generatedId : dto.id };
      }),
      catchError((err) => throwError(() => err))
    );
  }

  alterar(dto: MotoristaDTO): Observable<MotoristaDTO> {
    const payload = this.dtoToPayload(dto);
    return this.http.put<unknown>(MOTORISTA, payload).pipe(
      timeout(15000),
      map(() => dto),
      catchError((err) => throwError(() => err))
    );
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${MOTORISTA}/${id}`).pipe(
      timeout(15000),
      catchError((err) => throwError(() => err))
    );
  }

  private normalizeBuscar(body: unknown, numeroPagina: number, tamanhoPagina: number): PagedResultMotoristaDTO {
    const source = this.unwrapBuscarBody(body);
    let list: unknown[] = [];
    let total = 0;
    let pagina = numeroPagina;
    let tamanho = tamanhoPagina;

    if (Array.isArray(source)) {
      list = source;
      total = source.length;
    } else if (source && typeof source === 'object') {
      const obj = source as Record<string, unknown>;
      if (Array.isArray(obj['results'])) {
        list = obj['results'];
      } else if (Array.isArray(obj['items'])) {
        list = obj['items'];
      } else if (Array.isArray(obj['itens'])) {
        list = obj['itens'];
      }

      total = Number(obj['rowCount'] ?? obj['totalCount'] ?? obj['totalRegistros']) || list.length;
      pagina = Number(obj['currentPage'] ?? obj['numeroPagina'] ?? numeroPagina) || numeroPagina;
      tamanho = Number(obj['pageSize'] ?? obj['tamanhoPagina'] ?? tamanhoPagina) || tamanhoPagina;
    }

    const items = list.map((item) => this.mapMotorista(item as Record<string, unknown>));
    return { items, totalCount: total, numeroPagina: pagina, tamanhoPagina: tamanho };
  }

  private mapMotorista(source: Record<string, unknown>): MotoristaListItemDTO {
    const get = (key: string) => source[key] ?? source[key.charAt(0).toUpperCase() + key.slice(1)];
    const pessoa = (get('pessoa') ?? {}) as Record<string, unknown>;
    const getPessoa = (key: string) => pessoa[key] ?? pessoa[key.charAt(0).toUpperCase() + key.slice(1)];
    const cpfValor = String(
      getPessoa('cpf') ?? getPessoa('Cpf') ?? getPessoa('documento') ?? getPessoa('Documento') ?? get('cpf') ?? get('Cpf') ?? ''
    );
    const transportadoraId = Number(get('transportadoraId') ?? getPessoa('transportadoraId'));
    const validadeCnhRaw = get('validadeCNH') ?? get('validadeCnh');
    return {
      id: Number(get('id')) || 0,
      transportadoraId: Number.isFinite(transportadoraId) && transportadoraId > 0 ? transportadoraId : undefined,
      nomeCompleto: String(getPessoa('nomeRazaoSocial') ?? get('descricao') ?? get('nome') ?? get('nomeCompleto') ?? ''),
      cpf: cpfValor,
      email: String(getPessoa('email') ?? ''),
      cnh: String(get('cnh') ?? ''),
      vencimentoCnh: this.normalizeDate(validadeCnhRaw),
      ativo: getPessoa('ativo') !== false && get('ativo') !== false
    };
  }

  private unwrapBuscarBody(body: unknown): unknown {
    let current: unknown = body;
    for (let i = 0; i < 2; i++) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) break;
      const obj = current as Record<string, unknown>;
      if (obj['result'] != null) {
        current = obj['result'];
        continue;
      }
      if (obj['Result'] != null) {
        current = obj['Result'];
        continue;
      }
      break;
    }
    return current;
  }

  private dtoToPayload(dto: MotoristaDTO): Record<string, unknown> {
    const cpfDigits = (dto.cpf ?? '').replace(/\D/g, '');
    const payload: Record<string, unknown> = {
      id: dto.id,
      descricao: dto.nomeCompleto?.trim() || undefined,
      cnh: dto.cnh?.trim() || undefined,
      validadeCNH: this.toIsoDate(dto.vencimentoCnh),
      transportadoraId: dto.transportadoraId,
      pessoa: {
        nomeRazaoSocial: dto.nomeCompleto?.trim() || undefined,
        cpf: cpfDigits || undefined,
        email: dto.email?.trim() || undefined,
        ativo: dto.ativo
      }
    };
    return payload;
  }

  private normalizeDate(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (raw.includes('T')) {
      const dt = new Date(raw);
      if (!Number.isNaN(dt.getTime())) {
        const day = String(dt.getDate()).padStart(2, '0');
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const year = dt.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }
    return raw;
  }

  private toIsoDate(value: string | undefined): string | undefined {
    const date = (value ?? '').trim();
    if (!date) return undefined;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    if (!match) return undefined;
    const [, day, month, year] = match;
    return `${year}-${month}-${day}T00:00:00`;
  }
}
