/** Tipos do Relatório de Transportadoras. */

export interface TransportadoraRelatorioFiltro {
  dataInicial?: string | null;
  dataFinal?: string | null;
  descricao?: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
  ativo?: boolean | null;
  quantidadeVeiculosMin?: number | null;
  quantidadeVeiculosMax?: number | null;
  limite?: number | null;
}

export interface TransportadoraRelatorioResumo {
  quantidade: number;
  qtdAtivas: number;
  qtdInativas: number;
  totalVeiculos: number;
}

export interface TransportadoraRelatorioItem {
  id: number;
  razaoSocial: string;
  fantasia: string;
  cnpj: string;
  email: string;
  ativo: boolean;
  responsavelLegal: string;
  responsavelTelefone: string;
  quantidadeVeiculo: number;
  dataAtualizacao: string | null;
}

export interface TransportadoraRelatorioOutput {
  resumo: TransportadoraRelatorioResumo;
  itens: TransportadoraRelatorioItem[];
  truncado: boolean;
  limiteAplicado: number;
}

export const RELATORIO_ATIVO_OPCOES: { value: boolean | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: true, label: 'Sim' },
  { value: false, label: 'Não' },
];
