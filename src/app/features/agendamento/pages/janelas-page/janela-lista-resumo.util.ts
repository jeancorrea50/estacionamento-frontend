import {
  JanelaAgendamentoDetalhe,
  JanelaAgendamentoListItem,
} from '../../models/janela-agendamento.models';
import { formDeDetalhe } from '../../components/janela-form-dialog/janela-form.state';
import {
  formatHorarioExtremosFaixas,
  formatRecorrenciaCompacta,
  totalDisponibilizacoesJanela,
} from '../../components/janela-form-wizard-dialog/janela-form-wizard.helpers';

/** Enriquece item da lista com recorrência e extremos de horário a partir do detalhe. */
export function enriquecerJanelaListItem(
  item: JanelaAgendamentoListItem,
  detalhe: JanelaAgendamentoDetalhe
): JanelaAgendamentoListItem {
  const form = formDeDetalhe(detalhe);
  const qtdFaixas = detalhe.faixas.length || item.qtdFaixas;
  const vagas = detalhe.vagasPorSlot || item.vagasPorSlot;
  return {
    ...item,
    vagasPorSlot: vagas,
    qtdFaixas,
    qtdPeriodicidades: detalhe.periodicidades.length || item.qtdPeriodicidades,
    totalDisponibilizacoes: totalDisponibilizacoesJanela(vagas, qtdFaixas),
    recorrenciaLabel: formatRecorrenciaCompacta(form.periodicidades),
    horarioResumo: formatHorarioExtremosFaixas(detalhe.faixas),
  };
}
