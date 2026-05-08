/**
 * Desenvolvimento: usar backend HTTPS local na porta oficial da API.
 */
export const environment = {
  production: false,
  apiUrl: 'http://108.174.145.123:5000',
  API_BASE_URL: 'http://108.174.145.123:5000/api',
  dashboardHubUrl: 'http://108.174.145.123:8081/hubs/movimento/entradasaida/dashboard',
  movimentacoesAtualizadasUrl:
    'http://108.174.145.123:8081/api/movimento/redis/movimentacoes-atualizadas',
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
