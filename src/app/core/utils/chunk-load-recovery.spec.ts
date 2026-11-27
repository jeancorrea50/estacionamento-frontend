import { describe, expect, it } from 'vitest';
import { isChunkLoadFailure } from './chunk-load-recovery';

describe('isChunkLoadFailure', () => {
  it('reconhece erro de módulo dinâmico do browser', () => {
    expect(
      isChunkLoadFailure(
        new TypeError('Failed to fetch dynamically imported module: https://gtsistema.com/chunk-ABC.js')
      )
    ).toBe(true);
  });

  it('ignora erros comuns de aplicação', () => {
    expect(isChunkLoadFailure(new Error('Network Error'))).toBe(false);
    expect(isChunkLoadFailure({ message: '502 Bad Gateway' })).toBe(false);
  });
});
