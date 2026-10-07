import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';

import { TransportadoraRelatorioService } from '../../services/transportadora-relatorio.service';
import type {
  TransportadoraRelatorioFiltro,
  TransportadoraRelatorioItem,
  TransportadoraRelatorioResumo,
} from './transportadora-relatorio.types';
import { RELATORIO_ATIVO_OPCOES } from './transportadora-relatorio.types';

@Component({
  selector: 'app-transportadora-relatorio',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, DatePipe],
  templateUrl: './transportadora-relatorio.component.html',
  styleUrls: ['./transportadora-relatorio.component.scss'],
})
export class TransportadoraRelatorioComponent implements OnInit {
  private readonly api = inject(TransportadoraRelatorioService);
  private readonly snack = inject(MatSnackBar);

  readonly ativoOpcoes = RELATORIO_ATIVO_OPCOES;

  readonly loading = signal(false);
  readonly exportando = signal(false);
  readonly jaBuscou = signal(false);
  readonly itens = signal<TransportadoraRelatorioItem[]>([]);
  readonly resumo = signal<TransportadoraRelatorioResumo>({
    quantidade: 0,
    qtdAtivas: 0,
    qtdInativas: 0,
    totalVeiculos: 0,
  });
  readonly truncado = signal(false);
  readonly limiteAplicado = signal(0);

  dataInicial = '';
  dataFinal = '';
  descricao = '';
  cnpj = '';
  ativo: boolean | null = null;
  quantidadeVeiculosMin: number | null = null;
  quantidadeVeiculosMax: number | null = null;

  ngOnInit(): void {
    this.definirPeriodoMesAtual();
  }

  limparFiltros(): void {
    this.definirPeriodoMesAtual();
    this.descricao = '';
    this.cnpj = '';
    this.ativo = null;
    this.quantidadeVeiculosMin = null;
    this.quantidadeVeiculosMax = null;
  }

  buscar(): void {
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
    this.exportando.set(true);
    const filtro = this.montarFiltro();
    const req$ = tipo === 'pdf' ? this.api.baixarPdf(filtro) : this.api.baixarExcel(filtro);
    const mime =
      tipo === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const ext = tipo === 'pdf' ? 'pdf' : 'xlsx';

    req$.pipe(finalize(() => this.exportando.set(false))).subscribe({
      next: (blob) => this.downloadBlob(blob, `relatorio-transportadoras.${ext}`, mime),
      error: () => this.snack.open(`Falha ao gerar ${tipo.toUpperCase()}.`, 'Fechar', { duration: 5000 }),
    });
  }

  private montarFiltro(): TransportadoraRelatorioFiltro {
    return {
      dataInicial: this.dataInicial || null,
      dataFinal: this.dataFinal || null,
      descricao: this.descricao.trim() || null,
      cnpj: this.cnpj.replace(/\D/g, '') || null,
      ativo: this.ativo,
      quantidadeVeiculosMin: this.quantidadeVeiculosMin,
      quantidadeVeiculosMax: this.quantidadeVeiculosMax,
    };
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
