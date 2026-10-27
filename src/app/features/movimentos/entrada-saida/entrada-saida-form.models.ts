/** Rótulos exibidos na tela (separados dos IDs enviados à API). */
export interface EntradaSaidaFormDisplayVm {
  motoristaTexto: string;
  transportadoraTexto: string;
  veiculoTexto: string;
  observacaoTexto: string;
}

/** Campos extras quando GET por id retorna objetos aninhados (edição). */
export interface EntradaSaidaFormDetailVm extends EntradaSaidaFormDisplayVm {
  motoristaCpf: string;
  motoristaTelefone: string;
  motoristaCnh: string;
  veiculoModelo: string;
  veiculoMarca: string;
  veiculoAno: string;
  transportadoraCnpj: string;
  transportadoraContato: string;
}
