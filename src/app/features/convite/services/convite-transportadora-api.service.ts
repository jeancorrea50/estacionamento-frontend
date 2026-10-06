import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';

const PUBLIC = `${environment.API_BASE_URL}/public/convite-transportadora`;
const AUTH = `${environment.API_BASE_URL}/ConviteTransportadora`;

export interface ConviteTransportadoraDto {
  id: number;
  token: string;
  urlConvite: string;
  emailConvidado: string;
  etapaAtual: number;
  status: string;
  clientUrl: string;
  estacionamentoId: number;
  codExportacao?: string;
  dataCriacao: string;
  dataExpiracao?: string;
  dataConclusao?: string;
  transportadoraIdCriada?: number;
  usuarioIdCriado?: number;
  emailEnviado?: boolean;
  urlWhatsApp?: string | null;
  urlSms?: string | null;
  mensagemCompartilhamento?: string | null;
  responsavelNome?: string;
  responsavelCpf?: string;
  responsavelEmail?: string;
  responsavelTelefone?: string;
  responsavelDataNascimento?: string;
  responsavelNomeMae?: string;
  userName?: string;
  emailAcesso?: string;
  possuiSenha?: boolean;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  inscricaoEstadual?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

export interface PagedResultConviteTransportadora {
  results: ConviteTransportadoraDto[];
  currentPage: number;
  pageCount: number;
  pageSize: number;
  rowCount: number;
}

interface ApiEnvelope<T> {
  success?: boolean;
  Success?: boolean;
  sucess?: boolean;
  data?: T;
  Data?: T;
  result?: T;
  Result?: T;
  message?: string;
  Message?: string;
  userMessage?: string;
  errors?: string[] | string;
}

@Injectable({ providedIn: 'root' })
export class ConviteTransportadoraApiService {
  private http = inject(HttpClient);

  /** Público — sem Bearer. */
  obterPorToken(token: string): Observable<ConviteTransportadoraDto> {
    return this.http.get<unknown>(`${PUBLIC}/${encodeURIComponent(token)}`).pipe(
      map((body) => this.unwrap(body)),
      catchError((e) => this.rethrow(e))
    );
  }

