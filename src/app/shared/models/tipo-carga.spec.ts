import { describe, expect, it } from 'vitest';
import {
  mapearTipoCargaParaEnum,
  parseTipoCarga,
  TipoCarga,
  tipoCargaLabel,
  TIPO_CARGA_LABEL
} from './tipo-carga';

describe('TipoCarga', () => {
  it('parseTipoCarga aceita número e texto', () => {
    expect(parseTipoCarga(1)).toBe(TipoCarga.Seca);
    expect(parseTipoCarga('5')).toBe(TipoCarga.Liquida);
    expect(parseTipoCarga('Refrigerada')).toBe(TipoCarga.Refrigerada);
    expect(parseTipoCarga('líquida')).toBe(TipoCarga.Liquida);
    expect(parseTipoCarga(null)).toBeUndefined();
    expect(parseTipoCarga(99)).toBeUndefined();
  });

  it('tipoCargaLabel e mapearTipoCargaParaEnum cobrem o contrato', () => {
    expect(tipoCargaLabel(TipoCarga.Granel)).toBe(TIPO_CARGA_LABEL[TipoCarga.Granel]);
    expect(mapearTipoCargaParaEnum('Perigosa')).toBe(TipoCarga.Perigosa);
    expect(mapearTipoCargaParaEnum('seca')).toBe(TipoCarga.Seca);
  });
});
