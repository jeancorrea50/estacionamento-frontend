import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../../../core/services/auth.service';
import { FaturaService } from '../../../services/fatura.service';
import { FaturaRelatorioService } from '../../../services/fatura-relatorio.service';
import type { FaturaRelatorioFiltro, FaturaRelatorioItem, FaturaRelatorioResumo, RelatorioPeriodoCampo } from './faturamento-relatorio.types';
import {
  RELATORIO_MODALIDADE_OPCOES,
  RELATORIO_PERIODO_CAMPO_OPCOES,
  RELATORIO_STATUS_OPCOES,
  RELATORIO_TIPO_OPCOES,
} from './faturamento-relatorio.types';

@Component({
  selector: 'app-faturamento-relatorio',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, CurrencyPipe, DatePipe],
  templateUrl: './faturamento-relatorio.component.html',
  styleUrls: ['./faturamento-relatorio.component.scss'],
})
export class FaturamentoRelatorioComponent implements OnInit {
  private readonly api = inject(FaturaRelatorioService);
  private readonly faturaApi = inject(FaturaService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);

  readonly statusOpcoes = RELATORIO_STATUS_OPCOES;
  readonly modalidadeOpcoes = RELATORIO_MODALIDADE_OPCOES;
  readonly tipoOpcoes = RELATORIO_TIPO_OPCOES;
  readonly periodoCampoOpcoes = RELATORIO_PERIODO_CAMPO_OPCOES;

  readonly loading = signal(false);
  readonly exportando = signal(false);
  readonly jaBuscou = signal(false);
  readonly itens = signal<FaturaRelatorioItem[]>([]);
  readonly resumo = signal<FaturaRelatorioResumo>({
    quantidade: 0,
    valorTotal: 0,
    valorRecebido: 0,
    valorEmAberto: 0,
    qtdPago: 0,
    qtdEmAberto: 0,
    qtdVencido: 0,
    qtdCancelada: 0,
  });
  readonly truncado = signal(false);
  readonly limiteAplicado = signal(0);

  transportadoras: Array<{ id: number; label: string }> = [];

  dataInicial = '';
  dataFinal = '';
  periodoCampo: RelatorioPeriodoCampo = 'emissao';
  transportadoraId: number | null = null;
  status: number | null = null;
  modalidadeRecebimento: number | null = null;
  tipoFatura: number | null = null;
  numero = '';
  descricao = '';
  dataVencimentoInicial = '';
  dataVencimentoFinal = '';
  dataPagamentoInicial = '';
  dataPagamentoFinal = '';
  valorMinimo: number | null = null;
  valorMaximo: number | null = null;

  ngOnInit(): void {
    this.definirPeriodoMesAtual();
    this.carregarTransportadoras();
  }

  limparFiltros(): void {
    this.definirPeriodoMesAtual();
    this.periodoCampo = 'emissao';
    this.transportadoraId = null;
    this.status = null;
    this.modalidadeRecebimento = null;
    this.tipoFatura = null;
    this.numero = '';
    this.descricao = '';
    this.dataVencimentoInicial = '';
    this.dataVencimentoFinal = '';
    this.dataPagamentoInicial = '';
    this.dataPagamentoFinal = '';
    this.valorMinimo = null;
    this.valorMaximo = null;
  }

  buscar(): void {
    if (this.auth.needsEstacionamentoSelection()) {
      this.snack.open('Selecione o estacionamento da sessão antes de consultar.', 'Fechar', { duration: 4000 });
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
    if (this.auth.needsEstacionamentoSelection()) {
      this.snack.open('Selecione o estacionamento da sessão antes de exportar.', 'Fechar', { duration: 4000 });
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
      next: (blob) => this.downloadBlob(blob, `relatorio-faturamento.${ext}`, mime),
      error: () => this.snack.open(`Falha ao gerar ${tipo.toUpperCase()}.`, 'Fechar', { duration: 5000 }),
    });
  }

  private montarFiltro(): FaturaRelatorioFiltro {
    return {
      dataInicial: this.dataInicial || null,
      dataFinal: this.dataFinal || null,
      periodoCampo: this.periodoCampo,
      transportadoraId: this.transportadoraId,
      status: this.status,
      modalidadeRecebimento: this.modalidadeRecebimento,
      tipoFatura: this.tipoFatura,
      numero: this.numero.trim() || null,
      descricao: this.descricao.trim() || null,
      dataVencimentoInicial: this.dataVencimentoInicial || null,
      dataVencimentoFinal: this.dataVencimentoFinal || null,
      dataPagamentoInicial: this.dataPagamentoInicial || null,
      dataPagamentoFinal: this.dataPagamentoFinal || null,
      valorMinimo: this.valorMinimo,
      valorMaximo: this.valorMaximo,
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
