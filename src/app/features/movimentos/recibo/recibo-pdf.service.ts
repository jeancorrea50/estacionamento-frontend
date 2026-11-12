import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { EstacionamentoService } from '../../cadastro/services/estacionamento.service';
import { EntradaSaidaService } from '../entrada-saida/entrada-saida.service';
import { ModoRecibo } from '../models/entrada-saida.models';
import {
  calcularPermanenciaMinutos,
  descricaoCobrancaRecibo,
  escolherEnderecoPrincipal,
  formatarCnpjRecibo,
  formatarPlacaRecibo,
  isModalidadeFaturamento,
  minutosSuspensaoRecibo,
  montarLinhasEndereco,
  rotuloCoberturaRecibo
} from './recibo-pdf.helpers';
import { criarPdfReciboTermico } from './recibo-pdf';
import type { ReciboGerarOpts, ReciboPdfDados } from './recibo-pdf.types';

/**
 * Monta o recibo térmico 80mm no frontend a partir dos contratos já usados
 * (GET EntradaSaida/{id}, GET valor-estacionamento, sessão + GET Estacionamento/{id}).
 * Não chama o blob legado `/recibo` — o layout fica sob controle do front.
 */
@Injectable({ providedIn: 'root' })
export class ReciboPdfService {
  private readonly entradaSaida = inject(EntradaSaidaService);
  private readonly estacionamento = inject(EstacionamentoService);
  private readonly auth = inject(AuthService);

  gerar(opts: ReciboGerarOpts): Observable<Blob> {
    if (!opts.id || opts.id <= 0) {
      return throwError(() => new Error('Id do movimento inválido para gerar o recibo.'));
    }

    const sessao = this.auth.getSessionEstacionamento();
    const estacionamentoId =
      (sessao?.id != null && sessao.id > 0 ? sessao.id : null) ??
      this.auth.resolveEstacionamentoId();
    const codExportacao = sessao?.codExportacao?.trim() || null;

    return forkJoin({
      detalhe: this.entradaSaida.getById(opts.id).pipe(catchError(() => of(null))),
      patio:
        estacionamentoId != null && estacionamentoId > 0
          ? this.estacionamento
              .obterPorId(estacionamentoId, codExportacao)
              .pipe(catchError(() => of(null)))
          : of(null)
    }).pipe(
      switchMap(({ detalhe, patio }) => {
        if (!detalhe) {
          return throwError(
            () => new Error('Não foi possível carregar os dados do movimento para o recibo.')
          );
        }

        const ehExcedente = detalhe.ehExcedente === true || opts.ehExcedente === true;
        const acordoCobrancaId =
          detalhe.acordoCobrancaId != null && detalhe.acordoCobrancaId > 0
            ? detalhe.acordoCobrancaId
            : opts.acordoCobrancaId != null && opts.acordoCobrancaId > 0
              ? opts.acordoCobrancaId
              : null;
        const avulso = opts.avulso ?? null;

        const ocultarValores = isModalidadeFaturamento({
          tipoCobranca: opts.tipoCobranca,
          avulso,
          acordoCobrancaId,
          ehExcedente
        });

        if (
          opts.modo === ModoRecibo.Saida &&
          !ocultarValores &&
          (opts.valor == null || !Number.isFinite(opts.valor))
        ) {
          return throwError(
            () => new Error('Valor do recibo é obrigatório no modo saída avulso.')
          );
        }

        const endereco = escolherEnderecoPrincipal(patio?.enderecos);
        const { linha1, linha2 } = montarLinhasEndereco(endereco);

        const nomePatio =
          patio?.pessoa?.nomeFantasia?.trim() ||
          patio?.pessoa?.nomeRazaoSocial?.trim() ||
          sessao?.nome?.trim() ||
          sessao?.razaoSocial?.trim() ||
          'Estacionamento';

        const cnpj =
          formatarCnpjRecibo(patio?.pessoa?.cnpj) ||
          formatarCnpjRecibo(sessao?.cnpj) ||
          null;

        const placaApi = detalhe.veiculo?.placa;
        const placa = formatarPlacaRecibo(placaApi || opts.placa);

        const dataHoraEntrada = detalhe.dataHoraEntrada ?? null;
        const dataHoraSaida = detalhe.dataHoraSaida ?? null;
        const permanenciaMinutos = calcularPermanenciaMinutos({
          tempoPermanenciaMinutos: detalhe.tempoPermanenciaMinutos,
          dataHoraEntrada,
          dataHoraSaida
        });

        const cobertura = rotuloCoberturaRecibo({ ehExcedente, acordoCobrancaId });
        const modalidade = ocultarValores
          ? 'Faturamento'
          : opts.tipoCobranca?.trim() || (avulso === true ? 'Avulso' : null);

        const usuario =
          (opts.modo === ModoRecibo.Saida
            ? detalhe.usuarioFinalizacaoNome?.trim()
            : detalhe.usuarioRegistroEntradaNome?.trim()) ||
          detalhe.usuarioRegistroEntradaNome?.trim() ||
          this.auth.getLoggedUser()?.username?.trim() ||
          null;

        const dados: ReciboPdfDados = {
          modo: opts.modo,
          ticketId: opts.id,
          placa,
          estacionamentoNome: nomePatio,
          cnpj,
          enderecoLinha1: linha1,
          enderecoLinha2: linha2,
          dataHoraEntrada,
          dataHoraSaida,
          permanenciaMinutos,
          modalidade,
          cobertura,
          ehExcedente,
          suspensaoMinutos: minutosSuspensaoRecibo(detalhe.tempoTotalSuspensaoMinutos),
          cobrancaDescricao: ocultarValores ? null : descricaoCobrancaRecibo(opts.tipoTarifa),
          valorTotal:
            !ocultarValores && opts.modo === ModoRecibo.Saida && opts.valor != null
              ? Math.round(Number(opts.valor) * 100) / 100
              : null,
          ocultarValores,
          usuarioResponsavel: usuario
        };

        return of(criarPdfReciboTermico(dados).output('blob'));
      })
    );
  }
}
