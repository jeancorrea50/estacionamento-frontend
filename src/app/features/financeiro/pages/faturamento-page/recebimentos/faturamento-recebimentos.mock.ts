import type {
  RecebimentoComprovanteEstado,
  RecebimentoHistoricoItem,
  RecebimentoListaItem,
  RecebimentoPagamentoStatus
} from './faturamento-recebimentos.types';

const featured: RecebimentoListaItem[] = [
  {
    id: 'FT-2026-000128',
    transportadora: 'Transp. Horizonte Ltda',
    estacionamento: 'Estac. Central',
    valorFatura: 5_210,
    valorRecebido: 5_210,
    saldoRestante: 0,
    dataPagamento: '02/06/2026',
    formaPagamento: 'PIX',
    comprovante: 'Anexado',
    status: 'Pago',
    historico: [{ data: '02/06/2026', forma: 'PIX', valor: 5_210, situacao: 'Confirmado' }]
  },
  {
    id: 'FT-2026-000127',
    transportadora: 'Logística Sul ME',
    estacionamento: 'Estac. Norte',
    valorFatura: 2_890.5,
    valorRecebido: 0,
    saldoRestante: 2_890.5,
    dataPagamento: null,
    formaPagamento: null,
    comprovante: 'Sem comprovante',
    status: 'Vencido',
    historico: []
  },
  {
    id: 'FT-2026-000126',
    transportadora: 'Cargo Prime Transportes',
    estacionamento: 'Estac. Sul',
    valorFatura: 18_500,
    valorRecebido: 9_250,
    saldoRestante: 9_250,
    dataPagamento: '20/05/2026',
    formaPagamento: 'Transferência',
    comprovante: 'Aguardando conferência',
    status: 'Parcial',
    historico: [
      { data: '20/05/2026', forma: 'PIX', valor: 5_000, situacao: 'Confirmado' },
      { data: '25/05/2026', forma: 'Transferência', valor: 4_250, situacao: 'Aguardando conferência' }
    ]
  },
  {
    id: 'FT-2026-000125',
    transportadora: 'Rota Azul Logística',
    estacionamento: 'Estac. Central',
    valorFatura: 1_980,
    valorRecebido: 0,
    saldoRestante: 1_980,
    dataPagamento: null,
    formaPagamento: null,
    comprovante: 'Sem comprovante',
    status: 'Em aberto',
    historico: []
  },
  {
    id: 'FT-2026-000124',
    transportadora: 'Expresso Centro Oeste',
    estacionamento: 'Estac. Norte',
    valorFatura: 6_000,
    valorRecebido: 3_000,
    saldoRestante: 3_000,
    dataPagamento: '08/05/2026',
    formaPagamento: 'Boleto',
    comprovante: 'Anexado',
    status: 'Parcial',
    historico: [{ data: '08/05/2026', forma: 'Boleto', valor: 3_000, situacao: 'Confirmado' }]
  },
  {
    id: 'FT-2026-000123',
    transportadora: 'Way Brasil Transportes',
    estacionamento: 'Estac. Aeroporto',
    valorFatura: 3_750,
    valorRecebido: 3_750,
    saldoRestante: 0,
    dataPagamento: '12/05/2026',
    formaPagamento: 'PIX',
    comprovante: 'Anexado',
    status: 'Pago',
    historico: [{ data: '12/05/2026', forma: 'PIX', valor: 3_750, situacao: 'Confirmado' }]
  },
  {
    id: 'FT-2026-000122',
    transportadora: 'Líder Transportes',
    estacionamento: 'Estac. Oeste',
    valorFatura: 4_420,
    valorRecebido: 0,
    saldoRestante: 4_420,
    dataPagamento: null,
    formaPagamento: null,
    comprovante: 'Sem comprovante',
    status: 'Vencido',
    historico: []
  },
  {
    id: 'FT-2026-000121',
    transportadora: 'Delta Logística',
    estacionamento: 'Estac. Sul',
    valorFatura: 1_250,
    valorRecebido: 0,
    saldoRestante: 0,
    dataPagamento: null,
    formaPagamento: null,
    comprovante: '—',
    status: 'Cancelada',
    historico: []
  }
];

