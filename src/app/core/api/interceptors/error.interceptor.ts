import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError, ApiErrorResponseBody } from '../models';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../../services/auth.service';

/**
 * Status 0 no Angular costuma ser: offline, CORS bloqueando leitura da resposta,
 * ou erro de rede — mesmo quando a aba Rede mostra 4xx/5xx (corpo inacessível ao JS).
 */
const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'Não foi possível ler a resposta (rede ou CORS). Na aba Rede confira o status HTTP; se for 5xx, veja os logs da API no Azure.',
  400: 'Requisição inválida.',
  401: 'Não autorizado. Faça login novamente.',
  403: 'Acesso negado.',
  404: 'Recurso não encontrado.',
  422: 'Dados inválidos.',
  500: 'Erro interno no servidor (500). Consulte os logs da API.',
  502: 'Servidor indisponível (502). Tente mais tarde.',
  503: 'Serviço temporariamente indisponível (503).',
  504: 'Tempo esgotado ao contatar o servidor (504).'
};

function parseFieldErrors(errors: Record<string, string[]> | string[]): Record<string, string[]> | undefined {
  if (Array.isArray(errors)) return undefined;
  if (errors && typeof errors === 'object') {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(errors)) {
      if (Array.isArray(v)) out[k] = v;
      else if (typeof v === 'string') out[k] = [v];
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

function toApiError(res: HttpErrorResponse): ApiError {
  const status = res.status;
  let message = DEFAULT_MESSAGES[status] ?? `Erro na requisição (${status}).`;
  let fieldErrors: Record<string, string[]> | undefined;

  const body = res.error;
  if (body && typeof body === 'object' && !(body instanceof ProgressEvent)) {
    const b = body as ApiErrorResponseBody & { notifications?: string[] | string; Notifications?: string[] | string };
    const nRaw = b.notifications ?? b.Notifications;
    if (Array.isArray(nRaw) && nRaw.length > 0) {
      const fromNotifications = nRaw.filter((n): n is string => typeof n === 'string').join(' ').trim();
      if (fromNotifications) message = fromNotifications;
    } else if (typeof nRaw === 'string' && nRaw.trim()) {
      message = nRaw.trim();
    } else {
      const msg =
        b.message ??
        b.title ??
        (b as { erro?: string }).erro ??
        (b as { Message?: string }).Message ??
        (b as { Title?: string }).Title ??
        (b as { Erro?: string }).Erro;
      if (typeof msg === 'string' && msg.trim()) message = msg.trim();
    }
    if (b.errors) fieldErrors = parseFieldErrors(b.errors as Record<string, string[]> | string[]);
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      const flat = Object.values(fieldErrors)
        .flat()
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      const generic =
        message === DEFAULT_MESSAGES[status] ||
        /validation error|requisição inválida|one or more validation/i.test(message);
      if (flat.length > 0 && generic) {
        message = flat.join(' ');
      }
    }
  } else if (typeof body === 'string' && body.trim()) {
    message = body.trim();
  }

  return { message, status, fieldErrors };
}

/** Endpoint de login: toast é exibido pela própria tela de login com mensagem da API. */
function isLoginRequest(req: HttpRequest<unknown>): boolean {
  return req.url.toLowerCase().includes('auth/usuario/login');
}

/** Consulta CNPJ (BrasilAPI direta): mensagem de erro é exibida no próprio campo do formulário. */
function isBrasilApiCnpjRequest(req: HttpRequest<unknown>): boolean {
  return req.url.includes('brasilapi.com.br');
}

/** Confirmação de e-mail: feedback na própria página. */
function isConfirmarEmailRequest(req: HttpRequest<unknown>): boolean {
  return req.url.toLowerCase().includes('auth/usuario/confirmar-email');
}

/** Esqueci / redefinir senha: mensagens na própria página (evita toast duplicado). */
function isPasswordResetPublicRequest(req: HttpRequest<unknown>): boolean {
  const u = req.url.toLowerCase();
  return u.includes('auth/usuario/esqueci-senha') || u.includes('auth/usuario/redefinir-senha');
}

/** Cadastro de usuário: a tela (modal) exibe a mensagem; evita toast duplicado. */
function isUsuarioRegisterRequest(req: HttpRequest<unknown>): boolean {
  const u = req.url.toLowerCase();
  return u.includes('auth/usuario/register') || u.includes('auth/usuario/registrar');
}

/**
 * GET da config de horário: 404 = ainda não cadastrada (cenário esperado).
 * O toast genérico atrapalhava o fluxo da aba Horário.
 */
function isEstacionamentoConfiguracaoAtualGet(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET') return false;
  const u = req.url.toLowerCase().split('?')[0];
  return u.endsWith('/estacionamentoconfiguracao') || u.endsWith('/estacionamentoconfiguracao/');
}

/**
 * Lookups do registro rápido em Movimentos: 404 = sem cadastro prévio (esperado).
 * A tela preenche silenciosamente quando houver dado; não deve exibir toast.
 */
function isMovimentosLookupSilencioso(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET') return false;
  const u = req.url.toLowerCase().split('?')[0];
  return u.includes('/entradasaida/buscar-por-placa/') || u.includes('/motorista/cpf/');
}

/** GET valor-estacionamento: ausência de config ativa (404) é cenário esperado na saída. */
function isValorEstacionamentoGet(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET') return false;
  const u = req.url.toLowerCase().split('?')[0];
  return u.includes('/entradasaida/valor-estacionamento');
}

/** Sugestão de NomeBanco: feedback fica no formulário (verde/vermelho), sem toast. */
function isSugerirNomeBancoGet(req: HttpRequest<unknown>): boolean {
  if (req.method !== 'GET') return false;
  return req.url.toLowerCase().includes('/bancodadosconexao/sugerir-nome');
}

/** Escrita de Motorista: toast fica na tela (notifications). Evita sobrescrever com genérico. */
function isMotoristaWriteRequest(req: HttpRequest<unknown>): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return false;
  const u = req.url.toLowerCase().split('?')[0];
  return u.endsWith('/motorista') || /\/motorista\/\d+$/.test(u);
}

