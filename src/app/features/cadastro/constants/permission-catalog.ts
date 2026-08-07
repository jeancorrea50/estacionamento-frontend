/**
 * Catálogo de permissões alinhado aos recursos/endpoints do backend.
 * Recursos: Estacionamento, Motorista, Transportadora, Veiculo, VeiculoModelo, Perfil, Usuario.
 * Ações por recurso: visualizar (Buscar + ObterPorId), gravar (Gravar), alterar (Alterar), excluir (Delete).
 * Módulos de app (Movimentos, Financeiro, Relatórios, Fotos) mantidos para uso na UI até o backend expor.
 */
export const PERMISSION_MODULES = [
  'Estacionamento',
  'Motorista',
  'Transportadora',
  'Veículo',
  'Veículo modelo',
  'Perfil',
  'Usuários',
  'Movimentos',
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
  Perfil: [
    'perfil.visualizar',
    'perfil.gravar',
    'perfil.alterar',
    'perfil.excluir',
  ],
  Usuários: [
    'usuarios.visualizar',
    'usuarios.gerenciar',
  ],
  Movimentos: [ // módulo interno (permissões/API); exibição na UI: "Entrada e Saída"
    'movimentos.entrada',
    'movimentos.saida',
    'movimentos.consultar',
  ],
  Financeiro: [
    'financeiro.ver',
    'financeiro.exportar',
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
