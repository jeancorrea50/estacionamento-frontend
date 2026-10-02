import { describe, expect, it } from 'vitest';
import { detalhesPontoMapa, filtrarPontosMapa, type PontoMapa } from './ponto-mapa.model';

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
