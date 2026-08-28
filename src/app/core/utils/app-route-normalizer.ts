import { normalizeFaturamentoAppRoute } from '../../features/financeiro/faturamento-rotas';
import { normalizeCadastroAppRoute } from '../../features/cadastro/cadastro-rotas';
import { normalizePatioAppRoute } from '../../features/patio/patio-rotas';

/** Normaliza rotas legadas de Financeiro, Cadastro e Pátio para o canônico do SPA. */
export function normalizeLegacyAppRoute(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const afterFaturamento = normalizeFaturamentoAppRoute(trimmed) ?? trimmed;
  const afterCadastro = normalizeCadastroAppRoute(afterFaturamento) ?? afterFaturamento;
  return normalizePatioAppRoute(afterCadastro) ?? afterCadastro;
}
