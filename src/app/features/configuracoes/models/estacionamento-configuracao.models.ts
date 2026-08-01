/** Item do catálogo GET `/api/EstacionamentoConfiguracao/padroes`. */
export interface EstacionamentoConfiguracaoPadrao {
  timeZoneId: string;
  nome: string;
  utcOffset: string;
}

/** Configuração atual GET `/api/EstacionamentoConfiguracao`. */
export interface EstacionamentoConfiguracao {
  id: number;
  estacionamentoId: number;
  timeZoneId: string;
  nome: string;
  utcOffset: string;
  cultura: string;
  ativo: boolean;
}

/** POST `/api/EstacionamentoConfiguracao` — `estacionamentoId` vem do token. */
export interface EstacionamentoConfiguracaoPostInput {
  timeZoneId: string;
}

/** PUT `/api/EstacionamentoConfiguracao`. */
export interface EstacionamentoConfiguracaoPutInput {
  id: number;
  timeZoneId: string;
}
