import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EntradaSaidaFiltro,
  EntradaSaidaPagedResult,
  EntradaSaidaPermanenciaInput,
  EntradaSaidaPostInput,
  EntradaSaidaPutInput,
  EntradaSaidaOutput,
  EntradaSaidaSearchOutput,
  ModoRecibo,
  parseEntradaSaidaStatus,
  TipoTarifaEstacionamento,
  ValorEstacionamentoResponse
} from '../models/entrada-saida.models';

const ENTRADA_SAIDA_API = `${environment.API_BASE_URL}/EntradaSaida`;

@Injectable({ providedIn: 'root' })
export class EntradaSaidaService {
  private readonly http = inject(HttpClient);

  buscar(filtro: EntradaSaidaFiltro): Observable<EntradaSaidaPagedResult<EntradaSaidaSearchOutput>> {
    const params = this.buildBuscarParams(filtro);
    return this.http.get<unknown>(ENTRADA_SAIDA_API, { params }).pipe(
      map((body) => this.normalizePagedResult(body, filtro.numeroPagina, filtro.tamanhoPagina))
    );
  }

  getById(id: number): Observable<EntradaSaidaOutput | null> {
    return this.http.get<unknown>(`${ENTRADA_SAIDA_API}/${id}`).pipe(
      map((body) => {
        const raw = this.extractResultRecord(body);
        if (!raw) return null;
        // Backend `EntradaSaidaOutput` não expõe Id — reaproveita o id da rota.
        return this.mapDetailItem(raw, id);
      })
    );
  }

  /**
   * GET `/api/EntradaSaida/buscar-por-placa/{placa}`.
   * Aceita contrato aninhado (`motorista`/`veiculo`/`transportadora`) ou flat na raiz
   * (`placa`, `cnpj`, `razaoSocial`, `responsavelLegal`, …) + IDs.
   * @see mapBuscarPorPlacaParaRegistroRapido
   */
  obterPorPlaca(placa: string): Observable<EntradaSaidaOutput | null> {
    return this.http.get<unknown>(`${ENTRADA_SAIDA_API}/buscar-por-placa/${encodeURIComponent(placa)}`).pipe(
      map((body) => {
        const raw = this.extractResultRecord(body);
        if (!raw) return null;
        const id = this.pickNumber(raw, 'id', 'Id');
        const detail = this.mapDetailItem(raw, id > 0 ? id : 0);
        return this.enrichBuscarPorPlacaFromFlat(raw, detail);
      }),
      // 404 / ausência = sem histórico prévio; silencioso no registro rápido.
      catchError(() => of(null))
    );
  }

  create(data: EntradaSaidaPostInput): Observable<EntradaSaidaOutput> {
    return this.http.post<unknown>(ENTRADA_SAIDA_API, data).pipe(
      map((body) => {
        const raw = this.extractResultRecord(body) ?? {};
        const id = this.pickNumber(raw, 'id', 'Id');
        return this.mapDetailItem(raw, id);
      })
    );
  }

  update(id: number, data: EntradaSaidaPostInput): Observable<EntradaSaidaOutput> {
    const payload: EntradaSaidaPutInput = { ...data, id };
    return this.http.put<unknown>(ENTRADA_SAIDA_API, payload).pipe(
      map((body) => {
        const raw = this.extractResultRecord(body) ?? {};
        return this.mapDetailItem(raw, id);
      })
    );
  }

  suspenderPermanencia(id: number, payload: EntradaSaidaPermanenciaInput): Observable<void> {
    return this.http.patch<void>(`${ENTRADA_SAIDA_API}/${id}/suspender-permanencia`, payload);
  }

  finalizarPermanencia(id: number, dataHoraEvento?: string): Observable<void> {
    let params = new HttpParams();
    if (dataHoraEvento?.trim()) {
      params = params.set('dataHoraSaida', dataHoraEvento.trim());
    }
    return this.http.patch<void>(`${ENTRADA_SAIDA_API}/${id}/finalizar-permanencia`, null, { params });
  }

