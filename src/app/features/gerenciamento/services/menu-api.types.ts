/**
 * DTOs alinhados ao Swagger (tag Menu) — gtsbackend.azurewebsites.net
 * Campos extras (ex.: icone, rota em submenu) podem existir no modelo .NET mesmo fora do schema publicado.
 */

export interface MenuFilterInput {
  descricao?: string | null;
  dataInicial?: string | null;
  dataFinal?: string | null;
  numeroPagina?: number;
  tamanhoPagina?: number;
  propriedade?: string | null;
  sort?: string | null;
}

export interface PermissionInput {
  id?: number;
  ordem?: number;
  subModuleId?: number;
  /** Swagger de Alterar usa `descricao` em permissions. */
  descricao?: string | null;
  /** Compatibilidade com respostas antigas do Buscar. */
  acao?: string | null;
}

/** Swagger: SubMenuCreateInput — estendido com rota/ativo/sidebar usados pelo front. */
export interface SubMenuCreateInput {
  id?: number;
  nome?: string | null;
  /** Compatibilidade com contratos que usam descricao no submódulo. */
  descricao?: string | null;
  ordem?: number;
  permissions?: PermissionInput[] | null;
  rota?: string | null;
  ativo?: boolean;
  /** Compatibilidade com contratos que usam isAtivo no submódulo. */
  isAtivo?: boolean;
  /** Compatibilidade com contratos que usam isActive no submódulo. */
  isActive?: boolean;
  /** Exibir item na sidebar (campo estendido — o backend pode ignorar se ainda não existir). */
  exibirNoSidebar?: boolean;
  mostrarSidebar?: boolean;
}

export interface MenuCreateInput {
  id?: number;
  /** Alguns backends expõem só `descricao` no modelo (Buscar retorna descricao). */
  nome?: string | null;
  descricao?: string | null;
  ordem?: number;
  /** Rota base do menu no SPA (ex.: `/app/configuracoes`). */
  rota?: string | null;
  ativo?: boolean;
  /** Exibir item na sidebar (campo estendido). */
  exibirNoSidebar?: boolean;
  mostrarSidebar?: boolean;
  subMenus?: SubMenuCreateInput[] | null;
}

export interface MenuUpdateInput {
  id?: number;
  nome?: string | null;
  /** Alguns backends usam/validam descricao também no Alterar. */
  descricao?: string | null;
  ordem?: number;
  rota?: string | null;
  ativo?: boolean;
  exibirNoSidebar?: boolean;
  mostrarSidebar?: boolean;
  subMenus?: SubMenuCreateInput[] | null;
}

/** Corpo de PUT /api/auth/Menu/OrganizarMenus — ordem dos menus e, por menu, ordem dos submenus (lista de ids por pai). */
export interface SubMenuOrdemInput {
  id: number;
  ordem: number;
}

export interface MenuOrdemInput {
  id: number;
  ordem: number;
  subMenus: SubMenuOrdemInput[];
}

export interface OrganizarMenusInput {
  menus: MenuOrdemInput[];
}
