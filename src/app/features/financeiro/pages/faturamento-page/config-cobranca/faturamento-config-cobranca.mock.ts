/**
 * Mock legado — a tela usa `/api/financeiro/ConfiguracaoCobranca`.
 * Mantido apenas como referência local de shape (não consumido pela UI).
 */
import { ModalidadeCobranca, RegraFechamento } from '../../../models/configuracao-cobranca.models';
import type { ConfigCobrancaListaItem } from './faturamento-config-cobranca.types';
import { emptyRegra } from '../../../mappers/configuracao-cobranca.mapper';

export const CONFIG_COBRANCA_MOCK: ConfigCobrancaListaItem[] = [
  {
    id: 1,
    transportadoraId: 1,
    estacionamentoId: 1,
    transportadora: 'Transp. Horizonte Ltda',
    estacionamento: 'Estac. Central',
    modalidade: 'Mensal',
    modalidadeCobranca: ModalidadeCobranca.Mensal,
    diaFechamento: null,
    regraFechamento: RegraFechamento.UltimoDiaDoMes,
    fechamento: 'Último dia do mês',
    prazoVencimentoDias: 10,
    prazoVencimento: '10 dias após fechamento',
    envioAutomatico: true,
    gerarFaturaAutomaticamente: true,
    emailFinanceiro: 'financeiro@horizonte.com.br',
    status: 'Ativa',
    multaAplicar: true,
    multaPercentual: 2,
    jurosAplicar: true,
    jurosPercentual: 1,
    aplicarDescontoFixo: false,
    valorDescontoFixo: 0,
    aplicarAcrescimoFixo: false,
    valorAcrescimoFixo: 0,
    valorEstadia: null,
    pagamentoParcial: false,
    servicosCobrados: 'Diária, Mensal, Lavagem',
    agrupamentoFatura: 'Por transportadora e período',
    agruparPorPlaca: false,
    agruparPorPeriodo: true,
    agruparPorTransportadora: true,
    regra: { ...emptyRegra(), cobrarDiaria: true, cobrarMensal: true, cobrarLavagem: true }
  }
];
