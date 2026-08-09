/**
 * Produção — tráfego público via nginx (porta 80), sem porta na URL.
 *
 * PathBases (gateway/nginx.conf):
 *   /estac                → backend
 *   /estac/worker         → workers
 *   /estac/notification   → notification
 *   /                     → frontend SPA
 */
export const environment = {
  production: true,
  apiUrl: 'http://108.174.145.123/estac',
  API_BASE_URL: 'http://108.174.145.123/estac/api',
  dashboardHubUrl: 'http://108.174.145.123/estac/worker/hubs/movimento/entradasaida',
  notificationApiUrl: 'http://108.174.145.123/estac/notification/api',
  notificationHubUrl: 'http://108.174.145.123/estac/notification/hubs/notificacao',
  emergencyAdmin: {
    enabled: false,
    username: '',
    password: '',
  },
  viacepBaseUrl: 'https://viacep.com.br',
  brasilApiBaseUrl: 'https://brasilapi.com.br',
};
