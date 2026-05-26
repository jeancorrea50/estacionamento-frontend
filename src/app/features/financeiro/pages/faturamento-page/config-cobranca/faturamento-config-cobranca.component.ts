import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  CONFIG_COBRANCA_ESTACIONAMENTOS,
  CONFIG_COBRANCA_TRANSPORTADORAS
} from './faturamento-config-cobranca.constants';
import {
  checksFromAgrupamento,
  checksFromServicos,
  montarRegistroDoFormularioExpansao,
  validarFormularioConfig,
  type AgrupamentoChecks,
  type ServicosChecks
} from './faturamento-config-cobranca.helpers';
import { CONFIG_COBRANCA_MOCK } from './faturamento-config-cobranca.mock';
import type {
  ConfigCobrancaEnvioFiltroId,
  ConfigCobrancaFiltroRapidoId,
  ConfigCobrancaListaItem,
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
    MatDividerModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './faturamento-config-cobranca.component.html',
  styleUrls: ['./faturamento-config-cobranca.component.scss']
})
export class FaturamentoConfigCobrancaComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly items = signal<ConfigCobrancaListaItem[]>(CONFIG_COBRANCA_MOCK.map((r) => ({ ...r })));

  readonly modalidades: ConfigCobrancaModalidade[] = [
    'Diária',
    'Semanal',
    'Quinzenal',
    'Mensal',
    'Por data personalizada'
  ];

  readonly statusOpcoes: ConfigCobrancaStatus[] = [
    'Ativa',
    'Inativa',
    'Pendente de dados',
    'Sem e-mail financeiro'
  ];

  readonly transportadoraFiltro = signal<string>('all');
  readonly estacionamentoFiltro = signal<string>('all');
  readonly modalidadeFiltro = signal<string>('all');
  readonly statusFiltro = signal<string>('all');
  readonly envioFiltro = signal<ConfigCobrancaEnvioFiltroId>('all');
  readonly filtroRapido = signal<ConfigCobrancaFiltroRapidoId | null>(null);

  readonly selection = new SelectionModel<ConfigCobrancaListaItem>(true, []);
  private readonly selectionTick = signal(0);
  readonly envioTopoLoading = signal(false);

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

  readonly listaTransportadorasForm = computed(() => {
    const u = new Set<string>([...CONFIG_COBRANCA_TRANSPORTADORAS]);
    for (const r of this.items()) u.add(r.transportadora);
    return [...u].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly listaEstacionamentosForm = computed(() => {
    const u = new Set<string>([...CONFIG_COBRANCA_ESTACIONAMENTOS]);
    for (const r of this.items()) u.add(r.estacionamento);
    return [...u].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly transportadorasOpcoes = computed(() => {
    const u = new Set(this.items().map((r) => r.transportadora));
    for (const t of CONFIG_COBRANCA_TRANSPORTADORAS) u.add(t);
    return [...u].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly estacionamentosOpcoes = computed(() => {
    const u = new Set(this.items().map((r) => r.estacionamento));
    for (const e of CONFIG_COBRANCA_ESTACIONAMENTOS) u.add(e);
    return [...u].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly contagensChips = computed(() => {
    const rows = this.items();
    return {
      todas: rows.length,
      ativas: rows.filter((r) => r.status === 'Ativa').length,
      inativas: rows.filter((r) => r.status === 'Inativa').length,
      pendentes: rows.filter((r) => r.status === 'Pendente de dados').length,
      semEmail: rows.filter((r) => !r.emailFinanceiro).length,
      envioAuto: rows.filter((r) => r.envioAutomatico).length,
      mensal: rows.filter((r) => r.modalidade === 'Mensal').length,
      quinzenal: rows.filter((r) => r.modalidade === 'Quinzenal').length
    };
  });

  readonly kpiAtivas = computed(() => this.contagensChips().ativas);
  readonly kpiEnvioAuto = computed(() => this.contagensChips().envioAuto);
  readonly kpiSemEmail = computed(() => this.contagensChips().semEmail);
  readonly kpiPendentes = computed(() => this.contagensChips().pendentes);

  readonly alertasDinamicos = computed(() => {
    const c = this.contagensChips();
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
        detalhe: `${c.todas - c.envioAuto} configuração(ões) com envio automático inativo`,
        nivel: 'atencao' as const
      }
    ];
  });

  readonly linhasFiltradas = computed(() => this.aplicarFiltros());

  readonly resumoLinha = computed(() => {
    this.selectionTick();
    const s = this.selection.selected;
    return s.length ? s[0] : null;
  });

  readonly variosSelecionados = computed(() => {
    this.selectionTick();
    return this.selection.selected.length > 1;
  });

  formTransportadora = '';
  formEstacionamento = '';
  formStatus: ConfigCobrancaStatus = 'Ativa';
  formModalidade: ConfigCobrancaModalidade = 'Mensal';
  formFechamento = '';
  formDiaFechamento = '';
  formPrazoVencimento = '';
  formEmail = '';
  formEnvioAuto = false;
  formGerarAuto = false;
  formPagamentoParcial = false;
  formMulta = false;
  formMultaPct = 0;
  formJuros = false;
  formJurosPct = 0;
  formDescFixo = false;
  formDescValor = 0;
  formAcresFixo = false;
  formAcresValor = 0;
  formCobDiaria = true;
  formCobSemanal = false;
  formCobQuinzenal = false;
  formCobMensal = true;
  formCobPersonal = false;
  formCobLavagem = false;
  formCobPernoite = false;
  formCobExtras = false;
  formCobBeneficio = false;
  formAgrPlaca = false;
  formAgrPeriodo = true;
  formAgrTransp = true;

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
    });

    effect(() => {
      const r = this.resumoLinha();
      if (r) this.preencherFormulario(r);
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
    this.abrirFormularioDialog('duplicate', row);
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
    const email = row.emailFinanceiro;
    this.envioTopoLoading.set(true);
    window.setTimeout(() => {
      this.envioTopoLoading.set(false);
      this.snack.open(`E-mail de teste enviado para ${email}.`, 'Fechar', { duration: 4500 });
    }, 1200);
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
    this.abrirFormularioDialog('edit', this.freshen(row));
  }

  visualizarRegra(row: ConfigCobrancaListaItem): void {
    const r = this.freshen(row);
    const ref = this.dialog.open(ConfigCobrancaViewRuleDialogComponent, {
      width: '480px',
      maxWidth: '96vw',
      data: { row: r }
    });
    ref.afterClosed().subscribe((v) => {
      if (v === 'edit') this.editarLinha(r);
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
    const r = this.freshen(row);
    if (!r) return;
    let novo: ConfigCobrancaStatus;
    if (r.status === 'Ativa') novo = 'Inativa';
    else if (r.status === 'Inativa') novo = 'Ativa';
    else novo = 'Ativa';
    const msg = novo === 'Ativa' ? 'Configuração ativada.' : 'Configuração inativada.';
    this.items.update((arr) => arr.map((x) => (x.id === r.id ? { ...x, status: novo } : x)));
    this.syncSelectionWithItems();
    this.snack.open(msg, 'Fechar', { duration: 3500 });
  }

  duplicarConfiguracaoMenu(row: ConfigCobrancaListaItem): void {
    const r = this.freshen(row);
    const [novoId] = this.allocarIds(1);
    const copia: ConfigCobrancaListaItem = {
      ...r,
      id: novoId,
      transportadora: `${r.transportadora} (Cópia)`,
      status: r.emailFinanceiro ? 'Ativa' : 'Sem e-mail financeiro'
    };
    this.items.update((a) => [...a, copia]);
    this.syncSelectionWithItems();
    this.snack.open('Configuração duplicada com sucesso.', 'Fechar', { duration: 3500 });
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
    const base = this.freshen(row);
    const ref = this.dialog.open(ConfigCobrancaApplyRuleDialogComponent, {
      width: '440px',
      maxWidth: '96vw',
      data: { row: base, transportadoras: [...this.listaTransportadorasForm()] }
    });
    ref.afterClosed().subscribe((res) => {
      if (!res?.selecionadas?.length) return;
      const toAdd = res.selecionadas.filter(
        (t: string) => !this.items().some((x) => x.transportadora === t && x.estacionamento === base.estacionamento)
      );
      if (!toAdd.length) {
        this.snack.open('Nenhuma configuração nova (combinações já existentes).', 'Fechar', { duration: 4500 });
        return;
      }
      const ids = this.allocarIds(toAdd.length);
      const novos: ConfigCobrancaListaItem[] = toAdd.map((t: string, idx: number) => ({
        ...base,
        id: ids[idx],
        transportadora: t,
        status: base.emailFinanceiro ? 'Ativa' : 'Sem e-mail financeiro'
      }));
      this.items.update((a) => [...a, ...novos]);
      this.syncSelectionWithItems();
      this.snack.open(`Regra aplicada para ${novos.length} transportadora(s).`, 'Fechar', { duration: 4500 });
    });
  }

  removerLinha(row: ConfigCobrancaListaItem): void {
    const r = this.freshen(row);
    const ref = this.dialog.open(ConfigCobrancaConfirmDialogComponent, {
      width: '420px',
      maxWidth: '96vw',
      data: {
        titulo: 'Remover configuração?',
        mensagem:
          'Essa ação removerá a configuração de cobrança selecionada apenas desta simulação.'
      }
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.items.update((arr) => arr.filter((x) => x.id !== r.id));
      this.selection.deselect(r);
      this.syncSelectionWithItems();
      this.snack.open('Configuração removida.', 'Fechar', { duration: 3500 });
    });
  }

  salvarPainelExpansao(): void {
    const row = this.resumoLinha();
    if (!row) {
      this.snack.open('Selecione uma configuração para salvar.', 'Fechar', { duration: 4000 });
      return;
    }
    const serv: ServicosChecks = {
      diaria: this.formCobDiaria,
      semanal: this.formCobSemanal,
      quinzenal: this.formCobQuinzenal,
      mensal: this.formCobMensal,
      personal: this.formCobPersonal,
      lavagem: this.formCobLavagem,
      pernoite: this.formCobPernoite,
      extras: this.formCobExtras,
      beneficio: this.formCobBeneficio
    };
    const agr: AgrupamentoChecks = {
      placa: this.formAgrPlaca,
      periodo: this.formAgrPeriodo,
      transportadora: this.formAgrTransp
    };
    const v = validarFormularioConfig({
      transportadora: this.formTransportadora,
      estacionamento: this.formEstacionamento,
      modalidade: this.formModalidade,
      fechamento: this.formFechamento,
      prazoVencimento: this.formPrazoVencimento,
      email: this.formEmail,
      precisaEmailFin: this.formEnvioAuto || this.formGerarAuto,
      multa: this.formMulta,
      multaPct: this.formMultaPct,
      juros: this.formJuros,
      jurosPct: this.formJurosPct
    });
    if (!v.ok) {
      this.snack.open(v.mensagens[0] ?? 'Revise os campos.', 'Fechar', { duration: 5000 });
      return;
    }
    const atualizado = montarRegistroDoFormularioExpansao(row.id, {
      transportadora: this.formTransportadora,
      estacionamento: this.formEstacionamento,
      status: this.formStatus,
      modalidade: this.formModalidade,
      fechamento: this.formFechamento,
      prazoVencimento: this.formPrazoVencimento,
      email: this.formEmail,
      envioAuto: this.formEnvioAuto,
      gerarAuto: this.formGerarAuto,
      pagamentoParcial: this.formPagamentoParcial,
      multa: this.formMulta,
      multaPct: this.formMultaPct,
      juros: this.formJuros,
      jurosPct: this.formJurosPct,
      serv,
      agr
    });
    this.items.update((arr) => arr.map((x) => (x.id === row.id ? atualizado : x)));
    this.syncSelectionWithItems();
    this.snack.open('Configuração atualizada com sucesso.', 'Fechar', { duration: 3500 });
  }

  cancelarPainelExpansao(): void {
    const r = this.resumoLinha();
    if (r) this.preencherFormulario(r);
    else this.limparFormulario();
  }

  testarEnvioPainel(): void {
    const row = this.resumoLinha();
    if (!row) {
      this.snack.open('Selecione uma configuração.', 'Fechar', { duration: 3500 });
      return;
    }
    this.testarEnvioLinha(row);
  }

  visualizarRegraPainel(): void {
    const row = this.resumoLinha();
    if (!row) {
      this.snack.open('Selecione uma configuração.', 'Fechar', { duration: 3500 });
      return;
    }
    this.visualizarRegra(row);
  }

  editarResumo(): void {
    const row = this.resumoLinha();
    if (!row) return;
    this.editarLinha(row);
  }

  duplicarResumo(): void {
    const row = this.resumoLinha();
    if (!row) return;
    this.abrirFormularioDialog('duplicate', row);
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
      width: '600px',
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
      if (mode === 'edit' && item) {
        const rec = { ...res.record, id: item.id };
        this.items.update((arr) => arr.map((x) => (x.id === item.id ? rec : x)));
        this.syncSelectionWithItems();
        this.snack.open('Configuração atualizada com sucesso.', 'Fechar', { duration: 3500 });
        return;
      }
      const [novoId] = this.allocarIds(1);
      const rec = { ...res.record, id: novoId };
      this.items.update((a) => [...a, rec]);
      this.syncSelectionWithItems();
      this.snack.open(
        mode === 'duplicate' ? 'Configuração duplicada com sucesso.' : 'Configuração criada com sucesso.',
        'Fechar',
        { duration: 3500 }
      );
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

  private allocarIds(n: number): string[] {
    if (n <= 0) return [];
    let max = 0;
    for (const r of this.items()) {
      const m = /^CFG-(\d+)$/i.exec(r.id);
      if (m) max = Math.max(max, +m[1]);
    }
    return Array.from({ length: n }, (_, i) => `CFG-${String(max + 1 + i).padStart(3, '0')}`);
  }

  private preencherFormulario(r: ConfigCobrancaListaItem): void {
    this.formTransportadora = r.transportadora;
    this.formEstacionamento = r.estacionamento;
    this.formStatus = r.status;
    this.formModalidade = r.modalidade;
    this.formFechamento = r.fechamento;
    this.formDiaFechamento = '';
    this.formPrazoVencimento = r.prazoVencimento;
    this.formEmail = r.emailFinanceiro ?? '';
    this.formEnvioAuto = r.envioAutomatico;
    this.formGerarAuto = r.envioAutomatico;
    this.formPagamentoParcial = r.pagamentoParcial;
    this.formMulta = r.multaAplicar;
    this.formMultaPct = r.multaPercentual;
    this.formJuros = r.jurosAplicar;
    this.formJurosPct = r.jurosPercentual;
    this.formDescFixo = false;
    this.formDescValor = 0;
    this.formAcresFixo = false;
    this.formAcresValor = 0;
    const sc = checksFromServicos(r.servicosCobrados);
    this.formCobDiaria = sc.diaria;
    this.formCobSemanal = sc.semanal;
    this.formCobQuinzenal = sc.quinzenal;
    this.formCobMensal = sc.mensal;
    this.formCobPersonal = sc.personal;
    this.formCobLavagem = sc.lavagem;
    this.formCobPernoite = sc.pernoite;
    this.formCobExtras = sc.extras;
    this.formCobBeneficio = sc.beneficio;
    const ag = checksFromAgrupamento(r.agrupamentoFatura);
    this.formAgrPlaca = ag.placa;
    this.formAgrPeriodo = ag.periodo;
    this.formAgrTransp = ag.transportadora;
  }

  private limparFormulario(): void {
    this.formTransportadora = '';
    this.formEstacionamento = '';
    this.formStatus = 'Ativa';
    this.formModalidade = 'Mensal';
    this.formFechamento = '';
    this.formDiaFechamento = '';
    this.formPrazoVencimento = '';
    this.formEmail = '';
    this.formEnvioAuto = false;
    this.formGerarAuto = false;
    this.formPagamentoParcial = false;
    this.formMulta = false;
    this.formMultaPct = 0;
    this.formJuros = false;
    this.formJurosPct = 0;
  }

  private aplicarFiltros(): ConfigCobrancaListaItem[] {
    let rows = [...this.items()];
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const mo = this.modalidadeFiltro();
    const st = this.statusFiltro();
    const env = this.envioFiltro();
    const q = this.filtroRapido();

    if (tr !== 'all') rows = rows.filter((r) => r.transportadora === tr);
    if (es !== 'all') rows = rows.filter((r) => r.estacionamento === es);
    if (mo !== 'all') rows = rows.filter((r) => r.modalidade === mo);
    if (st !== 'all') rows = rows.filter((r) => r.status === st);
    if (env === 'ativo') rows = rows.filter((r) => r.envioAutomatico);
    if (env === 'inativo') rows = rows.filter((r) => !r.envioAutomatico);

    if (q === 'ativas') rows = rows.filter((r) => r.status === 'Ativa');
    else if (q === 'inativas') rows = rows.filter((r) => r.status === 'Inativa');
    else if (q === 'pendentes') rows = rows.filter((r) => r.status === 'Pendente de dados');
    else if (q === 'semEmail') {
      rows = rows.filter((r) => !r.emailFinanceiro);
    } else if (q === 'envioAuto') rows = rows.filter((r) => r.envioAutomatico);
    else if (q === 'mensal') rows = rows.filter((r) => r.modalidade === 'Mensal');
    else if (q === 'quinzenal') rows = rows.filter((r) => r.modalidade === 'Quinzenal');

    return rows;
  }
}
