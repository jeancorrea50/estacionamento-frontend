/**
 * Produção — frontend em :4200; APIs publicadas por porta direta.
 *
 * Validação (probe TCP/HTTP em 2026-08-09):
 *   :80   nginx gateway → FECHADA (connection refused)
 *   :4200 frontend      → OK
 *   :5000 backend       → OK (/estac/api → 401 sem token = rota viva)
 *   :8081 workers       → OK (hub negotiate 200)
 *   :8083 notification  → FECHADA (serviço/porta não publicada)
 *
 * Quando o gateway nginx (porta 80) estiver no ar de fato, trocar para:
 *   http://108.174.145.123/estac/...
 */
export const environment = {
  production: true,
  apiUrl: 'http://108.174.145.123:5000/estac',
  API_BASE_URL: 'http://108.174.145.123:5000/estac/api',
  dashboardHubUrl: 'http://108.174.145.123:8081/estac/worker/hubs/movimento/entradasaida',
  notificationApiUrl: 'http://108.174.145.123:8083/estac/notification/api',
  notificationHubUrl: 'http://108.174.145.123:8083/estac/notification/hubs/notificacao',
  emergencyAdmin: {
    enabled: false,
    username: '',
    password: '',
  },
  viacepBaseUrl: 'https://viacep.com.br',
  brasilApiBaseUrl: 'https://brasilapi.com.br',
};
