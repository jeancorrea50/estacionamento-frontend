/**
 * Ambiente de produção.
 * O backend deve permitir CORS para a origem do frontend.
 */
export const environment = {
  production: true,
  /** Base do backend (sem /api no final). Ajuste para o host público da API em produção. */
  apiUrl: 'http://108.174.145.123:5000',
  /** Base URL da API (uso em serviços HTTP e interceptors). */
  API_BASE_URL: 'http://108.174.145.123:5000/api',
  dashboardHubUrl: 'http://108.174.145.123:8081/hubs/movimento/entradasaida',
  notificationApiUrl: 'http://108.174.145.123:8083/estacnotification/api',
  notificationHubUrl: 'http://108.174.145.123:8083/estacnotification/hubs/notificacao',
  emergencyAdmin: {
    enabled: false,
    username: '',
    password: '',
  },
  /** Base URL ViaCEP (chamada direta em prod; ViaCEP permite CORS). */
  viacepBaseUrl: 'https://viacep.com.br',
  /** Base URL BrasilAPI (CNPJ). */
  brasilApiBaseUrl: 'https://brasilapi.com.br',
};
