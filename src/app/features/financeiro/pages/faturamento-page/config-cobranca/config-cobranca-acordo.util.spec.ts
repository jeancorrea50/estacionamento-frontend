import { TipoCobrancaExcedente } from '../../../models/configuracao-cobranca.models';
import {
  acordoVazio,
  listagensAPartirDasVagas,
  mensagensValidacaoAcordo,
  novaListagemAcordo,
  sincronizarVagasDoAcordo,
  vagasFromListagens
} from './config-cobranca-acordo.util';

describe('config-cobranca-acordo.util', () => {
  it('agrupa meses com a mesma quantidade ao reconstruir listagens', () => {
    const vagas = acordoVazio().vagas;
    vagas[1] = 10;
    vagas[2] = 10;
    vagas[3] = 20;
    const listagens = listagensAPartirDasVagas(vagas);
    expect(listagens).toHaveLength(2);
    const dez = listagens.find((l) => l.quantidade === 10);
    const vinte = listagens.find((l) => l.quantidade === 20);
    expect(dez?.meses).toEqual([1, 2]);
    expect(vinte?.meses).toEqual([3]);
  });

  it('achata listagens para o payload mensal da API', () => {
    const listagens = [novaListagemAcordo([1, 2], 8), novaListagemAcordo([6], 12)];
    const vagas = vagasFromListagens(listagens);
    expect(vagas[1]).toBe(8);
    expect(vagas[2]).toBe(8);
    expect(vagas[6]).toBe(12);
    expect(vagas[3]).toBeNull();
  });

  it('rejeita acordo sem período ou sem meses selecionados', () => {
    const acordo = acordoVazio();
    acordo.custoExcedente = 50;
    acordo.tipoCobrancaExcedente = TipoCobrancaExcedente.PorHora;
    expect(mensagensValidacaoAcordo(acordo)).toContain('Informe a data de início e a data de fim do acordo.');

    acordo.dataInicio = '2026-03-01';
    acordo.dataFim = '2026-02-01';
    expect(mensagensValidacaoAcordo(acordo)).toContain(
      'A data de início do acordo deve ser anterior ou igual à data de fim.'
    );

    acordo.dataFim = '2026-06-30';
    acordo.listagens = [novaListagemAcordo([1], 4)];
    sincronizarVagasDoAcordo(acordo);
    expect(mensagensValidacaoAcordo(acordo)).toEqual([]);
  });
});
