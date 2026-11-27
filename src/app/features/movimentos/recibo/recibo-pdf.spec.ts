import { ModoRecibo } from '../models/entrada-saida.models';
import {
  calcularPermanenciaMinutos,
  descricaoCobrancaRecibo,
  formatarDataHoraRecibo,
  formatarMoedaRecibo,
  formatarPermanenciaRecibo,
  isModalidadeFaturamento,
  minutosSuspensaoRecibo,
  montarLinhasEndereco,
  rotuloCoberturaRecibo
} from './recibo-pdf.helpers';
import { criarPdfReciboTermico } from './recibo-pdf';
import type { ReciboPdfDados } from './recibo-pdf.types';

describe('recibo-pdf.helpers', () => {
  it('formata permanência no padrão 00h 05min', () => {
    expect(formatarPermanenciaRecibo(5)).toBe('00h 05min');
    expect(formatarPermanenciaRecibo(65)).toBe('01h 05min');
    expect(formatarPermanenciaRecibo(0)).toBe('00h 00min');
    expect(formatarPermanenciaRecibo(null)).toBe('—');
  });

  it('formata data/hora com traço', () => {
    const txt = formatarDataHoraRecibo('2026-10-26T23:52:00');
    expect(txt).toMatch(/26\/10\/2026 - 23:52/);
  });

  it('formata moeda BRL', () => {
    expect(formatarMoedaRecibo(120)).toContain('120');
    expect(formatarMoedaRecibo(null)).toBe('—');
  });

  it('descreve cobrança pelo tipoTarifa do contrato', () => {
    expect(descricaoCobrancaRecibo(1)).toBe('Tarifa por hora');
    expect(descricaoCobrancaRecibo(2)).toBe('Tarifa por diária');
    expect(descricaoCobrancaRecibo(null)).toBeNull();
  });

  it('calcula permanência com fallback entrada→saída', () => {
    expect(
      calcularPermanenciaMinutos({
        tempoPermanenciaMinutos: 12,
        dataHoraEntrada: '2026-10-26T10:00:00',
        dataHoraSaida: '2026-10-26T11:00:00'
      })
    ).toBe(12);

    expect(
      calcularPermanenciaMinutos({
        tempoPermanenciaMinutos: null,
        dataHoraEntrada: '2026-10-26T10:00:00',
        dataHoraSaida: '2026-10-26T10:05:00'
      })
    ).toBe(5);
  });

  it('monta linhas de endereço sem inventar dados', () => {
    expect(
      montarLinhasEndereco({
        pessoaId: 1,
        principal: true,
        tipoEndereco: 1,
        cep: '00000-000',
        logradouro: 'Rodovia BR-101',
        numero: '12750',
        complemento: '',
        bairro: 'Canhanduba',
        cidade: 'Itajaí',
        estado: 'SC'
      })
    ).toEqual({
      linha1: 'Rodovia BR-101, 12750',
      linha2: 'Canhanduba - Itajaí/SC'
    });
  });

  it('detecta faturamento e cobertura sem inventar', () => {
    expect(isModalidadeFaturamento({ tipoCobranca: 'Faturado' })).toBe(true);
    expect(isModalidadeFaturamento({ avulso: false })).toBe(true);
    expect(isModalidadeFaturamento({ acordoCobrancaId: 10 })).toBe(true);
    expect(isModalidadeFaturamento({ tipoCobranca: 'Avulso' })).toBe(false);
    expect(
      isModalidadeFaturamento({ acordoCobrancaId: 10, ehExcedente: true, tipoCobranca: 'Avulso' })
    ).toBe(false);
    expect(rotuloCoberturaRecibo({ ehExcedente: true })).toBe('Excedente');
    expect(rotuloCoberturaRecibo({ acordoCobrancaId: 3 })).toBe('Acordo');
    expect(minutosSuspensaoRecibo(0)).toBeNull();
    expect(minutosSuspensaoRecibo(12)).toBe(12);
  });
});

describe('criarPdfReciboTermico', () => {
  const base: ReciboPdfDados = {
    modo: ModoRecibo.Saida,
    ticketId: 10047,
    placa: 'JGG5050',
    estacionamentoNome: 'ESTACIONAMENTOWSC',
    cnpj: '45544609000160',
    enderecoLinha1: 'Rodovia BR-101, 12750',
    enderecoLinha2: 'Canhanduba - Itajaí/SC',
    dataHoraEntrada: '2026-10-26T23:52:00',
    dataHoraSaida: '2026-10-26T23:57:00',
    permanenciaMinutos: 5,
    modalidade: 'Avulso',
    cobertura: null,
    ehExcedente: false,
    suspensaoMinutos: null,
    cobrancaDescricao: 'Tarifa por diária',
    valorTotal: 120,
    ocultarValores: false,
    usuarioResponsavel: 'operador.teste'
  };

  it('gera blob PDF 80mm sem erro', () => {
    const doc = criarPdfReciboTermico(base);
    expect(doc.internal.pageSize.getWidth()).toBe(80);
    const blob = doc.output('blob');
    expect(blob.type).toContain('pdf');
    expect(blob.size).toBeGreaterThan(100);
  });

  it('gera ticket de entrada sem bloco financeiro', () => {
    const doc = criarPdfReciboTermico({
      ...base,
      modo: ModoRecibo.Entrada,
      dataHoraSaida: null,
      valorTotal: null,
      cobrancaDescricao: null
    });
    expect(doc.output('blob').size).toBeGreaterThan(100);
  });

  it('gera recibo de faturamento com excedente e suspensão sem valores', () => {
    const doc = criarPdfReciboTermico({
      ...base,
      modalidade: 'Faturamento',
      cobertura: 'Excedente',
      ehExcedente: true,
      suspensaoMinutos: 45,
      ocultarValores: true,
      valorTotal: null,
      cobrancaDescricao: null
    });
    expect(doc.output('blob').size).toBeGreaterThan(100);
  });
});
