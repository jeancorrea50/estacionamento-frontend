import { EntradaSaidaOutput, EntradaSaidaPostInput } from '../models/entrada-saida.models';
import { EntradaSaidaFormDetailVm, EntradaSaidaFormDisplayVm } from './entrada-saida-form.models';

function pickPessoa(obj: Record<string, unknown>): Record<string, unknown> {
  const p =
    obj['pessoa'] ??
    obj['Pessoa'] ??
    obj['pessoaFisica'] ??
    obj['PessoaFisica'] ??
    obj['pessoaJuridica'] ??
    obj['PessoaJuridica'];
  return (p != null && typeof p === 'object' ? (p as Record<string, unknown>) : obj) as Record<string, unknown>;
}

export function buildEntradaSaidaPostPayload(params: {
  motoristaId: number;
  transportadoraId: number;
  veiculoId: number;
  dataHoraEntradaIso: string;
  dataHoraSaidaIso?: string;
  observacao: string;
}): EntradaSaidaPostInput {
  return {
    motoristaId: params.motoristaId,
    transportadoraId: params.transportadoraId,
    veiculoId: params.veiculoId,
    dataHoraEntrada: params.dataHoraEntradaIso,
    dataHoraSaida: params.dataHoraSaidaIso,
    observao: params.observacao.trim() ? params.observacao.trim() : undefined
  };
}

export function mapEntradaSaidaOutputToDisplay(api: EntradaSaidaOutput): EntradaSaidaFormDisplayVm {
  const motorista = (api.motorista ?? {}) as Record<string, unknown>;
  const transportadora = (api.transportadora ?? {}) as Record<string, unknown>;
  const veiculo = (api.veiculo ?? {}) as Record<string, unknown>;
  const pm = pickPessoa(motorista);
  const pt = pickPessoa(transportadora);
  const obs = api as EntradaSaidaOutput & { observao?: string | null };
  return {
    motoristaTexto: String(
      pm['nome'] ??
        pm['Nome'] ??
        pm['nomeRazaoSocial'] ??
        pm['NomeRazaoSocial'] ??
        motorista['nome'] ??
        motorista['nomeCompleto'] ??
        ''
    ),
    transportadoraTexto: String(
      pt['nomeFantasia'] ??
        pt['NomeFantasia'] ??
        pt['nomeRazaoSocial'] ??
        pt['NomeRazaoSocial'] ??
        transportadora['nomeFantasia'] ??
        transportadora['razaoSocial'] ??
        ''
    ),
    veiculoTexto: String(veiculo['placa'] ?? ''),
    observacaoTexto: String(api.observacao ?? obs.observao ?? '')
  };
}

function anoVeiculoDetalhe(v: Record<string, unknown>): string {
  const af = Number(v['anoFabricacao'] ?? v['AnoFabricacao']);
  const am = Number(v['anoModelo'] ?? v['AnoModelo']);
  const anoUnico = Number(v['ano'] ?? v['Ano']);
  if (Number.isFinite(af) && af > 0 && Number.isFinite(am) && am > 0 && af !== am) {
    return `${af} / ${am}`;
  }
  const one =
    Number.isFinite(af) && af > 0
      ? af
      : Number.isFinite(am) && am > 0
        ? am
        : Number.isFinite(anoUnico) && anoUnico > 0
          ? anoUnico
          : 0;
  return one > 0 ? String(one) : '';
}

/** Enriquecimento para edição quando a API envia motorista/veículo/transportadora aninhados. */
export function mapEntradaSaidaOutputToDetailVm(api: EntradaSaidaOutput): EntradaSaidaFormDetailVm {
  const base = mapEntradaSaidaOutputToDisplay(api);
  const motorista = (api.motorista ?? {}) as Record<string, unknown>;
  const transportadora = (api.transportadora ?? {}) as Record<string, unknown>;
  const veiculo = (api.veiculo ?? {}) as Record<string, unknown>;
  const pm = pickPessoa(motorista);
  const pt = pickPessoa(transportadora);
  const marcaModelo = String(veiculo['marcaModelo'] ?? veiculo['MarcaModelo'] ?? '').trim();
  const mmParts = marcaModelo ? marcaModelo.split(/\s+/) : [];

  return {
    ...base,
    motoristaCpf: String(
      pm['documento'] ?? pm['Documento'] ?? pm['cpf'] ?? pm['Cpf'] ?? motorista['cpf'] ?? ''
    ),
    motoristaTelefone: String(
      pm['telefone'] ?? pm['Telefone'] ?? pm['celular'] ?? pm['Celular'] ?? ''
    ),
    motoristaCnh: String(motorista['cnh'] ?? motorista['Cnh'] ?? ''),
    veiculoModelo: String(
      veiculo['modelo'] ?? veiculo['Modelo'] ?? (mmParts.length > 1 ? mmParts.slice(1).join(' ') : '')
    ),
    veiculoMarca: String(veiculo['marca'] ?? veiculo['Marca'] ?? (mmParts.length ? mmParts[0] : '')),
    veiculoAno: anoVeiculoDetalhe(veiculo),
    transportadoraCnpj: String(pt['documento'] ?? pt['Documento'] ?? transportadora['cnpj'] ?? ''),
    transportadoraContato: String(
      pt['telefone'] ??
        pt['Telefone'] ??
        transportadora['telefone'] ??
        transportadora['Telefone'] ??
        ''
    )
  };
}
