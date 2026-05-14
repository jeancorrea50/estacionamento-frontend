import type { ConfigCobrancaListaItem, ConfigCobrancaModalidade, ConfigCobrancaStatus } from './faturamento-config-cobranca.types';

const featured: ConfigCobrancaListaItem[] = [
  {
    id: 'CFG-001',
    transportadora: 'Transp. Horizonte Ltda',
    estacionamento: 'Estac. Central',
    modalidade: 'Mensal',
    fechamento: 'Último dia do mês',
    prazoVencimento: '10 dias após fechamento',
    envioAutomatico: true,
    emailFinanceiro: 'financeiro@horizonte.com.br',
    status: 'Ativa',
    multaAplicar: true,
    multaPercentual: 2,
    jurosAplicar: true,
    jurosPercentual: 1,
    pagamentoParcial: false,
    servicosCobrados: 'Diária, Mensal, Lavagem',
    agrupamentoFatura: 'Por transportadora e período'
  },
  {
    id: 'CFG-002',
    transportadora: 'Logística Sul ME',
    estacionamento: 'Estac. Norte',
    modalidade: 'Quinzenal',
    fechamento: 'Dia 15 e 30',
    prazoVencimento: '5 dias após fechamento',
    envioAutomatico: true,
    emailFinanceiro: 'financeiro@logisticasul.com.br',
    status: 'Ativa',
    multaAplicar: true,
    multaPercentual: 2,
    jurosAplicar: false,
    jurosPercentual: 0,
    pagamentoParcial: true,
    servicosCobrados: 'Quinzenal, Mensal, Extras',
    agrupamentoFatura: 'Por período'
  },
  {
    id: 'CFG-003',
    transportadora: 'Cargo Prime Transportes',
    estacionamento: 'Estac. Sul',
    modalidade: 'Semanal',
    fechamento: 'Toda segunda-feira',
    prazoVencimento: '3 dias após fechamento',
    envioAutomatico: false,
    emailFinanceiro: null,
    status: 'Sem e-mail financeiro',
    multaAplicar: false,
    multaPercentual: 0,
    jurosAplicar: false,
    jurosPercentual: 0,
    pagamentoParcial: false,
    servicosCobrados: 'Semanal, Diária',
    agrupamentoFatura: 'Por placa'
  },
  {
    id: 'CFG-004',
    transportadora: 'Rota Azul Logística',
    estacionamento: 'Estac. Central',
    modalidade: 'Diária',
    fechamento: 'Diário às 23:59',
    prazoVencimento: '1 dia após fechamento',
    envioAutomatico: true,
    emailFinanceiro: 'financeiro@rotaazul.com.br',
    status: 'Ativa',
    multaAplicar: false,
    multaPercentual: 0,
    jurosAplicar: false,
    jurosPercentual: 0,
    pagamentoParcial: true,
    servicosCobrados: 'Diária, Pernoite',
    agrupamentoFatura: 'Por placa e período'
  },
  {
    id: 'CFG-005',
    transportadora: 'Expresso Centro Oeste',
    estacionamento: 'Estac. Norte',
    modalidade: 'Por data personalizada',
    fechamento: '01/05 a 20/05',
    prazoVencimento: '7 dias após fechamento',
    envioAutomatico: false,
    emailFinanceiro: 'cobranca@expressoeste.com.br',
    status: 'Pendente de dados',
    multaAplicar: true,
    multaPercentual: 1,
    jurosAplicar: true,
    jurosPercentual: 0.5,
    pagamentoParcial: false,
    servicosCobrados: 'Personalizado, Extras',
    agrupamentoFatura: 'Por transportadora'
  },
  {
    id: 'CFG-006',
    transportadora: 'Delta Logística',
    estacionamento: 'Estac. Sul',
    modalidade: 'Mensal',
    fechamento: 'Dia 30',
    prazoVencimento: '10 dias após fechamento',
    envioAutomatico: false,
    emailFinanceiro: 'financeiro@delta.com.br',
    status: 'Inativa',
    multaAplicar: false,
    multaPercentual: 0,
    jurosAplicar: false,
    jurosPercentual: 0,
    pagamentoParcial: false,
    servicosCobrados: 'Mensal',
    agrupamentoFatura: 'Por período'
  }
];

const transp = ['Norte Cargo', 'Parking Plus', 'Metro Park', 'Blue Lot', 'Garagem 2000'];
const estac = ['Estac. Leste', 'Estac. Oeste', 'Estac. Aeroporto'];
const mods: ConfigCobrancaModalidade[] = ['Mensal', 'Quinzenal', 'Semanal', 'Diária', 'Por data personalizada'];

function mkExtra(idx: number): ConfigCobrancaListaItem {
  const id = `CFG-${String(20 + idx).padStart(3, '0')}`;
  const mod = mods[idx % mods.length];
  let status: ConfigCobrancaStatus = 'Ativa';
  let email: string | null = `cfg${idx}@mock-transp.com.br`;
  let envio = idx % 2 === 0;

  if (idx >= 18 && idx < 20) {
    status = 'Inativa';
    envio = false;
  } else if (idx >= 20 && idx < 24) {
    status = 'Pendente de dados';
    envio = idx % 2 === 0;
  } else if (idx >= 24 && idx < 26) {
    status = 'Sem e-mail financeiro';
    email = null;
    envio = false;
  }

  return {
    id,
    transportadora: transp[idx % transp.length],
    estacionamento: estac[(idx + 1) % estac.length],
    modalidade: mod,
    fechamento: idx % 2 === 0 ? 'Último dia do mês' : 'Dia 15 e último dia',
    prazoVencimento: idx % 3 === 0 ? '10 dias após fechamento' : '5 dias após fechamento',
    envioAutomatico: envio,
    emailFinanceiro: email,
    status,
    multaAplicar: idx % 4 === 0,
    multaPercentual: 2,
    jurosAplicar: idx % 5 === 0,
    jurosPercentual: 1,
    pagamentoParcial: idx % 3 === 0,
    servicosCobrados: 'Diária, Mensal, Lavagem',
    agrupamentoFatura: idx % 2 === 0 ? 'Por transportadora' : 'Por período'
  };
}

/** 6 linhas da especificação + 26 sintéticas (32). */
export const CONFIG_COBRANCA_MOCK: ConfigCobrancaListaItem[] = [
  ...featured,
  ...Array.from({ length: 26 }, (_, i) => mkExtra(i))
];
