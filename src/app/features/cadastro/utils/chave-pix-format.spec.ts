import { describe, expect, it } from 'vitest';
import {
  chavePixMaxLength,
  formatChavePix,
  normalizeChavePixForApi
} from './chave-pix-format';

describe('chave-pix-format', () => {
  it('mascara CPF', () => {
    expect(formatChavePix('06006431157', 1)).toBe('060.064.311-57');
    expect(normalizeChavePixForApi('060.064.311-57', 1)).toBe('06006431157');
    expect(chavePixMaxLength(1)).toBe(14);
  });

  it('mascara CNPJ', () => {
    expect(formatChavePix('12345678000190', 2)).toBe('12.345.678/0001-90');
    expect(normalizeChavePixForApi('12.345.678/0001-90', 2)).toBe('12345678000190');
  });

  it('normaliza e-mail', () => {
    expect(formatChavePix('  User@Mail.COM ', 3)).toBe('User@Mail.COM');
    expect(normalizeChavePixForApi('User@Mail.COM', 3)).toBe('user@mail.com');
  });

  it('mascara telefone', () => {
    expect(formatChavePix('11987654321', 4)).toBe('(11) 98765-4321');
    expect(normalizeChavePixForApi('(11) 98765-4321', 4)).toBe('11987654321');
  });

  it('mascara UUID', () => {
    expect(formatChavePix('7bb1c7cc42e2425ab9275a023cfc71aa', 5)).toBe(
      '7bb1c7cc-42e2-425a-b927-5a023cfc71aa'
    );
    expect(normalizeChavePixForApi('7BB1C7CC-42E2-425A-B927-5A023CFC71AA', 5)).toBe(
      '7bb1c7cc-42e2-425a-b927-5a023cfc71aa'
    );
  });
});
