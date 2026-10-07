/**
 * Fluxos ponta a ponta usados pelo diagnóstico do Ecossistema.
 * Etapas = ids de nós em `ecossistema-mapa.data.ts` (ordem operacional).
 */
export interface FluxoDiagnosticoDef {
  id: string;
  nome: string;
  /** Ids de nós na ordem do fluxo. */
  etapas: string[];
  /** Se true, aresta proposta/N/V entre etapas gera achado de severidade alta. */
  exigeEvidenciaForte: boolean;
}

export const ECOSSISTEMA_FLUXOS_DIAGNOSTICO: FluxoDiagnosticoDef[] = [
  {
    id: 'acl-acesso',
    nome: 'Acesso (ACL) → operação',
    etapas: ['plt-usuarios', 'plt-permissoes', 'plt-menu', 'est-entrada'],
    exigeEvidenciaForte: true,
  },
  {
    id: 'onboarding-tr',
    nome: 'Onboarding transportadora',
    etapas: ['trn-convites', 'trn-cadastro', 'trn-frota', 'trn-motoristas', 'est-entrada'],
    exigeEvidenciaForte: true,
  },
  {
    id: 'operacao-patio',
    nome: 'Operação do pátio → financeiro',
    etapas: [
      'plt-estacionamentos',
      'est-entrada',
      'est-portaria',
      'est-faturamento',
      'est-recebimentos',
    ],
    exigeEvidenciaForte: true,
  },
  {
    id: 'cobranca-acordo',
    nome: 'Acordo / cobrança → valor na saída',
    etapas: ['trn-cadastro', 'est-cobranca', 'est-entrada', 'est-faturamento', 'trn-faturas'],
    exigeEvidenciaForte: true,
  },
  {
    id: 'agendamento-entrada',
    nome: 'Agendamento → entrada',
    etapas: ['est-agendamento', 'est-entrada'],
    exigeEvidenciaForte: true,
  },
];
