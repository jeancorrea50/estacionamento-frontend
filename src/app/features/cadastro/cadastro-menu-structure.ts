import {
  CADASTRO_ESTACIONAMENTOS_ROUTE,
  CADASTRO_MOTORISTAS_ROUTE,
  CADASTRO_ROUTE,
  CADASTRO_TRANSPORTADORAS_ROUTE,
  CADASTRO_VEICULOS_ROUTE,
} from './cadastro-rotas';

export interface CadastroFlatSubMenuDef {
  nome: string;
  rota: string;
}

export interface CadastroMenuItemDef {
  id: string;
  label: string;
  route: string;
}

/** Submenus canônicos do módulo Cadastro (nível 2). */
export const CADASTRO_MENU_TREE: CadastroMenuItemDef[] = [
  { id: 'sub-transportadoras', label: 'Transportadoras', route: CADASTRO_TRANSPORTADORAS_ROUTE },
  { id: 'sub-veiculos', label: 'Veículos', route: CADASTRO_VEICULOS_ROUTE },
  { id: 'sub-motoristas', label: 'Motoristas', route: CADASTRO_MOTORISTAS_ROUTE },
  { id: 'sub-estacionamentos', label: 'Estacionamento', route: CADASTRO_ESTACIONAMENTOS_ROUTE },
];

export function flattenCadastroMenuTree(
  items: CadastroMenuItemDef[] = CADASTRO_MENU_TREE
): CadastroFlatSubMenuDef[] {
  return items.map((node) => ({
    nome: node.label,
    rota: node.route,
  }));
}

export function getCadastroMenuRoute(): string {
  return CADASTRO_ROUTE;
}
