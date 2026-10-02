import { describe, expect, it } from 'vitest';
import { filtrarPontosMapa, type PontoMapa } from './ponto-mapa.model';

const pontos: PontoMapa[] = [
  ponto(1, 'Cuiabá', 'MT'),
  ponto(2, 'Várzea Grande', 'MT'),
  ponto(3, 'Curitiba', 'PR')
];

describe('filtrarPontosMapa', () => {
  it('encontra a cidade sem acento e pela sigla do estado', () => {
    expect(filtrarPontosMapa(pontos, 'cuiaba', 'MT').map((item) => item.id)).toEqual([1]);
  });

  it('reconhece o estado gravado pelo nome quando a busca usa a UF', () => {
    const comNome = [ponto(4, 'Cuiabá', 'Mato Grosso')];
    expect(filtrarPontosMapa(comNome, '', 'MT').map((item) => item.id)).toEqual([4]);
    expect(filtrarPontosMapa(pontos, 'varzea', 'MT').map((item) => item.cidade)).toEqual(['Várzea Grande']);
  });

  it('lista só o estado quando a cidade fica em branco', () => {
    expect(filtrarPontosMapa(pontos, '  ', 'MT')).toHaveLength(2);
  });
});

function ponto(id: number, cidade: string, estado: string): PontoMapa {
  return {
    id,
    codExportacao: String(id),
    descricao: cidade,
    cidade,
    estado,
    latitude: -15,
    longitude: -56
  };
}
