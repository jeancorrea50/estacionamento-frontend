/**
 * Produção — frontend em :4200 (origem diferente das APIs).
 * URLs absolutas com PathBase de cada serviço (não usar paths relativos,
 * senão o browser resolve em http://host:4200/estac/... e bate no Angular).
 *
 *   API:          :5000/estac
 *   Workers:      :8081/estac/worker
 *   Notification: :8083/estac/notification
 */
export const environment = {
  production: true,
  apiUrl: 'http://108.174.145.123:5000/estac',
  API_BASE_URL: 'http://108.174.145.123:5000/estac/api',
  dashboardHubUrl: 'http://108.174.145.123:8081/estac/worker/hubs/movimento/entradasaida',
  notificationApiUrl: 'http://108.174.145.123:8083/estac/notification/api',
  notificationHubUrl: 'http://108.174.145.123:8083/estac/notification/hubs/notificacao',
  emergencyAdmin: {
    enabled: false,
    username: '',
    password: '',
  },
  viacepBaseUrl: 'https://viacep.com.br',
  brasilApiBaseUrl: 'https://brasilapi.com.br',
};