  saida(placa: string): Observable<void> {
    return this.http.post<void>(`${ENTRADA_SAIDA_API}/saida`, { placa });
  }

  /**
   * GET `/api/EntradaSaida/valor-estacionamento?entradaSaidaId=`
   * Valor do recibo / pré-preenchimento da saída (não exige transportadora no front).
   */
  obterValorEstacionamento(entradaSaidaId: number): Observable<ValorEstacionamentoResponse> {
    const params = new HttpParams().set('entradaSaidaId', String(entradaSaidaId));
    return this.http.get<unknown>(`${ENTRADA_SAIDA_API}/valor-estacionamento`, { params }).pipe(
      map((body) => {
        const raw = this.extractResultRecord(body) ?? {};
        return {
          entradaSaidaId:
            this.pickNumber(raw, 'entradaSaidaId', 'EntradaSaidaId') || entradaSaidaId,
          estacionamentoId: this.pickNumber(raw, 'estacionamentoId', 'EstacionamentoId'),
          transportadoraId: this.pickNumberOrNull(raw, 'transportadoraId', 'TransportadoraId'),
          configuracaoCobrancaId: this.pickNumberOrNull(
            raw,
            'configuracaoCobrancaId',
            'ConfiguracaoCobrancaId'
          ),
          valor: this.pickNumberOrNull(raw, 'valor', 'Valor'),
          origem: this.pickString(raw, 'origem', 'Origem') || 'Indisponivel',
          valorUnitario: this.pickNumberOrNull(
            raw,
            'valorUnitario',
            'ValorUnitario',
            'valorUnitarioDiario',
            'ValorUnitarioDiario'
          ),
          quantidadeUnidades: this.pickNumberOrNull(
            raw,
            'quantidadeUnidades',
            'QuantidadeUnidades',
            'quantidadeDias',
            'QuantidadeDias'
          ),
          tipoTarifa: this.pickTipoTarifa(raw['tipoTarifa'] ?? raw['TipoTarifa']),
          tipoCobranca: this.pickString(raw, 'tipoCobranca', 'TipoCobranca') || 'Avulso'
        };
      })
    );
  }

