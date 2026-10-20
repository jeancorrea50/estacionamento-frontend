import { EntradaSaidaStatus } from '../../../movimentos/models/entrada-saida.models';
import type { MovimentacaoRelatorioItem, MovimentacaoRelatorioResumo } from './movimentacao-relatorio.types';
import {
  criarPdfMovimentacoes,
  formatarDataFiltro,
  formatarDataHoraRelatorio,
  formatarPermanenciaRelatorio,
  montarDemonstrativoQuantitativo,
  montarDetalhesRelatorio,
  resolverTransportadoraEscopo,
  formatarValorRelatorio,
  minutosPermanenciaRelatorio,
  rotuloCobertura,
  rotuloExcedente,
  rotuloFaturamento,
  rotuloPermanenciaRelatorio,
  type MovimentacaoRelatorioPdfEntrada,
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
    valor: null,
    ...parcial,
  };
}

function entradaPdf(
  parcial: Partial<MovimentacaoRelatorioPdfEntrada> = {}
): MovimentacaoRelatorioPdfEntrada {
  return {
    estacionamentoNome: 'Pátio Teste',
    estacionamentoCnpj: null,
    transportadoraEscopo: null,
    timeZoneId: 'America/Cuiaba',
    periodoEntrada: '01/10/2026 a 15/10/2026',
    periodoSaida: null,
    filtrosAplicados: [],
    resumo: resumoVazio,
    itens: [],
    truncado: false,
    limiteAplicado: 0,
    emitidoEm: new Date('2026-10-15T18:00:00Z'),
    ...parcial,
  };
}

describe('movimentacao-relatorio-pdf', () => {
  it('formata permanência e deriva de entrada/saída quando a API omite o tempo', () => {
    expect(formatarPermanenciaRelatorio(null)).toBe('—');
    expect(formatarPermanenciaRelatorio(0)).toBe('0 min');
    expect(formatarPermanenciaRelatorio(90)).toBe('1h 30min');
    expect(
      minutosPermanenciaRelatorio(
        item({
          tempoPermanenciaMinutos: null,
          dataHoraEntrada: '2026-10-19T21:43:00',
          dataHoraSaida: '2026-10-19T22:45:00',
        })
      )
    ).toBe(62);
    expect(
      rotuloPermanenciaRelatorio(
        item({
          tempoPermanenciaMinutos: null,
          dataHoraEntrada: '2026-10-19T21:43:00',
          dataHoraSaida: '2026-10-19T22:45:00',
        })
      )
    ).toBe('1h 2min');
    expect(
      minutosPermanenciaRelatorio(
        item({
          tempoPermanenciaMinutos: 45,
          dataHoraEntrada: '2026-10-19T21:43:00',
          dataHoraSaida: '2026-10-19T22:45:00',
        })
      )
    ).toBe(45);
  });

  it('formata a data do filtro sem deslocar o dia e o horário no fuso do pátio', () => {
    expect(formatarDataFiltro('2026-10-15')).toBe('15/10/2026');
    const texto = formatarDataHoraRelatorio('2026-10-15T15:30:00Z', 'America/Cuiaba');
    expect(texto).toContain('15/10/2026');
    expect(texto).toContain('11:30');
  });

  it('deriva cobertura e faturamento apenas das flags do contrato', () => {
    expect(rotuloCobertura(item({ ehExcedente: true, avulso: false }))).toBe('Excedente');
    expect(rotuloCobertura(item({ ehExcedente: false, avulso: true }))).toBe('Avulso');
    expect(rotuloCobertura(item({ ehExcedente: false, avulso: false }))).toBe('Acordo');
    expect(rotuloFaturamento(item({ faturado: true }))).toBe('Sim');
    expect(rotuloFaturamento(item({ faturado: false }))).toBe('Não');
  });

  it('excedente e valor sem inventar dados ausentes no contrato', () => {
    expect(rotuloExcedente(item({ ehExcedente: true }))).toBe('Sim');
    expect(rotuloExcedente(item({ ehExcedente: false }))).toBe('Não');
    expect(formatarValorRelatorio(null)).toBe('—');
    expect(formatarValorRelatorio(12.5)).toContain('12,50');
  });

  it('monta demonstrativo quantitativo sem valores monetários e omite zeros', () => {
    const linhas = montarDemonstrativoQuantitativo([
      item({ ehExcedente: true, avulso: false, faturado: false }),
      item({ ehExcedente: false, avulso: true, faturado: true }),
      item({ ehExcedente: false, avulso: false, faturado: true }),
    ]);
    expect(linhas.some((l) => l.descricao.includes('excedentes') && l.quantidade === 1)).toBe(true);
    expect(linhas.some((l) => l.descricao.includes('avulsas') && l.quantidade === 1)).toBe(true);
    expect(linhas.some((l) => l.descricao.includes('acordo') && l.quantidade === 1)).toBe(true);
    expect(linhas.some((l) => l.descricao.includes('faturadas') && l.quantidade === 2)).toBe(true);
    expect(linhas.every((l) => l.quantidade > 0)).toBe(true);
  });

  it('resolve escopo de transportadora sem inventar CNPJ', () => {
    expect(resolverTransportadoraEscopo([])).toBeNull();
    expect(resolverTransportadoraEscopo([item({ nomeTransportadora: 'Alpha' })])).toBe('Alpha');
    expect(
      resolverTransportadoraEscopo([
        item({ nomeTransportadora: 'Alpha' }),
        item({ nomeTransportadora: 'Beta' }),
      ])
    ).toBe('Consolidado (múltiplas transportadoras)');
  });

  it('mantém detalhes legados com cobertura e faturamento separados', () => {
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
    expect(texto).toContain('Cobertura: Excedente');
    expect(texto).toContain('Faturado: Sim');
    expect(texto).toContain('Obs.: Aguardando doca');
  });

  it('gera PDF em mais de uma página quando há muitos registros e aceita lista vazia', () => {
    const vazio = criarPdfMovimentacoes(entradaPdf());
    expect(vazio.getNumberOfPages()).toBe(1);
    expect(vazio.output('blob').size).toBeGreaterThan(500);

    const muitos = Array.from({ length: 40 }, (_, indice) =>
      item({
        id: indice + 1,
        nomeMotorista: 'Nome muito longo do motorista para forçar quebra de linha no PDF',
        observacao: 'Observação longa '.repeat(12),
        ehExcedente: indice % 5 === 0,
        avulso: indice % 5 !== 0 && indice % 2 === 0,
        tempoPermanenciaMinutos: indice % 3 === 0 ? null : 30 + indice,
        status: indice % 4 === 0 ? EntradaSaidaStatus.Cancelado : EntradaSaidaStatus.Saida,
        statusDescricao: indice % 4 === 0 ? 'Cancelado' : 'Saida',
        dataHoraSaida: indice % 4 === 0 ? null : '2026-10-15T18:00:00Z',
      })
    );
    const cheio = criarPdfMovimentacoes(
      entradaPdf({
        estacionamentoCnpj: '00.000.000/0001-00',
        transportadoraEscopo: 'Consolidado (múltiplas transportadoras)',
        timeZoneId: 'America/Sao_Paulo',
        periodoSaida: '01/10/2026 a 15/10/2026',
        filtrosAplicados: ['Placa ABC1D23', 'Excedente: Sim'],
        resumo: { ...resumoVazio, quantidade: 40, qtdExcedente: 8 },
        itens: muitos,
        limiteAplicado: 40,
      })
    );
    expect(cheio.getNumberOfPages()).toBeGreaterThan(1);
  });
});
