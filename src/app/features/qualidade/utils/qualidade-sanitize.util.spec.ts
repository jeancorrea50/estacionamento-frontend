import { sanitizarTextoQualidade } from './qualidade-sanitize.util';

describe('sanitizarTextoQualidade', () => {
  it('redige senha e JWT', () => {
    const out = sanitizarTextoQualidade(
      'senha=segredo123 token=abc eyJhbGciOiJIUzI1NiJ9.aaa.bbb'
    );
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('[JWT_REDACTED]');
    expect(out).not.toContain('segredo123');
  });

  it('retorna vazio para null', () => {
    expect(sanitizarTextoQualidade(null)).toBe('');
  });
});
