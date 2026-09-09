import { Injectable, inject } from '@angular/core';
import { Observable, of, map, catchError } from 'rxjs';
import { VeiculoService } from '../../cadastro/services/veiculo.service';

/** Dados do veículo/transportadora vindos do cadastro (backend). */
export interface DadosVeiculoCadastro {
  transportadora: string;
  modeloVeiculo: string;
  anoFabricacao: string;
  quantidadeEixos: string;
}

/** Lookup por placa via GET /api/Veiculo/por-placa/{placa}. */
@Injectable({ providedIn: 'root' })
export class PlacaTransportadoraLookupService {
  private readonly veiculoService = inject(VeiculoService);

  /**
   * Busca dados do veículo/transportadora pela placa.
   * Se houver cadastro, retorna as informações; se não, retorna null.
   */
  getDadosVeiculoPorPlaca(placa: string): Observable<DadosVeiculoCadastro | null> {
    const p = (placa || '').replace(/\s/g, '').trim().toUpperCase();
    if (!p) return of(null);
    return this.veiculoService.obterPorPlaca(p).pipe(
      map((agg) => {
        if (!agg) return null;
        const modelo =
          [agg.veiculoMarca, agg.veiculoModelo].filter((x) => !!String(x ?? '').trim()).join(' / ') ||
          agg.veiculoModelo ||
          '';
        return {
          transportadora:
            agg.transportadoraNomeFantasia?.trim() ||
            agg.transportadoraNome?.trim() ||
            agg.transportadoraRazaoSocial?.trim() ||
            '—',
          modeloVeiculo: modelo,
          anoFabricacao: agg.veiculoAno ?? '',
          quantidadeEixos: ''
        } satisfies DadosVeiculoCadastro;
      }),
      catchError(() => of(null))
    );
  }
}
