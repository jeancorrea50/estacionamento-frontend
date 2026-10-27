import { QUALIDADE_SPECS_CONHECIDOS, listarSpecsOrfaos, mapaCasoParaSpecs } from './qualidade-automacao-mapa.data';
import { QUALIDADE_INVENTARIO, listarTodosCasosQualidade } from './qualidade-inventario.data';

describe('qualidade inventário', () => {
  it('tem casos com IDs únicos', () => {
    const ids = listarTodosCasosQualidade().map((c) => c.caso.id);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('módulos alinhados a features reais', () => {
    const ids = QUALIDADE_INVENTARIO.map((m) => m.id);
    expect(ids).toContain('mod-patio');
    expect(ids).toContain('mod-financeiro');
    expect(ids).toContain('mod-admin');
  });

  it('mapa de specs e lista de conhecidos não vazia', () => {
    expect(QUALIDADE_SPECS_CONHECIDOS.length).toBeGreaterThanOrEqual(25);
    expect(Object.keys(mapaCasoParaSpecs()).length).toBeGreaterThan(5);
    expect(Array.isArray(listarSpecsOrfaos())).toBe(true);
  });

  it('caso de excedente dinâmico não finge automação', () => {
    const row = listarTodosCasosQualidade().find((c) => c.caso.id === 'PATIO-EXC-002');
    expect(row).toBeTruthy();
    expect(row!.caso.tipoCobertura).toBe('sem_cobertura');
    expect(row!.caso.notas?.toLowerCase()).toContain('excedente');
  });
});
