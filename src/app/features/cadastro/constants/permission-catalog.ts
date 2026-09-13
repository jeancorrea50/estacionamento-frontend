/**
 * Catálogo de permissões alinhado aos recursos/endpoints do backend.
 * Recursos: Estacionamento, Motorista, Transportadora, Veiculo, VeiculoModelo, Permissao, Usuario.
 * Ações por recurso: visualizar (Buscar + ObterPorId), gravar (Gravar), alterar (Alterar), excluir (Delete).
 * Módulos de app (Movimentos, Financeiro, Relatórios, Fotos) mantidos para uso na UI até o backend expor.
 */
export const PERMISSION_MODULES = [
  'Estacionamento',
  'Motorista',
  'Transportadora',
  'Veículo',
  'Veículo modelo',
  'Permissão',
  'Usuários',
  'Movimentações',
  'Movimentos',
  'Agendamento',
  'Financeiro',
  'Relatórios',
  'Fotos',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

/** Chaves por módulo (espelhando endpoints: Buscar, ObterPorId, Gravar, Alterar, Delete). */
export const PERMISSION_CATALOG: Record<PermissionModule, string[]> = {
  Estacionamento: [
    'estacionamento.visualizar',
    'estacionamento.gravar',
    'estacionamento.alterar',
    'estacionamento.excluir',
  ],
  Motorista: [
    'motorista.visualizar',
    'motorista.gravar',
    'motorista.alterar',
    'motorista.excluir',
  ],
  Transportadora: [
    'transportadora.visualizar',
    'transportadora.gravar',
    'transportadora.alterar',
    'transportadora.excluir',
  ],
  'Veículo': [
    'veiculo.visualizar',
    'veiculo.gravar',
    'veiculo.alterar',
    'veiculo.excluir',
  ],
  'Veículo modelo': [
    'veiculoModelo.visualizar',
    'veiculoModelo.gravar',
    'veiculoModelo.alterar',
    'veiculoModelo.excluir',
  ],
  'Permissão': [
    'permissao.visualizar',
    'permissao.gravar',
    'permissao.alterar',
    'permissao.excluir',
  ],
  Usuários: [
    'usuarios.visualizar',
    'usuarios.gerenciar',
  ],
  Movimentações: [
    'movimentacoes.visualizar',
    'movimentacoes.gravar',
    'movimentacoes.alterar',
    'movimentacoes.excluir',
  ],
  Movimentos: [ // módulo interno (permissões/API); exibição na UI: "Entrada e Saída"
    'entradasaida.visualizar',
    'entradasaida.gravar',
    'entradasaida.alterar',
    'entradasaida.excluir',
  ],
  Agendamento: [
    'agendamento.visualizar',
    'agendamento.gravar',
    'agendamento.alterar',
    'agendamento.excluir',
  ],
  Financeiro: [
    'financeiro.ver',
    'financeiro.exportar',
    'faturamento.visualizar',
    'faturamento.gravar',
    'faturamento.alterar',
    'faturamento.excluir',
    'relatorio.visualizar',
    'relatorio.exportar',
    'pagamento.visualizar',
    'pagamento.gravar',
    'pagamento.alterar',
    'pagamento.excluir',
    'cobranca.visualizar',
    'cobranca.gravar',
    'cobranca.alterar',
    'cobranca.excluir',
  ],
  Relatórios: [
    'relatorios.visualizar',
    'relatorios.exportar',
  ],
  Fotos: [
    'fotos.upload',
    'fotos.excluir',
    'fotos.visualizar',
  ],
};

/** Lista plana de todas as chaves de permissão (para filtro/contagem). */
export function getAllPermissionKeys(): string[] {
  return PERMISSION_MODULES.flatMap((mod) => PERMISSION_CATALOG[mod]);
}
