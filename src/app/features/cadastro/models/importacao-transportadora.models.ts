/** Resultado da consulta local → Central para importação de rede. */
export interface ImportacaoTransportadoraConsulta {
  origem: 'Local' | 'Central' | 'Indisponivel' | string;
  existeNoTenantAtual: boolean;
  existeNoCentral: boolean;
  podeImportar: boolean;
  mensagem: string;
  cnpj: string;
  codExportacao?: string;
  nomeRazaoSocial?: string;
  fantasia?: string;
  bancoDadosConexaoOrigemId?: number | null;
  bancoOrigemNome?: string;
  transportadoraIdLocal?: number | null;
  estimativaMotoristas: number;
  estimativaVeiculos: number;
}

export interface ImportacaoTransportadoraStatus {
  id: number;
  cnpj: string;
  status: number;
  etapaAtual?: string;
  mensagemErro?: string;
  quantidadeMotoristas: number;
  quantidadeVeiculos: number;
  quantidadeVinculos: number;
}
