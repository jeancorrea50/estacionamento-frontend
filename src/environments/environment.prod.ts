/**
 * Produção via gateway nginx (porta 80) — sem porta na URL.
 *
 * Público:
 *   http://HOST/                         → frontend
 *   http://HOST/estac/                   → backend
 *   http://HOST/estac/worker/            → workers
 *   http://HOST/estac/notification/      → notification
 *
 * Fallback direto (só se gateway cair):
 *   :5000 backend | :8081 workers | :8083 notification | :4200 frontend
 */
export const environment = {
  production: true,
  apiUrl: 'http://108.174.145.123/estac',
  API_BASE_URL: 'http://108.174.145.123/estac/api',
  REPORT_BASE_URL: 'http://108.174.145.123/estac/report/api',
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
