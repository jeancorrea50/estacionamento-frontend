export interface EnderecoParaGeocode {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  principal?: boolean | null;
}

export function escolherEnderecoParaGeocode(
  enderecosForm: EnderecoParaGeocode[] | null | undefined,
  enderecosCarregados?: Array<Record<string, unknown>> | null
): EnderecoParaGeocode | null {
  const doFormulario = (enderecosForm ?? []).filter(enderecoUtil);
  const fonte = doFormulario.length > 0
    ? doFormulario
    : (enderecosCarregados ?? []).map(normalizarEnderecoCarregado).filter(enderecoUtil);
  if (!fonte.length) return null;
  return fonte.find((item) => item.principal) ?? fonte[0];
}

export function montarConsultaEndereco(endereco: EnderecoParaGeocode | null | undefined): string | null {
  if (!endereco || !enderecoUtil(endereco)) return null;
  const logradouro = [endereco.logradouro, endereco.numero]
    .map((parte) => String(parte ?? '').trim())
    .filter(Boolean)
    .join(', ');
  const partes = [logradouro, endereco.bairro, endereco.cidade, endereco.estado, endereco.cep, 'Brasil']
    .map((parte) => String(parte ?? '').trim())
    .filter(Boolean);
  return partes.length >= 2 ? partes.join(', ') : null;
}

function enderecoUtil(endereco: EnderecoParaGeocode): boolean {
  const cidade = String(endereco.cidade ?? '').trim();
  const estado = String(endereco.estado ?? '').trim();
  const cep = String(endereco.cep ?? '').replace(/\D/g, '');
  return (cidade.length > 0 && estado.length > 0) || cep.length === 8;
}

function normalizarEnderecoCarregado(raw: Record<string, unknown>): EnderecoParaGeocode {
  return {
    cep: texto(raw['cep'] ?? raw['Cep']),
    logradouro: texto(raw['logradouro'] ?? raw['Logradouro']),
    numero: texto(raw['numero'] ?? raw['Numero']),
    bairro: texto(raw['bairro'] ?? raw['Bairro']),
    cidade: texto(raw['cidade'] ?? raw['Cidade']),
    estado: texto(raw['estado'] ?? raw['Estado']),
    principal: Boolean(raw['principal'] ?? raw['Principal'])
  };
}

function texto(valor: unknown): string {
  return valor == null ? '' : String(valor);
}
