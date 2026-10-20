import { describe, expect, it } from 'vitest';
import {
  detalhesPontoMapa,
  distanciaKmHaversine,
  filtrarPontosMapa,
  filtrarPontosMapaCompleto,
  filtrarPontosPorProximidade,
  formatarDistanciaKm,
  type PontoMapa
} from './ponto-mapa.model';

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

describe('filtrarPontosMapaCompleto', () => {
  it('filtra por status, segurança, banheiro e tipo de tarifa', () => {
    const lista: PontoMapa[] = [
      {
        ...ponto(1, 'Cuiabá', 'MT'),
        ativo: true,
        possuiSeguranca: true,
        possuiBanheiro: true,
        tipoTarifaAvulsa: 2
      },
      {
        ...ponto(2, 'Curitiba', 'PR'),
        ativo: false,
        possuiSeguranca: false,
        possuiBanheiro: false,
        tipoTarifaAvulsa: 1
      }
    ];
    expect(
      filtrarPontosMapaCompleto(lista, {
        status: 'ativo',
        seguranca: 'sim',
        banheiro: 'sim',
        tipoTarifa: 'diaria'
      }).map((item) => item.id)
    ).toEqual([1]);
    expect(filtrarPontosMapaCompleto(lista, { busca: 'curiti' }).map((item) => item.id)).toEqual([2]);
  });
});

describe('distanciaKmHaversine e proximidade', () => {
  it('calcula distância aproximada entre duas cidades', () => {
    const km = distanciaKmHaversine(
      { latitude: -15.601, longitude: -56.097 },
      { latitude: -15.65, longitude: -56.13 }
    );
    expect(km).toBeGreaterThan(4);
    expect(km).toBeLessThan(10);
  });

  it('filtra pelo raio e ordena do mais próximo ao mais longe', () => {
    const origem = { latitude: -15.6, longitude: -56.1 };
    const lista: PontoMapa[] = [
      { ...ponto(1, 'Longe', 'MT'), latitude: -23.5, longitude: -46.6 },
      { ...ponto(2, 'Perto', 'MT'), latitude: -15.61, longitude: -56.11 },
      { ...ponto(3, 'Médio', 'MT'), latitude: -15.7, longitude: -56.2 }
    ];
    const proximos = filtrarPontosPorProximidade(lista, origem, 50);
    expect(proximos.map((p) => p.id)).toEqual([2, 3]);
    expect(proximos[0].distanciaKm).toBeLessThan(proximos[1].distanciaKm);
  });

  it('sem raio apenas ordena por distância', () => {
    const origem = { latitude: -15.6, longitude: -56.1 };
    const lista: PontoMapa[] = [
      { ...ponto(1, 'Longe', 'SP'), latitude: -23.5, longitude: -46.6 },
      { ...ponto(2, 'Perto', 'MT'), latitude: -15.61, longitude: -56.11 }
    ];
    expect(filtrarPontosPorProximidade(lista, origem, null).map((p) => p.id)).toEqual([2, 1]);
  });

  it('formata metros e quilômetros', () => {
    expect(formatarDistanciaKm(0.35)).toBe('350 m');
    expect(formatarDistanciaKm(12.4)).toMatch(/12/);
  });
});

describe('detalhesPontoMapa', () => {
  it('mostra diária, valor, segurança, banheiro e status', () => {
    const detalhes = detalhesPontoMapa({
      ...ponto(1, 'Cuiabá', 'MT'),
      tipoTarifaAvulsa: 2,
      valorAvulso: 15,
      minutosTolerancia: 1,
      possuiSeguranca: true,
      possuiBanheiro: false,
      ativo: true
    });
    const [cobranca, seguranca, banheiro, status] = detalhes;
    expect(cobranca.texto.replace(/\u00a0/g, ' ')).toBe('Diária · R$ 15,00 · tolerância 1 min');
    expect([seguranca.texto, banheiro.texto, status.texto]).toEqual([
      'Com segurança',
      'Sem banheiro',
      'Ativo'
    ]);
    expect(detalhes.map((item) => item.icone)).toEqual(['calendar_month', 'shield', 'wc', 'check_circle']);
  });

  it('resume o horário de funcionamento na sequência da semana', () => {
    const texto = detalhesPontoMapa({
      ...ponto(1, 'Cuiabá', 'MT'),
      horarioAbertura: '08:00:00',
      horarioFechamento: '18:00',
      diasFuncionamento: '1,2,3,4,5'
    }).find((item) => item.icone === 'event_available')?.texto;
    expect(texto).toBe('Seg a Sex · 08:00–18:00');
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
