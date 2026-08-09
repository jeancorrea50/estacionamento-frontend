/** Item do catálogo GET `/api/EstacionamentoConfiguracao/padroes`. */
export interface EstacionamentoConfiguracaoPadrao {
  timeZoneId: string;
  nome: string;
  utcOffset: string;
}

/** Tarifa avulsa: Hora = 1, Diaria = 2 (backend `TipoTarifaEstacionamento`). */
export type TipoTarifaAvulsa = 1 | 2;

/** Configuração atual GET `/api/EstacionamentoConfiguracao`. */
export interface EstacionamentoConfiguracao {
  id: number;
  estacionamentoId: number;
  timeZoneId: string;
  nome: string;
  utcOffset: string;
  cultura: string;
  ativo: boolean;
  tipoTarifaAvulsa: TipoTarifaAvulsa | null;
  valorAvulso: number | null;
  minutosToleranciaPermanencia: number | null;
}

/** POST `/api/EstacionamentoConfiguracao`. */
export interface EstacionamentoConfiguracaoPostInput {
  timeZoneId: string;
  /** Admin: grava config para este estacionamento (cadastro). */
  estacionamentoId?: number | null;
  tipoTarifaAvulsa?: TipoTarifaAvulsa | null;
  valorAvulso?: number | null;
  minutosToleranciaPermanencia?: number | null;
}

/** PUT `/api/EstacionamentoConfiguracao`. */
export interface EstacionamentoConfiguracaoPutInput extends EstacionamentoConfiguracaoPostInput {
  id: number;
}