const transp = ['Norte Cargo', 'Parking Plus', 'Metro Park', 'Blue Lot', 'Garagem 2000', 'FastPark'];
const estac = ['Estac. Leste', 'Estac. Oeste', 'Estac. Aeroporto', 'Estac. Shopping'];

function mkHistorico(
  status: RecebimentoPagamentoStatus,
  comp: RecebimentoComprovanteEstado,
  valorFatura: number,
  valorRecebido: number,
  forma: string | null
): RecebimentoHistoricoItem[] {
  if (status === 'Pago' && valorRecebido > 0) {
    return [{ data: '14/05/2026', forma: forma ?? 'PIX', valor: valorRecebido, situacao: 'Confirmado' }];
  }
  if (status === 'Parcial' && valorRecebido > 0) {
    return [
      {
        data: '13/05/2026',
        forma: forma ?? 'Boleto',
        valor: valorRecebido,
        situacao: comp === 'Aguardando conferência' ? 'Aguardando conferência' : 'Confirmado'
      }
    ];
  }
  return [];
}

function mkRow(
  idx: number,
  status: RecebimentoPagamentoStatus,
  comp: RecebimentoComprovanteEstado
): RecebimentoListaItem {
  const id = `FT-2026-${String(200 + idx).padStart(6, '0')}`;
  const t = transp[idx % transp.length];
  const e = estac[(idx + 3) % estac.length];
  const valorFatura = 1_400 + (idx % 23) * 175;
  let valorRecebido = 0;
  let saldoRestante = valorFatura;
  let dataPagamento: string | null = null;
  let formaPagamento: string | null = null;

  if (status === 'Pago') {
    valorRecebido = valorFatura;
    saldoRestante = 0;
    dataPagamento = '14/05/2026';
    formaPagamento = idx % 2 === 0 ? 'PIX' : 'Transferência';
  } else if (status === 'Parcial') {
    valorRecebido = Math.round(valorFatura * 0.42);
    saldoRestante = Math.round((valorFatura - valorRecebido) * 100) / 100;
    dataPagamento = '13/05/2026';
    formaPagamento = 'Boleto';
  } else if (status === 'Cancelada') {
    valorRecebido = 0;
    saldoRestante = 0;
  } else {
    valorRecebido = 0;
    saldoRestante = valorFatura;
  }

  return {
    id,
    transportadora: t,
    estacionamento: e,
    valorFatura,
    valorRecebido,
    saldoRestante,
    dataPagamento,
    formaPagamento,
    comprovante: comp,
    status,
    historico: mkHistorico(status, comp, valorFatura, valorRecebido, formaPagamento)
  };
}

/**
 * 8 linhas da especificação + 78 sintéticas (86).
 * Status sintéticos: 40 Pago, 7 Parcial, 20 Em aberto, 9 Vencido, 2 Cancelada.
 * Comprovante sintético coerente; contagens exatas dos chips vêm do `computed` no componente.
 */
export function buildRecebimentosMock(): RecebimentoListaItem[] {
  const statuses: RecebimentoPagamentoStatus[] = [
    ...Array.from({ length: 40 }, () => 'Pago' as const),
    ...Array.from({ length: 7 }, () => 'Parcial' as const),
    ...Array.from({ length: 20 }, () => 'Em aberto' as const),
    ...Array.from({ length: 9 }, () => 'Vencido' as const),
    ...Array.from({ length: 2 }, () => 'Cancelada' as const)
  ];

  const comps: RecebimentoComprovanteEstado[] = statuses.map((st) => {
    if (st === 'Cancelada') return '—';
    if (st === 'Pago') return 'Anexado';
    if (st === 'Parcial') return 'Anexado';
    return 'Sem comprovante';
  });

  for (let k = 0; k < 7; k++) {
    comps[40 + k] = k % 3 === 0 ? 'Aguardando conferência' : 'Anexado';
  }

  const extra = statuses.map((st, j) => mkRow(j, st, comps[j]));
  return [...featured, ...extra];
}

export const RECEBIMENTOS_MOCK = buildRecebimentosMock();
