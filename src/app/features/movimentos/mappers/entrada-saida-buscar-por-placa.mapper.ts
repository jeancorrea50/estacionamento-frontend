import { formatPlacaDisplay, normalizePlaca } from '../../cadastro/utils/placa-br';
import { formatTelefone } from '../../cadastro/directives/telefone-format.directive';
import {
  EntradaSaidaBuscarPorPlacaResult,
  RegistroRapidoPorPlacaCampos
} from '../models/entrada-saida-buscar-por-placa.models';
import { EntradaSaidaOutput } from '../models/entrada-saida.models';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function pickStr(objs: Array<Record<string, unknown> | undefined>, ...keys: string[]): string {
  for (const obj of objs) {
    if (!obj) continue;
    for (const key of keys) {
      const val = obj[key] ?? obj[key.charAt(0).toUpperCase() + key.slice(1)];
      if (val == null) continue;
      const s = String(val).trim();
      if (s) return s;
    }
  }
  return '';
}

function pessoaAninhada(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  return (
    asRecord(obj['pessoaFisica']) ??
    asRecord(obj['PessoaFisica']) ??
    asRecord(obj['pessoaJuridica']) ??
    asRecord(obj['PessoaJuridica']) ??
    asRecord(obj['pessoa']) ??
    asRecord(obj['Pessoa'])
  );
}

/** Enum TipoCarga (1–5) → label do select do Registro Rápido. */
export function mapearTipoCargaEnumParaLabel(valor: string | number | null | undefined): string {
  const raw = String(valor ?? '').trim();
  if (!raw) return '';

  const byText = raw.toLowerCase();
  const mapaTexto: Record<string, string> = {
    graneleiro: 'Graneleiro',
    bitrem: 'Bitrem',
    rodotrem: 'Rodotrem',
    caçamba: 'Caçamba',
    cacamba: 'Caçamba',
    sider: 'Sider'
  };
  if (mapaTexto[byText]) return mapaTexto[byText];

  const n = Number(raw);
  if (!Number.isFinite(n)) return '';
  const mapaEnum: Record<number, string> = {
    1: 'Graneleiro',
    2: 'Bitrem',
    3: 'Rodotrem',
    4: 'Caçamba',
    5: 'Sider'
  };
  return mapaEnum[n] ?? '';
}

/**
 * Extrai campos do Registro Rápido a partir do GET buscar-por-placa
 * (EntradaSaidaOutput / result com motorista, veiculo, transportadora).
 */
export function mapBuscarPorPlacaParaRegistroRapido(
  entrada: EntradaSaidaOutput | EntradaSaidaBuscarPorPlacaResult | Record<string, unknown>
): RegistroRapidoPorPlacaCampos {
  const root = entrada as unknown as Record<string, unknown>;
  const motorista = asRecord(root['motorista'] ?? root['Motorista']);
  const transportadora = asRecord(root['transportadora'] ?? root['Transportadora']);
  const veiculo = asRecord(root['veiculo'] ?? root['Veiculo']);
  const pessoaM = pessoaAninhada(motorista);
  const pessoaT = pessoaAninhada(transportadora);

  const placaRaw = pickStr([veiculo, root], 'placa', 'placaVeiculo');
  const placa = placaRaw ? formatPlacaDisplay(normalizePlaca(placaRaw)) : '';

  const motoristaNome = pickStr(
    [pessoaM, motorista, root],
    'nome',
    'nomeCompleto',
    'nomeRazaoSocial',
    'descricao',
    'nomeMotorista'
  );

  const motoristaCpf = pickStr([pessoaM, motorista, root], 'cpf', 'documento', 'cpfMotorista');

  const transportadoraRazaoSocial = pickStr(
    [pessoaT, transportadora, root],
    'razaoSocial',
    'nomeFantasia',
    'nomeRazaoSocial',
    'nomeTransportadora'
  );

  const transportadoraCnpj = pickStr(
    [pessoaT, transportadora, root],
    'cnpj',
    'documento',
    'cnpjTransportadora'
  );

  const transportadoraResponsavelNome = pickStr(
    [transportadora, root],
    'responsavelLegal',
    'nomeResponsavel',
    'responsavelNome',
    'transportadoraResponsavelNome'
  );

  const transportadoraResponsavelTelefone = pickStr(
    [transportadora, root],
    'responsavelTelefone',
    'telefoneResponsavel',
    'telefone',
    'transportadoraResponsavelTelefone',
    'celular'
  );

  const tipoCargaRaw = pickStr([veiculo, root], 'tipoCarga', 'tipoCargaDescricao');
  const tipoCargaLabel = mapearTipoCargaEnumParaLabel(tipoCargaRaw);

  const existeEntradaEmAberto =
    Boolean(root['existeEntradaEmAberto'] ?? root['ExisteEntradaEmAberto']) === true;

  return {
    placa,
    motoristaNome,
    motoristaCpf,
    tipoCargaLabel,
    transportadoraCnpj,
    transportadoraRazaoSocial,
    transportadoraResponsavelNome,
    transportadoraResponsavelTelefone: transportadoraResponsavelTelefone
      ? formatTelefone(transportadoraResponsavelTelefone)
      : '',
    existeEntradaEmAberto
  };
}
