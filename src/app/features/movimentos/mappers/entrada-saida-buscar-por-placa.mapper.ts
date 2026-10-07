import { formatPlacaDisplay, normalizePlaca } from '../../cadastro/utils/placa-br';
import { formatTelefone } from '../../cadastro/directives/telefone-format.directive';
import { tipoCargaLabel } from '../../../shared/models/tipo-carga';
import {
  EntradaSaidaBuscarPorPlacaMotorista,
  EntradaSaidaBuscarPorPlacaResult,
  EntradaSaidaMotoristaVinculoItem,
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

function mapMotoristaItem(raw: unknown): EntradaSaidaMotoristaVinculoItem | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const pessoa = pessoaAninhada(obj);
  const idRaw = obj['id'] ?? obj['Id'];
  const id = typeof idRaw === 'number' ? idRaw : Number(idRaw);
  const nome = pickStr(
    [pessoa, obj],
    'nome',
    'nomeCompleto',
    'nomeRazaoSocial',
    'descricao',
    'nomeMotorista'
  );
  const cpf = pickStr([pessoa, obj], 'cpf', 'documento', 'cpfMotorista');
  const principalRaw = obj['principal'] ?? obj['Principal'];
  const principal =
    typeof principalRaw === 'boolean'
      ? principalRaw
      : principalRaw == null
        ? null
        : Boolean(principalRaw);

  if ((!Number.isFinite(id) || id <= 0) && !nome && !cpf) return null;

  return {
    id: Number.isFinite(id) && id > 0 ? id : undefined,
    nome: nome || undefined,
    cpf: cpf || undefined,
    principal
  };
}

/**
 * Normaliza `motorista` da resposta (objeto único ou lista) para array de vínculos.
 * Também aceita `motoristas` / vínculos em `veiculo`.
 */
export function extrairMotoristasVinculados(
  entrada: EntradaSaidaOutput | EntradaSaidaBuscarPorPlacaResult | Record<string, unknown>
): EntradaSaidaMotoristaVinculoItem[] {
  const root = entrada as unknown as Record<string, unknown>;
  const veiculo = asRecord(root['veiculo'] ?? root['Veiculo']);
  const raw =
    root['motorista'] ??
    root['Motorista'] ??
    root['motoristas'] ??
    root['Motoristas'] ??
    veiculo?.['motorista'] ??
    veiculo?.['Motorista'] ??
    veiculo?.['motoristas'] ??
    veiculo?.['Motoristas'];

  let lista: EntradaSaidaMotoristaVinculoItem[] = [];

  if (Array.isArray(raw)) {
    lista = raw
      .map((item) => mapMotoristaItem(item))
      .filter((m): m is EntradaSaidaMotoristaVinculoItem => m != null);
  } else {
    const single = mapMotoristaItem(raw);
    if (single) {
      lista = [single];
    } else {
      // Fallback flat na raiz (contrato antigo)
      const nome = pickStr([root], 'nomeMotorista');
      const cpf = pickStr([root], 'cpfMotorista');
      const id = Number(root['motoristaId'] ?? root['MotoristaId'] ?? 0);
      if (nome || cpf || (Number.isFinite(id) && id > 0)) {
        lista = [
          {
            id: Number.isFinite(id) && id > 0 ? id : undefined,
            nome: nome || undefined,
            cpf: cpf || undefined
          }
        ];
      }
    }
  }

  return lista.sort((a, b) => Number(b.principal === true) - Number(a.principal === true));
}

/** Enum TipoCarga (1–5) → label do select do Registro Rápido. */
export function mapearTipoCargaEnumParaLabel(valor: string | number | null | undefined): string {
  return tipoCargaLabel(valor);
}

/**
 * Extrai campos do Registro Rápido a partir do GET buscar-por-placa
 * (EntradaSaidaOutput / result com motorista, veiculo, transportadora).
 * @param motoristaSelecionado
 *   - `undefined`: usa o primeiro da lista (ou objeto único)
 *   - `null`: não preenche motorista (aguarda seleção no modal)
 *   - objeto: motorista escolhido pelo usuário
 */
export function mapBuscarPorPlacaParaRegistroRapido(
  entrada: EntradaSaidaOutput | EntradaSaidaBuscarPorPlacaResult | Record<string, unknown>,
  motoristaSelecionado?: EntradaSaidaBuscarPorPlacaMotorista | null
): RegistroRapidoPorPlacaCampos {
  const root = entrada as unknown as Record<string, unknown>;
  const transportadora = asRecord(root['transportadora'] ?? root['Transportadora']);
  const veiculo = asRecord(root['veiculo'] ?? root['Veiculo']);
  const pessoaT = pessoaAninhada(transportadora);

  const motoristas = extrairMotoristasVinculados(entrada);
  const motoristaEscolhido =
    motoristaSelecionado === undefined
      ? motoristas[0]
      : motoristaSelecionado == null
        ? null
        : mapMotoristaItem(motoristaSelecionado) ?? motoristaSelecionado;
  const motorista = asRecord(motoristaEscolhido as unknown);
  const pessoaM = pessoaAninhada(motorista);

  const placaRaw = pickStr([veiculo, root], 'placa', 'placaVeiculo');
  const placa = placaRaw ? formatPlacaDisplay(normalizePlaca(placaRaw)) : '';

  const motoristaNome =
    motoristaSelecionado === null
      ? ''
      : pickStr(
          [pessoaM, motorista, root],
          'nome',
          'nomeCompleto',
          'nomeRazaoSocial',
          'descricao',
          'nomeMotorista'
        );

  const motoristaCpf =
    motoristaSelecionado === null
      ? ''
      : pickStr([pessoaM, motorista, root], 'cpf', 'documento', 'cpfMotorista');

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
  const tipoCargaLabelResolved = mapearTipoCargaEnumParaLabel(tipoCargaRaw);

  const existeEntradaEmAberto =
    Boolean(root['existeEntradaEmAberto'] ?? root['ExisteEntradaEmAberto']) === true;

  const acordo = asRecord(root['acordo'] ?? root['Acordo']);
  const geraExcedente = Boolean(
    acordo?.['entradaGeraExcedente'] ?? acordo?.['EntradaGeraExcedente']
  );
  const vagasOcupadas = Number(acordo?.['vagasOcupadas'] ?? acordo?.['VagasOcupadas']);
  const vagasContratadas = Number(acordo?.['vagasContratadas'] ?? acordo?.['VagasContratadas']);

  return {
    placa,
    motoristaNome,
    motoristaCpf,
    tipoCargaLabel: tipoCargaLabelResolved,
    transportadoraCnpj,
    transportadoraRazaoSocial,
    transportadoraResponsavelNome,
    transportadoraResponsavelTelefone: transportadoraResponsavelTelefone
      ? formatTelefone(transportadoraResponsavelTelefone)
      : '',
    existeEntradaEmAberto,
    acordoMensagem: pickStr([acordo], 'mensagem'),
    acordoEntradaGeraExcedente: geraExcedente,
    acordoVagasOcupadas: Number.isFinite(vagasOcupadas) ? vagasOcupadas : null,
    acordoVagasContratadas: Number.isFinite(vagasContratadas) ? vagasContratadas : null
  };
}
