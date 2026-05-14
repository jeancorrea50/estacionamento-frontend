export type FechamentoSituacao =
  | 'Em andamento'
  | 'Pronto para faturar'
  | 'Faturado'
  | 'Com divergência'
  | 'Cancelado';

export type FechamentoModalidade =
  | 'Diária'
  | 'Semanal'
  | 'Quinzenal'
  | 'Mensal'
  | 'Por data personalizada';

export type FechamentoPeriodoFiltroId = 'este-mes' | 'mes-anterior' | 'ultimos-30' | 'personalizado';

export type FechamentoFiltroRapidoId =
  | 'todos'
  | 'prontos'
  | 'andamento'
  | 'divergencia'
  | 'faturados'
  | 'cancelados';

export interface FechamentoListaItem {
  id: string;
  transportadora: string;
  estacionamento: string;
  modalidade: FechamentoModalidade;
  periodoApurado: string;
  movimentacoes: number;
  valorEstimado: number;
  divergencias: number;
  situacao: FechamentoSituacao;
}

export interface FechamentoDetalheResumo {
  diarias: number;
  mensalistas: number;
  lavagens: number;
  servicosExtras: number;
  descontos: number;
  acrescimos: number;
  beneficios: number;
  totalEstimado: number;
}

export interface FechamentoValidacaoAlerta {
  id: string;
  texto: string;
  severidade: 'atencao' | 'critico';
}
