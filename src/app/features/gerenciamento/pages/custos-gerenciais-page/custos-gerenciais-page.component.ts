import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { finalize } from 'rxjs/operators';
import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  TIPO_LANCAMENTO_OPCOES,
  type CategoriaCusto,
  type DashboardCusto,
  type LancamentoCusto,
  type LancamentoCustoInput,
  type TipoLancamentoCusto,
} from '../../models/custo-gerencial.models';
import { CustoGerencialApiService } from '../../services/custo-gerencial-api.service';

type AbaCusto = 'visao' | 'lancamentos';

@Component({
  selector: 'app-custos-gerenciais-page',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, CurrencyPipe, DatePipe],
  templateUrl: './custos-gerenciais-page.component.html',
  styleUrls: ['./custos-gerenciais-page.component.scss'],
})
export class CustosGerenciaisPageComponent implements OnInit {
  private readonly api = inject(CustoGerencialApiService);
  private readonly toast = inject(ToastService);

  readonly tipos = TIPO_LANCAMENTO_OPCOES;
  readonly aba = signal<AbaCusto>('visao');
  readonly loadingDash = signal(false);
  readonly loadingLista = signal(false);
  readonly salvando = signal(false);
  readonly categorias = signal<CategoriaCusto[]>([]);
  readonly dashboard = signal<DashboardCusto | null>(null);
  readonly lancamentos = signal<LancamentoCusto[]>([]);
  readonly totalCount = signal(0);
  readonly numeroPagina = signal(1);
  readonly tamanhoPagina = 25;
  readonly anoFiltro = signal(new Date().getFullYear());
  readonly tipoDashFiltro = signal<TipoLancamentoCusto | null>(null);
  readonly termo = signal('');
  readonly tipoListaFiltro = signal<TipoLancamentoCusto | null>(null);
  readonly modalAberto = signal(false);
  readonly editId = signal<number | null>(null);

  form: LancamentoCustoInput = this.emptyForm();

