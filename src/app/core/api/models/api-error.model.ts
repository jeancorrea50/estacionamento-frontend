/**
 * Erro padronizado lançado pelo ErrorInterceptor.
 * Permite ao caller exibir mensagem geral e/ou erros por campo.
 */
export interface ApiError {
  /** Mensagem principal (ex.: "Falha na requisição" ou mensagem do backend). */
  message: string;
  /** Status HTTP (ex.: 400, 401, 500). */
  status?: number;
  /** Erros por campo quando o backend retorna validação (ex.: { email: ['E-mail inválido'] }). */
  fieldErrors?: Record<string, string[]>;
  /** true quando o ErrorInterceptor já exibiu o toast (evita sobrescrever com genérico). */
  toastShown?: boolean;
}

/**
 * Formato comum de resposta de erro do backend (ajustar conforme API real).
 * Ex.: { message: '...', errors: { field: ['msg'] } } ou { title: '...', errors: [...] }
 */
export interface ApiErrorResponseBody {
  message?: string;
  title?: string;
  status?: number;
  errors?: Record<string, string[]> | string[];
  [key: string]: unknown;
}
