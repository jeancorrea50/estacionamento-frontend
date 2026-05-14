import type { FechamentoListaItem, FechamentoSituacao } from './faturamento-fechamentos.types';

/** 6 linhas detalhadas da especificação + linhas sintéticas para totalizar 42 com as contagens dos chips. */
export function buildFechamentosMock(): FechamentoListaItem[] {
  const featured: FechamentoListaItem[] = [
    {
      id: 'FC-001',
      transportadora: 'Transp. Horizonte Ltda',
      estacionamento: 'Estac. Central',
      modalidade: 'Mensal',
      periodoApurado: '01/05/2026 - 31/05/2026',
      movimentacoes: 48,
      valorEstimado: 12_840,
      divergencias: 0,
      situacao: 'Pronto para faturar'
    },
    {
      id: 'FC-002',
      transportadora: 'Logística Sul ME',
      estacionamento: 'Estac. Norte',
      modalidade: 'Quinzenal',
      periodoApurado: '01/05/2026 - 15/05/2026',
      movimentacoes: 21,
      valorEstimado: 5_680,
      divergencias: 2,
      situacao: 'Com divergência'
    },
    {
      id: 'FC-003',
      transportadora: 'Cargo Prime Transportes',
      estacionamento: 'Estac. Sul',
      modalidade: 'Semanal',
      periodoApurado: '06/05/2026 - 12/05/2026',
      movimentacoes: 14,
      valorEstimado: 3_250,
      divergencias: 0,
      situacao: 'Em andamento'
    },
    {
      id: 'FC-004',
      transportadora: 'Rota Azul Logística',
      estacionamento: 'Estac. Central',
      modalidade: 'Diária',
      periodoApurado: '14/05/2026',
      movimentacoes: 7,
      valorEstimado: 980,
      divergencias: 0,
      situacao: 'Pronto para faturar'
    },
    {
      id: 'FC-005',
      transportadora: 'Expresso Centro Oeste',
      estacionamento: 'Estac. Norte',
      modalidade: 'Por data personalizada',
      periodoApurado: '01/05/2026 - 20/05/2026',
      movimentacoes: 31,
      valorEstimado: 9_450,
      divergencias: 1,
      situacao: 'Com divergência'
    },
    {
      id: 'FC-006',
      transportadora: 'Delta Logística',
      estacionamento: 'Estac. Sul',
      modalidade: 'Mensal',
      periodoApurado: '01/05/2026 - 31/05/2026',
      movimentacoes: 0,
      valorEstimado: 0,
      divergencias: 0,
      situacao: 'Cancelado'
    }
  ];

  const modalidades = ['Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Por data personalizada'] as const;
  const transp = ['Norte Cargo', 'Parking Plus', 'Metro Park', 'Blue Lot', 'Garagem 2000', 'FastPark'];
  const estac = ['Estac. Leste', 'Estac. Oeste', 'Estac. Aeroporto', 'Estac. Shopping'];

  let seq = 7;
  const mk = (
    situacao: FechamentoSituacao,
    divergencias: number,
    mov: number,
    valor: number
  ): FechamentoListaItem => {
    const id = `FC-${String(seq++).padStart(3, '0')}`;
    const t = transp[(seq + mov) % transp.length];
    const e = estac[(seq + valor) % estac.length];
    const m = modalidades[seq % modalidades.length];
    return {
      id,
      transportadora: t,
      estacionamento: e,
      modalidade: m,
      periodoApurado: '01/05/2026 - 31/05/2026',
      movimentacoes: mov,
      valorEstimado: valor,
      divergencias,
      situacao
    };
  };

  const extra: FechamentoListaItem[] = [];
  /** Soma dos extras alinhada ao KPI global (R$ 86.430,00) com as 6 linhas em destaque fixas. */
  const sumFeatured = featured.reduce((a, r) => a + r.valorEstimado, 0);
  const targetTotal = 86_430;
  const targetExtras = targetTotal - sumFeatured;

  for (let i = 0; i < 10; i++) {
    extra.push(mk('Pronto para faturar', 0, 20 + i, 3_000));
  }
  for (let i = 0; i < 17; i++) {
    extra.push(mk('Em andamento', i % 4 === 0 ? 1 : 0, 5 + i, 800));
  }
  for (let i = 0; i < 2; i++) {
    extra.push(mk('Com divergência', 2 + i, 12 + i, 500));
  }
  for (let i = 0; i < 7; i++) {
    extra.push(mk('Faturado', 0, 30 + i, i === 6 ? 1_380 : 1_375));
  }

  const sumExtrasPlanned = extra.reduce((a, r) => a + r.valorEstimado, 0);
  const delta = targetExtras - sumExtrasPlanned;
  if (extra.length && delta !== 0) {
    const last = extra[extra.length - 1];
    last.valorEstimado = Math.max(0, last.valorEstimado + delta);
  }

  return [...featured, ...extra];
}

export const FECHAMENTOS_MOCK = buildFechamentosMock();
