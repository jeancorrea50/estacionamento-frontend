export type TipoLancamentoCusto = 1 | 2 | 3;
export type RecorrenciaLancamentoCusto = 1 | 2 | 3;
export type FormaPagamentoCusto = 1 | 2 | 3;

export interface CategoriaCusto {
  id: number;
  codigo: string;
  nome: string;
}

export interface CentroCusto {
  id: number;
  codigo: string;
  nome: string;
  ativo: boolean;
}

export interface CentroCustoInput {
  codigo: string;
  nome: string;
}

export interface FinanciadorOpcao {
  /** null = Gt Sistema */
  usuarioId: number | null;
  nome: string;
}

export interface LancamentoCusto {
  id: number;
  tipo: TipoLancamentoCusto;
  tipoLabel: string;
  categoriaId: number;
  categoriaNome: string;
  centroCustoId: number;
  centroCustoNome: string;
  descricao: string;
  valor: number;
  dataCompetencia: string;
  dataPagamento?: string | null;
  observacao?: string | null;
  recorrencia: RecorrenciaLancamentoCusto;
  recorrenciaLabel: string;
  dataFimRecorrencia?: string | null;
  recorrenciaGrupoId?: string | null;
  financiadorUsuarioId?: number | null;
  financiadorNome: string;
  formaPagamento: FormaPagamentoCusto;
  formaPagamentoLabel: string;
  parcelas?: number | null;
  ativo: boolean;
  criadoPorNome?: string | null;
  alteradoPorNome?: string | null;
}

export interface LancamentoCustoInput {
  tipo: TipoLancamentoCusto;
  categoriaId: number;
  centroCustoId: number;
  descricao: string;
  valor: number;
  dataCompetencia: string;
  dataPagamento?: string | null;
  observacao?: string | null;
  recorrencia: RecorrenciaLancamentoCusto;
  dataFimRecorrencia?: string | null;
  financiadorUsuarioId?: number | null;
  financiadorNome: string;
  formaPagamento: FormaPagamentoCusto;
  parcelas?: number | null;
}

export interface CampoAlteracaoHistorico {
  campo: string;
  de?: string | null;
  para?: string | null;
  alterado: boolean;
}

export interface HistoricoLancamentoCusto {
  id: number;
  operacao: 1 | 2 | 3;
  operacaoLabel: string;
  usuarioId?: number | null;
  usuarioNome: string;
  dataHora: string;
  alteracoes: CampoAlteracaoHistorico[];
}

export interface PagedLancamentos {
  results: LancamentoCusto[];
  currentPage: number;
  pageCount: number;
  pageSize: number;
  rowCount: number;
}

export interface DashboardCusto {
  ano: number;
  totalDespesa: number;
  totalInvestimento: number;
  totalReceita: number;
  saldoLiquido: number;
  mensal: Array<{
    mes: number;
    mesLabel: string;
    despesa: number;
    investimento: number;
    receita: number;
  }>;
  anual: Array<{
    ano: number;
    despesa: number;
    investimento: number;
    receita: number;
  }>;
  porCategoria: Array<{
    categoriaId: number;
    categoriaNome: string;
    valor: number;
  }>;
}

export const TIPO_LANCAMENTO_OPCOES: Array<{ value: TipoLancamentoCusto; label: string }> = [
  { value: 1, label: 'Despesa' },
  { value: 2, label: 'Investimento' },
  { value: 3, label: 'Receita' },
];

export const RECORRENCIA_OPCOES: Array<{ value: RecorrenciaLancamentoCusto; label: string }> = [
  { value: 1, label: 'Única (dia)' },
  { value: 2, label: 'Semanal' },
  { value: 3, label: 'Mensal' },
];

export const FORMA_PAGAMENTO_OPCOES: Array<{ value: FormaPagamentoCusto; label: string }> = [
  { value: 1, label: 'Pix' },
  { value: 2, label: 'Cartão à vista' },
  { value: 3, label: 'Cartão recorrente' },
];

export const FINANCIADOR_GT_SISTEMA: FinanciadorOpcao = {
  usuarioId: null,
  nome: 'Gt Sistema',
};
