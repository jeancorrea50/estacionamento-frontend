import { EntradaSaidaStatus } from '../../models/entrada-saida.models';
import { criarFiltrosAvancadosVazios } from './movimentos-filtros.util';
import {
  montarFiltroMovimentacoesExportacao,
  rotulosFiltroMovimentacoesExportacao,
} from './movimentos-exportacao.util';

describe('movimentos-exportacao.util', () => {
  const base = {
    filtrosAvancados: criarFiltrosAvancadosVazios(),
    placaRapida: '',
    transportadoraSessaoId: null as number | null,
    estacionamentoId: 500,
    limiteMinimo: 7,
  };

  it('Todos + Em aberto desmarcado: sem Status e SomenteEmAberto=false', () => {
    const filtro = montarFiltroMovimentacoesExportacao({
      ...base,
      somenteEmAberto: false,
      chip: 'todos',
    });
    expect(filtro.status).toBeNull();
    expect(filtro.somenteEmAberto).toBe(false);
    expect(filtro.estacionamentoId).toBe(500);
    expect(filtro.limite).toBe(7);
  });

  it('No pátio: Em aberto=true e NÃO força Status Entrada', () => {
    const filtro = montarFiltroMovimentacoesExportacao({
      ...base,
      somenteEmAberto: true,
      chip: 'noPatio',
    });
    expect(filtro.somenteEmAberto).toBe(true);
    expect(filtro.status).toBeNull();
  });

  it('Suspensos e Agendados enviam Status correspondente', () => {
    expect(
      montarFiltroMovimentacoesExportacao({
        ...base,
        somenteEmAberto: true,
        chip: 'suspensos',
      }).status
    ).toBe(EntradaSaidaStatus.Suspenso);
    expect(
      montarFiltroMovimentacoesExportacao({
        ...base,
        somenteEmAberto: false,
        chip: 'agendados',
      }).status
    ).toBe(EntradaSaidaStatus.Agendado);
  });

  it('rótulos refletem chip e Em aberto', () => {
    const filtro = montarFiltroMovimentacoesExportacao({
      ...base,
      somenteEmAberto: false,
      chip: 'todos',
    });
    const rotulos = rotulosFiltroMovimentacoesExportacao(filtro, 'todos');
    expect(rotulos).toContain('Todos');
    expect(rotulos).toContain('Em aberto: Não');
    expect(rotulos.some((r) => r.startsWith('Status'))).toBe(false);
  });
});
