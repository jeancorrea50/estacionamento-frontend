/**
 * Desenvolvimento: usar backend HTTPS local na porta oficial da API.
 */
export const environment = {
  production: false,
  apiUrl: 'https://localhost:44317',
  API_BASE_URL: 'https://localhost:44317/api',
  dashboardHubUrl: 'http://localhost:62299/hubs/movimento/entradasaida',
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
