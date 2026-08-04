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
  /** Enum byte `TipoCarga` quando a listagem expõe o campo. */
  tipoCarga?: number | null;
  /** Vínculos da listagem (`motoristas[]` / `motoristaIds`). */
  motoristas?: VeiculoMotoristaVinculoDTO[];
}

/**
 * POST/PUT `/api/Veiculo` — espelha `MotoristaVinculoInput` do backend.
 * `motoristas: [{ id, principal }]`.
 */
export interface MotoristaVinculoInput {
  id: number;
  principal?: boolean | null;
}

/** Item de vínculo veículo ↔ motorista (GET `motoristas[]` ou legado `motoristaIds` + nomes). */
export interface VeiculoMotoristaVinculoDTO {
  id: number;
  /** Descrição / nome do motorista. */
  nome: string;
  /** CPF quando a API ou enriquecimento local disponibiliza. */
  cpf?: string;
  cnh?: string;
  /** Validade CNH já formatada para exibição (DD/MM/AAAA) quando possível. */
  validadeCnh?: string;
  /** Flag do GET quando a API envia `principal` no objeto do vínculo. */
  principal?: boolean;
}

/** Dados do veículo (formulário / API) */
export interface VeiculoDTO {
  id?: number;
  transportadoraId?: number;
  placa: string;
  /**
   * Motorista principal (UI / GET legado). No POST/PUT o service envia em `motoristas[].id`
   * com `principal: true` — não reenviar `motoristaId` solto.
   */
  motoristaId?: number;
  /**
   * Nome vindo do GET (objeto aninhado ou denormalizado); não reenviar — use só para exibir o lookup.
   */
  motoristaNome?: string;
  descricao?: string | null;
  veiculoModeloId?: number;
  /** Texto combinado (GET/listagem). No POST vira `marca`/`modelo`. */
  marcaModelo?: string;
  /** Descrição da marca (formulário) → POST `marca.descricao` / `modelo.marca.descricao`. */
  marcaDescricao?: string;
  /** Descrição do modelo (formulário) → POST `modelo.descricao`. */
  modeloDescricao?: string;
  cor?: string;
  /**
   * Anos da tela. No POST o contrato expõe um único `ano`
   * (`anoFabricacao` com fallback para `anoModelo`).
   */
  anoFabricacao?: number;
  anoModelo?: number;
  tipoVeiculo?: string;
  /**
   * Enum byte do backend (`TipoCarga`):
   * 1 Seca, 2 Refrigerada, 3 Perigosa, 4 Granel, 5 Líquida.
   */
  tipoCarga?: 1 | 2 | 3 | 4 | 5 | number | null;
  centroCusto?: string;
  ativo: boolean;
  /** Alguns GET retornam na raiz ou em `veiculoDetalhe` — uso local do formulário de frota. */
  quantidadeEixos?: string | number | null;
  tipoPeso?: string | null;
  /** GET: preenchido a partir de `motoristas[]` (objetos) ou listas paralelas legadas. */
  motoristasVinculos?: VeiculoMotoristaVinculoDTO[];
  /**
   * POST/PUT preferencial: lista `MotoristaVinculoInput` (`id` + `principal`).
   * Se omitido, o service monta a partir de `motoristaIds` + `motoristaId`.
   */
  motoristas?: MotoristaVinculoInput[];
  /** @deprecated Preferir `motoristas`. Mantido para montagem no service a partir da UI. */
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
