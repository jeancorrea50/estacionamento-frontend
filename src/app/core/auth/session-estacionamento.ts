export interface SessionEstacionamento {
  id: number;
  nome?: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
  codExportacao?: string | null;
}

export const SESSION_ESTACIONAMENTO_KEY = 'gts_session_estacionamento';
