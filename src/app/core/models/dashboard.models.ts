export interface DashboardAtualizadoPayload {
  [key: string]: unknown;
}

export interface MovimentacaoAtualizadaItem {
  [key: string]: unknown;
}

export type MovimentacaoAtualizadaPayload = MovimentacaoAtualizadaItem[];

export type AlertaOperacionalPayload = string;
