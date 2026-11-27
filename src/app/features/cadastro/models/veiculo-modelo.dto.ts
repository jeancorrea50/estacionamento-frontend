/** Modelo de veículo para dropdown (GET /api/VeiculoModelo?...) */
export interface VeiculoModeloListItemDTO {
  id: number;
  nome: string;
  marca?: string;
}

export interface VeiculoModeloBuscarParams {
  Termo?: string;
  NumeroPagina?: number;
  TamanhoPagina?: number;
}
