/** Item da listagem GET /api/Veiculo?... */
export interface VeiculoListItemDTO {
  id: number;
  placa: string;
  marcaModelo: string;
  cor?: string;
  anoFabricacao?: number;
  anoModelo?: number;
  tipoVeiculo?: string;
  centroCusto?: string;
  ativo: boolean;
  transportadoraId?: number;
}

/** Item de vínculo veículo ↔ motorista (GET paralelo `motoristaIds` + `motoristas`). */
export interface VeiculoMotoristaVinculoDTO {
  id: number;
  nome: string;
}

/** Dados do veículo (formulário / API) */
export interface VeiculoDTO {
  id?: number;
  transportadoraId?: number;
  placa: string;
  /** Vínculo com motorista (GET/POST/PUT conforme contrato do backend). */
  motoristaId?: number;
  /**
   * Nome vindo do GET (objeto aninhado ou denormalizado); não reenviar — use só para exibir o lookup.
   */
  motoristaNome?: string;
  descricao?: string | null;
  veiculoModeloId?: number;
  marcaModelo?: string;
  cor?: string;
  anoFabricacao?: number;
  anoModelo?: number;
  tipoVeiculo?: string;
  centroCusto?: string;
  ativo: boolean;
  /** Alguns GET retornam na raiz ou em `veiculoDetalhe` — uso local do formulário de frota. */
  quantidadeEixos?: string | number | null;
  tipoPeso?: string | null;
  /** GET: preenchido a partir de `motoristaIds` + `motoristas` quando o backend envia listas paralelas. */
  motoristasVinculos?: VeiculoMotoristaVinculoDTO[];
  /** POST/PUT: lista de ids dos motoristas vinculados ao veículo (contrato API frota). */
  motoristaIds?: number[];
}

export interface VeiculoBuscarParams {
  /** Mapeado para query `Descricao` no serviço. */
  Termo?: string;
  /** Busca por placa (GET /api/Veiculo?Placa=xxx) */
  Placa?: string;
  TransportadoraId?: number;
  NumeroPagina: number;
  TamanhoPagina: number;
}

export interface PagedResultVeiculoDTO {
  items: VeiculoListItemDTO[];
  totalCount: number;
  numeroPagina: number;
  tamanhoPagina: number;
}
