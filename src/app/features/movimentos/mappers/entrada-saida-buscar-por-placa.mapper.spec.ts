import { describe, expect, it } from 'vitest';
import {
  extrairMotoristasVinculados,
  mapBuscarPorPlacaParaRegistroRapido,
  mapearTipoCargaEnumParaLabel
} from './entrada-saida-buscar-por-placa.mapper';

/** Response de referência do contrato buscar-por-placa → Registro Rápido. */
const RESPONSE_REFERENCIA = {
  result: {
    motoristaId: 2,
    transportadoraId: 1,
    veiculoId: 1,
    existeEntradaEmAberto: false,
    motorista: {
      id: 2,
      nome: 'EA Eduardo Augusto Rezende',
      cpf: '59319251270',
      cnh: '59319251270'
    },
    veiculo: {
      id: 1,
      placa: 'ABC1D23',
      tipoCarga: 1
    },
    transportadora: {
      id: 1,
      cnpj: '12345678000195',
      razaoSocial: 'Transportes Rápidos Paraná LTDA',
      responsavelLegal: 'Juninho Pereba',
      responsavelTelefone: '44999999999'
    }
  }
};

describe('mapBuscarPorPlacaParaRegistroRapido', () => {
  it('deve preencher todos os campos do Registro Rápido a partir do JSON de referência', () => {
    const campos = mapBuscarPorPlacaParaRegistroRapido(RESPONSE_REFERENCIA.result);

    expect(campos.placa).toBe('ABC-1D23');
    expect(campos.motoristaNome).toBe('EA Eduardo Augusto Rezende');
    expect(campos.motoristaCpf).toBe('59319251270');
    expect(campos.tipoCargaLabel).toBe('Seca');
    expect(campos.transportadoraCnpj).toBe('12345678000195');
    expect(campos.transportadoraRazaoSocial).toBe('Transportes Rápidos Paraná LTDA');
    expect(campos.transportadoraResponsavelNome).toBe('Juninho Pereba');
    expect(campos.transportadoraResponsavelTelefone.replace(/\D/g, '')).toBe('44999999999');
    expect(campos.existeEntradaEmAberto).toBe(false);
  });

  it('deve ler CPF/nome em pessoaFisica aninhada', () => {
    const campos = mapBuscarPorPlacaParaRegistroRapido({
      motorista: {
        id: 9,
        pessoaFisica: { nome: 'Maria Silva', cpf: '12345678901' }
      },
      veiculo: { placa: 'XYZ9Z99' },
      transportadora: {
        pessoaJuridica: { cnpj: '11222333000181', nomeRazaoSocial: 'ACME LTDA' },
        responsavelNome: 'João',
        responsavelTelefone: '11988887777'
      }
    });

    expect(campos.motoristaNome).toBe('Maria Silva');
    expect(campos.motoristaCpf).toBe('12345678901');
    expect(campos.transportadoraCnpj).toBe('11222333000181');
    expect(campos.transportadoraRazaoSocial).toBe('ACME LTDA');
    expect(campos.placa).toBe('XYZ-9Z99');
  });

  it('deve aceitar PascalCase nos objetos aninhados', () => {
    const campos = mapBuscarPorPlacaParaRegistroRapido({
      Motorista: { Nome: 'Pedro', Cpf: '11122233344' },
      Veiculo: { Placa: 'DEF2A34', TipoCarga: 2 },
      Transportadora: {
        Cnpj: '99888777000166',
        RazaoSocial: 'Beta SA',
        ResponsavelLegal: 'Ana',
        ResponsavelTelefone: '21977776666'
      },
      ExisteEntradaEmAberto: true
    });

    expect(campos.motoristaNome).toBe('Pedro');
    expect(campos.tipoCargaLabel).toBe('Refrigerada');
    expect(campos.existeEntradaEmAberto).toBe(true);
  });

  it('deve preencher Registro Rápido a partir do contrato flat (placa/transportadora na raiz)', () => {
    const campos = mapBuscarPorPlacaParaRegistroRapido({
      veiculoId: 1,
      placa: 'KAI-6428',
      tipoCarga: null,
      transportadoraId: 1,
      razaoSocial: 'Transportes Rápidos Paraná LTDA',
      cnpj: '12.345.678/0001-95',
      responsavelLegal: 'Juninho Pereba',
      responsavelCpf: '312.402.060-03',
      responsavelEmail: 'ugne5565@uorak.com',
      responsavelTelefone: '',
      motorista: {
        id: 1,
        nome: 'Valdimir Santicago',
        cpf: '65272970520'
      },
      existeEntradaEmAberto: false
    });

    expect(campos.placa).toBe('KAI-6428');
    expect(campos.motoristaNome).toBe('Valdimir Santicago');
    expect(campos.motoristaCpf).toBe('65272970520');
    expect(campos.transportadoraCnpj).toBe('12.345.678/0001-95');
    expect(campos.transportadoraRazaoSocial).toBe('Transportes Rápidos Paraná LTDA');
    expect(campos.transportadoraResponsavelNome).toBe('Juninho Pereba');
    expect(campos.transportadoraResponsavelTelefone).toBe('');
    expect(campos.existeEntradaEmAberto).toBe(false);
  });

  it('deve usar o motorista selecionado quando a API retorna lista', () => {
    const entrada = {
      placa: 'KFN0722',
      motorista: [
        { id: 1, nome: 'Fernando Fernandes', cpf: '904.310.510-46', principal: true },
        { id: 2, nome: 'Outro Motorista', cpf: '111.222.333-44', principal: false }
      ]
    };
    const campos = mapBuscarPorPlacaParaRegistroRapido(entrada, entrada.motorista[1]);
    expect(campos.motoristaNome).toBe('Outro Motorista');
    expect(campos.motoristaCpf).toBe('111.222.333-44');
    expect(campos.placa).toBe('KFN-0722');
  });

  it('não deve preencher motorista quando seleção é null (aguarda modal)', () => {
    const campos = mapBuscarPorPlacaParaRegistroRapido(
      {
        placa: 'KFN0722',
        motorista: [
          { id: 1, nome: 'A', cpf: '1' },
          { id: 2, nome: 'B', cpf: '2' }
        ]
      },
      null
    );
    expect(campos.motoristaNome).toBe('');
    expect(campos.motoristaCpf).toBe('');
    expect(campos.placa).toBe('KFN-0722');
  });
});

