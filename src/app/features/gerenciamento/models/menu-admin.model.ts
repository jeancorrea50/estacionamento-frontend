/** Ações padrão de permissão por submenu */
export const PERMISSOES_ACOES = ['visualizar', 'criar', 'editar', 'excluir'] as const;
export type PermissaoAcao = (typeof PERMISSOES_ACOES)[number];

/** Linha de permissão vinculada a um submenu (sub-módulo) */
export interface MenuPermissionRow {
  id: number;
  ordem: number;
  subModuleId: number;
  acao: string;
}

export interface SubMenuAdmin {
  id: number;
  nome: string;
  ordem: number;
  rota: string;
  ativo: boolean;
  /**
   * Se o item aparece na sidebar.
   * Independente de `ativo` (ativo = habilitado no sistema; este flag só controla a navegação lateral).
   */
  exibirNoSidebar: boolean;
  permissions: MenuPermissionRow[];
}

export interface MenuAdmin {
  id: number;
  nome: string;
  ordem: number;
  icone: string;
  /** Rota base do módulo (ex.: `/app/configuracoes`). Usada na sidebar e para derivar rotas de submenus. */
  rota?: string;
  ativo: boolean;
  /** Se o módulo (ou o agrupamento) aparece na sidebar. */
  exibirNoSidebar: boolean;
  subMenus: SubMenuAdmin[];
  /**
   * `true` = menu já existe no backend (Buscar / após salvar). Usar **Alterar** ao persistir.
   * `false`/omitido = criado só no front (Novo menu / seed). Usar **Gravar** ao persistir.
   */
  existeNoServidor?: boolean;
}

/** Vínculo de permissões por perfil (role) */
export interface RolePermissionBinding {
  roleId: string;
  nome: string;
  /** subMenuId -> lista de ações concedidas */
  permissoesPorSubMenu: Record<number, string[]>;
}

export interface MenuAdminState {
  menus: MenuAdmin[];
  roles: RolePermissionBinding[];
  nextId: number;
}
