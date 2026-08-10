/**
 * Desenvolvimento (`ng serve` :4200).
 * Usa paths /estac/* iguais à produção; o proxy.conf.json encaminha para as APIs locais/VPS.
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
  viacepBaseUrl: '/viacep',
  brasilApiBaseUrl: 'https://brasilapi.com.br'
};
