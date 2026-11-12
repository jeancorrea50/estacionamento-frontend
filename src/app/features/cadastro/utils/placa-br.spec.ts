import { describe, expect, it } from 'vitest';
import {
  formatPlacaDisplay,
  formatPlacaInput,
  normalizePlaca,
  placaCompleta,
  placaMercosul,
  sanitizePlacaInput,
  stripPlacaAlnum
} from './placa-br';

describe('placa-br (Mercosul)', () => {
  it('sanitizePlacaInput respeita posições Mercosul/legado', () => {
    expect(sanitizePlacaInput('abc1d23')).toBe('ABC1D23');
    expect(sanitizePlacaInput('abc-1d23')).toBe('ABC1D23');
    expect(sanitizePlacaInput('abc1234')).toBe('ABC1234');
    expect(sanitizePlacaInput('12ab')).toBe('AB');
    // X inválido na 4ª posição é ignorado; dígitos seguintes ocupam as posições válidas
    expect(sanitizePlacaInput('ABCX123')).toBe('ABC123');
  });

  it('formatPlacaDisplay preserva placa da API mesmo fora do padrão estrito', () => {
    expect(formatPlacaDisplay('KG65881')).toBe('KG6-5881');
    expect(formatPlacaDisplay('KLC-8443')).toBe('KLC-8443');
    expect(formatPlacaDisplay('ABC1D23')).toBe('ABC-1D23');
    expect(formatPlacaDisplay('ABC1234')).toBe('ABC-1234');
    expect(formatPlacaDisplay('AB')).toBe('AB');
    expect(formatPlacaInput('kai6428')).toBe('KAI-6428');
  });

  it('normalizePlaca / stripPlacaAlnum não descartam dígito na 3ª posição', () => {
    expect(stripPlacaAlnum('KG65881')).toBe('KG65881');
    expect(normalizePlaca('KG65881')).toBe('KG65881');
    expect(normalizePlaca('KLC-8443')).toBe('KLC8443');
    // sanitize ainda é estrito (digitação)
    expect(sanitizePlacaInput('KG65881')).toBe('KG');
  });

  it('formatPlacaInput preserva valor completo colado/API e guia digitação parcial', () => {
    expect(formatPlacaInput('KG65881')).toBe('KG6-5881');
    expect(formatPlacaInput('KG')).toBe('KG');
    expect(formatPlacaInput('KAI642')).toBe('KAI-642');
  });

  it('placaCompleta distingue incompleta, antiga e Mercosul', () => {
    expect(placaCompleta('KAI642')).toBe(false);
    expect(placaCompleta('KAI-6428')).toBe(true);
    expect(placaCompleta('ABC1234')).toBe(true);
    expect(placaCompleta('KG65881')).toBe(true);
    expect(placaMercosul('ABC1D23')).toBe(true);
    expect(placaMercosul('ABC1234')).toBe(false);
    expect(normalizePlaca('ABC-1D23')).toBe('ABC1D23');
  });
});
