import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import type { PeriodoFiltroId } from '../faturamento-visao.types';
import { RECEBIMENTOS_MOCK } from './faturamento-recebimentos.mock';
import { FaturamentoRecebimentosPartialDialogComponent } from './faturamento-recebimentos-partial-dialog.component';
import type {
  RecebimentoComprovanteEstado,
  RecebimentoFiltroRapidoId,
  RecebimentoListaItem,
  RecebimentoPagamentoStatus,
  RecebimentoPartialDialogData
} from './faturamento-recebimentos.types';

interface PeriodoOpcao {
  id: PeriodoFiltroId;
  label: string;
}

@Component({
  selector: 'app-faturamento-recebimentos',
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
  templateUrl: './faturamento-recebimentos.component.html',
  styleUrls: ['./faturamento-recebimentos.component.scss']
})
export class FaturamentoRecebimentosComponent {
  private readonly dialog = inject(MatDialog);

  readonly todas = RECEBIMENTOS_MOCK;

  readonly periodoOpcoes: PeriodoOpcao[] = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'semana', label: 'Esta semana' },
    { id: 'mes', label: 'Este mês' },
    { id: 'personalizado', label: 'Personalizado' }
  ];

  readonly statusPagamentoOpcoes: RecebimentoPagamentoStatus[] = [
    'Pago',
    'Parcial',
    'Em aberto',
    'Vencido',
    'Cancelada'
  ];

  readonly formasPagamento = ['PIX', 'Boleto', 'Transferência', 'Cartão', 'Dinheiro', 'Outros'] as const;

  readonly periodoFiltro = signal<PeriodoFiltroId>('mes');
  dataInicioPersonalizado = '';
  dataFimPersonalizado = '';

  readonly transportadoraFiltro = signal<string>('all');
  readonly estacionamentoFiltro = signal<string>('all');
  readonly statusFiltro = signal<string>('all');
  readonly formaFiltro = signal<string>('all');
  readonly filtroRapido = signal<RecebimentoFiltroRapidoId | null>(null);

  readonly selection = new SelectionModel<RecebimentoListaItem>(true, []);

  readonly displayedColumns: string[] = [
    'select',
    'fatura',
    'transportadora',
    'valorFatura',
    'valorRecebido',
    'saldoRestante',
    'dataPagamento',
    'formaPagamento',
    'comprovante',
    'status',
    'acoes'
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
    const comArquivo = (r: RecebimentoListaItem) =>
      r.comprovante === 'Anexado' || r.comprovante === 'Aguardando conferência';
    return {
      todos: rows.length,
      pagos: rows.filter((r) => r.status === 'Pago').length,
      parciais: rows.filter((r) => r.status === 'Parcial').length,
      pendentes: rows.filter((r) => r.status === 'Em aberto').length,
      vencidos: rows.filter((r) => r.status === 'Vencido').length,
      comComprovante: rows.filter(comArquivo).length,
      semComprovante: rows.filter((r) => r.comprovante === 'Sem comprovante').length
    };
  });

  readonly linhasFiltradas = computed(() => this.aplicarFiltros());

  readonly resumoLinha = computed(() => {
    const s = this.selection.selected;
    if (s.length === 0) return null;
    return s[0];
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

  isFiltroRapidoAtivo(id: RecebimentoFiltroRapidoId): boolean {
    const cur = this.filtroRapido();
    if (id === 'todos') return cur === null || cur === 'todos';
    return cur === id;
  }

  alternarFiltroRapido(id: RecebimentoFiltroRapidoId): void {
    if (id === 'todos') {
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

  statusChipClass(status: RecebimentoPagamentoStatus): string {
    const map: Record<RecebimentoPagamentoStatus, string> = {
      Pago: 'visao-chip visao-chip--pago',
      Parcial: 'visao-chip visao-chip--parcial',
      'Em aberto': 'visao-chip visao-chip--aberto',
      Vencido: 'visao-chip visao-chip--vencido',
      Cancelada: 'visao-chip visao-chip--cancelada'
    };
    return map[status] ?? 'visao-chip';
  }

  comprovanteChipClass(c: RecebimentoComprovanteEstado): string {
    if (c === 'Anexado') return 'visao-chip visao-chip--pago';
    if (c === 'Aguardando conferência') return 'visao-chip visao-chip--parcial';
    if (c === 'Sem comprovante') return 'visao-chip visao-chip--aguardando';
    return 'visao-chip visao-chip--cancelada';
  }

  bloquearPagamentoPrincipal(row: RecebimentoListaItem): boolean {
    return row.status === 'Pago' || row.status === 'Cancelada';
  }

  onMasterToggle(ev: MatCheckboxChange): void {
    if (ev.checked) {
      for (const r of this.linhasFiltradas()) this.selection.select(r);
    } else {
      this.selection.clear();
    }
  }

  onRowToggle(row: RecebimentoListaItem, ev: MatCheckboxChange): void {
    if (ev.checked) this.selection.select(row);
    else this.selection.deselect(row);
  }

  isAllSelected(): boolean {
    const v = this.linhasFiltradas();
    return v.length > 0 && this.selection.selected.length === v.length;
  }

  checkboxLabel(row?: RecebimentoListaItem): string {
    if (!row) return 'Selecionar todos';
    return `${this.selection.isSelected(row) ? 'Desmarcar' : 'Selecionar'} ${row.id}`;
  }

  acaoMock(acao: string, row?: RecebimentoListaItem): void {
    void acao;
    void row;
  }

  abrirPagamentoParcial(row?: RecebimentoListaItem): void {
    const alvo = row ?? this.resumoLinha();
    const data: RecebimentoPartialDialogData = {
      faturaId: alvo?.id ?? '—',
      valorTotal: alvo?.valorFatura ?? 0,
      valorJaRecebido: alvo?.valorRecebido ?? 0,
      saldoRestante: alvo?.saldoRestante ?? 0
    };
    this.dialog.open(FaturamentoRecebimentosPartialDialogComponent, {
      width: '520px',
      maxWidth: '96vw',
      data
    });
  }

  private aplicarFiltros(): RecebimentoListaItem[] {
    let rows = [...this.todas];
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const st = this.statusFiltro();
    const fo = this.formaFiltro();
    const q = this.filtroRapido();

    if (tr !== 'all') rows = rows.filter((r) => r.transportadora === tr);
    if (es !== 'all') rows = rows.filter((r) => r.estacionamento === es);
    if (st !== 'all') rows = rows.filter((r) => r.status === st);
    if (fo !== 'all') rows = rows.filter((r) => r.formaPagamento === fo);

    if (q === 'pagos') rows = rows.filter((r) => r.status === 'Pago');
    else if (q === 'parciais') rows = rows.filter((r) => r.status === 'Parcial');
    else if (q === 'pendentes') rows = rows.filter((r) => r.status === 'Em aberto');
    else if (q === 'vencidos') rows = rows.filter((r) => r.status === 'Vencido');
    else if (q === 'comComprovante') {
      rows = rows.filter((r) => r.comprovante === 'Anexado' || r.comprovante === 'Aguardando conferência');
    } else if (q === 'semComprovante') rows = rows.filter((r) => r.comprovante === 'Sem comprovante');

    return rows;
  }
}
