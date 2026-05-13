import type { FaturaListaItem } from './faturamento-faturas.types';

/** Dados fictícios para a aba Faturas (sem integração com API). */
export const FATURAS_MOCK: FaturaListaItem[] = [
  {
    id: 'FT-2026-0142',
    transportadora: 'Transp. Horizonte Ltda',
    estacionamento: 'Estacionamento Centro',
    modalidade: 'Semanal',
    periodoInicio: '2026-05-05',
    periodoFim: '2026-05-11',
    valor: 4200,
    vencimento: '2026-05-14',
    status: 'Em aberto',
    envio: { situacao: 'Enviado', canal: 'E-mail', detalhe: '08/05/2026 09:12' }
  },
  {
    id: 'FT-2026-0141',
    transportadora: 'Logística Sul ME',
    estacionamento: 'Garagem Sul',
    modalidade: 'Mensal',
    periodoInicio: '2026-04-01',
    periodoFim: '2026-04-30',
    valor: 12890.5,
    vencimento: '2026-05-10',
    status: 'Vencido',
    envio: { situacao: 'Enviado', canal: 'E-mail e WhatsApp', detalhe: '02/05/2026 14:40' }
  },
  {
    id: 'FT-2026-0140',
    transportadora: 'Cargo Prime Transportes',
    estacionamento: 'Parking Norte',
    modalidade: 'Quinzenal',
    periodoInicio: '2026-04-16',
    periodoFim: '2026-04-30',
    valor: 6150,
    vencimento: '2026-05-16',
    status: 'Parcial',
    envio: { situacao: 'Enviado', canal: 'E-mail', detalhe: '01/05/2026 11:05' }
  },
  {
    id: 'FT-2026-0138',
    transportadora: 'Rota Azul Logística',
    estacionamento: 'Estacionamento Centro',
    modalidade: 'Diária',
    periodoInicio: '2026-05-01',
    periodoFim: '2026-05-01',
    valor: 1980,
    vencimento: '2026-05-18',
    status: 'Em aberto',
    envio: { situacao: 'Não enviado' }
  },
  {
    id: 'FT-2026-0137',
    transportadora: 'Expresso Centro Oeste',
    estacionamento: 'Terminal T2',
    modalidade: 'Mensal',
    periodoInicio: '2026-04-01',
    periodoFim: '2026-04-30',
    valor: 3310,
    vencimento: '2026-05-08',
    status: 'Vencido',
    envio: { situacao: 'Enviado', canal: 'E-mail', detalhe: '28/04/2026 08:55' }
  },
  {
    id: 'FT-2026-0135',
    transportadora: 'Frota União S/A',
    estacionamento: 'Garagem Sul',
    modalidade: 'Semanal',
    periodoInicio: '2026-04-28',
    periodoFim: '2026-05-04',
    valor: 2890,
    vencimento: '2026-05-12',
    status: 'Em aberto',
    envio: { situacao: 'Agendado', canal: 'E-mail', detalhe: 'Hoje 16:00' }
  },
  {
    id: 'FT-2026-0134',
    transportadora: 'Transp. Horizonte Ltda',
    estacionamento: 'Parking Express',
    modalidade: 'Por data personalizada',
    periodoInicio: '2026-05-02',
    periodoFim: '2026-05-09',
    valor: 5120.75,
    vencimento: '2026-05-20',
    status: 'Aguardando envio',
    envio: { situacao: 'Não enviado' }
  },
  {
    id: 'FT-2026-0132',
    transportadora: 'Logística Sul ME',
    estacionamento: 'Terminal T2',
    modalidade: 'Diária',
    periodoInicio: '2026-05-11',
    periodoFim: '2026-05-11',
    valor: 640,
    vencimento: '2026-05-13',
    status: 'Aguardando envio',
    envio: { situacao: 'Não enviado' }
  },
  {
    id: 'FT-2026-0130',
    transportadora: 'Cargo Prime Transportes',
    estacionamento: 'Estacionamento Centro',
    modalidade: 'Mensal',
    periodoInicio: '2026-03-01',
    periodoFim: '2026-03-31',
    valor: 22400,
    vencimento: '2026-04-15',
    status: 'Pago',
    envio: { situacao: 'Enviado', canal: 'E-mail', detalhe: '05/04/2026 10:22' }
  },
  {
    id: 'FT-2026-0128',
    transportadora: 'Rota Azul Logística',
    estacionamento: 'Parking Norte',
    modalidade: 'Semanal',
    periodoInicio: '2026-04-21',
    periodoFim: '2026-04-27',
    valor: 1750,
    vencimento: '2026-05-05',
    status: 'Pago',
    envio: { situacao: 'Enviado', canal: 'WhatsApp', detalhe: '29/04/2026 17:18' }
  },
  {
    id: 'FT-2026-0125',
    transportadora: 'Expresso Centro Oeste',
    estacionamento: 'Garagem Sul',
    modalidade: 'Quinzenal',
    periodoInicio: '2026-04-01',
    periodoFim: '2026-04-15',
    valor: 980,
    vencimento: '2026-04-28',
    status: 'Cancelada',
    envio: { situacao: 'Enviado', canal: 'E-mail', detalhe: '16/04/2026 09:00' }
  },
  {
    id: 'FT-2026-0122',
    transportadora: 'Frota União S/A',
    estacionamento: 'Parking Express',
    modalidade: 'Mensal',
    periodoInicio: '2026-04-01',
    periodoFim: '2026-04-30',
    valor: 15440,
    vencimento: '2026-05-15',
    status: 'Em aberto',
    envio: { situacao: 'Enviado', canal: 'E-mail', detalhe: '30/04/2026 13:44' }
  },
  {
    id: 'FT-2026-0119',
    transportadora: 'Logística Sul ME',
    estacionamento: 'Estacionamento Centro',
    modalidade: 'Semanal',
    periodoInicio: '2026-05-06',
    periodoFim: '2026-05-12',
    valor: 3020,
    vencimento: '2026-05-19',
    status: 'Parcial',
    envio: { situacao: 'Enviado', canal: 'E-mail e WhatsApp', detalhe: '07/05/2026 08:30' }
  },
  {
    id: 'FT-2026-0115',
    transportadora: 'Transp. Horizonte Ltda',
    estacionamento: 'Terminal T2',
    modalidade: 'Diária',
    periodoInicio: '2026-05-10',
    periodoFim: '2026-05-10',
    valor: 890,
    vencimento: '2026-05-17',
    status: 'Em aberto',
    envio: { situacao: 'Enviado', canal: 'E-mail', detalhe: '11/05/2026 07:15' }
  }
];
