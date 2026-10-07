import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { EntradaSaidaService } from './entrada-saida.service';

/**
 * Mesmo contrato de EntradaSaida, apontando para `/api/Movimento`
 * (tela `/app/patio/movimentacoes`, permissões `movimentacoes.*`).
 */
@Injectable({ providedIn: 'root' })
export class MovimentoService extends EntradaSaidaService {
  protected override readonly apiRoot = `${environment.API_BASE_URL}/Movimento`;
}
