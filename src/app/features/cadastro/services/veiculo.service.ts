import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  VeiculoDTO,
  VeiculoListItemDTO,
  VeiculoBuscarParams,
  PagedResultVeiculoDTO,
  VeiculoMotoristaVinculoDTO
} from '../models/veiculo.dto';
import { MotoristaPorPlacaAggregateVm } from '../models/motorista-por-placa.vm';
import { mapMotoristaPorPlacaResponse } from '../mappers/motorista-por-placa.mapper';
import { normalizePlaca } from '../utils/placa-br';

/**
 * Contrato: GET/POST/PUT `/api/Veiculo`, GET/DELETE `/api/Veiculo/{id}`.
 * Parâmetros de listagem: Placa, Descricao, DataInicial, DataFinal, paginação (OpenAPI).
 * `TransportadoraId` e `Termo` não estão no spec; o backend ASP.NET costuma aceitar parâmetros extras no mesmo GET.
 */
const API_BASE = environment.API_BASE_URL;
const VEICULO = `${API_BASE}/Veiculo`;

@Injectable({
  providedIn: 'root'
})
export class VeiculoService {
  constructor(private http: HttpClient) {}

  /** GET /api/Veiculo?... */
  buscar(params: VeiculoBuscarParams): Observable<PagedResultVeiculoDTO> {
    const query = new URLSearchParams();
    const termo = params.Termo?.trim();
    if (termo) query.set('Descricao', termo);
    const placaNorm = (params.Placa ?? '').replace(/\s/g, '').toUpperCase();
    if (placaNorm.length >= 7) query.set('Placa', placaNorm);
    if (params.TransportadoraId != null) query.set('TransportadoraId', String(params.TransportadoraId));
    query.set('NumeroPagina', String(params.NumeroPagina));
    query.set('TamanhoPagina', String(params.TamanhoPagina));
    const url = `${VEICULO}?${query.toString()}`;
    return this.http.get<unknown>(url).pipe(
      timeout(15000),
      map((body) => this.normalizeBuscar(body, params.NumeroPagina, params.TamanhoPagina)),
      catchError((err) => throwError(() => err))
    );
  }

  /**
   * GET `/api/Veiculo/por-placa/{placa}` — agregado veículo + motorista + transportadora.
   * 404 → `null` (sem registro). Demais erros propagam para o chamador exibir toast.
   */
  obterPorPlaca(placa: string): Observable<MotoristaPorPlacaAggregateVm | null> {
    const norm = normalizePlaca(placa);
    if (norm.length < 7) {
      return of(null);
    }
    return this.http.get<unknown>(`${VEICULO}/por-placa/${encodeURIComponent(norm)}`).pipe(
      timeout(15000),
      map((body) => mapMotoristaPorPlacaResponse(body)),
      catchError((err: unknown) => {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        if (status === 404) return of(null);
        return throwError(() => err);
      })
    );
  }

  private normalizeBuscar(body: unknown, numeroPagina: number, tamanhoPagina: number): PagedResultVeiculoDTO {
    const source = this.unwrapBuscarBody(body);
    let list: unknown[] = [];
    let total = 0;
    let pagina = numeroPagina;
    let tamanho = tamanhoPagina;
    if (Array.isArray(source)) {
      list = source;
      total = source.length;
    } else if (source && typeof source === 'object') {
      const r = source as Record<string, unknown>;
      if (Array.isArray(r['results'])) {
        list = r['results'];
      } else if (Array.isArray(r['items'])) {
        list = r['items'];
      } else if (Array.isArray(r['itens'])) {
        list = r['itens'];
      }
      total = Number(r['rowCount'] ?? r['totalCount'] ?? r['totalRegistros']) || list.length;
      pagina = Number(r['currentPage'] ?? r['numeroPagina'] ?? numeroPagina) || numeroPagina;
      tamanho = Number(r['pageSize'] ?? r['tamanhoPagina'] ?? tamanhoPagina) || tamanhoPagina;
    }
    const items = list.map((row) => this.mapItem(row as Record<string, unknown>));
    return { items, totalCount: total, numeroPagina: pagina, tamanhoPagina: tamanho };
  }

  private mapItem(row: Record<string, unknown>): VeiculoListItemDTO {
    const get = (k: string) => row[k] ?? row[k.charAt(0).toUpperCase() + k.slice(1)];
    const modeloMarcaApi = get('modeloMarca');
    const marca = get('marcaModelo') ?? get('MarcaModelo') ?? modeloMarcaApi ?? get('marca') ?? get('Marca') ?? '';
    const modelo = get('modelo') ?? get('Modelo') ?? '';
    const marcaModelo = [String(marca), String(modelo)].filter(Boolean).join(' / ') || String(marca || modelo);
    return {
      id: Number(get('id') ?? get('Id')) || 0,
      placa: String(get('placa') ?? get('Placa') ?? ''),
      marcaModelo: marcaModelo || '—',
      cor: get('cor') != null ? String(get('cor')) : undefined,
      anoFabricacao: get('anoFabricacao') != null ? Number(get('anoFabricacao')) : (get('ano') != null ? Number(get('ano')) : undefined),
      anoModelo: get('anoModelo') != null ? Number(get('anoModelo')) : (get('ano') != null ? Number(get('ano')) : undefined),
      tipoVeiculo: get('tipoVeiculo') != null ? String(get('tipoVeiculo')) : undefined,
      centroCusto: get('centroCusto') != null ? String(get('centroCusto')) : undefined,
      ativo: get('ativo') !== false && get('Ativo') !== false,
      transportadoraId: get('transportadoraId') != null ? Number(get('transportadoraId')) : undefined
    };
  }

