import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, timeout, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EstacionamentoPaths } from '../constants/estacionamento-api.paths';

const API_BASE = environment.API_BASE_URL;
const Estacionamento = `${API_BASE}/Estacionamento`;

/**
 * Item de foto retornado pelo backend (BuscarFotos).
 * O backend pode retornar array de strings (base64/url) ou array de objetos com id.
 */
export interface FotoBackendItem {
  id?: number;
  url?: string;
  base64?: string;
}

/** Item normalizado para exibição na aba Fotos (id obrigatório para remoção via API). */
export interface FotoItem {
  id?: number;
  url: string;
  file?: File;
  /** Indica se é a foto principal (chPrincipal/ehPrincipal do backend). */
  principal?: boolean;
  /** Ordem de exibição (orden/ordem do backend). */
  ordem?: number;
}

/** Resposta possível da API (array direto ou wrapper com result/data/fotos). */
type BuscarFotosRaw =
  | FotoBackendItem[]
  | string[]
  | { result?: FotoBackendItem[] | string[]; data?: FotoBackendItem[] | string[]; fotos?: FotoBackendItem[] | string[] };

/**
 * Serviço para operações de fotos do Estacionamento na Azure.
 * Endpoints alinhados ao Swagger: BuscarFotos/buscar-fotos/{id}, UploadFotos/upload-fotos, DeletarFotos/deletar-fotos/{fotoId}.
 */
@Injectable({
  providedIn: 'root'
})
export class EstacionamentoFotosService {
  constructor(private http: HttpClient) {}

  /**
   * GET /api/Estacionamento/buscar-fotos/{id}
   * Lista fotos do Estacionamento. Retorna itens com id (quando o backend envia) para permitir DeletarFotos.
   */
  buscarFotos(EstacionamentoId: number | string): Observable<FotoItem[]> {
    const id = Number(EstacionamentoId);
    if (!Number.isFinite(id)) {
      return of([]);
    }
    return this.http.get<BuscarFotosRaw>(`${Estacionamento}/${EstacionamentoPaths.buscarFotos(id)}`).pipe(
      timeout(15000),
      map((body) => this.normalizeBuscarFotosResponse(body)),
      catchError(() => of([]))
    );
  }

  /**
   * POST /api/Estacionamento/UploadFotos/upload-fotos
   * multipart/form-data: EstacionamentoId, Fotos (arquivos).
   */
  uploadFotos(
    EstacionamentoId: number | string,
    files: FileList | File[]
  ): Observable<unknown> {
    const id = Number(EstacionamentoId);
    if (!Number.isFinite(id)) {
      return throwError(() => new Error('ID do Estacionamento inválido'));
    }
    const fileList = Array.isArray(files) ? files : Array.from(files);
    if (fileList.length === 0) {
      return throwError(() => new Error('Nenhum arquivo para enviar'));
    }
    const form = new FormData();
    form.append('EstacionamentoId', String(id));
    fileList.forEach((file, index) => {
      form.append('Fotos', file, file.name || `foto-${index}`);
    });
    return this.http.post<unknown>(`${Estacionamento}/${EstacionamentoPaths.uploadFotos}`, form).pipe(
      timeout(60000),
      catchError((err) => throwError(() => err))
    );
  }

  /**
   * DELETE /api/Estacionamento/DeletarFotos/deletar-fotos/{fotoId}
   */
  deletarFoto(fotoId: number | string): Observable<void> {
    const id = Number(fotoId);
    if (!Number.isFinite(id)) {
      return throwError(() => new Error('ID da foto inválido'));
    }
    return this.http.delete<void>(`${Estacionamento}/${EstacionamentoPaths.deletarFoto(id)}`).pipe(
      timeout(15000),
      catchError((err) => throwError(() => err))
    );
  }

  /**
   * Monta URL completa para exibição quando o backend retorna caminho relativo.
   */
  getUrlCompleta(urlOuCaminho: string): string {
    if (!urlOuCaminho || urlOuCaminho.startsWith('http') || urlOuCaminho.startsWith('data:')) {
      return urlOuCaminho;
    }
    const base = API_BASE.replace(/\/$/, '');
    const path = urlOuCaminho.startsWith('/') ? urlOuCaminho : `/${urlOuCaminho}`;
    return `${base}${path}`;
  }

  private normalizeBuscarFotosResponse(body: BuscarFotosRaw): FotoItem[] {
    if (Array.isArray(body)) {
      return this.mapArrayToFotoItems(body);
    }
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      const raw = b['result'] ?? b['data'] ?? b['fotos'];
      const arr = Array.isArray(raw) ? raw : [];
      return this.mapArrayToFotoItems(arr);
    }
    return [];
  }

  private mapArrayToFotoItems(arr: unknown[]): FotoItem[] {
    const items: FotoItem[] = [];
    for (const item of arr) {
      if (typeof item === 'string') {
        const url = item.startsWith('http')
          ? item
          : item.startsWith('data:')
            ? item
            : `data:image/jpeg;base64,${item}`;
        items.push({ url });
        continue;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const id = obj['id'] ?? obj['Id'];
        const idNum = id != null ? Number(id) : undefined;
        const principal = obj['chPrincipal'] ?? obj['ehPrincipal'];
        const principalBool = principal === true || principal === 'true';
        const ordem = obj['orden'] ?? obj['ordem'] ?? obj['Ordem'];
        const ordemNum = ordem != null ? Number(ordem) : undefined;

        let url = String(obj['url'] ?? obj['Url'] ?? obj['urlCompleta'] ?? obj['UrlCompleta'] ?? '');
        const base64 = obj['fotoBase64'] ?? obj['FotoBase64'] ?? obj['base64'] ?? obj['Base64'];
        const base64Str = base64 != null ? String(base64).trim() : '';
        const contentType = obj['contentType'] ?? obj['ContentType'];
        const contentTypeStr = contentType != null ? String(contentType) : 'image/jpeg';
        const caminho = obj['caminho'] ?? obj['Caminho'];
        const caminhoStr = caminho != null ? String(caminho) : '';

        if (base64Str) {
          const mime = contentTypeStr.split(';')[0].trim() || 'image/jpeg';
          url = base64Str.startsWith('data:') ? base64Str : `data:${mime};base64,${base64Str}`;
        } else if (caminhoStr && !url) {
          url = this.getUrlCompleta(caminhoStr);
        }
        if (url) {
          items.push({
            id: Number.isFinite(idNum) ? idNum : undefined,
            url,
            principal: principalBool,
            ordem: Number.isFinite(ordemNum) ? ordemNum : undefined
          });
        }
      }
    }
    return items.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }
}
