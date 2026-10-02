import { describe, expect, it } from 'vitest';
import {
  escolherEnderecoParaGeocode,
  montarConsultaEndereco
} from './endereco-geolocalizacao.util';

describe('endereco-geolocalizacao', () => {
  it('monta a consulta com o endereço completo e o Brasil', () => {
    expect(
      montarConsultaEndereco({
        logradouro: 'Rodovia BR-101',
        numero: '12750',
        bairro: 'Canhanduba',
        cidade: 'Itajaí',
        estado: 'SC',
        cep: '88313-000'
      })
    ).toBe('Rodovia BR-101, 12750, Canhanduba, Itajaí, SC, 88313-000, Brasil');
  });

  it('prefere o endereço principal do formulário', () => {
    const escolhido = escolherEnderecoParaGeocode(
      [
        { cidade: 'Blumenau', estado: 'SC', principal: false },
        { cidade: 'Itajaí', estado: 'SC', principal: true }
      ],
      [{ cidade: 'São Paulo', estado: 'SP', principal: true }]
    );
    expect(escolhido?.cidade).toBe('Itajaí');
  });

  it('usa o endereço carregado quando o formulário não tem cidade', () => {
    const escolhido = escolherEnderecoParaGeocode(
      [{ logradouro: 'Sem cidade' }],
      [{ cidade: 'Itajaí', estado: 'SC', logradouro: 'Rodovia BR-101' }]
    );
    expect(escolhido?.cidade).toBe('Itajaí');
  });
});
