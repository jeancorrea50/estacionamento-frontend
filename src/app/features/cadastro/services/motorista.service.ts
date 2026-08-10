import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, throwError, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { throwIfServiceFailure } from '../../../core/api/utils/service-result.util';
import { stripUndefinedDeep } from '../pages/estacionamento-form/estacionamento-form.mapper';
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
        throwIfServiceFailure(res);
        const response = res as Record<string, unknown>;
        const result =
          response?.['result'] && typeof response['result'] === 'object'
            ? (response['result'] as Record<string, unknown>)
            : response;
        const generatedId = Number(result?.['id'] ?? result?.['Id'] ?? response?.['id'] ?? response?.['Id']);
        return { ...dto, id: Number.isFinite(generatedId) && generatedId > 0 ? generatedId : dto.id };
      }),
      catchError((err) => throwError(() => err))
    );
  }

  alterar(dto: MotoristaDTO): Observable<MotoristaDTO> {
    const payload = this.dtoToPayload(dto);
    return this.http.put<unknown>(MOTORISTA, payload).pipe(
      timeout(15000),
      map((res) => {
        throwIfServiceFailure(res);
        return dto;
      }),
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
    const pfRaw = get('pessoaFisica') ?? get('PessoaFisica') ?? get('pessoa') ?? get('Pessoa');
    const pessoa =
      pfRaw != null && typeof pfRaw === 'object' ? (pfRaw as Record<string, unknown>) : {};
    const getPessoa = (key: string) => pessoa[key] ?? pessoa[key.charAt(0).toUpperCase() + key.slice(1)];
    const cpfValor = String(
      getPessoa('cpf') ??
        getPessoa('Cpf') ??
        getPessoa('documento') ??
        getPessoa('Documento') ??
        get('cpf') ??
        get('Cpf') ??
        ''
    );
    const transportadoraId = Number(get('transportadoraId') ?? getPessoa('transportadoraId'));
    const validadeCnhRaw = get('validadeCNH') ?? get('validadeCnh');
    const nomeCompleto = String(
      getPessoa('nome') ??
        getPessoa('Nome') ??
        getPessoa('nomeRazaoSocial') ??
        getPessoa('NomeRazaoSocial') ??
        get('descricao') ??
        get('nome') ??
        get('nomeCompleto') ??
        ''
    );
    const contatosArr = (getPessoa('contatos') as Record<string, unknown>[] | undefined) ?? [];
    const principalCt =
      contatosArr.find((c) => c['principal'] === true || c['Principal'] === true) ?? contatosArr[0];
    const emailPf = String(getPessoa('email') ?? getPessoa('Email') ?? '').trim();
    const emailCt = principalCt
      ? String(principalCt['email'] ?? principalCt['Email'] ?? '').trim()
      : '';
    const emailRoot = String(get('email') ?? get('Email') ?? '').trim();
    const email = emailPf || emailCt || emailRoot;

    const celularCt = principalCt
      ? String(
          principalCt['celular'] ??
            principalCt['Celular'] ??
            principalCt['telefone'] ??
            principalCt['Telefone'] ??
            principalCt['numero'] ??
            principalCt['Numero'] ??
            ''
        ).trim()
      : '';
    const celularRoot = String(get('celular') ?? get('Celular') ?? get('telefone') ?? get('Telefone') ?? '').trim();
    const celular = celularCt || celularRoot;

    const enderecosArr = (getPessoa('enderecos') as Record<string, unknown>[] | undefined) ?? [];
    const e0 = enderecosArr[0];
    const c0 = principalCt;
    const pidRoot = Number(get('pessoaId') ?? get('PessoaId'));
    const pidPf = Number(getPessoa('id') ?? getPessoa('Id'));

    return {
      id: Number(get('id')) || 0,
      transportadoraId: Number.isFinite(transportadoraId) && transportadoraId > 0 ? transportadoraId : undefined,
      nomeCompleto,
      cpf: cpfValor,
      email: email || undefined,
      celular: celular || undefined,
      cnh: String(get('cnh') ?? ''),
      vencimentoCnh: this.normalizeDate(validadeCnhRaw),
      ativo: getPessoa('ativo') !== false && get('ativo') !== false,
      pessoaId: Number.isFinite(pidRoot) && pidRoot > 0 ? pidRoot : undefined,
      pessoaFisicaId: Number.isFinite(pidPf) && pidPf > 0 ? pidPf : undefined,
      primeiroEnderecoId:
        e0 && typeof e0 === 'object' && Number(e0['id'] ?? e0['Id']) > 0
          ? Number(e0['id'] ?? e0['Id'])
          : undefined,
      primeiroContatoId:
        c0 && typeof c0 === 'object' && Number(c0['id'] ?? c0['Id']) > 0
          ? Number(c0['id'] ?? c0['Id'])
          : undefined
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

  /**
   * Contrato: POST/PUT `/api/Motorista` (sem query).
   * `transportadoraId` vai no body (camelCase JSON ↔ TransportadoraId no backend).
   */
  private dtoToPayload(dto: MotoristaDTO): Record<string, unknown> {
    const nome = (dto.nomeCompleto ?? '').trim();
    const cpfDigits = (dto.cpf ?? '').replace(/\D/g, '');
    const email = (dto.email ?? '').trim();
    const cnh = (dto.cnh ?? '').trim();
    const motoristaId = dto.id != null && dto.id > 0 ? dto.id : 0;
    const pessoaIdRoot = dto.pessoaId != null && dto.pessoaId > 0 ? dto.pessoaId : 0;
    const pfId = dto.pessoaFisicaId != null && dto.pessoaFisicaId > 0 ? dto.pessoaFisicaId : 0;
    const endId = dto.primeiroEnderecoId != null && dto.primeiroEnderecoId > 0 ? dto.primeiroEnderecoId : 0;
    const ctId = dto.primeiroContatoId != null && dto.primeiroContatoId > 0 ? dto.primeiroContatoId : 0;
    const pessoaIdNested = pessoaIdRoot > 0 ? pessoaIdRoot : 0;
    const transportadoraId =
      dto.transportadoraId != null && Number.isFinite(dto.transportadoraId) && dto.transportadoraId > 0
        ? dto.transportadoraId
        : undefined;

    const validadeCNH = this.toIsoDateTimeUtc(dto.vencimentoCnh);
    const celularDigits = String(dto.celular ?? '').replace(/\D/g, '').slice(0, 11);

    const endereco = {
      id: endId,
      pessoaId: pessoaIdNested,
      principal: true,
      tipoEndereco: 1,
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: ''
    };

    const contato = {
      id: ctId,
      pessoaId: pessoaIdNested,
      descricao: nome || 'Contato principal',
      cpf: cpfDigits,
      telefone: celularDigits || '',
      email,
      principal: true,
      observacao: ''
    };
    const pessoaFisica: Record<string, unknown> = {
      id: pfId,
      nome,
      cpf: cpfDigits,
      ativo: dto.ativo !== false,
      enderecos: [endereco],
      contatos: [contato]
    };

    const payload: Record<string, unknown> = {
      id: motoristaId,
      transportadoraId,
      cnh,
      pessoaId: pessoaIdRoot,
      pessoaFisica
    };
    if (validadeCNH != null) {
      payload['validadeCNH'] = validadeCNH;
    }
    return stripUndefinedDeep(payload) as Record<string, unknown>;
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

  /**
   * Converte DD/MM/AAAA (form) ou ISO existente para `date-time` com sufixo Z (ex.: Swagger).
   */
  private toIsoDateTimeUtc(value: string | undefined): string | undefined {
    const raw = (value ?? '').trim();
    if (!raw) return undefined;
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
    if (br) {
      const [, day, month, year] = br;
      const ms = Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
      return new Date(ms).toISOString();
    }
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return undefined;
  }

  /**
   * GET report /api/Motorista/obterModeloImportacao
   * Baixa o Excel modelo padrão (Tipo=Motorista).
   */
  downloadModeloImportacao(): Observable<Blob> {
    const url = `${environment.REPORT_BASE_URL}/Motorista/obterModeloImportacao`;
    return this.http.get(url, { responseType: 'blob' }).pipe(timeout(60000));
  }

  /**
   * POST /api/Motorista/ImportarDados — multipart Excel + transportadoraId.
   */
  importarDadosExcel(
    transportadoraId: number,
    file: File
  ): Observable<{
    ok: boolean;
    message?: string;
    totalLinhas?: number;
    sucesso?: number;
    falha?: number;
    ignorado?: number;
  }> {
    const form = new FormData();
    form.append('transportadoraId', String(transportadoraId));
    form.append('arquivo', file, file.name);
    return this.http.post<unknown>(`${MOTORISTA}/ImportarDados`, form).pipe(
      timeout(120000),
      map((body) => {
        const o = (body ?? {}) as Record<string, unknown>;
        const success = o['success'] === true || o['Success'] === true || o['sucesso'] === true;
        const msg = String(o['message'] ?? o['Message'] ?? o['mensagem'] ?? '');
        const raw = (o['result'] ?? o['Result'] ?? o['data'] ?? o['Data'] ?? o) as Record<string, unknown>;
        return {
          ok: success,
          message: msg || (success ? 'Importação concluída.' : 'Falha na importação.'),
          totalLinhas: Number(raw['totalLinhas'] ?? raw['TotalLinhas'] ?? 0) || 0,
          sucesso: Number(raw['sucesso'] ?? raw['Sucesso'] ?? 0) || 0,
          falha: Number(raw['falha'] ?? raw['Falha'] ?? 0) || 0,
          ignorado: Number(raw['ignorado'] ?? raw['Ignorado'] ?? 0) || 0
        };
      }),
      catchError((err) => {
        const msg =
          err?.error?.message ??
          err?.error?.mensagem ??
          (Array.isArray(err?.error?.notifications) ? err.error.notifications[0] : null) ??
          (Array.isArray(err?.error?.Notifications) ? err.error.Notifications[0] : null) ??
          err?.message ??
          'Falha ao importar planilha.';
        return of({ ok: false, message: String(msg) });
      })
    );
  }
}
