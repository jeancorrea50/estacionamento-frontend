export interface PaginatedSearchItem {
  id: number;
  titulo: string;
  subtitulo?: string;
  campo2?: string;
  campo3?: string;
  campo4?: string;
  campo5?: string;
  /** Metadados opcionais do item (ex.: motorista vinculado ao veículo). */
  meta?: Record<string, unknown>;
}

export interface PaginatedSearchResult {
  items: PaginatedSearchItem[];
  totalCount: number;
  numeroPagina: number;
  tamanhoPagina: number;
}
