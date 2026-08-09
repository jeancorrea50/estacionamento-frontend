/**
 * Produção: frontend e APIs atrás do gateway (porta 80).
 * Rotas relativas — sem IP/porta fixos (mesmo host do browser).
 *
 *   /estac                  → backend
 *   /estac/worker           → workers (SignalR dashboard)
 *   /estac/notification     → notification (API + SignalR)
 *   /estac/report           → report
 */
export const environment = {
  production: true,
  /** Base do backend (PathBase /estac). */
  apiUrl: '/estac',
  /** Base URL da API (serviços HTTP / interceptors). */
  API_BASE_URL: '/estac/api',
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
