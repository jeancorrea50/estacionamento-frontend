/**
 * Desenvolvimento (`ng serve` :4200).
 * Paths /estac/* iguais à produção; `proxy.conf.json` encaminha a https://gtsistema.com.
 */
export const environment = {
  production: false,
  apiUrl: '/estac',
  API_BASE_URL: '/estac/api',
  REPORT_BASE_URL: '/estac/report/api',
  dashboardHubUrl: '/estac/worker/hubs/movimento/entradasaida',
  notificationApiUrl: '/estac/notification/api',
  notificationHubUrl: '/estac/notification/hubs/notificacao',
  emergencyAdmin: {
    enabled: true,
    username: 'teste.admin',
    password: 'GTS@12345'
  },
  viacepBaseUrl: '/viacep/ws',
  brasilApiBaseUrl: 'https://brasilapi.com.br'
};
