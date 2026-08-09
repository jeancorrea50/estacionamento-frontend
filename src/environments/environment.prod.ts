/**
 * Produção — frontend em :4200 (origem diferente das APIs).
 * URLs absolutas com PathBase de cada serviço.
 *
 * Quando o gateway (porta 80) estiver no ar, pode trocar para:
 *   http://108.174.145.123/estac/...
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
