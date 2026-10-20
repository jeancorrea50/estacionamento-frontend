const RELOAD_FLAG = 'gts-chunk-reload-once';

/** Detecta falha de lazy chunk (deploy novo com aba antiga / asset ausente). */
export function isChunkLoadFailure(error: unknown): boolean {
  const text = extractErrorText(error);
  return (
    /Failed to fetch dynamically imported module/i.test(text) ||
    /ChunkLoadError/i.test(text) ||
    /Loading chunk [\w-]+ failed/i.test(text) ||
    /Importing a module script failed/i.test(text)
  );
}

/**
 * Recarrega a página uma vez por sessão para pegar o `index.html` e chunks novos.
 * Evita loop infinito com flag em sessionStorage.
 */
export function recoverFromChunkLoadFailure(error: unknown): boolean {
  if (!isChunkLoadFailure(error)) return false;
  try {
    if (typeof sessionStorage === 'undefined') {
      location.reload();
      return true;
    }
    if (sessionStorage.getItem(RELOAD_FLAG) === '1') {
      sessionStorage.removeItem(RELOAD_FLAG);
      return false;
    }
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    /* ignore storage */
  }
  location.reload();
  return true;
}

/** Limpa a flag após bootstrap bem-sucedido (chunks da sessão atual ok). */
export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}

function extractErrorText(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    return `${error.name} ${error.message} ${error.stack ?? ''}`;
  }
  if (typeof error === 'object') {
    const o = error as { message?: unknown; error?: unknown; rejection?: unknown };
    return [o.message, o.error, o.rejection, JSON.stringify(error)].map(String).join(' ');
  }
  return String(error);
}