  salvarAcesso(token: string, body: {
    userName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Observable<ConviteTransportadoraDto> {
    return this.http.put<unknown>(`${PUBLIC}/${encodeURIComponent(token)}/etapa/acesso`, body).pipe(
      map((b) => this.unwrap(b)),
      catchError((e) => this.rethrow(e))
    );
  }

  salvarResponsavel(token: string, body: {
    nome: string;
    cpf: string;
    email: string;
    telefone?: string;
    dataNascimento?: string | null;
    nomeMae?: string;
  }): Observable<ConviteTransportadoraDto> {
    return this.http.put<unknown>(`${PUBLIC}/${encodeURIComponent(token)}/etapa/responsavel`, body).pipe(
      map((b) => this.unwrap(b)),
      catchError((e) => this.rethrow(e))
    );
  }

  salvarEmpresa(token: string, body: {
    razaoSocial: string;
    nomeFantasia: string;
    cnpj: string;
    inscricaoEstadual?: string;
  }): Observable<ConviteTransportadoraDto> {
    return this.http.put<unknown>(`${PUBLIC}/${encodeURIComponent(token)}/etapa/empresa`, body).pipe(
      map((b) => this.unwrap(b)),
      catchError((e) => this.rethrow(e))
    );
  }

  salvarEndereco(token: string, body: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
  }): Observable<ConviteTransportadoraDto> {
    return this.http.put<unknown>(`${PUBLIC}/${encodeURIComponent(token)}/etapa/endereco`, body).pipe(
      map((b) => this.unwrap(b)),
      catchError((e) => this.rethrow(e))
    );
  }

  /** Autenticado — estacionamento. */
  criar(body: {
    emailConvidado: string;
    clientUrl?: string;
    responsavelNome: string;
    responsavelCpf?: string;
    responsavelEmail?: string;
    responsavelTelefone?: string;
    responsavelDataNascimento?: string | null;
    responsavelNomeMae?: string;
    diasExpiracao?: number;
  }): Observable<ConviteTransportadoraDto> {
    return this.http.post<unknown>(AUTH, body).pipe(
      map((b) => this.unwrap(b)),
      catchError((e) => this.rethrow(e))
    );
  }

  listar(params?: {
    NumeroPagina?: number;
    TamanhoPagina?: number;
    Status?: string;
    Busca?: string;
  }): Observable<PagedResultConviteTransportadora> {
    const page = params?.NumeroPagina && params.NumeroPagina > 0 ? params.NumeroPagina : 1;
    const size = params?.TamanhoPagina && params.TamanhoPagina > 0 ? params.TamanhoPagina : 10;
    const query = new URLSearchParams();
    query.set('NumeroPagina', String(page));
    query.set('TamanhoPagina', String(size));
    if (params?.Status?.trim()) query.set('Status', params.Status.trim());
    if (params?.Busca?.trim()) query.set('Busca', params.Busca.trim());

    return this.http.get<unknown>(`${AUTH}?${query.toString()}`).pipe(
      map((body) => this.normalizePaged(body, page, size)),
      catchError((e) => this.rethrow(e))
    );
  }

  /** Reenvia e-mail mantendo o mesmo token/etapaAtual. */
  reenviar(id: number): Observable<ConviteTransportadoraDto> {
    return this.http.post<unknown>(`${AUTH}/${id}/reenviar`, {}).pipe(
      map((b) => this.unwrap(b)),
      catchError((e) => this.rethrow(e))
    );
  }

  cancelar(id: number): Observable<ConviteTransportadoraDto> {
    return this.http.post<unknown>(`${AUTH}/${id}/cancelar`, {}).pipe(
      map((b) => this.unwrap(b)),
      catchError((e) => this.rethrow(e))
    );
  }

  private rethrow(err: unknown) {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ApiEnvelope<unknown> | string | null;
      let message = err.message;
      if (body && typeof body === 'object') {
        const errors = body.errors ?? body.message ?? body.Message ?? body.userMessage;
        message = Array.isArray(errors) ? errors.join(' ') : String(errors ?? message);
      } else if (typeof body === 'string' && body.trim()) {
        message = body.trim();
      }
      return throwError(() => ({ message, raw: err }));
    }
    return throwError(() => err);
  }

  private unwrap(body: unknown): ConviteTransportadoraDto {
    const env = body as ApiEnvelope<ConviteTransportadoraDto>;
    const ok = env?.success ?? env?.Success ?? env?.sucess;
    const data = this.peelPayload(body) as ConviteTransportadoraDto;
    if (ok === false) {
      const err = env.errors ?? env.message ?? env.Message ?? env.userMessage ?? 'Falha na operação.';
      throw { message: Array.isArray(err) ? err.join(' ') : String(err), raw: body };
    }
    return this.normalize(data);
  }

  private normalizePaged(
    body: unknown,
    fallbackPage: number,
    fallbackSize: number
  ): PagedResultConviteTransportadora {
    const peeled = this.peelPayload(body);
    // Compat: resposta antiga era array puro.
    if (Array.isArray(peeled)) {
      const results = peeled.map((x) => this.normalize(x as Record<string, unknown>));
      return {
        results,
        currentPage: 1,
        pageCount: 1,
        pageSize: results.length || fallbackSize,
        rowCount: results.length,
      };
    }

    const r = (peeled && typeof peeled === 'object' ? peeled : {}) as Record<string, unknown>;
    const rawList =
      (r['results'] as unknown) ??
      (r['Results'] as unknown) ??
      (r['itens'] as unknown) ??
      (r['Items'] as unknown) ??
      [];
    const list = Array.isArray(rawList) ? rawList : [];
    const currentPage = Number(r['currentPage'] ?? r['CurrentPage'] ?? fallbackPage) || fallbackPage;
    const pageSize = Number(r['pageSize'] ?? r['PageSize'] ?? fallbackSize) || fallbackSize;
    const rowCount = Number(r['rowCount'] ?? r['RowCount'] ?? list.length) || 0;
    const pageCount =
      Number(r['pageCount'] ?? r['PageCount'] ?? Math.ceil(rowCount / Math.max(pageSize, 1))) || 0;

    return {
      results: list.map((x) => this.normalize(x as Record<string, unknown>)),
      currentPage,
      pageCount,
      pageSize,
      rowCount,
    };
  }

