/**
 * Contrato GET `/api/EntradaSaida/buscar-por-placa/{placa}` → Registro Rápido.
 * Propriedades no nível de `motorista` / `veiculo` / `transportadora` (ou raiz).
 * Também aceita `pessoaFisica` / `pessoaJuridica` aninhados quando presentes.
 */

export interface EntradaSaidaBuscarPorPlacaMotorista {
  id?: number;
  nome?: string | null;
  nomeCompleto?: string | null;
  nomeRazaoSocial?: string | null;
  descricao?: string | null;
  nomeMotorista?: string | null;
  cpf?: string | null;
  documento?: string | null;
  cpfMotorista?: string | null;
  cnh?: string | null;
  pessoaFisica?: Record<string, unknown> | null;
  pessoa?: Record<string, unknown> | null;
}

export interface EntradaSaidaBuscarPorPlacaVeiculo {
  id?: number;
  placa?: string | null;
  placaVeiculo?: string | null;
  /** Enum byte: 1 Seca, 2 Refrigerada, 3 Perigosa, 4 Granel, 5 Líquida. */
  tipoCarga?: 1 | 2 | 3 | 4 | 5 | number | string | null;
  tipoCargaDescricao?: string | null;
}

export interface EntradaSaidaBuscarPorPlacaTransportadora {
  id?: number;
  cnpj?: string | null;
  documento?: string | null;
  cnpjTransportadora?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  nomeRazaoSocial?: string | null;
  nomeTransportadora?: string | null;
  responsavelLegal?: string | null;
  nomeResponsavel?: string | null;
  responsavelNome?: string | null;
  transportadoraResponsavelNome?: string | null;
  responsavelTelefone?: string | null;
  telefoneResponsavel?: string | null;
  telefone?: string | null;
  transportadoraResponsavelTelefone?: string | null;
  responsavelCpf?: string | null;
  responsavelEmail?: string | null;
  pessoaJuridica?: Record<string, unknown> | null;
  pessoa?: Record<string, unknown> | null;
}

/** Shape esperado do result de buscar-por-placa (além dos campos de EntradaSaidaOutput). */
export interface EntradaSaidaBuscarPorPlacaResult {
  motoristaId?: number;
  transportadoraId?: number;
  veiculoId?: number;
  existeEntradaEmAberto?: boolean;
  motorista?: EntradaSaidaBuscarPorPlacaMotorista | null;
  veiculo?: EntradaSaidaBuscarPorPlacaVeiculo | null;
  transportadora?: EntradaSaidaBuscarPorPlacaTransportadora | null;
  /**
   * Fallbacks na raiz (contrato flat atual do backend):
   * placa/tipoCarga + razaoSocial/cnpj/responsavel* sem objeto `transportadora`/`veiculo`.
   */
  placa?: string | null;
  placaVeiculo?: string | null;
  nomeMotorista?: string | null;
  cpfMotorista?: string | null;
  cnpj?: string | null;
  cnpjTransportadora?: string | null;
  razaoSocial?: string | null;
  nomeTransportadora?: string | null;
  responsavelLegal?: string | null;
  responsavelTelefone?: string | null;
  responsavelCpf?: string | null;
  responsavelEmail?: string | null;
  tipoCarga?: 1 | 2 | 3 | 4 | 5 | number | string | null;
  tipoCargaDescricao?: string | null;
}

/** Valores já resolvidos para preencher o Registro Rápido (ainda sem máscara de UI). */
export interface RegistroRapidoPorPlacaCampos {
  placa: string;
  motoristaNome: string;
  motoristaCpf: string;
  tipoCargaLabel: string;
  transportadoraCnpj: string;
  transportadoraRazaoSocial: string;
  transportadoraResponsavelNome: string;
  transportadoraResponsavelTelefone: string;
  existeEntradaEmAberto: boolean;
}
