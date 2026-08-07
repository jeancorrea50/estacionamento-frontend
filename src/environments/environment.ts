/**
 * Desenvolvimento: frontend em localhost:4200.
 * Chamadas usam `/api` relativo para passar pelo proxy (`proxy.conf.json` → VPS),
 * evitando CORS e a necessidade da API HTTPS local (44317).
 */
export const environment = {
  production: false,
  apiUrl: '',
  API_BASE_URL: '/api',
  dashboardHubUrl: 'http://108.174.145.123:8081/hubs/movimento/entradasaida',
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
