export type TipoLancamentoCusto = 1 | 2 | 3;

export interface CategoriaCusto {
  id: number;
  codigo: string;
  nome: string;
}

export interface LancamentoCusto {
  id: number;
  tipo: TipoLancamentoCusto;
  tipoLabel: string;
  categoriaId: number;
  categoriaNome: string;
  descricao: string;
  valor: number;
  dataCompetencia: string;
  dataPagamento?: string | null;
  observacao?: string | null;
  ativo: boolean;
}

export interface LancamentoCustoInput {
  tipo: TipoLancamentoCusto;
  categoriaId: number;
  descricao: string;
  valor: number;
  dataCompetencia: string;
  dataPagamento?: string | null;
  observacao?: string | null;
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
