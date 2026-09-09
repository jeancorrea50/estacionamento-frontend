/** Resumo opcional da sincronização multi-pátio após save (perfil Transportadora). */
export interface PropagacaoCadastroResumo {
  /** Job Hangfire enfileirado (propagação assíncrona). */
  enfileirada: boolean;
  propagacaoId?: number | null;
  /** Preenchido apenas quando a sincronização ainda era síncrona / legado. */
  executada: boolean;
  destinosOk: number;
  destinosFalha: number;
  destinosIgnorados: number;
  qtdMotoristas: number;
  qtdVeiculos: number;
  falhas: string[];
}

export function parsePropagacaoCadastroResumo(raw: unknown): PropagacaoCadastroResumo | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const nested =
    (o['propagacao'] as Record<string, unknown> | undefined) ??
    (o['Propagacao'] as Record<string, unknown> | undefined);
  const src = nested && typeof nested === 'object' ? nested : o;

  const enfileirada = Boolean(src['enfileirada'] ?? src['Enfileirada']);
  const executada = Boolean(src['executada'] ?? src['Executada']);
  const destinosOk = Number(src['destinosOk'] ?? src['DestinosOk'] ?? 0);
  const destinosFalha = Number(src['destinosFalha'] ?? src['DestinosFalha'] ?? 0);
  const propagacaoIdRaw = src['propagacaoId'] ?? src['PropagacaoId'];
  const propagacaoId =
    propagacaoIdRaw == null || propagacaoIdRaw === ''
      ? null
      : Number(propagacaoIdRaw);

  if (!enfileirada && !executada && destinosOk === 0 && destinosFalha === 0) {
    // Pode ser objeto sem ser propagação — só aceita se houver flag ou contagens.
    if (
      src['destinosOk'] == null &&
      src['DestinosOk'] == null &&
      src['executada'] == null &&
      src['Executada'] == null &&
      src['enfileirada'] == null &&
      src['Enfileirada'] == null
    ) {
      return null;
    }
  }

  const falhasRaw = src['falhas'] ?? src['Falhas'];
  const falhas = Array.isArray(falhasRaw)
    ? falhasRaw.map((f) => String(f ?? '').trim()).filter(Boolean)
    : [];

  return {
    enfileirada,
    propagacaoId: Number.isFinite(propagacaoId as number) ? (propagacaoId as number) : null,
    executada,
    destinosOk: Number.isFinite(destinosOk) ? destinosOk : 0,
    destinosFalha: Number.isFinite(destinosFalha) ? destinosFalha : 0,
    destinosIgnorados: Number(src['destinosIgnorados'] ?? src['DestinosIgnorados'] ?? 0) || 0,
    qtdMotoristas: Number(src['qtdMotoristas'] ?? src['QtdMotoristas'] ?? 0) || 0,
    qtdVeiculos: Number(src['qtdVeiculos'] ?? src['QtdVeiculos'] ?? 0) || 0,
    falhas
  };
}

/** Extrai `result` do envelope da API e, se houver, a propagação. */
export function unwrapApiResultComPropagacao(body: unknown): {
  result: Record<string, unknown> | null;
  propagacao: PropagacaoCadastroResumo | null;
} {
  if (!body || typeof body !== 'object') {
    return { result: null, propagacao: null };
  }
  const o = body as Record<string, unknown>;
  const inner = (o['result'] ?? o['Result'] ?? o['data'] ?? o['Data'] ?? body) as unknown;
  if (!inner || typeof inner !== 'object') {
    return { result: null, propagacao: null };
  }
  const result = inner as Record<string, unknown>;
  return {
    result,
    propagacao: parsePropagacaoCadastroResumo(result)
  };
}

export function mensagemToastPropagacao(
  base: string,
  prop: PropagacaoCadastroResumo | null | undefined
): string {
  if (!prop) return base;

  if (prop.falhas.length > 0) {
    return `${base} ${prop.falhas[0]}`;
  }

  if (prop.enfileirada) {
    return `${base} Sincronização com outros pátios enfileirada; os operadores serão notificados ao concluir.`;
  }

  if (!prop.executada) return base;
  if (prop.destinosOk <= 0 && prop.destinosFalha <= 0) {
    return `${base} Nenhum outro pátio para sincronizar.`;
  }
  if (prop.destinosFalha > 0 && prop.destinosOk > 0) {
    return `${base} Sincronizado em ${prop.destinosOk} pátio(s); ${prop.destinosFalha} com falha.`;
  }
  if (prop.destinosFalha > 0) {
    return `${base} Falha ao sincronizar em ${prop.destinosFalha} pátio(s).`;
  }
  return `${base} Sincronizado em ${prop.destinosOk} pátio(s).`;
}
