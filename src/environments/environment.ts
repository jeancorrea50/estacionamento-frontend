/**
 * Desenvolvimento: frontend em localhost:4200, API local IIS Express.
 * Base absoluta evita depender do proxy e bate com o backend em https://localhost:44317.
 */
export const environment = {
  production: false,
  apiUrl: '',
  API_BASE_URL: 'https://localhost:44317/api',
  dashboardHubUrl: 'http://108.174.145.123:8081/hubs/movimento/entradasaida',
  /** API HTTP do estacionamento-notification (lista / marcar lida) — IIS Express SSL. */
  notificationApiUrl: 'https://localhost:44322/api',
  /** Hub SignalR: /hubs/notificacao — envie access_token no querystring. */
  notificationHubUrl: 'https://localhost:44322/hubs/notificacao',
  emergencyAdmin: {
    enabled: true,
    username: 'teste.admin',
    password: 'GTS@12345'
  },
  /** Base URL ViaCEP: em dev usa proxy /viacep. */
  viacepBaseUrl: '/viacep',
  /** Base URL BrasilAPI (CNPJ): consulta direta na BrasilAPI. */
  brasilApiBaseUrl: 'https://brasilapi.com.br'
};
