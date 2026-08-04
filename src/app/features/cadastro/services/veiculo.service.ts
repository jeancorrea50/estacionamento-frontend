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
import {
  descricaoFromApiField,
  joinMarcaModelo,
  splitMarcaModelo
} from '../utils/marca-modelo';
import { parseTipoCarga } from '../../../shared/models/tipo-carga';

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
    const marca = descricaoFromApiField(
      get('marcaModelo') ?? get('MarcaModelo') ?? modeloMarcaApi ?? get('marca') ?? get('Marca')
    );
    const modelo = descricaoFromApiField(get('modelo') ?? get('Modelo'));
    const marcaModelo =
      joinMarcaModelo(marca, modelo) || String(marca || modelo);
    const motoristas = this.parseMotoristasVinculosGet(row);
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
      transportadoraId: get('transportadoraId') != null ? Number(get('transportadoraId')) : undefined,
      tipoCarga: parseTipoCarga(
        (get('tipoCarga') ?? get('TipoCarga')) as number | string | null | undefined
      ),
      motoristas: motoristas.length > 0 ? motoristas : undefined
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
    let marcaDescricao = '';
    let modeloDescricao = '';
    if (mmFlat != null) {
      const parsed = splitMarcaModelo(String(mmFlat));
      marcaDescricao = parsed.marca;
      modeloDescricao = parsed.modelo;
    }
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
      if (marcaDesc) marcaDescricao = marcaDesc.trim();
      if (modeloDesc) modeloDescricao = modeloDesc.trim();
    }

    // Contrato atual GET/POST: `modelo` + `marca` aninhados
    const modeloApi = get('modelo') ?? get('Modelo');
    const marcaApi = get('marca') ?? get('Marca');
    if (modeloApi && typeof modeloApi === 'object' && !Array.isArray(modeloApi)) {
      const mo = modeloApi as Record<string, unknown>;
      const mg = (k: string) => mo[k] ?? mo[k.charAt(0).toUpperCase() + k.slice(1)];
      if (veiculoModeloId == null && mg('id') != null) {
        const mid = Number(mg('id'));
        if (Number.isFinite(mid) && mid > 0) veiculoModeloId = mid;
      }
      const modeloDesc = String(mg('descricao') ?? '').trim();
      let marcaDesc = '';
      const nestedMarca = mg('marca');
      if (nestedMarca && typeof nestedMarca === 'object' && !Array.isArray(nestedMarca)) {
        const nm = nestedMarca as Record<string, unknown>;
        marcaDesc = String(nm['descricao'] ?? nm['Descricao'] ?? '').trim();
      }
      if (!marcaDesc && marcaApi && typeof marcaApi === 'object' && !Array.isArray(marcaApi)) {
        const ma = marcaApi as Record<string, unknown>;
        marcaDesc = String(ma['descricao'] ?? ma['Descricao'] ?? '').trim();
      }
      if (marcaDesc) marcaDescricao = marcaDesc;
      if (modeloDesc) modeloDescricao = modeloDesc;
    } else if (marcaApi && typeof marcaApi === 'object' && !Array.isArray(marcaApi)) {
      const ma = marcaApi as Record<string, unknown>;
      const marcaDesc = String(ma['descricao'] ?? ma['Descricao'] ?? '').trim();
      if (marcaDesc) marcaDescricao = marcaDesc;
    }

    const marcaModeloCombined = joinMarcaModelo(marcaDescricao, modeloDescricao) || undefined;
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
    const principalFromVinculos = motoristasVinculos.find((m) => m.principal === true)?.id;
    if (motoristaId == null && principalFromVinculos != null) {
      motoristaId = principalFromVinculos;
    }
    if (motoristaId == null && motoristasVinculos.length === 1) {
      motoristaId = motoristasVinculos[0].id;
    }

    const tipoCarga = parseTipoCarga(
      (get('tipoCarga') ?? get('TipoCarga')) as number | string | null | undefined
    );

    return {
      id,
      transportadoraId: get('transportadoraId') != null ? Number(get('transportadoraId')) : undefined,
      placa: String(get('placa') ?? ''),
      motoristaId,
      motoristaNome,
      descricao: descricaoRaw != null ? String(descricaoRaw) : undefined,
      veiculoModeloId: Number.isFinite(veiculoModeloIdNum as number) ? veiculoModeloIdNum : undefined,
      marcaModelo: marcaModeloCombined,
      marcaDescricao: marcaDescricao || undefined,
      modeloDescricao: modeloDescricao || undefined,
      cor: get('cor') != null ? String(get('cor')) : undefined,
      anoFabricacao,
      anoModelo,
      tipoVeiculo: get('tipoVeiculo') != null ? String(get('tipoVeiculo')) : undefined,
      tipoCarga: tipoCarga ?? undefined,
      centroCusto: get('centroCusto') != null ? String(get('centroCusto')) : undefined,
      ativo: get('ativo') !== false && get('Ativo') !== false,
      quantidadeEixos: quantidadeEixos != null ? quantidadeEixos : undefined,
      tipoPeso: tipoPeso != null ? String(tipoPeso) : undefined,
      motoristasVinculos: motoristasVinculos.length > 0 ? motoristasVinculos : undefined
    };
  }

  /**
   * GET: `motoristas` como array de objetos (contrato atual) ou
   * legado com listas paralelas `motoristaIds` + `motoristas` (nomes).
   */
  private parseMotoristasVinculosGet(result: Record<string, unknown>): VeiculoMotoristaVinculoDTO[] {
    const motoristasRaw = result['motoristas'] ?? result['Motoristas'];

    if (Array.isArray(motoristasRaw) && motoristasRaw.length > 0) {
      const comoObjetos = motoristasRaw.filter(
        (x): x is Record<string, unknown> => x != null && typeof x === 'object' && !Array.isArray(x)
      );
      if (comoObjetos.length > 0) {
        return comoObjetos
          .map((m) => this.mapMotoristaVinculoObjeto(m))
          .filter((v) => v.id > 0);
      }
    }

    const idsRaw = result['motoristaIds'] ?? result['MotoristaIds'];
    if (!Array.isArray(idsRaw)) return [];
    const ids = idsRaw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    const nomes = Array.isArray(motoristasRaw) ? motoristasRaw.map((n) => String(n ?? '').trim()) : [];
    return ids.map((id, i) => ({
      id,
      nome: nomes[i] && nomes[i].length > 0 ? nomes[i] : `Motorista ${id}`
    }));
  }

  private mapMotoristaVinculoObjeto(m: Record<string, unknown>): VeiculoMotoristaVinculoDTO {
    const get = (k: string) => m[k] ?? m[k.charAt(0).toUpperCase() + k.slice(1)];
    const id = Number(get('id') ?? get('motoristaId')) || 0;

    const pfRaw = get('pessoaFisica') ?? get('PessoaFisica') ?? get('pessoa') ?? get('Pessoa');
    let nomePf = '';
    let cpfPf = '';
    if (pfRaw != null && typeof pfRaw === 'object' && !Array.isArray(pfRaw)) {
      const pf = pfRaw as Record<string, unknown>;
      const pg = (k: string) => pf[k] ?? pf[k.charAt(0).toUpperCase() + k.slice(1)];
      nomePf = String(pg('nome') ?? pg('nomeCompleto') ?? pg('descricao') ?? '').trim();
      cpfPf = String(pg('cpf') ?? pg('Cpf') ?? '').trim();
    }

    const nome = String(
      get('descricao') ??
        get('Descricao') ??
        get('nomeCompleto') ??
        get('NomeCompleto') ??
        get('nome') ??
        nomePf ??
        ''
    ).trim();

    const cnh = String(get('cnh') ?? get('Cnh') ?? '').trim();
    const validadeCnh = this.formatValidadeCnhDisplay(
      get('validadeCNH') ?? get('validadeCnh') ?? get('ValidadeCNH')
    );
    const cpf = String(get('cpf') ?? get('Cpf') ?? cpfPf ?? '').replace(/\D/g, '');

    return {
      id,
      nome: nome || `Motorista ${id}`,
      cpf: cpf || undefined,
      cnh: cnh || undefined,
      validadeCnh: validadeCnh || undefined,
      principal:
        get('principal') != null || get('Principal') != null
          ? Boolean(get('principal') ?? get('Principal'))
          : undefined
    };
  }

  /** Normaliza validade CNH (ISO / date-time) para DD/MM/AAAA. */
  private formatValidadeCnhDisplay(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (isoDate) {
      const [, year, month, day] = isoDate;
      return `${day}/${month}/${year}`;
    }
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return raw;
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /** POST /api/Veiculo — mesmo shape do PUT, sem `id`. */
  gravar(dto: VeiculoDTO): Observable<VeiculoDTO> {
    const payload = this.dtoToPayload(dto, 'gravar');
    return this.http.post<VeiculoDTO>(VEICULO, payload).pipe(
      timeout(15000),
      map((res) => (res && typeof res === 'object' ? { ...dto, id: (res as { id?: number }).id ?? (res as { Id?: number }).Id } : dto)),
      catchError((err) => throwError(() => err))
    );
  }

  /** PUT /api/Veiculo — mesmos campos do POST + `id` obrigatório. */
  alterar(dto: VeiculoDTO): Observable<VeiculoDTO> {
    const id = dto.id != null ? Number(dto.id) : NaN;
    if (!Number.isFinite(id) || id <= 0) {
      return throwError(() => new Error('Id obrigatório para alterar veículo.'));
    }
    const payload = this.dtoToPayload({ ...dto, id }, 'alterar');
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

  /**
   * Payload POST/PUT `/api/Veiculo` alinhado ao contrato:
   * placa, ano, ativo, cor, tipoCarga, transportadoraId, marca, modelo, motoristas.
   * Em `alterar`, inclui também `id` (único campo a mais em relação ao gravar).
   * Não envia campos fora do contrato (`marcaModelo`, `anoFabricacao`, `centroCusto`, etc.).
   */
  private dtoToPayload(dto: VeiculoDTO, modo: 'gravar' | 'alterar'): Record<string, unknown> {
    const placa = normalizePlaca(dto.placa);
    const tipoCarga = parseTipoCarga(dto.tipoCarga as number | string | null | undefined);
    const { marcaDesc, modeloDesc } = this.resolveMarcaModeloDesc(dto);
    const ano = this.resolveAnoPayload(dto);
    const modeloId =
      dto.veiculoModeloId != null && Number(dto.veiculoModeloId) > 0
        ? Number(dto.veiculoModeloId)
        : undefined;

    const payload: Record<string, unknown> = {
      placa: placa || undefined,
      ativo: dto.ativo !== false,
      /** Contrato C#: `List<MotoristaVinculoInput>` — não enviar `motoristaId` / `motoristaIds`. */
      motoristas: this.buildMotoristasVinculoPayload(dto)
    };

    if (modo === 'alterar') {
      payload['id'] = Number(dto.id);
    }

    if (dto.transportadoraId != null && Number(dto.transportadoraId) > 0) {
      payload['transportadoraId'] = Number(dto.transportadoraId);
    }
    const cor = String(dto.cor ?? '').trim();
    if (cor) payload['cor'] = cor;
    if (tipoCarga != null) payload['tipoCarga'] = tipoCarga;
    if (ano != null) payload['ano'] = ano;

    if (marcaDesc) {
      payload['marca'] = { descricao: marcaDesc };
    }

    if (modeloDesc || modeloId != null) {
      const modelo: Record<string, unknown> = {};
      if (modeloId != null) modelo['id'] = modeloId;
      if (modeloDesc) modelo['descricao'] = modeloDesc;
      if (marcaDesc) modelo['marca'] = { descricao: marcaDesc };
      payload['modelo'] = modelo;
    }

    return payload;
  }

  /** `ano` do POST: Ano Fabricação da tela, com fallback para Ano Modelo. */
  private resolveAnoPayload(dto: VeiculoDTO): number | undefined {
    const fab = dto.anoFabricacao != null ? Number(dto.anoFabricacao) : NaN;
    if (Number.isFinite(fab) && fab > 0) return fab;
    const mod = dto.anoModelo != null ? Number(dto.anoModelo) : NaN;
    if (Number.isFinite(mod) && mod > 0) return mod;
    return undefined;
  }

  /** Resolve marca/modelo a partir dos campos do formulário ou do texto combinado. */
  private resolveMarcaModeloDesc(dto: VeiculoDTO): {
    marcaDesc?: string;
    modeloDesc?: string;
  } {
    const marcaFromForm = String(dto.marcaDescricao ?? '').trim();
    const modeloFromForm = String(dto.modeloDescricao ?? '').trim();
    if (marcaFromForm || modeloFromForm) {
      return {
        marcaDesc: marcaFromForm || undefined,
        modeloDesc: modeloFromForm || undefined
      };
    }

    const parsed = splitMarcaModelo(dto.marcaModelo);
    return {
      marcaDesc: parsed.marca || undefined,
      modeloDesc: parsed.modelo || undefined
    };
  }

  /**
   * Monta `motoristas: [{ id, principal }]` a partir de `dto.motoristas`
   * ou, em fallback, de `motoristaIds` + `motoristaId` (principal).
   */
  private buildMotoristasVinculoPayload(
    dto: VeiculoDTO
  ): Array<{ id: number; principal?: boolean }> {
    if (dto.motoristas != null) {
      return dto.motoristas
        .map((m) => {
          const id = Number(m?.id);
          if (!Number.isFinite(id) || id <= 0) return null;
          const item: { id: number; principal?: boolean } = { id };
          if (m.principal != null) item.principal = Boolean(m.principal);
          return item;
        })
        .filter((m): m is { id: number; principal?: boolean } => m != null);
    }

    const ids = (dto.motoristaIds ?? [])
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
    const principalId =
      dto.motoristaId != null && Number(dto.motoristaId) > 0 ? Number(dto.motoristaId) : undefined;

    if (ids.length > 0) {
      const unique = [...new Set(ids)];
      if (principalId != null && !unique.includes(principalId)) {
        unique.unshift(principalId);
      }
      return unique.map((id) => ({
        id,
        principal: principalId != null ? id === principalId : undefined
      }));
    }

    if (principalId != null) {
      return [{ id: principalId, principal: true }];
    }

    return [];
  }
}
