import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../../core/services/auth.service';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { PAGAMENTOS_RELATORIO_ROUTE } from '../../faturamento-rotas';
import { FaturaService } from '../../services/fatura.service';
import { PagamentoRelatorioService } from '../../services/pagamento-relatorio.service';
import type {
  PagamentoRelatorioFiltro,
  PagamentoRelatorioItem,
  PagamentoRelatorioResumo,
} from './pagamento-relatorio.types';
import {
  PAGAMENTO_RELATORIO_FORMA_OPCOES,
  PAGAMENTO_RELATORIO_STATUS_OPCOES,
} from './pagamento-relatorio.types';

@Component({
  selector: 'app-pagamento-relatorio',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, CurrencyPipe, DatePipe],
  templateUrl: './pagamento-relatorio.component.html',
  styleUrls: ['./pagamento-relatorio.component.scss'],
})
export class PagamentoRelatorioComponent implements OnInit {
  private readonly api = inject(PagamentoRelatorioService);
  private readonly faturaApi = inject(FaturaService);
  private readonly auth = inject(AuthService);
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);

  readonly statusOpcoes = PAGAMENTO_RELATORIO_STATUS_OPCOES;
  readonly formaOpcoes = PAGAMENTO_RELATORIO_FORMA_OPCOES;

  readonly loading = signal(false);
  readonly exportando = signal(false);
  readonly jaBuscou = signal(false);
  readonly itens = signal<PagamentoRelatorioItem[]>([]);
  readonly resumo = signal<PagamentoRelatorioResumo>({
    quantidade: 0,
    valorTotal: 0,
    valorRecebido: 0,
    saldoRestante: 0,
    qtdPago: 0,
    qtdParcial: 0,
    qtdEmAberto: 0,
    qtdVencido: 0,
  });
  readonly truncado = signal(false);
  readonly limiteAplicado = signal(0);

  transportadoras: Array<{ id: number; label: string }> = [];

  dataInicial = '';
  dataFinal = '';
  transportadoraId: number | null = null;
  status: number | null = null;
  formaPagamento: number | null = null;
  numero = '';
  descricao = '';

  /**
   * Acesso só pelo `menus` do login (SessionAccessService).
   * A rota `/app/financeiro/pagamento/relatorio` precisa vir no payload.
   */
  get canVisualizar(): boolean {
    return (
      this.sessionAccess.canAccessRoute(this.router.url) ||
      this.sessionAccess.canAccessRoute(PAGAMENTOS_RELATORIO_ROUTE)
    );
  }

  ngOnInit(): void {
    this.definirPeriodoMesAtual();
    if (this.canVisualizar) {
      this.carregarTransportadoras();
    }
  }

  limparFiltros(): void {
    this.definirPeriodoMesAtual();
    this.transportadoraId = null;
    this.status = null;
    this.formaPagamento = null;
    this.numero = '';
    this.descricao = '';
  }

  buscar(): void {
    if (!this.canVisualizar) return;
    if (this.auth.needsEstacionamentoSelection()) {
      this.snack.open('Selecione o estacionamento da sessão antes de consultar.', 'Fechar', {
        duration: 4000,
      });
      return;
    }

    this.loading.set(true);
    this.api
      .buscar(this.montarFiltro())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.itens.set(res.itens);
          this.resumo.set(res.resumo);
          this.truncado.set(res.truncado);
          this.limiteAplicado.set(res.limiteAplicado);
          this.jaBuscou.set(true);
        },
        error: (err: { message?: string } | unknown) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
              ? err.message
              : 'Não foi possível carregar o relatório.';
          this.snack.open(msg, 'Fechar', { duration: 5000 });
        },
      });
  }

  imprimirPdf(): void {
    this.exportar('pdf');
  }

  exportarExcel(): void {
    this.exportar('excel');
  }

  private exportar(tipo: 'pdf' | 'excel'): void {
    if (!this.canVisualizar) return;
    if (this.auth.needsEstacionamentoSelection()) {
      this.snack.open('Selecione o estacionamento da sessão antes de exportar.', 'Fechar', {
        duration: 4000,
      });
      return;
    }

    this.exportando.set(true);
    const filtro = this.montarFiltro();
    const req$ = tipo === 'pdf' ? this.api.baixarPdf(filtro) : this.api.baixarExcel(filtro);
    const mime =
      tipo === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const ext = tipo === 'pdf' ? 'pdf' : 'xlsx';

    req$.pipe(finalize(() => this.exportando.set(false))).subscribe({
      next: (blob) => this.downloadBlob(blob, `relatorio-pagamentos.${ext}`, mime),
      error: () =>
        this.snack.open(`Falha ao gerar ${tipo.toUpperCase()}.`, 'Fechar', { duration: 5000 }),
    });
  }

  private montarFiltro(): PagamentoRelatorioFiltro {
    return {
      dataInicial: this.dataInicial || null,
      dataFinal: this.dataFinal || null,
      transportadoraId: this.transportadoraId,
      status: this.status,
      formaPagamento: this.formaPagamento,
      numero: this.numero.trim() || null,
      descricao: this.descricao.trim() || null,
    };
  }

  private carregarTransportadoras(): void {
    this.faturaApi.buscarTransportadoras({ numeroPagina: 1, tamanhoPagina: 200 }).subscribe({
      next: (lista) => {
        this.transportadoras = lista ?? [];
      },
      error: () => {
        this.transportadoras = [];
      },
    });
  }

  private definirPeriodoMesAtual(): void {
    const agora = new Date();
    const ini = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
    this.dataInicial = this.toInputDate(ini);
    this.dataFinal = this.toInputDate(fim);
  }

  private toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private downloadBlob(blob: Blob, fileName: string, mimeType: string): void {
    const file = blob.type ? blob : new Blob([blob], { type: mimeType });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
