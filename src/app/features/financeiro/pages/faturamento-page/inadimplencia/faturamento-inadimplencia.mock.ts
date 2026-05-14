import type { InadimplenciaListaItem, InadimplenciaStatusCobranca } from './faturamento-inadimplencia.types';

const featured: InadimplenciaListaItem[] = [
  {
    id: 'FT-2026-000127',
    transportadora: 'Logística Sul ME',
    estacionamento: 'Estac. Norte',
    valor: 2_890.5,
    vencimento: '15/05/2026',
    diasAtraso: 12,
    ultimaCobranca: '16/05/2026',
    statusCobranca: 'Enviada',
    emailFinanceiro: 'financeiro@logisticasul.com.br',
    contato: '(11) 98877-2211',
    historicoCobranca: [
      { data: '16/05/2026', canal: 'E-mail', acao: 'Cobrança enviada', resultado: 'Enviado' },
      { data: '18/05/2026', canal: 'WhatsApp', acao: 'Lembrete enviado', resultado: 'Sem resposta' },
      { data: '21/05/2026', canal: 'E-mail', acao: 'Reenvio de cobrança', resultado: 'Visualizado' }
    ]
  },
  {
    id: 'FT-2026-000122',
    transportadora: 'Líder Transportes',
    estacionamento: 'Estac. Norte',
    valor: 4_420,
    vencimento: '05/05/2026',
    diasAtraso: 22,
    ultimaCobranca: '08/05/2026',
    statusCobranca: 'Reenviada',
    emailFinanceiro: 'cobranca@lidertransportes.com.br',
    contato: '(21) 97766-3344',
    historicoCobranca: [
      { data: '08/05/2026', canal: 'E-mail', acao: 'Cobrança enviada', resultado: 'Enviado' },
      { data: '10/05/2026', canal: 'WhatsApp', acao: 'Reenvio', resultado: 'Lido' }
    ]
  },
  {
    id: 'FT-2026-000119',
    transportadora: 'Transp. Horizonte Ltda',
    estacionamento: 'Estac. Central',
    valor: 12_840,
    vencimento: '30/04/2026',
    diasAtraso: 27,
    ultimaCobranca: null,
    statusCobranca: 'Não enviada',
    emailFinanceiro: 'faturamento@horizonteltda.com.br',
    contato: '(11) 96655-8899',
    historicoCobranca: []
  },
  {
    id: 'FT-2026-000118',
    transportadora: 'Rota Azul Logística',
    estacionamento: 'Estac. Central',
    valor: 1_980,
    vencimento: '18/05/2026',
    diasAtraso: 9,
    ultimaCobranca: '19/05/2026',
    statusCobranca: 'Sem retorno',
    emailFinanceiro: 'financeiro@rotaazul.com.br',
    contato: '(47) 98844-1122',
    historicoCobranca: [
      { data: '19/05/2026', canal: 'E-mail', acao: 'Cobrança enviada', resultado: 'Enviado' },
      { data: '22/05/2026', canal: 'WhatsApp', acao: 'Lembrete', resultado: 'Sem resposta' }
    ]
  },
  {
    id: 'FT-2026-000116',
    transportadora: 'Expresso Centro Oeste',
    estacionamento: 'Estac. Sul',
    valor: 6_310,
    vencimento: '08/05/2026',
    diasAtraso: 19,
    ultimaCobranca: '10/05/2026',
    statusCobranca: 'Em negociação',
    emailFinanceiro: 'contas@expressocentro.com.br',
    contato: '(61) 98444-5566',
    historicoCobranca: [
      { data: '10/05/2026', canal: 'E-mail', acao: 'Cobrança enviada', resultado: 'Visualizado' },
      { data: '12/05/2026', canal: 'WhatsApp', acao: 'Contato comercial', resultado: 'Em conversa' }
    ]
  },
  {
    id: 'FT-2026-000113',
    transportadora: 'Cargo Prime Transportes',
    estacionamento: 'Estac. Sul',
    valor: 7_650,
    vencimento: '28/04/2026',
    diasAtraso: 29,
    ultimaCobranca: '02/05/2026',
    statusCobranca: 'Acordo realizado',
    emailFinanceiro: 'financeiro@cargoprime.com.br',
    contato: '(11) 97711-2233',
    historicoCobranca: [{ data: '02/05/2026', canal: 'E-mail', acao: 'Proposta de acordo', resultado: 'Aceito' }]
  },
  {
    id: 'FT-2026-000110',
    transportadora: 'Way Brasil Transportes',
    estacionamento: 'Estac. Central',
    valor: 3_750,
    vencimento: '21/05/2026',
    diasAtraso: 6,
    ultimaCobranca: null,
    statusCobranca: 'Não enviada',
    emailFinanceiro: 'cobranca@waybrasil.com.br',
    contato: '(11) 99988-7766',
    historicoCobranca: []
  }
];