  /**
   * GET `/api/EntradaSaida/{id}/recibo?modo=&valor=`
   * `modo`: {@link ModoRecibo.Saida}=1 (exige valor) | {@link ModoRecibo.Entrada}=2.
   */
  baixarRecibo(id: number, modo: ModoRecibo, valor?: number | null): Observable<Blob> {
    let params = new HttpParams().set('modo', String(modo));
    if (modo === ModoRecibo.Saida) {
      if (valor == null || !Number.isFinite(valor)) {
        throw new Error('Valor do recibo é obrigatório no modo saída.');
      }
      params = params.set('valor', String(valor));
    }
    return this.http.get(`${ENTRADA_SAIDA_API}/${id}/recibo`, {
      params,
      responseType: 'blob'
    });
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${ENTRADA_SAIDA_API}/${id}`);
  }

  private buildBuscarParams(filtro: EntradaSaidaFiltro): HttpParams {
    let params = new HttpParams()
      .set('NumeroPagina', String(filtro.numeroPagina))
      .set('TamanhoPagina', String(filtro.tamanhoPagina))
      .set('page', String(filtro.page ?? filtro.numeroPagina))
      .set('size', String(filtro.size ?? filtro.tamanhoPagina));

    if (filtro.placa?.trim()) params = params.set('placa', filtro.placa.trim());
    if (typeof filtro.motoristaId === 'number') params = params.set('motoristaId', String(filtro.motoristaId));
    if (typeof filtro.transportadoraId === 'number') params = params.set('transportadoraId', String(filtro.transportadoraId));
    if (typeof filtro.somenteEmAberto === 'boolean') params = params.set('somenteEmAberto', String(filtro.somenteEmAberto));
    return params;
  }

  private normalizePagedResult(
    body: unknown,
    numeroPagina: number,
    tamanhoPagina: number
  ): EntradaSaidaPagedResult<EntradaSaidaSearchOutput> {
    const source = this.unwrap(body);
    const root = (source && typeof source === 'object') ? source as Record<string, unknown> : {};
    const rows =
      (Array.isArray(root['results']) && root['results']) ||
      (Array.isArray(root['Results']) && root['Results']) ||
      (Array.isArray(root['items']) && root['items']) ||
      (Array.isArray(root['itens']) && root['itens']) ||
      (Array.isArray(source) && source) ||
      [];

    const items = (rows as unknown[])
      .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
      .map((row) => this.mapSearchItem(row));

    return {
      items,
      totalCount:
        Number(
          root['rowCount'] ??
            root['RowCount'] ??
            root['totalCount'] ??
            root['totalRegistros'] ??
            items.length
        ) || items.length,
      numeroPagina:
        Number(root['currentPage'] ?? root['CurrentPage'] ?? root['numeroPagina'] ?? numeroPagina) ||
        numeroPagina,
      tamanhoPagina:
        Number(root['pageSize'] ?? root['PageSize'] ?? root['tamanhoPagina'] ?? tamanhoPagina) ||
        tamanhoPagina
    };
  }

  private mapSearchItem(row: Record<string, unknown>): EntradaSaidaSearchOutput {
    return {
      id: this.pickNumber(row, 'id', 'Id'),
      descricao: this.pickString(row, 'descricao', 'Descricao'),
      motoristaId: this.pickNumber(row, 'motoristaId', 'MotoristaId'),
      nomeMotorista: this.pickString(row, 'nomeMotorista', 'NomeMotorista'),
      transportadoraId: this.pickNumber(row, 'transportadoraId', 'TransportadoraId'),
      nomeTransportadora: this.pickString(row, 'nomeTransportadora', 'NomeTransportadora'),
      veiculoId: this.pickNumber(row, 'veiculoId', 'VeiculoId'),
      placaVeiculo: this.pickString(row, 'placaVeiculo', 'PlacaVeiculo'),
      dataHoraEntrada: this.pickString(row, 'dataHoraEntrada', 'DataHoraEntrada'),
      dataHoraSaida: this.pickStringOrNull(row, 'dataHoraSaida', 'DataHoraSaida'),
      status: parseEntradaSaidaStatus(
        this.pickRaw(row, 'status', 'Status', 'situacao', 'Situacao') as number | string | undefined
      ),
      faturado: this.pickBool(row, 'faturado', 'Faturado'),
      dataFaturado: this.pickStringOrNull(row, 'dataFaturado', 'DataFaturado'),
      avulso: this.pickBool(row, 'avulso', 'Avulso')
    };
  }

  /** Detalhe GET: garante `id` mesmo quando o DTO do backend não serializa o campo. */
  private mapDetailItem(row: Record<string, unknown>, fallbackId: number): EntradaSaidaOutput {
    const id = this.pickNumber(row, 'id', 'Id') || fallbackId;
    const suspensoesRaw = row['suspensoes'] ?? row['Suspensoes'];
    const transportadora = (row['transportadora'] ?? row['Transportadora']) as EntradaSaidaOutput['transportadora'];
    const transportadoraId =
      this.pickNumber(row, 'transportadoraId', 'TransportadoraId') ||
      (transportadora && typeof transportadora === 'object'
        ? this.pickNumber(transportadora as Record<string, unknown>, 'id', 'Id')
        : 0);

    return {
      id,
      descricao: this.pickString(row, 'descricao', 'Descricao'),
      motoristaId: this.pickNumber(row, 'motoristaId', 'MotoristaId'),
      transportadoraId,
      veiculoId: this.pickNumber(row, 'veiculoId', 'VeiculoId'),
      observacao: this.pickStringOrNull(row, 'observacao', 'Observacao', 'observao', 'Observao'),
      dataHoraEntrada: this.pickString(row, 'dataHoraEntrada', 'DataHoraEntrada'),
      dataHoraSaida: this.pickStringOrNull(row, 'dataHoraSaida', 'DataHoraSaida'),
      dataHoraUltimaEntradaPatio: this.pickStringOrNull(
        row,
        'dataHoraUltimaEntradaPatio',
        'DataHoraUltimaEntradaPatio'
      ),
      dataHoraFinalizacao: this.pickStringOrNull(row, 'dataHoraFinalizacao', 'DataHoraFinalizacao'),
      tempoPermanenciaMinutos: this.pickNumber(row, 'tempoPermanenciaMinutos', 'TempoPermanenciaMinutos'),
      tempoTotalSuspensaoMinutos: this.pickNumber(
        row,
        'tempoTotalSuspensaoMinutos',
        'TempoTotalSuspensaoMinutos'
      ),
      permanenciaSuspensa: Boolean(row['permanenciaSuspensa'] ?? row['PermanenciaSuspensa']),
      finalizado: Boolean(row['finalizado'] ?? row['Finalizado']),
      usuarioRegistroEntradaId: this.pickNumber(
        row,
        'usuarioRegistroEntradaId',
        'UsuarioRegistroEntradaId'
      ),
      usuarioRegistroEntradaNome: this.pickString(
        row,
        'usuarioRegistroEntradaNome',
        'UsuarioRegistroEntradaNome'
      ),
      usuarioFinalizacaoId: this.pickNumber(row, 'usuarioFinalizacaoId', 'UsuarioFinalizacaoId') || null,
      usuarioFinalizacaoNome:
        this.pickString(row, 'usuarioFinalizacaoNome', 'UsuarioFinalizacaoNome') || null,
      existeEntradaEmAberto:
        row['existeEntradaEmAberto'] != null || row['ExisteEntradaEmAberto'] != null
          ? Boolean(row['existeEntradaEmAberto'] ?? row['ExisteEntradaEmAberto'])
          : undefined,
      suspensoes: Array.isArray(suspensoesRaw)
        ? (suspensoesRaw as EntradaSaidaOutput['suspensoes'])
        : [],
      motorista: (row['motorista'] ?? row['Motorista']) as EntradaSaidaOutput['motorista'],
      transportadora,
      veiculo: (row['veiculo'] ?? row['Veiculo']) as EntradaSaidaOutput['veiculo']
    };
  }

  /**
   * Só em buscar-por-placa: se a API não enviar objetos aninhados,
   * monta `veiculo`/`transportadora`/`motorista` a partir dos campos flat da raiz.
   */
  private enrichBuscarPorPlacaFromFlat(
    row: Record<string, unknown>,
    detail: EntradaSaidaOutput
  ): EntradaSaidaOutput {
    return {
      ...detail,
      motorista: detail.motorista ?? this.synthesizeMotoristaFromFlat(row),
      transportadora: detail.transportadora ?? this.synthesizeTransportadoraFromFlat(row),
      veiculo: detail.veiculo ?? this.synthesizeVeiculoFromFlat(row)
    };
  }

  private synthesizeTransportadoraFromFlat(
    row: Record<string, unknown>
  ): EntradaSaidaOutput['transportadora'] {
    const cnpj = this.pickString(row, 'cnpj', 'Cnpj', 'cnpjTransportadora', 'CnpjTransportadora');
    const razaoSocial = this.pickString(
      row,
      'razaoSocial',
      'RazaoSocial',
      'nomeTransportadora',
      'NomeTransportadora',
      'nomeFantasia',
      'NomeFantasia'
    );
    const responsavelLegal = this.pickString(
      row,
      'responsavelLegal',
      'ResponsavelLegal',
      'nomeResponsavel',
      'NomeResponsavel',
      'responsavelNome',
      'ResponsavelNome'
    );
    const responsavelTelefone = this.pickString(
      row,
      'responsavelTelefone',
      'ResponsavelTelefone',
      'telefoneResponsavel',
      'TelefoneResponsavel'
    );
    const responsavelCpf = this.pickString(row, 'responsavelCpf', 'ResponsavelCpf');
    const responsavelEmail = this.pickString(row, 'responsavelEmail', 'ResponsavelEmail');
    const id = this.pickNumber(row, 'transportadoraId', 'TransportadoraId');

    if (
      !cnpj &&
      !razaoSocial &&
      !responsavelLegal &&
      !responsavelTelefone &&
      !responsavelCpf &&
      !responsavelEmail &&
      id <= 0
    ) {
      return undefined;
    }

    return {
      id: id > 0 ? id : undefined,
      cnpj: cnpj || undefined,
      razaoSocial: razaoSocial || undefined,
      responsavelLegal: responsavelLegal || undefined,
      responsavelTelefone: responsavelTelefone || undefined,
      responsavelCpf: responsavelCpf || undefined,
      responsavelEmail: responsavelEmail || undefined
    };
  }

  private synthesizeVeiculoFromFlat(row: Record<string, unknown>): EntradaSaidaOutput['veiculo'] {
    const placa = this.pickString(row, 'placa', 'Placa', 'placaVeiculo', 'PlacaVeiculo');
    const tipoCargaRaw = this.pickRaw(row, 'tipoCarga', 'TipoCarga', 'tipoCargaDescricao', 'TipoCargaDescricao');
    const id = this.pickNumber(row, 'veiculoId', 'VeiculoId');

    if (!placa && tipoCargaRaw == null && id <= 0) {
      return undefined;
    }

    return {
      id: id > 0 ? id : undefined,
      placa: placa || undefined,
      tipoCarga: (tipoCargaRaw as number | string | null | undefined) ?? undefined
    };
  }

  private synthesizeMotoristaFromFlat(row: Record<string, unknown>): EntradaSaidaOutput['motorista'] {
    const nome = this.pickString(row, 'nomeMotorista', 'NomeMotorista');
    const cpf = this.pickString(row, 'cpfMotorista', 'CpfMotorista');
    const id = this.pickNumber(row, 'motoristaId', 'MotoristaId');

    if (!nome && !cpf && id <= 0) {
      return undefined;
    }

    return {
      id: id > 0 ? id : undefined,
      nome: nome || undefined,
      cpf: cpf || undefined
    };
  }

  private extractResultRecord(body: unknown): Record<string, unknown> | null {
    const raw = this.unwrap(body);
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw as Record<string, unknown>;
  }

  private pickNumber(row: Record<string, unknown>, ...keys: string[]): number {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return 0;
  }

  private pickNumberOrNull(row: Record<string, unknown>, ...keys: string[]): number | null {
    for (const key of keys) {
      if (!(key in row)) continue;
      const value = row[key];
      if (value == null || value === '') return null;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return null;
  }

  private pickString(row: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string') return value;
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
  }

  private pickStringOrNull(row: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
      const value = row[key];
      if (value == null) {
        if (key in row) return null;
        continue;
      }
      if (typeof value === 'string') return value;
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return null;
  }

  private pickRaw(row: Record<string, unknown>, ...keys: string[]): unknown {
    for (const key of keys) {
      if (row[key] != null && row[key] !== '') return row[key];
    }
    return undefined;
  }

  private pickBool(row: Record<string, unknown>, ...keys: string[]): boolean {
    for (const key of keys) {
      if (key in row) return Boolean(row[key]);
    }
    return false;
  }

  private pickTipoTarifa(raw: unknown): TipoTarifaEstacionamento | null {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number' && (raw === 1 || raw === 2)) return raw;
    const text = String(raw).trim().toLowerCase();
    if (text === '1' || text === 'hora') return 1;
    if (text === '2' || text === 'diaria' || text === 'diária') return 2;
    const n = Number(text);
    return n === 1 || n === 2 ? n : null;
  }

  private unwrap(body: unknown): unknown {
    let cur: unknown = body;
    for (let i = 0; i < 2; i++) {
      if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
      const obj = cur as Record<string, unknown>;
      if (obj['result'] != null) {
        cur = obj['result'];
        continue;
      }
      if (obj['Result'] != null) {
        cur = obj['Result'];
        continue;
      }
      break;
    }
    return cur;
  }
}
