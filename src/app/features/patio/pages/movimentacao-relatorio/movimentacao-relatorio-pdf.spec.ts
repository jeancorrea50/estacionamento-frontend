import { EntradaSaidaStatus } from '../../../movimentos/models/entrada-saida.models';
import type { MovimentacaoRelatorioItem, MovimentacaoRelatorioResumo } from './movimentacao-relatorio.types';
import {
  criarPdfMovimentacoes,
  formatarDataFiltro,
  formatarDataHoraRelatorio,
  formatarPermanenciaRelatorio,
  montarDetalhesRelatorio,
} from './movimentacao-relatorio-pdf';

const resumoVazio: MovimentacaoRelatorioResumo = {
  quantidade: 0,
  qtdEntrada: 0,
  qtdSaida: 0,
  qtdSuspenso: 0,
  qtdAgendado: 0,
  qtdCancelado: 0,
  qtdFaturado: 0,
  qtdExcedente: 0,
};

function item(parcial: Partial<MovimentacaoRelatorioItem> = {}): MovimentacaoRelatorioItem {
  return {
    id: 1,
    placaVeiculo: 'ABC1D23',
    nomeMotorista: 'Motorista',
    nomeTransportadora: 'Transportadora',
    status: EntradaSaidaStatus.Entrada,
    statusDescricao: 'Entrada',
    dataHoraEntrada: '2026-10-15T10:00:00',
    dataHoraSaida: null,
    tempoPermanenciaMinutos: null,
    faturado: false,
    avulso: true,
    ehExcedente: false,
    observacao: null,
    ...parcial,
  };
}

describe('movimentacao-relatorio-pdf', () => {
  it('não inventa permanência quando a API não envia o tempo', () => {
    expect(formatarPermanenciaRelatorio(null)).toBe('—');
    expect(formatarPermanenciaRelatorio(0)).toBe('0 min');
    expect(formatarPermanenciaRelatorio(90)).toBe('1h 30min');
  });

  it('formata a data do filtro sem deslocar o dia e o horário no fuso do pátio', () => {
    expect(formatarDataFiltro('2026-10-15')).toBe('15/10/2026');
    const texto = formatarDataHoraRelatorio('2026-10-15T15:30:00Z', 'America/Cuiaba');
    expect(texto).toContain('15/10/2026');
    expect(texto).toContain('11:30');
  });

  it('separa situação, avulso, faturamento e excedente nos detalhes', () => {
    const texto = montarDetalhesRelatorio(
      item({
        statusDescricao: 'Suspenso',
        avulso: false,
        faturado: true,
        ehExcedente: true,
        observacao: 'Aguardando doca',
      })
    );
    expect(texto).toContain('Situação: Suspenso');
    expect(texto).toContain('Avulso: Não');
    expect(texto).toContain('Faturado: Sim');
    expect(texto).toContain('Excedente: Sim');
    expect(texto).toContain('Obs.: Aguardando doca');
  });

  it('gera PDF em mais de uma página quando há muitos registros e aceita lista vazia', () => {
    const vazio = criarPdfMovimentacoes({
      estacionamentoNome: 'Pátio Teste',
      estacionamentoCnpj: null,
      timeZoneId: 'America/Cuiaba',
      periodoEntrada: '01/10/2026 a 15/10/2026',
      periodoSaida: null,
      filtrosAplicados: [],
      resumo: resumoVazio,
      itens: [],
      truncado: false,
      limiteAplicado: 0,
      emitidoEm: new Date('2026-10-15T18:00:00Z'),
    });
    expect(vazio.getNumberOfPages()).toBe(1);
    expect(vazio.output('blob').size).toBeGreaterThan(500);

    const muitos = Array.from({ length: 40 }, (_, indice) =>
      item({
        id: indice + 1,
        nomeMotorista: 'Nome muito longo do motorista para forçar quebra de linha no PDF',
        observacao: 'Observação longa '.repeat(12),
        ehExcedente: indice % 5 === 0,
        tempoPermanenciaMinutos: indice % 3 === 0 ? null : 30 + indice,
        status: indice % 4 === 0 ? EntradaSaidaStatus.Cancelado : EntradaSaidaStatus.Saida,
        statusDescricao: indice % 4 === 0 ? 'Cancelado' : 'Saida',
        dataHoraSaida: indice % 4 === 0 ? null : '2026-10-15T18:00:00Z',
      })
    );
    const cheio = criarPdfMovimentacoes({
      estacionamentoNome: 'Pátio Teste',
      estacionamentoCnpj: '00.000.000/0001-00',
      timeZoneId: 'America/Sao_Paulo',
      periodoEntrada: '01/10/2026 a 15/10/2026',
      periodoSaida: '01/10/2026 a 15/10/2026',
      filtrosAplicados: ['Placa ABC1D23', 'Excedente: Sim'],
      resumo: { ...resumoVazio, quantidade: 40, qtdExcedente: 8 },
      itens: muitos,
      truncado: false,
      limiteAplicado: 40,
      emitidoEm: new Date('2026-10-15T18:00:00Z'),
    });
    expect(cheio.getNumberOfPages()).toBeGreaterThan(1);
  });
});
