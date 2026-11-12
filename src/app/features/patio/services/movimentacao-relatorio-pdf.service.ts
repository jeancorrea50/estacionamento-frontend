import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { EstacionamentoConfiguracaoService } from '../../configuracoes/services/estacionamento-configuracao.service';
import {
  criarPdfMovimentacoes,
  formatarDataFiltro,
  resolverTransportadoraEscopo,
} from '../pages/movimentacao-relatorio/movimentacao-relatorio-pdf';
import type { MovimentacaoRelatorioFiltro } from '../pages/movimentacao-relatorio/movimentacao-relatorio.types';
import { MovimentacaoRelatorioService } from './movimentacao-relatorio.service';

const LIMITE_EXPORTACAO = 5000;

export interface MovimentacaoRelatorioPdfResultado {
  blob: Blob;
  truncado: boolean;
  limiteAplicado: number;
}

@Injectable({ providedIn: 'root' })
export class MovimentacaoRelatorioPdfService {
  private readonly api = inject(MovimentacaoRelatorioService);
  private readonly auth = inject(AuthService);
  private readonly config = inject(EstacionamentoConfiguracaoService);

  /**
   * Gera o PDF com o GET `/api/MovimentacaoRelatorio` (não usa o PDF do backend).
   * O limite explícito pede o conjunto do filtro, não a página da tela.
   */
  gerar(
    filtro: MovimentacaoRelatorioFiltro,
    filtrosAplicados: string[],
    timeZoneId?: string | null
  ): Observable<MovimentacaoRelatorioPdfResultado> {
    const estacionamentoId = filtro.estacionamentoId ?? this.auth.resolveEstacionamentoId();
    const consulta: MovimentacaoRelatorioFiltro = {
      ...filtro,
      estacionamentoId: estacionamentoId != null && estacionamentoId > 0 ? estacionamentoId : null,
      limite: filtro.limite != null && filtro.limite > 0 ? filtro.limite : LIMITE_EXPORTACAO,
    };
    const fuso$ =
      timeZoneId !== undefined
        ? of(timeZoneId)
        : this.config.obterAtual().pipe(
            map((atual) => atual?.timeZoneId?.trim() || null),
            catchError(() => of(null))
          );

    return forkJoin({
      relatorio: this.api.buscar(consulta),
      timeZoneId: fuso$,
    }).pipe(
      map(({ relatorio, timeZoneId: fuso }) => {
        const sessao = this.auth.getSessionEstacionamento();
        const transportadoraEscopo = resolverTransportadoraEscopo(relatorio.itens);
        const doc = criarPdfMovimentacoes({
          estacionamentoNome:
            sessao?.razaoSocial?.trim() || sessao?.nome?.trim() || 'Estacionamento',
          estacionamentoCnpj: sessao?.cnpj?.trim() || null,
          transportadoraEscopo,
          timeZoneId: fuso,
          periodoEntrada: periodo(consulta.dataInicial, consulta.dataFinal),
          periodoSaida:
            consulta.dataSaidaInicial || consulta.dataSaidaFinal
              ? periodo(consulta.dataSaidaInicial, consulta.dataSaidaFinal)
              : null,
          filtrosAplicados,
          resumo: relatorio.resumo,
          itens: relatorio.itens,
          truncado: relatorio.truncado,
          limiteAplicado: relatorio.limiteAplicado,
          emitidoEm: new Date(),
        });
        return {
          blob: doc.output('blob'),
          truncado: relatorio.truncado,
          limiteAplicado: relatorio.limiteAplicado,
        };
      })
    );
  }
}

function periodo(inicio: string | null | undefined, fim: string | null | undefined): string {
  if (!inicio && !fim) return 'Não informado';
  return `${formatarDataFiltro(inicio)} a ${formatarDataFiltro(fim)}`;
}