  readonly anosOpcoes = computed(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => y - i);
  });

  readonly chartMensalSeries = signal<ApexAxisChartSeries>([]);
  readonly chartMensalCategories = signal<string[]>([]);
  readonly chartAnualSeries = signal<ApexAxisChartSeries>([]);
  readonly chartAnualCategories = signal<string[]>([]);
  readonly chartCategoriaSeries = signal<ApexNonAxisChartSeries>([]);
  readonly chartCategoriaLabels = signal<string[]>([]);

  readonly chartLine: ApexChart = {
    type: 'area',
    height: 300,
    toolbar: { show: false },
    fontFamily: 'inherit',
  };
  readonly chartBar: ApexChart = {
    type: 'bar',
    height: 300,
    toolbar: { show: false },
    fontFamily: 'inherit',
  };
  readonly chartPie: ApexChart = {
    type: 'donut',
    height: 300,
    fontFamily: 'inherit',
  };
  readonly stroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly fill: ApexFill = { type: 'gradient', gradient: { opacityFrom: 0.45, opacityTo: 0.05 } };
  readonly dataLabels: ApexDataLabels = { enabled: false };
  readonly legend: ApexLegend = { position: 'bottom' };
  readonly tooltip: ApexTooltip = { y: { formatter: (v) => this.formatMoney(v) } };
  readonly plotBars: ApexPlotOptions = { bar: { borderRadius: 4, columnWidth: '55%' } };
  readonly yaxis: ApexYAxis = {
    labels: { formatter: (v) => this.formatMoney(Number(v)) },
  };

  ngOnInit(): void {
    this.api.listarCategorias().subscribe({
      next: (c) => this.categorias.set(c),
      error: () => this.toast.error('Não foi possível carregar as categorias.'),
    });
    this.carregarDashboard();
    this.carregarLancamentos();
  }

  setAba(aba: AbaCusto): void {
    this.aba.set(aba);
    if (aba === 'visao') this.carregarDashboard();
    else this.carregarLancamentos();
  }

  carregarDashboard(): void {
    this.loadingDash.set(true);
    this.api
      .dashboard(this.anoFiltro(), this.tipoDashFiltro())
      .pipe(finalize(() => this.loadingDash.set(false)))
      .subscribe({
        next: (d) => {
          this.dashboard.set(d);
          this.chartMensalCategories.set(d.mensal.map((m) => m.mesLabel));
          this.chartMensalSeries.set([
            { name: 'Despesa', data: d.mensal.map((m) => m.despesa) },
            { name: 'Investimento', data: d.mensal.map((m) => m.investimento) },
            { name: 'Receita', data: d.mensal.map((m) => m.receita) },
          ]);
          this.chartAnualCategories.set(d.anual.map((a) => String(a.ano)));
          this.chartAnualSeries.set([
            { name: 'Despesa', data: d.anual.map((a) => a.despesa) },
            { name: 'Investimento', data: d.anual.map((a) => a.investimento) },
            { name: 'Receita', data: d.anual.map((a) => a.receita) },
          ]);
          this.chartCategoriaLabels.set(d.porCategoria.map((c) => c.categoriaNome));
          this.chartCategoriaSeries.set(d.porCategoria.map((c) => c.valor));
        },
        error: () => this.toast.error('Não foi possível carregar o dashboard de custos.'),
      });
  }

  carregarLancamentos(): void {
    this.loadingLista.set(true);
    this.api
      .buscarLancamentos({
        termo: this.termo(),
        tipo: this.tipoListaFiltro(),
        numeroPagina: this.numeroPagina(),
        tamanhoPagina: this.tamanhoPagina,
      })
      .pipe(finalize(() => this.loadingLista.set(false)))
      .subscribe({
        next: (p) => {
          this.lancamentos.set(p.results ?? []);
          this.totalCount.set(p.rowCount ?? 0);
        },
        error: () => this.toast.error('Não foi possível carregar os lançamentos.'),
      });
  }

  onBuscarLista(): void {
    this.numeroPagina.set(1);
    this.carregarLancamentos();
  }

  abrirNovo(): void {
    this.editId.set(null);
    this.form = this.emptyForm();
    this.modalAberto.set(true);
  }

  abrirEditar(item: LancamentoCusto): void {
    this.editId.set(item.id);
    this.form = {
      tipo: item.tipo,
      categoriaId: item.categoriaId,
      descricao: item.descricao,
      valor: item.valor,
      dataCompetencia: item.dataCompetencia?.slice(0, 10) ?? '',
      dataPagamento: item.dataPagamento ? item.dataPagamento.slice(0, 10) : null,
      observacao: item.observacao ?? null,
    };
    this.modalAberto.set(true);
  }

  fecharModal(): void {
    this.modalAberto.set(false);
  }

  salvar(): void {
    if (!this.form.descricao?.trim() || !this.form.categoriaId || this.form.valor <= 0 || !this.form.dataCompetencia) {
      this.toast.warning('Preencha descrição, categoria, valor e data de competência.');
      return;
    }
    this.salvando.set(true);
    const payload: LancamentoCustoInput = {
      ...this.form,
      descricao: this.form.descricao.trim(),
      observacao: this.form.observacao?.trim() || null,
      dataPagamento: this.form.dataPagamento || null,
    };
    const id = this.editId();
    const req$ = id ? this.api.alterar(id, payload) : this.api.criar(payload);
    req$.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: () => {
        this.toast.success(id ? 'Lançamento atualizado.' : 'Lançamento criado.');
        this.modalAberto.set(false);
        this.carregarLancamentos();
        this.carregarDashboard();
      },
      error: (err) =>
        this.toast.error(err?.error?.message ?? err?.message ?? 'Falha ao salvar lançamento.'),
    });
  }

  excluir(item: LancamentoCusto): void {
    if (!confirm(`Excluir o lançamento "${item.descricao}"?`)) return;
    this.api.excluir(item.id).subscribe({
      next: () => {
        this.toast.success('Lançamento excluído.');
        this.carregarLancamentos();
        this.carregarDashboard();
      },
      error: () => this.toast.error('Falha ao excluir lançamento.'),
    });
  }

  xaxisFrom(cats: string[]): ApexXAxis {
    return { categories: cats };
  }

  private emptyForm(): LancamentoCustoInput {
    const hoje = new Date().toISOString().slice(0, 10);
    return {
      tipo: 1,
      categoriaId: 0,
      descricao: '',
      valor: 0,
      dataCompetencia: hoje,
      dataPagamento: null,
      observacao: null,
    };
  }

  private formatMoney(v: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  }
}
