import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import type { ApiError } from '../../../../../core/api/models';
import { ThemeService } from '../../../../../core/services/theme.service';
import { EstacionamentoLookupService } from '../../../../cadastro/services/estacionamento-lookup.service';
import { TransportadoraLookupService } from '../../../../cadastro/services/transportadora-lookup.service';
import { mapListaItemToPostInput } from '../../../mappers/configuracao-cobranca.mapper';
import { StatusConfiguracaoCobranca } from '../../../models/configuracao-cobranca.models';
import { ConfiguracaoCobrancaService } from '../../../services/configuracao-cobranca.service';
import type {
  ConfigCobrancaEnvioFiltroId,
  ConfigCobrancaFiltroRapidoId,
  ConfigCobrancaListaItem,
  ConfigCobrancaLookupOption,
  ConfigCobrancaModalidade,
  ConfigCobrancaStatus
} from './faturamento-config-cobranca.types';
import { ConfigCobrancaApplyRuleDialogComponent } from './dialogs/config-cobranca-apply-rule-dialog.component';
import { ConfigCobrancaConfirmDialogComponent } from './dialogs/config-cobranca-confirm-dialog.component';
import {
  ConfigCobrancaFormDialogComponent,
  type ConfigCobrancaFormDialogResult
} from './dialogs/config-cobranca-form-dialog.component';
import { ConfigCobrancaHistoryDialogComponent } from './dialogs/config-cobranca-history-dialog.component';
import { ConfigCobrancaSimulateDialogComponent } from './dialogs/config-cobranca-simulate-dialog.component';
import { ConfigCobrancaViewRuleDialogComponent } from './dialogs/config-cobranca-view-rule-dialog.component';

type ConfigCobrancaPeriodoGranularidade = 'dia' | 'mes' | 'ano';

interface PeriodoGranularidadeOpcao {
  id: ConfigCobrancaPeriodoGranularidade;
  label: string;
}

interface CfgCalendarioCelula {
  iso: string;
  day: number;
  inMonth: boolean;
  date: Date;
}

