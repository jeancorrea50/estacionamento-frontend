import { listarTodosCasosQualidade } from './qualidade-inventario.data';

/**
 * Specs conhecidos no repo (auditoria). Usado para detectar automação órfã.
 * Atualizar quando novos *.spec.ts forem adicionados.
 */
export const QUALIDADE_SPECS_CONHECIDOS: string[] = [
  'src/app/app.spec.ts',
  'src/app/core/services/session-access.service.spec.ts',
  'src/app/core/utils/chunk-load-recovery.spec.ts',
  'src/app/features/cadastro/pages/estacionamento-form/estacionamento-form.mapper.spec.ts',
  'src/app/features/cadastro/services/endereco-geolocalizacao.service.spec.ts',
  'src/app/features/cadastro/services/transportadora.service.spec.ts',
  'src/app/features/cadastro/services/veiculo.service.spec.ts',
  'src/app/features/cadastro/utils/chave-pix-format.spec.ts',
  'src/app/features/cadastro/utils/placa-br.spec.ts',
  'src/app/features/configuracoes/services/estacionamento-configuracao.service.spec.ts',
  'src/app/features/financeiro/mappers/configuracao-cobranca.mapper.spec.ts',
  'src/app/features/financeiro/mappers/fatura.mapper.spec.ts',
  'src/app/features/financeiro/mappers/pagamento.mapper.spec.ts',
  'src/app/features/financeiro/pages/faturamento-page/config-cobranca/config-cobranca-acordo.util.spec.ts',
  'src/app/features/financeiro/pages/faturamento-page/config-cobranca/faturamento-config-cobranca.helpers.spec.ts',
  'src/app/features/financeiro/services/configuracao-cobranca.service.spec.ts',
  'src/app/features/financeiro/services/fatura.service.spec.ts',
  'src/app/features/financeiro/services/pagamento.service.spec.ts',
  'src/app/features/movimentos/entrada-saida/entrada-saida-form.component.spec.ts',
  'src/app/features/movimentos/entrada-saida/entrada-saida.service.spec.ts',
  'src/app/features/movimentos/mappers/entrada-saida-buscar-por-placa.mapper.spec.ts',
  'src/app/features/movimentos/pages/movimentos-page/kpi-tendencia.util.spec.ts',
  'src/app/features/movimentos/pages/movimentos-page/movimentos-exportacao.util.spec.ts',
  'src/app/features/movimentos/pages/movimentos-page/movimentos-page.component.spec.ts',
  'src/app/features/movimentos/utils/calcular-diarias.spec.ts',
  'src/app/features/patio/pages/movimentacao-relatorio/movimentacao-relatorio-pdf.spec.ts',
  'src/app/shared/maps/ponto-mapa.model.spec.ts',
  'src/app/shared/models/tipo-carga.spec.ts',
  'src/app/shared/utils/local-iso-datetime.spec.ts',
  'tests/e2e/movimentos-placa.spec.ts',
];

/** casoId → specs vinculados (derivado do inventário). */
export function mapaCasoParaSpecs(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const row of listarTodosCasosQualidade()) {
    const specs = row.caso.automacaoSpecPaths ?? [];
    if (specs.length) map[row.caso.id] = [...specs];
  }
  return map;
}

/** Specs do repo sem vínculo a nenhum caso do inventário. */
export function listarSpecsOrfaos(): string[] {
  const vinculados = new Set<string>();
  for (const specs of Object.values(mapaCasoParaSpecs())) {
    for (const s of specs) vinculados.add(s.replace(/\\/g, '/'));
  }
  return QUALIDADE_SPECS_CONHECIDOS.filter((s) => !vinculados.has(s.replace(/\\/g, '/')));
}
