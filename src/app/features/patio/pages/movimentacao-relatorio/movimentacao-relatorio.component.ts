import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../../core/services/auth.service';
import { TransportadoraService } from '../../../cadastro/services/transportadora.service';
import { MovimentacaoRelatorioService } from '../../services/movimentacao-relatorio.service';
import type {
  MovimentacaoRelatorioFiltro,
  MovimentacaoRelatorioItem,
  MovimentacaoRelatorioResumo,
} from './movimentacao-relatorio.types';
import { RELATORIO_BOOL_OPCOES, RELATORIO_MOV_STATUS_OPCOES } from './movimentacao-relatorio.types';

@Component({
  selector: 'app-movimentacao-relatorio',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, DatePipe],
  templateUrl: './movimentacao-relatorio.component.html',
  styleUrls: ['./movimentacao-relatorio.component.scss'],
})
export class MovimentacaoRelatorioComponent implements OnInit {
  private readonly api = inject(MovimentacaoRelatorioService);
  private readonly transportadoraApi = inject(TransportadoraService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);

  readonly statusOpcoes = RELATORIO_MOV_STATUS_OPCOES;
  readonly boolOpcoes = RELATORIO_BOOL_OPCOES;

  readonly loading = signal(false);
  readonly exportando = signal(false);
  readonly jaBuscou = signal(false);
  readonly itens = signal<MovimentacaoRelatorioItem[]>([]);
  readonly resumo = signal<MovimentacaoRelatorioResumo>({
    quantidade: 0,
    qtdEntrada: 0,
    qtdSaida: 0,
    qtdSuspenso: 0,
    qtdAgendado: 0,
    qtdCancelado: 0,
    qtdFaturado: 0,
    qtdExcedente: 0,
  });
  readonly truncado = signal(false);
  readonly limiteAplicado = signal(0);

  transportadoras: Array<{ id: number; label: string }> = [];

  dataInicial = '';
  dataFinal = '';
  dataSaidaInicial = '';
  dataSaidaFinal = '';
  placa = '';
  transportadoraId: number | null = null;
  status: number | null = null;
  faturado: boolean | null = null;
  ehExcedente: boolean | null = null;
  avulso: boolean | null = null;
  descricao = '';

  ngOnInit(): void {
    this.definirPeriodoMesAtual();
    this.carregarTransportadoras();
  }

  limparFiltros(): void {
    this.definirPeriodoMesAtual();
    this.dataSaidaInicial = '';
    this.dataSaidaFinal = '';
    this.placa = '';
    this.transportadoraId = null;
    this.status = null;
    this.faturado = null;
    this.ehExcedente = null;
    this.avulso = null;
    this.descricao = '';
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
      next: (blob) => this.downloadBlob(blob, `relatorio-movimentacoes.${ext}`, mime),
      error: () => this.snack.open(`Falha ao gerar ${tipo.toUpperCase()}.`, 'Fechar', { duration: 5000 }),
    });
  }

  private montarFiltro(): MovimentacaoRelatorioFiltro {
    return {
      dataInicial: this.dataInicial || null,
      dataFinal: this.dataFinal || null,
      dataSaidaInicial: this.dataSaidaInicial || null,
      dataSaidaFinal: this.dataSaidaFinal || null,
      placa: this.placa.trim() || null,
      transportadoraId: this.transportadoraId,
      status: this.status,
      faturado: this.faturado,
      ehExcedente: this.ehExcedente,
      avulso: this.avulso,
      descricao: this.descricao.trim() || null,
    };
  }

  private carregarTransportadoras(): void {
    this.transportadoraApi.listarTransportadoras({ NumeroPagina: 1, TamanhoPagina: 200 }).subscribe({
      next: (res) => {
        this.transportadoras = (res.items ?? []).map((t) => ({
          id: t.id,
          label: t.nomeFantasia || t.razaoSocial || `Transportadora #${t.id}`,
        }));
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
