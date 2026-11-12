import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
  ApexTheme,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
} from 'ng-apexcharts';
import { UsuarioApiService } from '../../../../core/api/services/usuario-api.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { ThemeService } from '../../../../core/services/theme.service';
import {
  FINANCIADOR_GT_SISTEMA,
  FORMA_PAGAMENTO_OPCOES,
  MESES_OPCOES,
  RECORRENCIA_OPCOES,
  TIPO_LANCAMENTO_OPCOES,
  type CategoriaCusto,
  type CentroCusto,
  type CentroCustoInput,
  type FinanciadorOpcao,
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
  private readonly usuariosApi = inject(UsuarioApiService);
  private readonly toast = inject(ToastService);
  private readonly themeService = inject(ThemeService);

  private readonly themeConfig = toSignal(this.themeService.theme$, {
    initialValue: this.themeService.getCurrentTheme(),
  });

  readonly isDarkTheme = computed(() => {
    const mode = this.themeConfig().mode;
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  private readonly chartAxisColor = computed(() => (this.isDarkTheme() ? '#8ea0b8' : '#4870a0'));
  private readonly chartGridColor = computed(() =>
    this.isDarkTheme() ? 'rgba(148, 163, 184, 0.22)' : 'rgba(72, 112, 160, 0.22)'
  );

  readonly tipos = TIPO_LANCAMENTO_OPCOES;
  readonly recorrencias = RECORRENCIA_OPCOES;
  readonly formasPagamento = FORMA_PAGAMENTO_OPCOES;
  readonly mesesOpcoes = MESES_OPCOES;
  readonly financiadorGtSistema = FINANCIADOR_GT_SISTEMA;
  readonly aba = signal<AbaCusto>('visao');
  readonly loadingDash = signal(false);
  readonly loadingLista = signal(false);
  readonly loadingCentros = signal(false);
  readonly loadingHistorico = signal(false);
  readonly salvando = signal(false);
  readonly salvandoCentro = signal(false);
  readonly categorias = signal<CategoriaCusto[]>([]);
  readonly centros = signal<CentroCusto[]>([]);
  readonly financiadoresAdmin = signal<FinanciadorOpcao[]>([]);
  readonly dashboard = signal<DashboardCusto | null>(null);
  readonly lancamentos = signal<LancamentoCusto[]>([]);
  readonly totalCount = signal(0);
  readonly numeroPagina = signal(1);
  readonly tamanhoPagina = 25;
  readonly anoFiltro = signal(new Date().getFullYear());
  readonly mesFiltro = signal(new Date().getMonth() + 1);
  readonly tipoDashFiltro = signal<TipoLancamentoCusto | null>(null);
  readonly centroDashFiltro = signal<number | null>(null);
  readonly termo = signal('');
  readonly anoListaFiltro = signal(new Date().getFullYear());
  readonly mesListaFiltro = signal(new Date().getMonth() + 1);
  readonly tipoListaFiltro = signal<TipoLancamentoCusto | null>(null);
  readonly centroListaFiltro = signal<number | null>(null);
  /** Desmarcado: mostra ativos + inativos. Marcado: filtra só inativos. */
  readonly somenteInativos = signal(false);
  readonly modalAberto = signal(false);
  readonly modalCentroAberto = signal(false);
  readonly modalHistoricoAberto = signal(false);
  readonly modalConfirmAberto = signal(false);
  readonly confirmTitulo = signal('Confirmar');
  readonly confirmMensagem = signal('');
  readonly confirmLabel = signal('Confirmar');
  private confirmAction: (() => void) | null = null;
  readonly editId = signal<number | null>(null);
  readonly editCentroId = signal<number | null>(null);
  readonly historicoTitulo = signal('');
  readonly historicoItens = signal<HistoricoLancamentoCusto[]>([]);

  /** Uma linha por evento de auditoria, antigo → novo. */
  readonly historicoLinhas = computed(() => {
    const ordenados = [...this.historicoItens()].sort((a, b) => {
      const byId = (a.id ?? 0) - (b.id ?? 0);
      if (byId !== 0) return byId;
      return new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime();
    });

    return ordenados.map((ev) => {
      const origem = Array.isArray(ev.alteracoes) ? ev.alteracoes : [];
      const alterados = origem.filter((a) => a.alterado);
      const campos = (ev.operacao === 2 && alterados.length > 0 ? alterados : origem).sort((a, b) =>
        a.campo.localeCompare(b.campo, 'pt-BR')
      );

      const resumo =
        campos.length === 0
          ? '—'
          : campos
              .map((c) => {
                const de = (c.de ?? '').trim() || '—';
                const para = (c.para ?? '').trim() || '—';
                if (ev.operacao === 1) return `${c.campo}: ${para}`;
                if (ev.operacao === 3) return `${c.campo}: ${de}`;
                return `${c.campo}: ${de} → ${para}`;
              })
              .join(' · ');

      return {
        key: String(ev.id),
        eventoId: ev.id,
        dataHora: ev.dataHora,
        operacao: ev.operacao,
        operacaoLabel: ev.operacaoLabel,
        usuarioNome: (ev.usuarioNome || '').trim() || '—',
        resumo,
        qtdCampos: campos.length,
      };
    });
  });

  form: LancamentoCustoInput = this.emptyForm();
  formCentro: CentroCustoInput = { codigo: '', nome: '' };
  /** Chave do select: 'gt-sistema' ou id numérico do admin. */
  financiadorKey: string = 'gt-sistema';

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

  readonly chartTheme = computed<ApexTheme>(() => ({
    mode: this.isDarkTheme() ? 'dark' : 'light',
    monochrome: { enabled: false },
  }));

  readonly chartLine = computed<ApexChart>(() => ({
    type: 'area',
    height: 300,
    toolbar: { show: false },
    fontFamily: 'inherit',
    foreColor: this.chartAxisColor(),
    background: 'transparent',
  }));

  readonly chartBar = computed<ApexChart>(() => ({
    type: 'bar',
    height: 300,
    toolbar: { show: false },
    fontFamily: 'inherit',
    foreColor: this.chartAxisColor(),
    background: 'transparent',
  }));

  readonly chartPie = computed<ApexChart>(() => ({
    type: 'donut',
    height: 300,
    fontFamily: 'inherit',
    foreColor: this.chartAxisColor(),
    background: 'transparent',
  }));

  readonly stroke: ApexStroke = { curve: 'smooth', width: 2 };
  readonly fill: ApexFill = { type: 'gradient', gradient: { opacityFrom: 0.45, opacityTo: 0.05 } };
  readonly dataLabels: ApexDataLabels = { enabled: false };
  readonly legend = computed<ApexLegend>(() => ({
    position: 'bottom',
    labels: { colors: this.chartAxisColor() },
  }));
  readonly tooltip = computed<ApexTooltip>(() => ({
    theme: this.isDarkTheme() ? 'dark' : 'light',
    y: { formatter: (v) => this.formatMoney(v) },
  }));
  readonly plotBars: ApexPlotOptions = { bar: { borderRadius: 4, columnWidth: '55%' } };
  readonly yaxis = computed<ApexYAxis>(() => ({
    labels: {
      style: { colors: this.chartAxisColor() },
      formatter: (v) => this.formatMoney(Number(v)),
    },
  }));

  ngOnInit(): void {
    this.api.listarCategorias().subscribe({
      next: (c) => this.categorias.set(c),
      error: () => this.toast.error('Não foi possível carregar as categorias.'),
    });
    this.carregarFinanciadoresAdmin();
    this.carregarCentros();
    this.carregarDashboard();
    this.carregarLancamentos();
  }

  carregarFinanciadoresAdmin(): void {
    this.usuariosApi.listar().subscribe({
      next: (usuarios) => {
        const admins = (usuarios ?? [])
          .filter((u) => this.isAdminRole(u.role))
          .map((u) => {
            const idNum = Number(u.id);
            if (!Number.isFinite(idNum) || idNum <= 0) return null;
            const nome = (u.nome || u.userName || u.email || `Usuário #${idNum}`).trim();
            return { usuarioId: idNum, nome } as FinanciadorOpcao;
          })
          .filter((x): x is FinanciadorOpcao => !!x)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        this.financiadoresAdmin.set(admins);
      },
      error: () => this.toast.warning('Não foi possível carregar administradores para financiador.'),
    });
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
      .dashboard(this.anoFiltro(), this.tipoDashFiltro(), this.centroDashFiltro(), this.mesFiltro())
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
        error: (err) =>
          this.toast.error(
            err?.error?.message ?? err?.message ?? 'Não foi possível carregar o dashboard de custos.'
          ),
      });
  }

  carregarLancamentos(): void {
    this.loadingLista.set(true);
    const { inicio, fim } = this.periodoDoMes(this.anoListaFiltro(), this.mesListaFiltro());
    this.api
      .buscarLancamentos({
        termo: this.termo(),
        tipo: this.tipoListaFiltro(),
        centroCustoId: this.centroListaFiltro(),
        periodoInicio: inicio,
        periodoFim: fim,
        incluirInativos: true,
        somenteInativos: this.somenteInativos(),
        numeroPagina: this.numeroPagina(),
        tamanhoPagina: this.tamanhoPagina,
      })
      .pipe(finalize(() => this.loadingLista.set(false)))
      .subscribe({
        next: (p) => {
          this.lancamentos.set(p.results ?? []);
          this.totalCount.set(p.rowCount ?? 0);
        },
        error: (err) =>
          this.toast.error(
            err?.error?.message ?? err?.message ?? 'Não foi possível carregar os lançamentos.'
          ),
      });
  }

  onBuscarLista(): void {
    this.numeroPagina.set(1);
    this.carregarLancamentos();
  }

  onSomenteInativosChange(checked: boolean): void {
    this.somenteInativos.set(!!checked);
    this.numeroPagina.set(1);
    this.carregarLancamentos();
  }

  abrirNovo(): void {
    this.fecharTodosModais();
    this.editId.set(null);
    this.form = this.emptyForm();
    this.financiadorKey = 'gt-sistema';
    this.modalAberto.set(true);
  }

  abrirEditar(item: LancamentoCusto): void {
    if (!item.ativo) {
      this.toast.warning('Lançamento inativo não pode ser editado.');
      return;
    }
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
      recorrencia: item.recorrencia || 1,
      dataFimRecorrencia: item.dataFimRecorrencia ? item.dataFimRecorrencia.slice(0, 10) : null,
      financiadorUsuarioId: item.financiadorUsuarioId ?? null,
      financiadorNome: item.financiadorNome || FINANCIADOR_GT_SISTEMA.nome,
      formaPagamento: item.formaPagamento || 1,
      parcelas: item.parcelas ?? null,
    };
    this.financiadorKey =
      item.financiadorUsuarioId != null && item.financiadorUsuarioId > 0
        ? String(item.financiadorUsuarioId)
        : 'gt-sistema';
    this.modalAberto.set(true);
  }

  fecharModal(): void {
    this.modalAberto.set(false);
  }

  onRecorrenciaChange(): void {
    if (this.form.recorrencia === 1) {
      this.form.dataFimRecorrencia = null;
    }
  }

  onFinanciadorChange(key: string): void {
    this.financiadorKey = key;
    if (key === 'gt-sistema') {
      this.form.financiadorUsuarioId = null;
      this.form.financiadorNome = FINANCIADOR_GT_SISTEMA.nome;
      return;
    }
    const id = Number(key);
    const admin = this.financiadoresAdmin().find((a) => a.usuarioId === id);
    this.form.financiadorUsuarioId = Number.isFinite(id) && id > 0 ? id : null;
    this.form.financiadorNome = admin?.nome || `Usuário #${id}`;
  }

  onFormaPagamentoChange(): void {
    if (this.form.formaPagamento === 1) {
      this.form.parcelas = null;
      return;
    }
    if (!this.form.parcelas || this.form.parcelas < 1) {
      this.form.parcelas = this.form.formaPagamento === 2 ? 1 : 2;
    }
  }

  isCartaoPagamento(): boolean {
    return this.form.formaPagamento === 2 || this.form.formaPagamento === 3;
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
    this.abrirConfirmacao({
      titulo: 'Excluir centro de custo',
      mensagem: `Excluir o centro "${item.nome}"?`,
      confirmLabel: 'Excluir',
      onConfirm: () => {
        this.api.excluirCentro(item.id).subscribe({
          next: () => {
            this.toast.success('Centro excluído.');
            this.carregarCentros(true);
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? err?.message ?? 'Falha ao excluir centro de custo.'),
        });
      },
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
    this.onFinanciadorChange(this.financiadorKey);
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
    if (this.form.recorrencia !== 1 && !this.form.dataFimRecorrencia) {
      this.toast.warning('Informe a data fim da recorrência semanal/mensal.');
      return;
    }
    if (this.isCartaoPagamento() && (!this.form.parcelas || this.form.parcelas < 1 || this.form.parcelas > 48)) {
      this.toast.warning('Informe as parcelas do cartão (1 a 48).');
      return;
    }
    this.salvando.set(true);
    const payload: LancamentoCustoInput = {
      ...this.form,
      descricao: this.form.descricao.trim(),
      observacao: this.form.observacao?.trim() || null,
      dataPagamento: this.form.dataPagamento || null,
      dataFimRecorrencia: this.form.recorrencia === 1 ? null : this.form.dataFimRecorrencia || null,
      financiadorUsuarioId: this.form.financiadorUsuarioId ?? null,
      financiadorNome: this.form.financiadorNome?.trim() || FINANCIADOR_GT_SISTEMA.nome,
      formaPagamento: this.form.formaPagamento || 1,
      parcelas: this.isCartaoPagamento() ? this.form.parcelas : null,
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
    if (!item.ativo) {
      this.toast.warning('Este lançamento já está inativo.');
      return;
    }
    this.abrirConfirmacao({
      titulo: 'Inativar lançamento',
      mensagem: `Inativar o lançamento "${item.descricao}"?\nO histórico de auditoria será preservado.`,
      confirmLabel: 'Inativar',
      onConfirm: () => {
        this.api.excluir(item.id).subscribe({
          next: () => {
            this.toast.success('Lançamento inativado. Ele permanece na lista com situação Inativo.');
            this.carregarLancamentos();
            this.carregarDashboard();
          },
          error: () => this.toast.error('Falha ao inativar lançamento.'),
        });
      },
    });
  }

  abrirConfirmacao(opts: {
    titulo: string;
    mensagem: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }): void {
    this.fecharTodosModais();
    this.confirmTitulo.set(opts.titulo);
    this.confirmMensagem.set(opts.mensagem);
    this.confirmLabel.set(opts.confirmLabel || 'Confirmar');
    this.confirmAction = opts.onConfirm;
    this.modalConfirmAberto.set(true);
  }

  confirmarAcao(): void {
    const action = this.confirmAction;
    this.fecharConfirmacao();
    action?.();
  }

  fecharConfirmacao(): void {
    this.modalConfirmAberto.set(false);
    this.confirmAction = null;
  }

  mesLabel(mes: number): string {
    return this.mesesOpcoes.find((m) => m.value === mes)?.label || String(mes);
  }

  xaxisFrom(cats: string[]): ApexXAxis {
    return {
      categories: cats,
      labels: { style: { colors: this.chartAxisColor() } },
      axisBorder: { color: this.chartGridColor() },
      axisTicks: { color: this.chartGridColor() },
    };
  }

  private fecharTodosModais(): void {
    this.modalAberto.set(false);
    this.modalCentroAberto.set(false);
    this.modalHistoricoAberto.set(false);
    this.modalConfirmAberto.set(false);
    this.confirmAction = null;
  }

  private periodoDoMes(ano: number, mes: number): { inicio: string; fim: string } {
    const m = String(mes).padStart(2, '0');
    const ultimoDia = new Date(ano, mes, 0).getDate();
    return {
      inicio: `${ano}-${m}-01`,
      fim: `${ano}-${m}-${String(ultimoDia).padStart(2, '0')}`,
    };
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
      recorrencia: 1,
      dataFimRecorrencia: null,
      financiadorUsuarioId: null,
      financiadorNome: FINANCIADOR_GT_SISTEMA.nome,
      formaPagamento: 1,
      parcelas: null,
    };
  }

  private isAdminRole(role?: string | null): boolean {
    const n = (role || '').trim().toLowerCase();
    return n === 'admin' || n === 'administrador' || n.includes('admin');
  }

  private formatMoney(v: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  }
}
