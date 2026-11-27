import type { JanelaAgendamentoListItem, ModalidadeJanela } from '../../models/janela-agendamento.models';
import { horaParaMinutos } from '../janela-form-dialog/janela-form.validation';

export interface FaixaGerada {
  horaInicio: string;
  horaFim: string;
}

export interface GerarHorariosInput {
  horaInicio: string;
  horaFim: string;
  /** Duração de cada faixa, em minutos. */
  duracaoMinutos: number;
}

function formatMinutosDia(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Gera faixas consecutivas [inicio, inicio+duracao), … até cobrir o intervalo
 * sem ultrapassar `horaFim`. Ex.: 06:00–18:00 / 60min → 12 faixas.
 */
export function gerarFaixasHorario(input: GerarHorariosInput): { faixas: FaixaGerada[]; erro?: string } {
  const ini = horaParaMinutos(String(input.horaInicio ?? '').trim());
  const fim = horaParaMinutos(String(input.horaFim ?? '').trim());
  const duracao = Math.trunc(Number(input.duracaoMinutos));

  if (ini == null || fim == null) {
    return { faixas: [], erro: 'Informe hora inicial e final válidas (HH:mm).' };
  }
  if (!(duracao >= 5)) {
    return { faixas: [], erro: 'Informe a duração de cada horário.' };
  }
  if (fim <= ini) {
    return { faixas: [], erro: 'A hora final deve ser maior que a hora inicial.' };
  }
  if ((fim - ini) % duracao !== 0) {
    return {
      faixas: [],
      erro: `O intervalo ${formatMinutosDia(ini)}–${formatMinutosDia(fim)} não é divisível pela duração de ${duracao} min.`,
    };
  }

  const faixas: FaixaGerada[] = [];
  for (let cursor = ini; cursor < fim; cursor += duracao) {
    faixas.push({
      horaInicio: formatMinutosDia(cursor),
      horaFim: formatMinutosDia(cursor + duracao),
    });
  }
  if (!faixas.length) {
    return { faixas: [], erro: 'Nenhuma faixa gerada. Ajuste o intervalo ou a duração.' };
  }
  return { faixas };
}

export interface CapacidadePatio {
  /** Cadastro: Capacidade (veíc.). */
  estacionamento: number | null;
  /** Cadastro: Capacidade limpeza. */
  limpeza: number | null;
}

export interface UsoVagasJanelas {
  estacionamento: number;
  limpeza: number;
}

export interface ValidacaoCapacidadeInput {
  vagasPorSlot: number | null;
  modalidade: ModalidadeJanela;
  capacidade: CapacidadePatio;
  /** Soma de `vagasPorSlot` das demais janelas (exclui a em edição). */
  usoOutras: UsoVagasJanelas;
}

/** Modalidade 1 e 3 consomem capacidade de estacionamento. */
export function consomeCapacidadeEstacionamento(m: ModalidadeJanela): boolean {
  return m === 1 || m === 3;
}

/** Modalidade 2 e 3 consomem capacidade de limpeza. */
export function consomeCapacidadeLimpeza(m: ModalidadeJanela): boolean {
  return m === 2 || m === 3;
}

/**
 * Soma vagas por bucket de capacidade, opcionalmente excluindo uma janela (edição).
 * Conta todas as janelas retornadas (ativas e inativas), conforme cadastro do pátio.
 */
export function somarUsoVagasJanelas(
  janelas: ReadonlyArray<Pick<JanelaAgendamentoListItem, 'id' | 'modalidade' | 'vagasPorSlot'>>,
  excluirId?: number | null
): UsoVagasJanelas {
  let estacionamento = 0;
  let limpeza = 0;
  for (const j of janelas) {
    if (excluirId != null && j.id === excluirId) continue;
    const vagas = Number(j.vagasPorSlot);
    if (!Number.isFinite(vagas) || vagas <= 0) continue;
    if (consomeCapacidadeEstacionamento(j.modalidade)) estacionamento += vagas;
    if (consomeCapacidadeLimpeza(j.modalidade)) limpeza += vagas;
  }
  return { estacionamento, limpeza };
}

export function tetoDisponivel(
  capacidade: number | null,
  usoOutras: number
): number | null {
  if (capacidade == null || !Number.isFinite(capacidade)) return null;
  return Math.max(0, Math.trunc(capacidade) - Math.max(0, Math.trunc(usoOutras)));
}

/**
 * Valida se `vagasPorSlot` cabe no restante da capacidade do cadastro
 * (`app/cadastro/estacionamentos`), somando as demais janelas do pátio.
 */
export function validarVagasContraCapacidadePatio(input: ValidacaoCapacidadeInput): string[] {
  const vagas = input.vagasPorSlot;
  if (vagas == null || !(vagas >= 1)) return [];

  const erros: string[] = [];
  const { modalidade, capacidade, usoOutras } = input;

  if (consomeCapacidadeEstacionamento(modalidade)) {
    const disponivel = tetoDisponivel(capacidade.estacionamento, usoOutras.estacionamento);
    if (capacidade.estacionamento == null) {
      erros.push(
        'Capacidade de veículos do estacionamento não está cadastrada. Informe em Cadastro → Estacionamentos.'
      );
    } else if (disponivel != null && vagas > disponivel) {
      erros.push(
        disponivel === 0
          ? `Não há vagas disponíveis na capacidade de estacionamento (${capacidade.estacionamento}). Outras janelas já usam ${usoOutras.estacionamento}.`
          : `Vagas por período (${vagas}) ultrapassam o disponível para estacionamento (${disponivel} de ${capacidade.estacionamento}). Outras janelas usam ${usoOutras.estacionamento}.`
      );
    }
  }

  if (consomeCapacidadeLimpeza(modalidade)) {
    const disponivel = tetoDisponivel(capacidade.limpeza, usoOutras.limpeza);
    if (capacidade.limpeza == null) {
      erros.push(
        'Capacidade de limpeza do estacionamento não está cadastrada. Informe em Cadastro → Estacionamentos.'
      );
    } else if (disponivel != null && vagas > disponivel) {
      erros.push(
        disponivel === 0
          ? `Não há vagas disponíveis na capacidade de limpeza (${capacidade.limpeza}). Outras janelas já usam ${usoOutras.limpeza}.`
          : `Vagas por período (${vagas}) ultrapassam o disponível para limpeza (${disponivel} de ${capacidade.limpeza}). Outras janelas usam ${usoOutras.limpeza}.`
      );
    }
  }

  return erros;
}