const transp = ['Norte Cargo', 'Parking Plus', 'Metro Park', 'Blue Lot'];
const estac = ['Estac. Leste', 'Estac. Oeste', 'Estac. Aeroporto'];

type Tupla = [number, InadimplenciaStatusCobranca, string | null];

/** 25 linhas sintéticas: dias escolhidos para equilibrar faixas com os 7 registros fixos (total 32). */
const extrasTuplas: Tupla[] = [
  [1, 'Enviada', '14/05/2026'],
  [2, 'Reenviada', '14/05/2026'],
  [3, 'Sem retorno', '12/05/2026'],
  [4, 'Enviada', '13/05/2026'],
  [5, 'Reenviada', '11/05/2026'],
  [7, 'Sem retorno', '10/05/2026'],
  [7, 'Enviada', '09/05/2026'],
  [3, 'Não enviada', null],
  [8, 'Enviada', '12/05/2026'],
  [10, 'Reenviada', '11/05/2026'],
  [11, 'Sem retorno', '09/05/2026'],
  [13, 'Enviada', '08/05/2026'],
  [15, 'Reenviada', '07/05/2026'],
  [31, 'Não enviada', null],
  [32, 'Enviada', '04/05/2026'],
  [33, 'Sem retorno', '03/05/2026'],
  [34, 'Reenviada', '02/05/2026'],
  [35, 'Enviada', '01/05/2026'],
  [42, 'Sem retorno', '30/04/2026'],
  [18, 'Enviada', '28/04/2026'],
  [16, 'Não enviada', null],
  [17, 'Não enviada', null],
  [20, 'Em negociação', '08/05/2026'],
  [21, 'Em negociação', '07/05/2026'],
  [29, 'Reenviada', '02/05/2026']
];

function mkExtra(idx: number, [dias, status, ultima]: Tupla): InadimplenciaListaItem {
  const id = `FT-2026-${String(95 + idx).padStart(6, '0')}`;
  const valor = 1_050 + (idx % 13) * 285;
  const historico: InadimplenciaListaItem['historicoCobranca'] =
    status === 'Não enviada'
      ? []
      : [
          {
            data: '12/05/2026',
            canal: 'E-mail',
            acao: 'Cobrança enviada',
            resultado: 'Enviado'
          }
        ];
  return {
    id,
    transportadora: transp[idx % transp.length],
    estacionamento: estac[(idx + 1) % estac.length],
    valor,
    vencimento: '01/05/2026',
    diasAtraso: dias,
    ultimaCobranca: ultima,
    statusCobranca: status,
    emailFinanceiro: `cobranca${idx}@mock-inad.com.br`,
    contato: `(11) 9800-${(2000 + idx).toString().slice(-4)}`,
    historicoCobranca: historico
  };
}

export const INADIMPLENCIA_MOCK: InadimplenciaListaItem[] = [
  ...featured,
  ...extrasTuplas.map((t, i) => mkExtra(i, t))
];