@Component({
  selector: 'app-faturamento-config-cobranca',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './faturamento-config-cobranca.component.html',
  styleUrls: ['./faturamento-config-cobranca.component.scss']
})
export class FaturamentoConfigCobrancaComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly themeService = inject(ThemeService);
  private readonly api = inject(ConfiguracaoCobrancaService);
  private readonly transportadoraLookup = inject(TransportadoraLookupService);
  private readonly estacionamentoLookup = inject(EstacionamentoLookupService);

  private readonly themeConfig = toSignal(this.themeService.theme$, {
    initialValue: this.themeService.getCurrentTheme()
  });

  readonly isDarkTheme = computed(() => {
    const mode = this.themeConfig().mode;
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  readonly items = signal<ConfigCobrancaListaItem[]>([]);
  readonly loading = signal(false);
  private readonly transportadorasLookup = signal<ConfigCobrancaLookupOption[]>([]);
  private readonly estacionamentosLookup = signal<ConfigCobrancaLookupOption[]>([]);

  readonly modalidades: ConfigCobrancaModalidade[] = ['Diária', 'Semanal', 'Quinzenal', 'Mensal'];

  readonly statusOpcoes: ConfigCobrancaStatus[] = ['Ativa', 'Inativa'];

  readonly filtroRapidoOpcoes: { id: ConfigCobrancaFiltroRapidoId; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'ativas', label: 'Ativas' },
    { id: 'inativas', label: 'Inativas' },
    { id: 'pendentes', label: 'Pendentes' },
    { id: 'semEmail', label: 'Sem e-mail' },
    { id: 'envioAuto', label: 'Envio automático' },
    { id: 'mensal', label: 'Mensal' },
    { id: 'quinzenal', label: 'Quinzenal' }
  ];

  readonly periodoGranularidadeOpcoes: PeriodoGranularidadeOpcao[] = [
    { id: 'dia', label: 'Dia' },
    { id: 'mes', label: 'Mês' },
    { id: 'ano', label: 'Ano' }
  ];

  readonly transportadoraFiltro = signal<string>('all');
  readonly estacionamentoFiltro = signal<string>('all');
  readonly modalidadeFiltro = signal<string>('all');
  readonly statusFiltro = signal<string>('all');
  readonly envioFiltro = signal<ConfigCobrancaEnvioFiltroId>('all');
  readonly filtroRapido = signal<ConfigCobrancaFiltroRapidoId | null>(null);
  readonly searchText = signal<string>('');

  readonly panelFiltrosAberto = signal(false);
  readonly panelDataAberto = signal(false);

  /* ── Calendário (visual, espelha Recebimentos) ────────────────────── */
  readonly periodoGranularidade = signal<ConfigCobrancaPeriodoGranularidade>('dia');
  readonly periodoDataInicio = signal<Date>(this.criarDataHoje());
  readonly periodoDataFim = signal<Date>(this.criarDataHoje());
  readonly calendarioAno = signal(new Date().getFullYear());
  readonly calendarioMes = signal(new Date().getMonth());
  private readonly arrastandoPeriodo = signal(false);
  private readonly arrasteAnchor = signal<Date | null>(null);

  readonly diasSemanaLabels = ['Do.', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sa.'] as const;
  readonly mesesLabels = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ] as const;

  readonly calendarioTituloMes = computed(() => {
    const d = new Date(this.calendarioAno(), this.calendarioMes(), 1);
    const titulo = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return titulo.charAt(0).toUpperCase() + titulo.slice(1);
  });

  readonly calendarioGrade = computed(() => this.montarGradeCalendario());

  readonly calendarioAnosOpcoes = computed(() => {
    const centro = this.calendarioAno();
    return Array.from({ length: 12 }, (_, i) => centro - 5 + i);
  });

  /* ── Paginação ────────────────────────────────────────────────────── */
  readonly paginaAtual = signal(0);
  readonly itensPorPagina = 20;

  readonly selection = new SelectionModel<ConfigCobrancaListaItem>(true, []);
  private readonly selectionTick = signal(0);

  readonly displayedColumns: string[] = [
    'select',
    'transportadora',
    'estacionamento',
    'modalidade',
    'fechamento',
    'prazoVencimento',
    'envioAutomatico',
    'emailFinanceiro',
    'status',
    'acoes'
  ];

  readonly listaTransportadorasForm = computed(() => this.transportadorasLookup());
  readonly listaEstacionamentosForm = computed(() => this.estacionamentosLookup());
  readonly transportadorasOpcoes = computed(() => this.transportadorasLookup());
  readonly estacionamentosOpcoes = computed(() => this.estacionamentosLookup());

  readonly contagensChips = computed(() => {
    const rows = this.items();
    const hidratados = rows.filter((r) => !r.parcial);
    return {
      todas: rows.length,
      ativas: rows.filter((r) => r.status === 'Ativa').length,
      inativas: rows.filter((r) => r.status === 'Inativa').length,
      pendentes: rows.filter((r) => r.status === 'Pendente de dados').length,
      semEmail: rows.filter((r) => !r.emailFinanceiro).length,
      envioAuto: hidratados.filter((r) => r.envioAutomatico).length,
      mensal: rows.filter((r) => r.modalidade === 'Mensal').length,
      quinzenal: rows.filter((r) => r.modalidade === 'Quinzenal').length
    };
  });

  readonly alertasDinamicos = computed(() => {
    const c = this.contagensChips();
    const hidratados = this.items().filter((r) => !r.parcial).length;
    return [
      {
        id: 'c1',
        icon: 'mark_email_unread' as const,
        titulo: 'E-mail financeiro ausente',
        detalhe: `${c.semEmail} transportadora(s) sem e-mail financeiro cadastrado`,
        nivel: 'atencao' as const
      },
      {
        id: 'c2',
        icon: 'pending_actions' as const,
        titulo: 'Dados incompletos',
        detalhe: `${c.pendentes} configuração(ões) pendente(s) de dados`,
        nivel: 'atencao' as const
      },
      {
        id: 'c3',
        icon: 'event_busy' as const,
        titulo: 'Prazo de vencimento',
        detalhe: 'Revise regras com prazo indefinido (simulação)',
        nivel: 'critico' as const
      },
      {
        id: 'c4',
        icon: 'schedule_send' as const,
        titulo: 'Envio automático',
        detalhe:
          hidratados > 0
            ? `${hidratados - c.envioAuto} configuração(ões) hidratada(s) com envio automático inativo`
            : 'Abra um registro para carregar o detalhe de envio automático',
        nivel: 'atencao' as const
      }
    ];
  });

  readonly linhasFiltradas = computed(() => this.aplicarFiltros());

  readonly linhasPaginadas = computed(() => {
    const rows = this.linhasFiltradas();
    const start = this.paginaAtual() * this.itensPorPagina;
    return rows.slice(start, start + this.itensPorPagina);
  });

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.linhasFiltradas().length / this.itensPorPagina))
  );

  readonly paginasVisiveis = computed(() => {
    const total = this.totalPaginas();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const atual = this.paginaAtual() + 1;
    const s = new Set<number>([1, total]);
    for (let i = Math.max(1, atual - 2); i <= Math.min(total, atual + 2); i++) s.add(i);
    return [...s].sort((a, b) => a - b);
  });

  readonly paginaInfo = computed(() => {
    const total = this.linhasFiltradas().length;
    if (total === 0) return '0 a 0';
    const start = this.paginaAtual() * this.itensPorPagina + 1;
    const end = Math.min(start + this.itensPorPagina - 1, total);
    return `${start} a ${end}`;
  });

  readonly filtrosAtivosCount = computed(() => {
    let c = 0;
    if (this.transportadoraFiltro() !== 'all') c++;
    if (this.estacionamentoFiltro() !== 'all') c++;
    if (this.modalidadeFiltro() !== 'all') c++;
    if (this.statusFiltro() !== 'all') c++;
    if (this.envioFiltro() !== 'all') c++;
    return c;
  });

  readonly resumoLinha = computed(() => {
    this.selectionTick();
    const s = this.selection.selected;
    return s.length ? s[0] : null;
  });

  readonly variosSelecionados = computed(() => {
    this.selectionTick();
    return this.selection.selected.length > 1;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (!target.closest('.rec-filter-bar')) {
      this.panelFiltrosAberto.set(false);
    }
    if (!target.closest('.rec-data-picker')) {
      this.panelDataAberto.set(false);
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.arrastandoPeriodo.set(false);
    this.arrasteAnchor.set(null);
  }

  constructor() {
    effect(() => {
      const vis = this.linhasFiltradas();
      let changed = false;
      for (const r of [...this.selection.selected]) {
        if (!vis.includes(r)) {
          this.selection.deselect(r);
          changed = true;
        }
      }
      if (changed) this.selectionTick.update((n) => n + 1);
      untracked(() => this.paginaAtual.set(0));
    });
  }

  ngOnInit(): void {
    this.carregarLookups();
    this.carregarLista();
  }

  carregarLista(): void {
    this.loading.set(true);
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const st = this.statusFiltro();
    const q = this.searchText().trim();
    const transportadoraId = tr !== 'all' && Number(tr) > 0 ? Number(tr) : undefined;
    const estacionamentoId = es !== 'all' && Number(es) > 0 ? Number(es) : undefined;
    const status =
      st === 'Ativa'
        ? StatusConfiguracaoCobranca.Ativa
        : st === 'Inativa'
          ? StatusConfiguracaoCobranca.Inativa
          : undefined;

    this.api
      .listar({
        numeroPagina: 1,
        tamanhoPagina: 200,
        descricao: q || undefined,
        transportadoraId,
        estacionamentoId,
        status
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.items.set(page.items);
          this.syncSelectionWithItems();
          if (page.totalCount > page.items.length) {
            this.snack.open(
              `Exibindo ${page.items.length} de ${page.totalCount} registros. Refine os filtros para ver os demais.`,
              'Fechar',
              { duration: 5000 }
            );
          }
        },
        error: (err) => {
          this.items.set([]);
          this.snack.open(this.mensagemErro(err, 'Falha ao carregar configurações de cobrança.'), 'Fechar', {
            duration: 5500
          });
        }
      });
  }

  private carregarLookups(): void {
    forkJoin({
      transportadoras: this.transportadoraLookup.list().pipe(catchError(() => of([]))),
      estacionamentos: this.estacionamentoLookup.list().pipe(catchError(() => of([])))
    }).subscribe(({ transportadoras, estacionamentos }) => {
      this.transportadorasLookup.set(
        transportadoras.map((t) => ({ id: t.id, label: t.label.split(' — ')[0] || t.label }))
      );
      this.estacionamentosLookup.set(
        estacionamentos.map((e) => ({ id: e.id, label: e.label.split(' — ')[0] || e.label }))
      );
    });
  }

  isFiltroRapidoAtivo(id: ConfigCobrancaFiltroRapidoId): boolean {
    const cur = this.filtroRapido();
    if (id === 'todas') return cur === null || cur === 'todas';
    return cur === id;
  }

  alternarFiltroRapido(id: ConfigCobrancaFiltroRapidoId): void {
    if (id === 'todas') {
      this.filtroRapido.set(null);
      return;
    }
    this.filtroRapido.update((cur) => (cur === id ? null : id));
  }

  setEnvioFiltro(ev: MatSelectChange): void {
    this.envioFiltro.set(ev.value as ConfigCobrancaEnvioFiltroId);
  }

  chipBadge(id: ConfigCobrancaFiltroRapidoId): number {
    const c = this.contagensChips();
    switch (id) {
      case 'todas':
        return c.todas;
      case 'ativas':
        return c.ativas;
      case 'inativas':
        return c.inativas;
      case 'pendentes':
        return c.pendentes;
      case 'semEmail':
        return c.semEmail;
      case 'envioAuto':
        return c.envioAuto;
      case 'mensal':
        return c.mensal;
      case 'quinzenal':
        return c.quinzenal;
      default:
        return 0;
    }
  }

  togglePanelFiltros(event: MouseEvent): void {
    event.stopPropagation();
    this.panelFiltrosAberto.update((v) => !v);
  }

  limparFiltros(): void {
    this.transportadoraFiltro.set('all');
    this.estacionamentoFiltro.set('all');
    this.modalidadeFiltro.set('all');
    this.statusFiltro.set('all');
    this.envioFiltro.set('all');
    this.searchText.set('');
    this.carregarLista();
  }

  irParaPagina(p: number): void {
    this.paginaAtual.set(Math.max(0, Math.min(p, this.totalPaginas() - 1)));
  }

  /* ── Calendário (seletor de data visual) ──────────────────────────── */
  togglePanelData(event: MouseEvent): void {
    event.stopPropagation();
    this.panelDataAberto.update((v) => {
      const abrindo = !v;
      if (abrindo) {
        const ref = this.periodoDataInicio();
        this.calendarioAno.set(ref.getFullYear());
        this.calendarioMes.set(ref.getMonth());
      }
      return abrindo;
    });
  }

  setPeriodoGranularidade(id: ConfigCobrancaPeriodoGranularidade): void {
    this.periodoGranularidade.set(id);
    const ini = this.periodoDataInicio();
    this.calendarioAno.set(ini.getFullYear());
    if (id === 'mes' || id === 'dia') {
      this.calendarioMes.set(ini.getMonth());
    }
  }

  mesCalendarioAnterior(): void {
    const m = this.calendarioMes();
    const a = this.calendarioAno();
    if (m === 0) {
      this.calendarioMes.set(11);
      this.calendarioAno.set(a - 1);
    } else {
      this.calendarioMes.set(m - 1);
    }
  }

  mesCalendarioProximo(): void {
    const m = this.calendarioMes();
    const a = this.calendarioAno();
    if (m === 11) {
      this.calendarioMes.set(0);
      this.calendarioAno.set(a + 1);
    } else {
      this.calendarioMes.set(m + 1);
    }
  }

  anoCalendarioAnterior(): void {
    this.calendarioAno.update((a) => a - 1);
  }

  anoCalendarioProximo(): void {
    this.calendarioAno.update((a) => a + 1);
  }

  onDiaCalendarioPointerDown(cell: CfgCalendarioCelula, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.navegarParaMesDoDia(cell);
    this.arrastandoPeriodo.set(true);
    this.arrasteAnchor.set(cell.date);
    this.definirIntervaloDias(cell.date, cell.date);
  }

  onDiaCalendarioPointerEnter(cell: CfgCalendarioCelula): void {
    if (!this.arrastandoPeriodo()) return;
    const anchor = this.arrasteAnchor();
    if (!anchor) return;
    this.navegarParaMesDoDia(cell);
    this.definirIntervaloDias(anchor, cell.date);
  }

  selecionarMesCalendario(mesIndex: number): void {
    this.calendarioMes.set(mesIndex);
    this.periodoGranularidade.set('dia');
  }

  selecionarAnoCalendario(ano: number): void {
    this.calendarioAno.set(ano);
    this.periodoGranularidade.set('mes');
  }

  diaCalendarioModificadores(cell: CfgCalendarioCelula): Record<string, boolean> {
    const iso = cell.iso;
    const ini = this.toIsoDate(this.periodoDataInicio());
    const fim = this.toIsoDate(this.periodoDataFim());
    const noIntervalo = iso >= ini && iso <= fim;
    const unico = ini === fim;
    return {
      'rec-cal__dia--fora': !cell.inMonth,
      'rec-cal__dia--selecionado': unico && iso === ini,
      'rec-cal__dia--range': !unico && noIntervalo,
      'rec-cal__dia--range-start': !unico && iso === ini,
      'rec-cal__dia--range-end': !unico && iso === fim
    };
  }

  mesCalendarioModificadores(mesIndex: number): Record<string, boolean> {
    const ini = this.periodoDataInicio();
    const ativo =
      this.periodoGranularidade() === 'mes' &&
      ini.getFullYear() === this.calendarioAno() &&
      ini.getMonth() === mesIndex;
    return { 'rec-cal__mes--ativo': ativo };
  }

  anoCalendarioModificadores(ano: number): Record<string, boolean> {
    const ini = this.periodoDataInicio();
    const ativo = this.periodoGranularidade() === 'ano' && ini.getFullYear() === ano;
    return { 'rec-cal__ano--ativo': ativo };
  }

  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  textoEmail(v: string | null): string {
    return v && v.trim() ? v : '—';
  }

  statusClass(s: ConfigCobrancaStatus): string {
    const map: Record<ConfigCobrancaStatus, string> = {
      Ativa: 'cfg-chip cfg-chip--ativa',
      Inativa: 'cfg-chip cfg-chip--inativa',
      'Pendente de dados': 'cfg-chip cfg-chip--pendente',
      'Sem e-mail financeiro': 'cfg-chip cfg-chip--sem-email'
    };
    return map[s] ?? 'cfg-chip';
  }

  envioClass(ativo: boolean): string {
    return ativo ? 'cfg-chip cfg-chip--envio-sim' : 'cfg-chip cfg-chip--envio-nao';
  }

  semEmailFinanceiro(row: ConfigCobrancaListaItem): boolean {
    return !row.emailFinanceiro?.trim();
  }

  onMasterToggle(ev: MatCheckboxChange): void {
    if (ev.checked) {
      for (const r of this.linhasFiltradas()) this.selection.select(r);
    } else {
      this.selection.clear();
    }
    this.selectionTick.update((n) => n + 1);
  }

  onRowToggle(row: ConfigCobrancaListaItem, ev: MatCheckboxChange): void {
    if (ev.checked) this.selection.select(row);
    else this.selection.deselect(row);
    this.selectionTick.update((n) => n + 1);
  }

  onRowClick(row: ConfigCobrancaListaItem): void {
    this.selection.clear();
    this.selection.select(row);
    this.selectionTick.update((n) => n + 1);
    if (row.parcial) {
      this.obterDetalhe(row.id, (full) => {
        this.items.update((arr) => arr.map((x) => (x.id === full.id ? full : x)));
        this.syncSelectionWithItems();
      });
    }
  }

  isAllSelected(): boolean {
    const v = this.linhasFiltradas();
    return v.length > 0 && v.every((r) => this.selection.isSelected(r));
  }

  checkboxLabel(row?: ConfigCobrancaListaItem): string {
    if (!row) return 'Selecionar todos';
    return `${this.selection.isSelected(row) ? 'Desmarcar' : 'Selecionar'} ${row.id}`;
  }

  abrirNovaConfiguracao(): void {
    this.abrirFormularioDialog('create');
  }

  duplicarRegraToolbar(): void {
    const row = this.primeiraSelecao();
    if (!row) {
      this.snack.open('Selecione uma configuração para duplicar.', 'Fechar', { duration: 4000 });
      return;
    }
    this.obterDetalhe(row.id, (full) => this.abrirFormularioDialog('duplicate', full));
  }

  testarEnvioToolbar(): void {
    const row = this.primeiraSelecao();
    if (!row) {
      this.snack.open('Selecione uma configuração para testar o envio.', 'Fechar', { duration: 4000 });
      return;
    }
    if (!row.emailFinanceiro?.trim()) {
      this.snack.open('Não é possível testar envio sem e-mail financeiro.', 'Fechar', { duration: 4500 });
      return;
    }
    this.snack.open(`E-mail de teste enviado para ${row.emailFinanceiro}.`, 'Fechar', { duration: 4500 });
  }

  exportar(): void {
    const rows = this.linhasFiltradas();
    const header = [
      'id',
      'transportadora',
      'estacionamento',
      'modalidade',
      'fechamento',
      'prazoVencimento',
      'envioAutomatico',
      'emailFinanceiro',
      'status'
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      header.join(';'),
      ...rows.map((r) =>
        [
          r.id,
          r.transportadora,
          r.estacionamento,
          r.modalidade,
          r.fechamento,
          r.prazoVencimento,
          r.envioAutomatico,
          r.emailFinanceiro ?? '',
          r.status
        ]
          .map(esc)
          .join(';')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-cobranca-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.snack.open('Exportação gerada com sucesso.', 'Fechar', { duration: 3500 });
  }

  editarLinha(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (full) => this.abrirFormularioDialog('edit', full));
  }

  visualizarRegra(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (full) => {
      const ref = this.dialog.open(ConfigCobrancaViewRuleDialogComponent, {
        width: '480px',
        maxWidth: '96vw',
        data: { row: full }
      });
      ref.afterClosed().subscribe((v) => {
        if (v === 'edit') this.editarLinha(full);
      });
    });
  }

  testarEnvioLinha(row: ConfigCobrancaListaItem): void {
    const r = this.freshen(row);
    if (!r.emailFinanceiro?.trim()) {
      this.snack.open('Configuração sem e-mail financeiro cadastrado.', 'Fechar', { duration: 4000 });
      return;
    }
    this.snack.open(`E-mail de teste enviado para ${r.emailFinanceiro}.`, 'Fechar', { duration: 4500 });
  }

  alternarAtivaLinha(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (full) => {
      const novo: ConfigCobrancaStatus = full.status === 'Ativa' ? 'Inativa' : 'Ativa';
      const payload = mapListaItemToPostInput({ ...full, status: novo });
      this.api.alterar({ ...payload, id: full.id }).subscribe({
        next: () => {
          this.snack.open(
            novo === 'Ativa' ? 'Configuração ativada.' : 'Configuração inativada.',
            'Fechar',
            { duration: 3500 }
          );
          this.carregarLista();
        },
        error: (err) =>
          this.snack.open(this.mensagemErro(err, 'Falha ao alterar status.'), 'Fechar', { duration: 5500 })
      });
    });
  }

  duplicarConfiguracaoMenu(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (full) => this.abrirFormularioDialog('duplicate', full));
  }

  verHistorico(row: ConfigCobrancaListaItem): void {
    this.dialog.open(ConfigCobrancaHistoryDialogComponent, {
      width: '440px',
      maxWidth: '96vw',
      data: { row: this.freshen(row) }
    });
  }

  simularFaturamento(row: ConfigCobrancaListaItem): void {
    this.dialog.open(ConfigCobrancaSimulateDialogComponent, {
      width: '480px',
      maxWidth: '96vw',
      data: { row: this.freshen(row) }
    });
  }

  aplicarRegraOutras(row: ConfigCobrancaListaItem): void {
    this.obterDetalhe(row.id, (base) => {
      const ref = this.dialog.open(ConfigCobrancaApplyRuleDialogComponent, {
        width: '440px',
        maxWidth: '96vw',
        data: {
          row: base,
          transportadoras: this.listaTransportadorasForm().filter((t) => t.id !== base.transportadoraId)
        }
      });
      ref.afterClosed().subscribe((res) => {
        if (!res?.selecionadas?.length) return;
        const ids = res.selecionadas as number[];
        const toCreate = ids.filter(
          (tid) =>
            !this.items().some((x) => x.transportadoraId === tid && x.estacionamentoId === base.estacionamentoId)
        );
        if (!toCreate.length) {
          this.snack.open('Nenhuma configuração nova (combinações já existentes).', 'Fechar', { duration: 4500 });
          return;
        }
        const requests = toCreate.map((tid) => {
          const nome = this.listaTransportadorasForm().find((t) => t.id === tid)?.label ?? base.transportadora;
          return this.api.gravar(
            mapListaItemToPostInput({
              ...base,
              id: 0,
              transportadoraId: tid,
              transportadora: nome,
              regra: { ...base.regra, id: 0 }
            })
          );
        });
        forkJoin(requests).subscribe({
          next: () => {
            this.snack.open(`Regra aplicada para ${toCreate.length} transportadora(s).`, 'Fechar', {
              duration: 4500
            });
            this.carregarLista();
          },
          error: (err) =>
            this.snack.open(this.mensagemErro(err, 'Falha ao aplicar regra.'), 'Fechar', { duration: 5500 })
        });
      });
    });
  }

  removerLinha(row: ConfigCobrancaListaItem): void {
    const r = this.freshen(row);
    const ref = this.dialog.open(ConfigCobrancaConfirmDialogComponent, {
      width: '420px',
      maxWidth: '96vw',
      data: {
        titulo: 'Remover configuração?',
        mensagem: 'Essa ação removerá a configuração de cobrança selecionada.'
      }
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.excluir(r.id).subscribe({
        next: () => {
          this.selection.deselect(r);
          this.snack.open('Configuração removida.', 'Fechar', { duration: 3500 });
          this.carregarLista();
        },
        error: (err) =>
          this.snack.open(this.mensagemErro(err, 'Falha ao remover configuração.'), 'Fechar', { duration: 5500 })
      });
    });
  }

  editarResumo(): void {
    const row = this.resumoLinha();
    if (!row) return;
    this.editarLinha(row);
  }

  duplicarResumo(): void {
    const row = this.resumoLinha();
    if (!row) return;
    this.obterDetalhe(row.id, (full) => this.abrirFormularioDialog('duplicate', full));
  }

  testarResumo(): void {
    const row = this.resumoLinha();
    if (!row) return;
    this.testarEnvioLinha(row);
  }

  alternarResumo(): void {
    const row = this.resumoLinha();
    if (!row) return;
    this.alternarAtivaLinha(row);
  }

  visualizarRegraCompletaResumo(): void {
    const row = this.resumoLinha();
    if (!row) return;
    this.visualizarRegra(row);
  }

  private abrirFormularioDialog(mode: 'create' | 'edit' | 'duplicate', item?: ConfigCobrancaListaItem): void {
    const ref = this.dialog.open(ConfigCobrancaFormDialogComponent, {
      width: '920px',
      maxWidth: '96vw',
      panelClass: 'cfg-form-dialog-panel',
      data: {
        mode,
        item,
        transportadoras: this.listaTransportadorasForm(),
        estacionamentos: this.listaEstacionamentosForm(),
        modalidades: this.modalidades,
        statusOpcoes: this.statusOpcoes
      }
    });
    ref.afterClosed().subscribe((res: ConfigCobrancaFormDialogResult | undefined) => {
      if (!res?.record) return;
      const payload = mapListaItemToPostInput(res.record);
      const req$ =
        mode === 'edit' && item
          ? this.api.alterar({ ...payload, id: item.id })
          : this.api.gravar({ ...payload, id: 0, regra: { ...payload.regra, id: 0 } });

      req$.subscribe({
        next: () => {
          this.snack.open(
            mode === 'edit'
              ? 'Configuração atualizada com sucesso.'
              : mode === 'duplicate'
                ? 'Configuração duplicada com sucesso.'
                : 'Configuração criada com sucesso.',
            'Fechar',
            { duration: 3500 }
          );
          this.carregarLista();
        },
        error: (err) =>
          this.snack.open(this.mensagemErro(err, 'Falha ao salvar configuração.'), 'Fechar', { duration: 5500 })
      });
    });
  }

  private obterDetalhe(id: number, onOk: (item: ConfigCobrancaListaItem) => void): void {
    this.api.obterListaItemPorId(id).subscribe({
      next: (full) => {
        if (!full) {
          this.snack.open('Configuração não encontrada.', 'Fechar', { duration: 4000 });
          return;
        }
        onOk(full);
      },
      error: (err) =>
        this.snack.open(this.mensagemErro(err, 'Falha ao carregar detalhe.'), 'Fechar', { duration: 5500 })
    });
  }

  private primeiraSelecao(): ConfigCobrancaListaItem | null {
    this.selectionTick();
    return this.selection.selected[0] ?? null;
  }

  private freshen(row: ConfigCobrancaListaItem): ConfigCobrancaListaItem {
    return this.items().find((x) => x.id === row.id) ?? row;
  }

  private syncSelectionWithItems(): void {
    const ids = new Set(this.selection.selected.map((r) => r.id));
    this.selection.clear();
    for (const r of this.items()) {
      if (ids.has(r.id)) this.selection.select(r);
    }
    this.selectionTick.update((n) => n + 1);
  }

  private mensagemErro(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const api = err as ApiError;
      if (typeof api.message === 'string' && api.message.trim()) return api.message.trim();
    }
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object') {
        const notes =
          (body as { notifications?: unknown }).notifications ??
          (body as { Notifications?: unknown }).Notifications;
        if (Array.isArray(notes) && notes.length) {
          return notes.filter((n): n is string => typeof n === 'string').join(' ') || fallback;
        }
        const msg =
          (body as { message?: string }).message ?? (body as { Message?: string }).Message;
        if (typeof msg === 'string' && msg.trim()) return msg.trim();
      }
      if (typeof body === 'string' && body.trim()) return body.trim();
    }
    return fallback;
  }

  private aplicarFiltros(): ConfigCobrancaListaItem[] {
    let rows = [...this.items()];
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const mo = this.modalidadeFiltro();
    const st = this.statusFiltro();
    const env = this.envioFiltro();
    const q = this.filtroRapido();
    const s = this.searchText().trim().toLowerCase();

    if (tr !== 'all') {
      const tid = Number(tr);
      rows = rows.filter((r) => r.transportadoraId === tid || r.transportadora === tr);
    }
    if (es !== 'all') {
      const eid = Number(es);
      rows = rows.filter((r) => r.estacionamentoId === eid || r.estacionamento === es);
    }
    if (mo !== 'all') rows = rows.filter((r) => r.modalidade === mo);
    if (st !== 'all') rows = rows.filter((r) => r.status === st);
    if (env === 'ativo') rows = rows.filter((r) => !r.parcial && r.envioAutomatico);
    if (env === 'inativo') rows = rows.filter((r) => !r.parcial && !r.envioAutomatico);

    if (q === 'ativas') rows = rows.filter((r) => r.status === 'Ativa');
    else if (q === 'inativas') rows = rows.filter((r) => r.status === 'Inativa');
    else if (q === 'pendentes') rows = rows.filter((r) => r.status === 'Pendente de dados');
    else if (q === 'semEmail') {
      rows = rows.filter((r) => !r.emailFinanceiro);
    } else if (q === 'envioAuto') rows = rows.filter((r) => !r.parcial && r.envioAutomatico);
    else if (q === 'mensal') rows = rows.filter((r) => r.modalidade === 'Mensal');
    else if (q === 'quinzenal') rows = rows.filter((r) => r.modalidade === 'Quinzenal');

    if (s) {
      rows = rows.filter(
        (r) =>
          String(r.id).includes(s) ||
          r.transportadora.toLowerCase().includes(s) ||
          r.estacionamento.toLowerCase().includes(s) ||
          (r.emailFinanceiro ?? '').toLowerCase().includes(s)
      );
    }

    return rows;
  }

  private criarDataHoje(): Date {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private montarGradeCalendario(): CfgCalendarioCelula[] {
    const ano = this.calendarioAno();
    const mes = this.calendarioMes();
    const primeiro = new Date(ano, mes, 1);
    const grade: CfgCalendarioCelula[] = [];
    const inicioGrade = new Date(primeiro);
    inicioGrade.setDate(primeiro.getDate() - primeiro.getDay());

    for (let i = 0; i < 42; i++) {
      const date = new Date(inicioGrade);
      date.setDate(inicioGrade.getDate() + i);
      grade.push({
        iso: this.toIsoDate(date),
        day: date.getDate(),
        inMonth: date.getMonth() === mes,
        date
      });
    }

    return grade;
  }

  private navegarParaMesDoDia(cell: CfgCalendarioCelula): void {
    if (!cell.inMonth) {
      this.calendarioAno.set(cell.date.getFullYear());
      this.calendarioMes.set(cell.date.getMonth());
    }
  }

  private definirIntervaloDias(inicio: Date, fim: Date): void {
    const a = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const b = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
    if (this.toIsoDate(a) <= this.toIsoDate(b)) {
      this.periodoDataInicio.set(a);
      this.periodoDataFim.set(b);
    } else {
      this.periodoDataInicio.set(b);
      this.periodoDataFim.set(a);
    }
  }
}