describe('extrairMotoristasVinculados', () => {
  it('normaliza objeto único e lista', () => {
    expect(extrairMotoristasVinculados({ motorista: { id: 1, nome: 'A', cpf: '1' } })).toHaveLength(1);
    expect(
      extrairMotoristasVinculados({
        motorista: [
          { id: 1, nome: 'A', cpf: '1' },
          { id: 2, nome: 'B', cpf: '2' }
        ]
      })
    ).toHaveLength(2);
  });

  it('prioriza motorista principal e aceita lista em veiculo.motoristas', () => {
    const lista = extrairMotoristasVinculados({
      veiculo: {
        motoristas: [
          { id: 2, nome: 'B', cpf: '2', principal: false },
          { id: 1, nome: 'A', cpf: '1', principal: true }
        ]
      }
    });
    expect(lista).toHaveLength(2);
    expect(lista[0].id).toBe(1);
    expect(lista[0].principal).toBe(true);
  });
});

describe('mapearTipoCargaEnumParaLabel', () => {
  it('mapeia enum e texto do contrato atual', () => {
    expect(mapearTipoCargaEnumParaLabel(1)).toBe('Seca');
    expect(mapearTipoCargaEnumParaLabel(2)).toBe('Refrigerada');
    expect(mapearTipoCargaEnumParaLabel(3)).toBe('Perigosa');
    expect(mapearTipoCargaEnumParaLabel(4)).toBe('Granel');
    expect(mapearTipoCargaEnumParaLabel(5)).toBe('Líquida');
    expect(mapearTipoCargaEnumParaLabel('liquida')).toBe('Líquida');
    expect(mapearTipoCargaEnumParaLabel('')).toBe('');
  });
});