  private unwrapBuscarBody(body: unknown): unknown {
    let current: unknown = body;
    for (let i = 0; i < 2; i++) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) break;
      const obj = current as Record<string, unknown>;
      if (obj['result'] != null) {
        current = obj['result'];
        continue;
      }
      if (obj['Result'] != null) {
        current = obj['Result'];
        continue;
      }
      break;
    }
    return current;
  }

  /** GET /api/Veiculo/{id} */
  obterPorId(id: number): Observable<VeiculoDTO | null> {
    return this.http.get<unknown>(`${VEICULO}/${id}`).pipe(
      timeout(15000),
      map((body) => {
        const res = body as Record<string, unknown> | VeiculoDTO;
        const raw =
          res && typeof res === 'object' && 'result' in res
            ? (res as Record<string, unknown>)['result']
            : res;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        return this.mapVeiculoDetalheGet(raw as Record<string, unknown>);
      }),
      catchError(() => of(null))
    );
  }

  /** Mapeia corpo do GET /api/Veiculo/{id} (flat + aninhado `veiculoModelo`, `motorista`). */
  private mapVeiculoDetalheGet(result: Record<string, unknown>): VeiculoDTO | null {
    const get = (k: string) => result[k] ?? result[k.charAt(0).toUpperCase() + k.slice(1)];
    const id = Number(get('id'));
    if (!id) return null;

    const nestedMotorista = get('motorista') ?? get('Motorista');
    let motoristaNome: string | undefined;
    let motoristaId: number | undefined;
    if (nestedMotorista && typeof nestedMotorista === 'object') {
      const nm = nestedMotorista as Record<string, unknown>;
      const ng = (k: string) => nm[k] ?? nm[k.charAt(0).toUpperCase() + k.slice(1)];
      const mid = ng('id');
      if (mid != null) motoristaId = Number(mid) || undefined;
      const nome = String(
        ng('nomeCompleto') ?? ng('NomeCompleto') ?? ng('descricao') ?? ng('Descricao') ?? ''
      ).trim();
      if (nome) motoristaNome = nome;
    }
    const flatMotoristaId = get('motoristaId') ?? get('MotoristaId') ?? get('condutorId') ?? get('CondutorId');
    if (motoristaId == null && flatMotoristaId != null) {
      motoristaId = Number(flatMotoristaId) || undefined;
    }

    const vmRaw = get('veiculoModelo') ?? get('VeiculoModelo');
    let veiculoModeloId = get('veiculoModeloId') ?? get('VeiculoModeloId');
    const mmFlat = get('marcaModelo') ?? get('MarcaModelo');
    let marcaModeloCombined = mmFlat != null ? String(mmFlat) : undefined;
    if (vmRaw && typeof vmRaw === 'object') {
      const vm = vmRaw as Record<string, unknown>;
      const vg = (k: string) => vm[k] ?? vm[k.charAt(0).toUpperCase() + k.slice(1)];
      if (veiculoModeloId == null && vg('id') != null) veiculoModeloId = Number(vg('id'));
      const marcaRaw = vg('veiculoMarca') ?? vg('VeiculoMarca');
      let marcaDesc = '';
      if (marcaRaw && typeof marcaRaw === 'object') {
        const mr = marcaRaw as Record<string, unknown>;
        marcaDesc = String(mr['descricao'] ?? mr['Descricao'] ?? '');
      }
      const modeloDesc = String(vg('descricao') ?? vg('Descricao') ?? '');
      const combined = [marcaDesc, modeloDesc].filter(Boolean).join(' ').trim();
      if (combined) marcaModeloCombined = combined;
    }

    const ano = get('ano') ?? get('Ano');
    const anoFabricacaoRaw = get('anoFabricacao') ?? get('AnoFabricacao');
    const anoModeloRaw = get('anoModelo') ?? get('AnoModelo');
    const anoNum = ano != null ? Number(ano) : undefined;
    const anoFabricacao =
      anoFabricacaoRaw != null ? Number(anoFabricacaoRaw) : anoNum !== undefined ? anoNum : undefined;
    const anoModelo =
      anoModeloRaw != null ? Number(anoModeloRaw) : anoNum !== undefined ? anoNum : undefined;

    const descricaoRaw = get('descricao') ?? get('Descricao');
    const veiculoModeloIdNum =
      veiculoModeloId != null ? Number(veiculoModeloId) : undefined;

    const vdRaw = get('veiculoDetalhe') ?? get('VeiculoDetalhe');
    let quantidadeEixos: string | number | null | undefined =
      (get('quantidadeEixos') ?? get('QuantidadeEixos')) as string | number | null | undefined;
    let tipoPeso: string | null | undefined = (get('tipoPeso') ?? get('TipoPeso')) as string | null | undefined;
    if (vdRaw && typeof vdRaw === 'object') {
      const vd = vdRaw as Record<string, unknown>;
      const vget = (k: string) => vd[k] ?? vd[k.charAt(0).toUpperCase() + k.slice(1)];
      if (quantidadeEixos == null) {
        quantidadeEixos = (vget('quantidadeEixos') ?? vget('QuantidadeEixos')) as string | number | null | undefined;
      }
      if (tipoPeso == null) {
        tipoPeso = (vget('tipoPeso') ?? vget('TipoPeso')) as string | null | undefined;
      }
    }

    const motoristasVinculos = this.parseMotoristasVinculosGet(result);

    return {
      id,
      transportadoraId: get('transportadoraId') != null ? Number(get('transportadoraId')) : undefined,
      placa: String(get('placa') ?? ''),
      motoristaId,
      motoristaNome,
      descricao: descricaoRaw != null ? String(descricaoRaw) : undefined,
      veiculoModeloId: Number.isFinite(veiculoModeloIdNum as number) ? veiculoModeloIdNum : undefined,
      marcaModelo: marcaModeloCombined,
      cor: get('cor') != null ? String(get('cor')) : undefined,
      anoFabricacao,
      anoModelo,
      tipoVeiculo: get('tipoVeiculo') != null ? String(get('tipoVeiculo')) : undefined,
      centroCusto: get('centroCusto') != null ? String(get('centroCusto')) : undefined,
      ativo: get('ativo') !== false && get('Ativo') !== false,
      quantidadeEixos: quantidadeEixos != null ? quantidadeEixos : undefined,
      tipoPeso: tipoPeso != null ? String(tipoPeso) : undefined,
      motoristasVinculos: motoristasVinculos.length > 0 ? motoristasVinculos : undefined
    };
  }

  /** GET: listas paralelas `motoristaIds` e `motoristas` (nomes). */
  private parseMotoristasVinculosGet(result: Record<string, unknown>): VeiculoMotoristaVinculoDTO[] {
    const idsRaw = result['motoristaIds'] ?? result['MotoristaIds'];
    const nomesRaw = result['motoristas'] ?? result['Motoristas'];
    if (!Array.isArray(idsRaw)) return [];
    const ids = idsRaw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    const nomes = Array.isArray(nomesRaw) ? nomesRaw.map((n) => String(n ?? '').trim()) : [];
    return ids.map((id, i) => ({
      id,
      nome: nomes[i] && nomes[i].length > 0 ? nomes[i] : `Motorista ${id}`
    }));
  }

  /** POST /api/Veiculo */
  gravar(dto: VeiculoDTO): Observable<VeiculoDTO> {
    const payload = this.dtoToPayload(dto);
    return this.http.post<VeiculoDTO>(VEICULO, payload).pipe(
      timeout(15000),
      map((res) => (res && typeof res === 'object' ? { ...dto, id: (res as { id?: number }).id ?? (res as { Id?: number }).Id } : dto)),
      catchError((err) => throwError(() => err))
    );
  }

  /** PUT /api/Veiculo */
  alterar(dto: VeiculoDTO): Observable<VeiculoDTO> {
    const payload = this.dtoToPayload(dto);
    return this.http.put<VeiculoDTO>(VEICULO, payload).pipe(
      timeout(15000),
      catchError((err) => throwError(() => err))
    );
  }

  /** DELETE /api/Veiculo/{id} */
  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${VEICULO}/${id}`).pipe(
      timeout(15000),
      catchError((err) => throwError(() => err))
    );
  }

  /** Payload para POST Gravar e PUT Alterar (backend: placa obrigatória). */
  private dtoToPayload(dto: VeiculoDTO): Record<string, unknown> {
    const placa = (dto.placa ?? '').replace(/\s/g, '').toUpperCase();
    const payload: Record<string, unknown> = {
      id: dto.id,
      transportadoraId: dto.transportadoraId,
      placa: placa || undefined,
      veiculoModeloId: dto.veiculoModeloId,
      marcaModelo: dto.marcaModelo,
      descricao: dto.descricao ?? undefined,
      cor: dto.cor ?? undefined,
      anoFabricacao: dto.anoFabricacao ?? undefined,
      anoModelo: dto.anoModelo ?? undefined,
      tipoVeiculo: dto.tipoVeiculo ?? undefined,
      centroCusto: dto.centroCusto ?? undefined,
      ativo: dto.ativo
    };
    if (dto.motoristaId != null && dto.motoristaId > 0) {
      payload['motoristaId'] = dto.motoristaId;
    }
    if (dto.motoristaIds != null) {
      payload['motoristaIds'] = dto.motoristaIds;
    }
    return payload;
  }
}