  private peelPayload(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;
    const o = body as Record<string, unknown>;
    const inner = o['result'] ?? o['Result'] ?? o['data'] ?? o['Data'];
    return inner !== undefined ? inner : body;
  }

  private normalize(raw: ConviteTransportadoraDto | Record<string, unknown>): ConviteTransportadoraDto {
    const r = raw as Record<string, unknown>;
    const g = (a: string, b: string) => (r[a] ?? r[b]) as never;
    return {
      id: Number(g('id', 'Id') ?? 0),
      token: String(g('token', 'Token') ?? ''),
      urlConvite: String(g('urlConvite', 'UrlConvite') ?? ''),
      emailConvidado: String(g('emailConvidado', 'EmailConvidado') ?? ''),
      etapaAtual: Number(g('etapaAtual', 'EtapaAtual') ?? 1),
      status: String(g('status', 'Status') ?? ''),
      clientUrl: String(g('clientUrl', 'ClientUrl') ?? ''),
      estacionamentoId: Number(g('estacionamentoId', 'EstacionamentoId') ?? 0),
      codExportacao: g('codExportacao', 'CodExportacao'),
      dataCriacao: String(g('dataCriacao', 'DataCriacao') ?? ''),
      dataExpiracao: g('dataExpiracao', 'DataExpiracao'),
      dataConclusao: g('dataConclusao', 'DataConclusao'),
      transportadoraIdCriada: g('transportadoraIdCriada', 'TransportadoraIdCriada'),
      usuarioIdCriado: g('usuarioIdCriado', 'UsuarioIdCriado'),
      emailEnviado: Boolean(g('emailEnviado', 'EmailEnviado')),
      urlWhatsApp: (g('urlWhatsApp', 'UrlWhatsApp') as string | null) ?? null,
      urlSms: (g('urlSms', 'UrlSms') as string | null) ?? null,
      mensagemCompartilhamento:
        (g('mensagemCompartilhamento', 'MensagemCompartilhamento') as string | null) ?? null,
      responsavelNome: g('responsavelNome', 'ResponsavelNome'),
      responsavelCpf: g('responsavelCpf', 'ResponsavelCpf'),
      responsavelEmail: g('responsavelEmail', 'ResponsavelEmail'),
      responsavelTelefone: g('responsavelTelefone', 'ResponsavelTelefone'),
      responsavelDataNascimento: g('responsavelDataNascimento', 'ResponsavelDataNascimento'),
      responsavelNomeMae: g('responsavelNomeMae', 'ResponsavelNomeMae'),
      userName: g('userName', 'UserName'),
      emailAcesso: g('emailAcesso', 'EmailAcesso'),
      possuiSenha: Boolean(g('possuiSenha', 'PossuiSenha')),
      razaoSocial: g('razaoSocial', 'RazaoSocial'),
      nomeFantasia: g('nomeFantasia', 'NomeFantasia'),
      cnpj: g('cnpj', 'Cnpj'),
      inscricaoEstadual: g('inscricaoEstadual', 'InscricaoEstadual'),
      cep: g('cep', 'Cep'),
      logradouro: g('logradouro', 'Logradouro'),
      numero: g('numero', 'Numero'),
      complemento: g('complemento', 'Complemento'),
      bairro: g('bairro', 'Bairro'),
      cidade: g('cidade', 'Cidade'),
      estado: g('estado', 'Estado'),
    };
  }
}
