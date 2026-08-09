export interface NotificacaoDto {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  dadosJson?: string | null;
  dataCriacao: string;
  lida: boolean;
  codExportacao?: string | null;
}
