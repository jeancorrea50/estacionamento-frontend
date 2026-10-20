import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { VeiculoModeloListItemDTO } from '../models/veiculo-modelo.dto';

/** Contrato: GET/POST/PUT `/api/VeiculoModelo`, GET/DELETE `/api/VeiculoModelo/{id}`. */
const API_BASE = environment.API_BASE_URL;
const VEICULO_MODELO = `${API_BASE}/VeiculoModelo`;

@Injectable({
  providedIn: 'root'
})
export class VeiculoModeloService {
  constructor(private http: HttpClient) {}

  /** GET /api/VeiculoModelo?Descricao=...&... */
  buscar(termo?: string): Observable<VeiculoModeloListItemDTO[]> {
    const query = new URLSearchParams();
    if (termo?.trim()) query.set('Descricao', termo.trim());
    query.set('NumeroPagina', '1');
    query.set('TamanhoPagina', '500');
    const url = `${VEICULO_MODELO}?${query.toString()}`;
    return this.http.get<unknown>(url).pipe(
      timeout(15000),
      map((body) => this.normalizeList(body)),
      catchError(() => of([]))
    );
  }

  private normalizeList(body: unknown): VeiculoModeloListItemDTO[] {
    const raw = body as { result?: unknown[]; results?: unknown[]; items?: unknown[] } | unknown[];
    let list: unknown[] = [];
    if (Array.isArray(raw)) list = raw;
    else if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>;
      if (Array.isArray(r['results'])) list = r['results'];
      else if (Array.isArray(r['items'])) list = r['items'];
      else if (Array.isArray(r['result'])) list = r['result'];
    }
    return list.map((row) => this.mapItem(row as Record<string, unknown>));
  }

  private mapItem(row: Record<string, unknown>): VeiculoModeloListItemDTO {
    const get = (k: string) => row[k] ?? row[k.charAt(0).toUpperCase() + k.slice(1)];
    const nome = get('nome') ?? get('Nome') ?? get('descricao') ?? get('Descricao');
    const marca = get('marca') ?? get('Marca');
    return {
      id: Number(get('id') ?? get('Id')) || 0,
      nome: String(nome ?? ''),
      marca: marca != null ? String(marca) : undefined
    };
  }

  /** GET /api/VeiculoModelo/{id} */
  obterPorId(id: number): Observable<VeiculoModeloListItemDTO | null> {
    return this.http.get<unknown>(`${VEICULO_MODELO}/${id}`).pipe(
      timeout(15000),
      map((body) => {
        const res = body as Record<string, unknown>;
        const result = res?.['result'] ?? res;
        if (result && typeof result === 'object') return this.mapItem(result as Record<string, unknown>);
        return null;
      }),
      catchError(() => of(null))
    );
  }
}
