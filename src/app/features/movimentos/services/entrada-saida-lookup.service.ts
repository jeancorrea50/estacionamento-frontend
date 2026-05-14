import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
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
    return this.motoristaService.buscar({
      Termo: termo || undefined,
      TransportadoraId: transportadoraId,
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
        items: paged.items.map((item) => ({
          id: item.id,
          titulo: item.nomeFantasia || item.razaoSocial || 'Transportadora',
          subtitulo: item.cnpj ? `CNPJ: ${item.cnpj}` : undefined
        })),
        totalCount: paged.totalCount,
        numeroPagina: paged.numeroPagina ?? numeroPagina,
        tamanhoPagina: paged.tamanhoPagina ?? tamanhoPagina
      }))
    );
  }

  buscarVeiculos(termo: string, numeroPagina: number, tamanhoPagina: number): Observable<PaginatedSearchResult> {
    return this.veiculoService.buscar({
      Termo: termo || undefined,
      NumeroPagina: numeroPagina,
      TamanhoPagina: tamanhoPagina
    }).pipe(
      map((paged) => ({
        items: paged.items.map((item) => ({
          id: item.id,
          titulo: item.placa,
          campo2: item.marcaModelo || '—',
          campo3: String(item.anoModelo ?? item.anoFabricacao ?? '—'),
          campo4: item.cor || '—',
          campo5: item.ativo ? 'Sim' : 'Não'
        })),
        totalCount: paged.totalCount,
        numeroPagina: paged.numeroPagina,
        tamanhoPagina: paged.tamanhoPagina
      }))
    );
  }
}
