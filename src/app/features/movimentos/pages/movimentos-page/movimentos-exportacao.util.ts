import { formatPlacaDisplay, normalizePlaca } from '../../../cadastro/utils/placa-br';
import { EntradaSaidaStatus, entradaSaidaStatusLabel } from '../../models/entrada-saida.models';
import type { MovimentacaoRelatorioFiltro } from '../../../patio/pages/movimentacao-relatorio/movimentacao-relatorio.types';
import {
  criarDataHoje,
  toIsoDate,
  type MovimentosFiltrosAvancados,
} from './movimentos-filtros.util';

export type FiltroResumoChipExport =
  | 'noPatio'
  | 'suspensos'
  | 'entradasHoje'
  | 'agendados'
  | 'todos';

export interface MontarFiltroMovimentacoesExportacaoInput {
  filtrosAvancados: MovimentosFiltrosAvancados;
  /** Campo rápido da barra (placa/descrição). */
  placaRapida: string;
  /** Checkbox "Em aberto" da tela — espelha `somenteEmAberto` do `/EntradaSaida`. */
  somenteEmAberto: boolean;
  chip: FiltroResumoChipExport;
  transportadoraSessaoId: number | null;
  estacionamentoId: number | null;
  /** Piso do Limite enviado ao relatório (default 1000). */
  limiteMinimo?: number;
}

/**
 * Mapeia o estado da tela Movimentações para o GET `/api/MovimentacaoRelatorio`.
 * Alinha com a lista: `SomenteEmAberto` do checkbox; status só nos chips que filtrama por status.
 */
export function montarFiltroMovimentacoesExportacao(
  input: MontarFiltroMovimentacoesExportacaoInput
): MovimentacaoRelatorioFiltro {
  const avancados = input.filtrosAvancados;
  const placaRapida = input.placaRapida.trim();
  const placaAvancada = avancados.placa.trim();
  const placaRaw = placaAvancada || placaRapida;
  const placa = placaRaw ? formatPlacaDisplay(normalizePlaca(placaRaw)) : null;

  const transportadoraSessao =
    input.transportadoraSessaoId != null && input.transportadoraSessaoId > 0
      ? input.transportadoraSessaoId
      : null;
  const transportadoraId =
    transportadoraSessao != null
      ? transportadoraSessao
      : avancados.transportadoraId != null && avancados.transportadoraId > 0
        ? avancados.transportadoraId
        : null;

  const motoristaId =
    avancados.motoristaId != null && avancados.motoristaId > 0 ? avancados.motoristaId : null;

  let dataInicial: string | null = avancados.periodoAtivo ? toIsoDate(avancados.dataInicio) : null;
  let dataFinal: string | null = avancados.periodoAtivo ? toIsoDate(avancados.dataFim) : null;

  const chip = input.chip;
  if (chip === 'entradasHoje' && !avancados.periodoAtivo) {
    const hoje = toIsoDate(criarDataHoje());
    dataInicial = hoje;
    dataFinal = hoje;
  }

  // Relatório exige janela de datas; sem isso o backend usa default estreito.
  if (!dataInicial || !dataFinal) {
    const hoje = criarDataHoje();
    dataInicial = toIsoDate(new Date(hoje.getFullYear() - 5, 0, 1));
    dataFinal = toIsoDate(hoje);
  }

  // Mesma regra da lista: chips de status só em suspensos/agendados.
  // "No pátio" = Em aberto (não forçar Status=Entrada — excluiria Saída e divergiria da tela).
  let status: number | null = null;
  if (chip === 'suspensos') status = EntradaSaidaStatus.Suspenso;
  else if (chip === 'agendados') status = EntradaSaidaStatus.Agendado;

  let ehExcedente: boolean | null = null;
  if (avancados.excedente === 'sim') ehExcedente = true;
  else if (avancados.excedente === 'nao') ehExcedente = false;

  const limiteMinimo = input.limiteMinimo != null && input.limiteMinimo > 0 ? input.limiteMinimo : 1000;

  return {
    dataInicial,
    dataFinal,
    placa,
    motoristaId,
    transportadoraId,
    somenteEmAberto: input.somenteEmAberto,
    status,
    ehExcedente,
    estacionamentoId:
      input.estacionamentoId != null && input.estacionamentoId > 0 ? input.estacionamentoId : null,
    limite: limiteMinimo,
  };
}

export function rotulosFiltroMovimentacoesExportacao(
  filtro: MovimentacaoRelatorioFiltro,
  chip: FiltroResumoChipExport
): string[] {
  const rotulos: string[] = [];

  if (chip === 'noPatio') rotulos.push('No pátio');
  else if (chip === 'suspensos') rotulos.push('Suspensos');
  else if (chip === 'entradasHoje') rotulos.push('Entradas hoje');
  else if (chip === 'agendados') rotulos.push('Agendados');
  else if (chip === 'todos') rotulos.push('Todos');

  rotulos.push(`Em aberto: ${filtro.somenteEmAberto ? 'Sim' : 'Não'}`);

  if (filtro.placa) rotulos.push(`Placa ${filtro.placa}`);
  if (filtro.transportadoraId) rotulos.push(`Transportadora #${filtro.transportadoraId}`);
  if (filtro.motoristaId) rotulos.push(`Motorista #${filtro.motoristaId}`);
  if (filtro.status != null) {
    rotulos.push(`Status ${entradaSaidaStatusLabel(filtro.status) || filtro.status}`);
  }
  if (filtro.faturado != null) rotulos.push(`Faturado: ${filtro.faturado ? 'Sim' : 'Não'}`);
  if (filtro.ehExcedente != null) rotulos.push(`Excedente: ${filtro.ehExcedente ? 'Sim' : 'Não'}`);
  if (filtro.descricao) rotulos.push(`Busca: ${filtro.descricao}`);
  return rotulos;
}
