import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import type { PeriodoFiltroId } from '../faturamento-visao.types';
import { FaturamentoInadimplenciaAcordoDialogComponent } from './faturamento-inadimplencia-acordo-dialog.component';
import { INADIMPLENCIA_MOCK } from './faturamento-inadimplencia.mock';
import type {
  InadimplenciaDiasFiltroId,
  InadimplenciaFiltroRapidoId,
  InadimplenciaListaItem,
  InadimplenciaStatusCobranca
} from './faturamento-inadimplencia.types';

interface PeriodoOpcao {
  id: PeriodoFiltroId;
  label: string;
}

@Component({
  selector: 'app-faturamento-inadimplencia',
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
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './faturamento-inadimplencia.component.html',
  styleUrls: [
    './faturamento-inadimplencia.component.scss',
    '../faturas/faturamento-faturas.component.scss',
    '../recebimentos/faturamento-recebimentos.component.scss',
    '../visao-geral/faturamento-visao-geral.component.scss'
  ]
})
export class FaturamentoInadimplenciaComponent {
  private readonly dialog = inject(MatDialog);

  readonly todas = INADIMPLENCIA_MOCK;

  readonly periodoOpcoes: PeriodoOpcao[] = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'semana', label: 'Esta semana' },
    { id: 'mes', label: 'Este mês' },
    { id: 'personalizado', label: 'Personalizado' }
  ];

  readonly diasAtrasoOpcoes: { id: InadimplenciaDiasFiltroId; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: '1-7', label: '1 a 7 dias' },
    { id: '8-15', label: '8 a 15 dias' },
    { id: 'mais15', label: 'Mais de 15 dias' },
    { id: 'mais30', label: 'Mais de 30 dias' }
  ];

  readonly statusCobrancaOpcoes: InadimplenciaStatusCobranca[] = [
    'Não enviada',
    'Enviada',
    'Reenviada',
    'Em negociação',
    'Acordo realizado',
    'Sem retorno'
  ];

  readonly periodoFiltro = signal<PeriodoFiltroId>('mes');
  dataInicioPersonalizado = '';
  dataFimPersonalizado = '';

  readonly transportadoraFiltro = signal<string>('all');
  readonly estacionamentoFiltro = signal<string>('all');
  readonly diasFiltro = signal<InadimplenciaDiasFiltroId>('all');
  readonly statusCobrancaFiltro = signal<string>('all');
  readonly filtroRapido = signal<InadimplenciaFiltroRapidoId | null>(null);

  readonly selection = new SelectionModel<InadimplenciaListaItem>(true, []);

  readonly displayedColumns: string[] = [
    'select',
    'fatura',
    'transportadora',
    'estacionamento',
    'valor',
    'vencimento',
    'diasAtraso',
    'ultimaCobranca',
    'statusCobranca',
    'acoes'
  ];

  readonly alertasCobranca = [
    {
      id: 'a1',
      icon: 'mark_email_unread',
      titulo: 'Faturas sem cobrança enviada',
      detalhe: '5 faturas vencidas ainda sem cobrança enviada',
      nivel: 'atencao' as const
    },
    {
      id: 'a2',
      icon: 'groups',
      titulo: 'Transportadoras com múltiplas faturas',
      detalhe: '3 transportadoras possuem mais de uma fatura vencida',
      nivel: 'atencao' as const
    },
    {
      id: 'a3',
      icon: 'warning_amber',
      titulo: 'Atraso prolongado',
      detalhe: '2 faturas estão vencidas há mais de 30 dias',
      nivel: 'critico' as const
    },
    {
      id: 'a4',
      icon: 'handshake',
      titulo: 'Negociação em andamento',
      detalhe: '1 transportadora está em negociação de acordo',
      nivel: 'atencao' as const
    }
  ];

  readonly transportadorasOpcoes = computed(() => {
    const u = new Set(this.todas.map((r) => r.transportadora));
    return [...u].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly estacionamentosOpcoes = computed(() => {
    const u = new Set(this.todas.map((r) => r.estacionamento));
    return [...u].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly contagensChips = computed(() => {
    const rows = this.todas;
    const d1_7 = (d: number) => d >= 1 && d <= 7;
    const d8_15 = (d: number) => d >= 8 && d <= 15;
    const m15 = (d: number) => d > 15;
    const m30 = (d: number) => d > 30;
    const semCob = (r: InadimplenciaListaItem) => r.statusCobranca === 'Não enviada';
    return {
      todas: rows.length,
      d1_7: rows.filter((r) => d1_7(r.diasAtraso)).length,
      d8_15: rows.filter((r) => d8_15(r.diasAtraso)).length,
      mais15: rows.filter((r) => m15(r.diasAtraso)).length,
      mais30: rows.filter((r) => m30(r.diasAtraso)).length,
      semCobranca: rows.filter(semCob).length,
      emNegociacao: rows.filter((r) => r.statusCobranca === 'Em negociação').length
    };
  });

  readonly linhasFiltradas = computed(() => this.aplicarFiltros());

  readonly resumoLinha = computed(() => {
    const s = this.selection.selected;
    return s.length ? s[0] : null;
  });

  readonly variosSelecionados = computed(() => this.selection.selected.length > 1);

  constructor() {
    effect(() => {
      const vis = this.linhasFiltradas();
      for (const r of [...this.selection.selected]) {
        if (!vis.includes(r)) this.selection.deselect(r);
      }
    });
  }

  setPeriodo(id: PeriodoFiltroId): void {
    this.periodoFiltro.set(id);
  }

  isFiltroRapidoAtivo(id: InadimplenciaFiltroRapidoId): boolean {
    const cur = this.filtroRapido();
    if (id === 'todas') return cur === null || cur === 'todas';
    return cur === id;
  }

  alternarFiltroRapido(id: InadimplenciaFiltroRapidoId): void {
    if (id === 'todas') {
      this.filtroRapido.set(null);
      return;
    }
    this.filtroRapido.update((cur) => (cur === id ? null : id));
  }

  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  textoCelula(v: string | null): string {
    return v && String(v).trim() ? v : '—';
  }

  statusCobrancaClass(s: InadimplenciaStatusCobranca): string {
    const map: Record<InadimplenciaStatusCobranca, string> = {
      'Não enviada': 'inad-chip inad-chip--nao-enviada',
      Enviada: 'inad-chip inad-chip--enviada',
      Reenviada: 'inad-chip inad-chip--reenviada',
      'Em negociação': 'inad-chip inad-chip--negociacao',
      'Acordo realizado': 'inad-chip inad-chip--acordo',
      'Sem retorno': 'inad-chip inad-chip--sem-retorno'
    };
    return map[s] ?? 'inad-chip';
  }

  diasAtrasoBadgeClass(d: number): string {
    if (d > 30) return 'inad-chip inad-chip--dias-30';
    if (d > 15) return 'inad-chip inad-chip--dias-16';
    if (d >= 8) return 'inad-chip inad-chip--dias-8';
    return 'inad-chip inad-chip--dias-1';
  }

  bloquearReenviar(row: InadimplenciaListaItem): boolean {
    return row.statusCobranca === 'Acordo realizado';
  }

  onMasterToggle(ev: MatCheckboxChange): void {
    if (ev.checked) {
      for (const r of this.linhasFiltradas()) this.selection.select(r);
    } else {
      this.selection.clear();
    }
  }

  onRowToggle(row: InadimplenciaListaItem, ev: MatCheckboxChange): void {
    if (ev.checked) this.selection.select(row);
    else this.selection.deselect(row);
  }

  isAllSelected(): boolean {
    const v = this.linhasFiltradas();
    return v.length > 0 && this.selection.selected.length === v.length;
  }

  checkboxLabel(row?: InadimplenciaListaItem): string {
    if (!row) return 'Selecionar todos';
    return `${this.selection.isSelected(row) ? 'Desmarcar' : 'Selecionar'} ${row.id}`;
  }

  acaoMock(_acao: string, _row?: InadimplenciaListaItem): void {}

  abrirAcordo(row?: InadimplenciaListaItem): void {
    const alvo = row ?? this.resumoLinha();
    this.dialog.open(FaturamentoInadimplenciaAcordoDialogComponent, {
      width: '520px',
      maxWidth: '96vw',
      data: {
        faturaId: alvo?.id ?? '—',
        transportadora: alvo?.transportadora ?? '—',
        valorOriginal: alvo?.valor ?? 0
      }
    });
  }

  setDiasFiltro(ev: MatSelectChange): void {
    this.diasFiltro.set(ev.value as InadimplenciaDiasFiltroId);
  }

  setStatusCobrancaFiltro(ev: MatSelectChange): void {
    this.statusCobrancaFiltro.set(ev.value as string);
  }

  private aplicarFiltros(): InadimplenciaListaItem[] {
    let rows = [...this.todas];
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const di = this.diasFiltro();
    const st = this.statusCobrancaFiltro();
    const q = this.filtroRapido();

    if (tr !== 'all') rows = rows.filter((r) => r.transportadora === tr);
    if (es !== 'all') rows = rows.filter((r) => r.estacionamento === es);
    if (st !== 'all') rows = rows.filter((r) => r.statusCobranca === st);

    if (di === '1-7') rows = rows.filter((r) => r.diasAtraso >= 1 && r.diasAtraso <= 7);
    else if (di === '8-15') rows = rows.filter((r) => r.diasAtraso >= 8 && r.diasAtraso <= 15);
    else if (di === 'mais15') rows = rows.filter((r) => r.diasAtraso > 15);
    else if (di === 'mais30') rows = rows.filter((r) => r.diasAtraso > 30);

    if (q === 'd1_7') rows = rows.filter((r) => r.diasAtraso >= 1 && r.diasAtraso <= 7);
    else if (q === 'd8_15') rows = rows.filter((r) => r.diasAtraso >= 8 && r.diasAtraso <= 15);
    else if (q === 'mais15') rows = rows.filter((r) => r.diasAtraso > 15);
    else if (q === 'mais30') rows = rows.filter((r) => r.diasAtraso > 30);
    else if (q === 'semCobranca') rows = rows.filter((r) => r.statusCobranca === 'Não enviada');
    else if (q === 'emNegociacao') rows = rows.filter((r) => r.statusCobranca === 'Em negociação');

    return rows;
  }
}
