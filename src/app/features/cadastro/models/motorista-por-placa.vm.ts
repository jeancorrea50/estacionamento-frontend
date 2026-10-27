/**
 * View model agregado para GET `/api/Veiculo/por-placa/{placa}`.
 * Campos são tolerantes a nomes alternativos no mapper (contrato backend).
 */
export interface MotoristaPorPlacaAggregateVm {
  motoristaId: number;
  transportadoraId: number;
  veiculoId: number;
  motoristaNome: string;
  motoristaCpf: string;
  motoristaTelefone: string;
  motoristaCnh: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  veiculoMarca: string;
  /** Texto livre (ex.: só fabricação ou "2020 / 2021") */
  veiculoAno: string;
  transportadoraNome: string;
  /** Razão social (PJ) quando dissociada do nome fantasia. */
  transportadoraRazaoSocial: string;
  transportadoraNomeFantasia: string;
  transportadoraCnpj: string;
  transportadoraContato: string;
  /** Responsável pela transportadora (contrato backend pode variar). */
  transportadoraResponsavelNome: string;
  transportadoraResponsavelTelefone: string;
}
