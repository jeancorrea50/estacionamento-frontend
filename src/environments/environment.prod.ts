/**
 * Produção via gateway nginx (mesmo host do frontend) — paths relativos.
 *
 * Público:
 *   https://HOST/                         → frontend
 *   https://HOST/estac/                   → backend
 *   https://HOST/estac/worker/            → workers
 *   https://HOST/estac/notification/      → notification
 *
 * Fallback direto (só se gateway cair):
 *   :5000 backend | :8081 workers | :8083 notification | :4200 frontend
 */
export const environment = {
  production: true,
  apiUrl: '/estac',
  API_BASE_URL: '/estac/api',
  REPORT_BASE_URL: '/estac/report/api',
  dashboardHubUrl: '/estac/worker/hubs/movimento/entradasaida',
  notificationApiUrl: '/estac/notification/api',
  notificationHubUrl: '/estac/notification/hubs/notificacao',
  emergencyAdmin: {
    enabled: false,
    username: '',
    password: '',
  },
  viacepBaseUrl: 'https://viacep.com.br',
  brasilApiBaseUrl: 'https://brasilapi.com.br',
};
