/** Módulo Administração (agrupador na sidebar). */
export const ADMINISTRACAO_ROUTE = '/app/administracao';
export const ADMINISTRACAO_PATH = 'administracao';

/** Cadastro/gestão de usuários. */
export const ADMINISTRACAO_USUARIO_ROUTE = '/app/administracao/usuario';
export const ADMINISTRACAO_USUARIO_PATH = 'usuario';

/** Perfis e permissões de acesso (ex-tela Perfil). */
export const ADMINISTRACAO_PERMISSAO_ROUTE = '/app/administracao/permissao';
export const ADMINISTRACAO_PERMISSAO_PATH = 'permissao';

/** Mapa funcional do ecossistema (documentação interativa). */
export {
  ECOSSISTEMA_PATH as ADMINISTRACAO_ECOSSISTEMA_PATH,
  ECOSSISTEMA_ROUTE as ADMINISTRACAO_ECOSSISTEMA_ROUTE,
  ECOSSISTEMA_LABEL as ADMINISTRACAO_ECOSSISTEMA_LABEL,
} from '../ecossistema/ecossistema-rotas';
