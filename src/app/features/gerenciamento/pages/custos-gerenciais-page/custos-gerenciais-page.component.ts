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
  type CentroCusto,
  type CentroCustoInput,
  type DashboardCusto,
  type HistoricoLancamentoCusto,
  type LancamentoCusto,
  type LancamentoCustoInput,
  type TipoLancamentoCusto,
} from '../../models/custo-gerencial.models';
import { CustoGerencialApiService } from '../../services/custo-gerencial-api.service';

type AbaCusto = 'visao' | 'lancamentos' | 'centros';

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
  readonly loadingCentros = signal(false);
  readonly loadingHistorico = signal(false);
  readonly salvando = signal(false);
  readonly salvandoCentro = signal(false);
  readonly categorias = signal<CategoriaCusto[]>([]);
  readonly centros = signal<CentroCusto[]>([]);
  readonly dashboard = signal<DashboardCusto | null>(null);
  readonly lancamentos = signal<LancamentoCusto[]>([]);
  readonly totalCount = signal(0);
  readonly numeroPagina = signal(1);
  readonly tamanhoPagina = 25;
  readonly anoFiltro = signal(new Date().getFullYear());
  readonly tipoDashFiltro = signal<TipoLancamentoCusto | null>(null);
  readonly centroDashFiltro = signal<number | null>(null);
  readonly termo = signal('');
  readonly tipoListaFiltro = signal<TipoLancamentoCusto | null>(null);
  readonly centroListaFiltro = signal<number | null>(null);
  readonly modalAberto = signal(false);
  readonly modalCentroAberto = signal(false);
  readonly modalHistoricoAberto = signal(false);
  readonly editId = signal<number | null>(null);
  readonly editCentroId = signal<number | null>(null);
  readonly historicoTitulo = signal('');
  readonly historicoItens = signal<HistoricoLancamentoCusto[]>([]);

  /** Auditoria em linhas de tabela: antigo → novo (id/data ASC). */
  readonly historicoLinhas = computed(() => {
    const ordenados = [...this.historicoItens()].sort((a, b) => {
      const byId = (a.id ?? 0) - (b.id ?? 0);
      if (byId !== 0) return byId;
      return new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime();
    });

    return ordenados.flatMap((ev) => {
      const origem = Array.isArray(ev.alteracoes) ? ev.alteracoes : [];
      const alterados = origem.filter((a) => a.alterado);
      const camposBase =
        ev.operacao === 2 && alterados.length > 0 ? alterados : origem;
      const campos = camposBase.length
        ? [...camposBase].sort((a, b) => a.campo.localeCompare(b.campo, 'pt-BR'))
        : [{ campo: '—', de: null, para: null, alterado: false }];

      return campos.map((campo, idx) => {
        const de = (campo.de ?? '').trim();
        const para = (campo.para ?? '').trim();
        return {
          key: `${ev.id}-${campo.campo}-${idx}`,
          eventoId: ev.id,
          dataHora: ev.dataHora,
          operacao: ev.operacao,
          operacaoLabel: ev.operacaoLabel,
          usuarioNome: (ev.usuarioNome || '').trim() || '—',
          campo: campo.campo,
          de: de || '—',
          para: para || '—',
          alterado: !!campo.alterado,
          primeiraDoEvento: idx === 0,
        };
      });
    });
  });

  form: LancamentoCustoInput = this.emptyForm();
  formCentro: CentroCustoInput = { codigo: '', nome: '' };

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
    this.carregarCentros();
    this.carregarDashboard();
    this.carregarLancamentos();
  }

  setAba(aba: AbaCusto): void {
    this.aba.set(aba);
    if (aba === 'visao') this.carregarDashboard();
    else if (aba === 'lancamentos') this.carregarLancamentos();
    else this.carregarCentros(true);
  }

  carregarCentros(incluirInativos = false): void {
    this.loadingCentros.set(true);
    this.api
      .listarCentros(incluirInativos)
      .pipe(finalize(() => this.loadingCentros.set(false)))
      .subscribe({
        next: (c) => this.centros.set(c),
        error: () => this.toast.error('Não foi possível carregar os centros de custo.'),
      });
  }

  carregarDashboard(): void {
    this.loadingDash.set(true);
    this.api
      .dashboard(this.anoFiltro(), this.tipoDashFiltro(), this.centroDashFiltro())
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
        centroCustoId: this.centroListaFiltro(),
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
    this.fecharTodosModais();
    this.editId.set(null);
    this.form = this.emptyForm();
    this.modalAberto.set(true);
  }

  abrirEditar(item: LancamentoCusto): void {
    this.fecharTodosModais();
    this.editId.set(item.id);
    this.form = {
      tipo: item.tipo,
      categoriaId: item.categoriaId,
      centroCustoId: item.centroCustoId,
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

  abrirNovoCentro(): void {
    this.fecharTodosModais();
    this.editCentroId.set(null);
    this.formCentro = { codigo: '', nome: '' };
    this.modalCentroAberto.set(true);
  }

  abrirEditarCentro(item: CentroCusto): void {
    this.fecharTodosModais();
    this.editCentroId.set(item.id);
    this.formCentro = { codigo: item.codigo, nome: item.nome };
    this.modalCentroAberto.set(true);
  }

  fecharModalCentro(): void {
    this.modalCentroAberto.set(false);
  }

  salvarCentro(): void {
    if (!this.formCentro.codigo?.trim() || !this.formCentro.nome?.trim()) {
      this.toast.warning('Informe código e nome do centro.');
      return;
    }
    this.salvandoCentro.set(true);
    const payload: CentroCustoInput = {
      codigo: this.formCentro.codigo.trim(),
      nome: this.formCentro.nome.trim(),
    };
    const id = this.editCentroId();
    const req$ = id ? this.api.alterarCentro(id, payload) : this.api.criarCentro(payload);
    req$.pipe(finalize(() => this.salvandoCentro.set(false))).subscribe({
      next: () => {
        this.toast.success(id ? 'Centro atualizado.' : 'Centro criado.');
        this.modalCentroAberto.set(false);
        this.carregarCentros(this.aba() === 'centros');
      },
      error: (err) =>
        this.toast.error(err?.error?.message ?? err?.message ?? 'Falha ao salvar centro de custo.'),
    });
  }

  excluirCentro(item: CentroCusto): void {
    if (!confirm(`Excluir o centro "${item.nome}"?`)) return;
    this.api.excluirCentro(item.id).subscribe({
      next: () => {
        this.toast.success('Centro excluído.');
        this.carregarCentros(true);
      },
      error: (err) =>
        this.toast.error(err?.error?.message ?? err?.message ?? 'Falha ao excluir centro de custo.'),
    });
  }

  abrirHistorico(item: LancamentoCusto): void {
    this.fecharTodosModais();
    this.historicoTitulo.set(item.descricao);
    this.historicoItens.set([]);
    this.modalHistoricoAberto.set(true);
    this.loadingHistorico.set(true);
    this.api
      .historico(item.id)
      .pipe(finalize(() => this.loadingHistorico.set(false)))
      .subscribe({
        next: (h) => this.historicoItens.set(Array.isArray(h) ? h : []),
        error: () => this.toast.error('Não foi possível carregar o histórico.'),
      });
  }

  fecharHistorico(): void {
    this.modalHistoricoAberto.set(false);
  }

  operacaoClass(operacao: HistoricoLancamentoCusto['operacao']): string {
    switch (operacao) {
      case 1:
        return 'hist-op--create';
      case 2:
        return 'hist-op--update';
      case 3:
        return 'hist-op--delete';
      default:
        return 'hist-op--unknown';
    }
  }

  salvar(): void {
    if (
      !this.form.descricao?.trim() ||
      !this.form.categoriaId ||
      !this.form.centroCustoId ||
      this.form.valor <= 0 ||
      !this.form.dataCompetencia
    ) {
      this.toast.warning('Preencha descrição, categoria, centro, valor e data de competência.');
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

  xaxisFrom(cats: string[]): ApexXAxis {
    return { categories: cats };
  }

  private fecharTodosModais(): void {
    this.modalAberto.set(false);
    this.modalCentroAberto.set(false);
    this.modalHistoricoAberto.set(false);
  }

  private emptyForm(): LancamentoCustoInput {
    const hoje = new Date().toISOString().slice(0, 10);
    return {
      tipo: 1,
      categoriaId: 0,
      centroCustoId: 0,
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
