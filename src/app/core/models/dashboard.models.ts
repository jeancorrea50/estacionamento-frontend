export interface DashboardAtualizadoPayload {
  [key: string]: unknown;
}

export interface MovimentacaoAtualizadaItem {
  [key: string]: unknown;
}

export type MovimentacaoAtualizadaPayload = MovimentacaoAtualizadaItem[];

export type AlertaOperacionalPayload = string;

export interface MovimentacoesAtualizadasResponse {
  sucesso: boolean;
  chaveRedis: string;
  totalItens: number;
  limite: number;
  movimentacoes: MovimentacaoAtualizadaPayload;
}