/**
 * Padroniza erros HTTP em ApiError, exibe toast e repassa o erro com mensagem e fieldErrors.
 * Não exibe toast para: login (tela exibe); BrasilAPI CNPJ (formulário exibe abaixo do campo).
 */
export function errorInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const toast = inject(ToastService);
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((err: unknown) => {
      const apiError = err instanceof HttpErrorResponse ? toApiError(err) : {
        message: err instanceof Error ? err.message : 'Ocorreu um erro inesperado.',
        status: undefined,
        fieldErrors: undefined
      };

      const isUnauthorized =
        apiError.status === 401 &&
        !isLoginRequest(req) &&
        !isConfirmarEmailRequest(req) &&
        !isPasswordResetPublicRequest(req);

      if (isUnauthorized) {
        // Injector evita dependência circular AuthService ↔ HttpClient.
        injector.get(AuthService).logoutDueToExpiry(
          apiError.message?.trim() || 'Sessão expirada. Faça login novamente.'
        );
        apiError.toastShown = true;
        return throwError(() => apiError);
      }

      const skipToast =
        isLoginRequest(req) ||
        isBrasilApiCnpjRequest(req) ||
        isConfirmarEmailRequest(req) ||
        isPasswordResetPublicRequest(req) ||
        isUsuarioRegisterRequest(req) ||
        isSugerirNomeBancoGet(req) ||
        isMotoristaWriteRequest(req) ||
        (isEstacionamentoConfiguracaoAtualGet(req) && apiError.status === 404) ||
        (isMovimentosLookupSilencioso(req) && (apiError.status === 404 || apiError.status === 204)) ||
        (isValorEstacionamentoGet(req) && (apiError.status === 404 || apiError.status === 204));
      if (!skipToast) {
        toast.error(apiError.message);
        apiError.toastShown = true;
      }
      return throwError(() => apiError);
    })
  );
}
