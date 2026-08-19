import { TipoCobrancaExcedente } from '../../../models/configuracao-cobranca.models';
import type { ConfigCobrancaAcordo, ConfigCobrancaMesAcordo, ConfigCobrancaVagasAcordo } from './faturamento-config-cobranca.types';

export const MESES_ACORDO: { mes: ConfigCobrancaMesAcordo; label: string; api: string; apiPascal: string }[] = [
  { mes: 1, label: 'Jan', api: 'vagasJaneiro', apiPascal: 'VagasJaneiro' },
  { mes: 2, label: 'Fev', api: 'vagasFevereiro', apiPascal: 'VagasFevereiro' },
  { mes: 3, label: 'Mar', api: 'vagasMarco', apiPascal: 'VagasMarco' },
  { mes: 4, label: 'Abr', api: 'vagasAbril', apiPascal: 'VagasAbril' },
  { mes: 5, label: 'Mai', api: 'vagasMaio', apiPascal: 'VagasMaio' },
  { mes: 6, label: 'Jun', api: 'vagasJunho', apiPascal: 'VagasJunho' },
  { mes: 7, label: 'Jul', api: 'vagasJulho', apiPascal: 'VagasJulho' },
  { mes: 8, label: 'Ago', api: 'vagasAgosto', apiPascal: 'VagasAgosto' },
  { mes: 9, label: 'Set', api: 'vagasSetembro', apiPascal: 'VagasSetembro' },
  { mes: 10, label: 'Out', api: 'vagasOutubro', apiPascal: 'VagasOutubro' },
  { mes: 11, label: 'Nov', api: 'vagasNovembro', apiPascal: 'VagasNovembro' },
  { mes: 12, label: 'Dez', api: 'vagasDezembro', apiPascal: 'VagasDezembro' }
];

export const TIPO_COBRANCA_EXCEDENTE_OPCOES: { value: TipoCobrancaExcedente; label: string }[] = [
  { value: TipoCobrancaExcedente.PorVaga, label: 'Por vaga' }
];

export function vagasAcordoVazias(): ConfigCobrancaVagasAcordo {
  return {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null,
    10: null,
    11: null,
    12: null
  };
}

export function acordoVazio(): ConfigCobrancaAcordo {
  return {
    vagas: vagasAcordoVazias(),
    custoExcedente: null,
    tipoCobrancaExcedente: TipoCobrancaExcedente.PorVaga
  };
}

export function isQuantidadeVagasValida(valor: number | null | undefined): boolean {
  return valor != null && Number.isInteger(Number(valor)) && Number(valor) >= 0;
}

export function tipoCobrancaExcedenteLabel(tipo: TipoCobrancaExcedente | number | null | undefined): string {
  const found = TIPO_COBRANCA_EXCEDENTE_OPCOES.find((o) => o.value === Number(tipo));
  return found?.label ?? '—';
}

export function resumoVagasAcordo(vagas: ConfigCobrancaVagasAcordo | undefined): string {
  if (!vagas) return '—';
  return MESES_ACORDO.map((m) => {
    const qtd = vagas[m.mes];
    return `${m.label} ${qtd == null ? '—' : qtd}`;
  }).join(' · ');
}
