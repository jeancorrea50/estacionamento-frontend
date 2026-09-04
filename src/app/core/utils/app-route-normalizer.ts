import { normalizeCadastroAppRoute } from '../../features/cadastro/cadastro-rotas';
import { normalizeFaturamentoAppRoute } from '../../features/financeiro/faturamento-rotas';
import { normalizePatioAppRoute } from '../../features/patio/patio-rotas';

/** Normaliza rotas legadas para o canônico do SPA (Financeiro, Pátio e Cadastro). */
export function normalizeLegacyAppRoute(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Typo legado frequente: /app/gerencimento → /app/gerenciamento
  const fixedTypo = trimmed.replace(/\/gerencimento(?=\/|$)/gi, '/gerenciamento');

  const afterFaturamento = normalizeFaturamentoAppRoute(fixedTypo) ?? fixedTypo;
  const afterPatio = normalizePatioAppRoute(afterFaturamento) ?? afterFaturamento;
  return normalizeCadastroAppRoute(afterPatio) ?? afterPatio;
}
