import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { MotoristaService } from '../../cadastro/services/motorista.service';
import { TransportadoraService } from '../../cadastro/services/transportadora.service';
import { VeiculoService } from '../../cadastro/services/veiculo.service';
import { PaginatedSearchResult } from '../../../shared/models/paginated-search.models';

@Injectable({ providedIn: 'root' })
export class EntradaSaidaLookupService {
  private readonly motoristaService = inject(MotoristaService);
  private readonly transportadoraService = inject(TransportadoraService);
  private readonly veiculoService = inject(VeiculoService);

  buscarMotoristas(
    termo: string,
    numeroPagina: number,
    tamanhoPagina: number,
    transportadoraId?: number
  ): Observable<PaginatedSearchResult> {
    const tid = Number(transportadoraId);
    if (!Number.isFinite(tid) || tid <= 0) {
      return of({ items: [], totalCount: 0, numeroPagina, tamanhoPagina });
    }

    return this.motoristaService.buscar({
      Termo: termo || undefined,
      TransportadoraId: tid,
      NumeroPagina: numeroPagina,
      TamanhoPagina: tamanhoPagina
    }).pipe(
      map((paged) => ({
        items: paged.items.map((item) => ({
          id: item.id,
          titulo: item.nomeCompleto,
          campo2: item.cpf || '—',
          campo3: item.cnh || '—'
        })),
        totalCount: paged.totalCount,
        numeroPagina: paged.numeroPagina,
        tamanhoPagina: paged.tamanhoPagina
      }))
    );
  }

  buscarTransportadoras(termo: string, numeroPagina: number, tamanhoPagina: number): Observable<PaginatedSearchResult> {
    return this.transportadoraService.listarTransportadoras({
      Termo: termo || undefined,
      NumeroPagina: numeroPagina,
      TamanhoPagina: tamanhoPagina
    }).pipe(
      map((paged) => ({
        items: paged.items.map((item) => {
          const fantasia = (item.nomeFantasia || '').trim();
          const razao = (item.razaoSocial || '').trim();
          const cnpj = (item.cnpj || '').trim();
          return {
            id: item.id,
            titulo: fantasia || razao || 'Transportadora',
            campo2: cnpj || '—',
            campo3: fantasia && razao && fantasia !== razao ? razao : razao || fantasia || '—',
            subtitulo: cnpj ? `CNPJ: ${cnpj}` : undefined,
          };
        }),
        totalCount: paged.totalCount,
        numeroPagina: paged.numeroPagina ?? numeroPagina,
        tamanhoPagina: paged.tamanhoPagina ?? tamanhoPagina
      }))
    );
  }

  buscarVeiculos(
    termo: string,
    numeroPagina: number,
    tamanhoPagina: number,
    transportadoraId?: number
  ): Observable<PaginatedSearchResult> {
    const tid = Number(transportadoraId);
    if (!Number.isFinite(tid) || tid <= 0) {
      return of({ items: [], totalCount: 0, numeroPagina, tamanhoPagina });
    }

    return this.veiculoService.buscar({
      Termo: termo || undefined,
      TransportadoraId: tid,
      NumeroPagina: numeroPagina,
      TamanhoPagina: tamanhoPagina
    }).pipe(
      map((paged) => ({
        items: paged.items.map((item) => {
          const principal =
            item.motoristas?.find((m) => m.principal === true) ?? item.motoristas?.[0];
          return {
            id: item.id,
            titulo: item.placa,
            campo2: item.marcaModelo || '—',
            campo3: String(item.anoModelo ?? item.anoFabricacao ?? '—'),
            campo4: item.cor || '—',
            campo5: item.ativo ? 'Sim' : 'Não',
            meta:
              principal && principal.id > 0
                ? {
                    motoristaId: principal.id,
                    motoristaNome: principal.nome || null,
                    motoristaCpf: principal.cpf || null,
                  }
                : undefined,
          };
        }),
        totalCount: paged.totalCount,
        numeroPagina: paged.numeroPagina,
        tamanhoPagina: paged.tamanhoPagina
      }))
    );
  }
}
