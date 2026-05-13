import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import type { FaturaStatusVisao, PeriodoFiltroId } from '../faturamento-visao.types';
import { FATURAS_MOCK } from './faturamento-faturas.mock';
import type { FaturaListaItem, FiltroRapidoFaturas, ModalidadeCobrancaFatura } from './faturamento-faturas.types';

interface PeriodoOpcao {
  id: PeriodoFiltroId;
  label: string;
}

@Component({
  selector: 'app-faturamento-faturas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './faturamento-faturas.component.html',
  styleUrl: './faturamento-faturas.component.scss'
})
export class FaturamentoFaturasComponent {
  readonly todas = FATURAS_MOCK;

  readonly periodoOpcoes: PeriodoOpcao[] = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'semana', label: 'Esta semana' },
    { id: 'mes', label: 'Este mês' },
    { id: 'personalizado', label: 'Personalizado' }
  ];

  readonly modalidades: ModalidadeCobrancaFatura[] = [
    'Diária',
    'Semanal',
    'Quinzenal',
    'Mensal',
    'Por data personalizada'
  ];

  readonly statusOpcoes: FaturaStatusVisao[] = [
    'Pago',
    'Em aberto',
    'Vencido',
    'Parcial',
    'Aguardando envio',
    'Cancelada'
  ];

  readonly filtroRapidoOpcoes: { id: FiltroRapidoFaturas; label: string }[] = [
    { id: 'vencidas', label: 'Vencidas' },
    { id: 'a-vencer', label: 'A vencer' },
    { id: 'dentro-prazo', label: 'Dentro do prazo' },
    { id: 'pagas', label: 'Pagas' },
    { id: 'aguardando-envio', label: 'Aguardando envio' }
  ];

  readonly periodoFiltro = signal<PeriodoFiltroId>('mes');
  dataInicioPersonalizado = '';
  dataFimPersonalizado = '';

  readonly transportadoraFiltro = signal<string>('all');
  readonly estacionamentoFiltro = signal<string>('all');
  readonly modalidadeFiltro = signal<string>('all');
  readonly statusFiltro = signal<string>('all');
  readonly filtroRapido = signal<FiltroRapidoFaturas | null>(null);

  readonly selection = new SelectionModel<FaturaListaItem>(true, []);

  readonly displayedColumns: string[] = [
    'select',
    'fatura',
    'transportadora',
    'estacionamento',
    'modalidade',
    'periodo',
    'valor',
    'vencimento',
    'status',
    'envio',
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

  readonly linhasFiltradas = computed(() => this.aplicarFiltros());

  constructor() {
    effect(() => {
      const vis = this.linhasFiltradas();
      const ids = new Set(vis.map((r) => r.id));
      for (const r of [...this.selection.selected]) {
        if (!ids.has(r.id)) {
          this.selection.deselect(r);
        }
      }
    });
  }

  setPeriodo(id: PeriodoFiltroId): void {
    this.periodoFiltro.set(id);
  }

  alternarFiltroRapido(id: FiltroRapidoFaturas): void {
    this.filtroRapido.update((cur) => (cur === id ? null : id));
  }

  isFiltroRapidoAtivo(id: FiltroRapidoFaturas): boolean {
    return this.filtroRapido() === id;
  }

  /** Linhas visíveis e selecionadas (para ações em lote). */
  selecionadasVisiveis(): FaturaListaItem[] {
    const ids = new Set(this.linhasFiltradas().map((r) => r.id));
    return this.selection.selected.filter((r) => ids.has(r.id));
  }

  isAllSelected(): boolean {
    const rows = this.linhasFiltradas();
    return rows.length > 0 && this.selecionadasVisiveis().length === rows.length;
  }

  onMasterChange(ev: MatCheckboxChange): void {
    const rows = this.linhasFiltradas();
    if (ev.checked) {
      for (const r of rows) {
        this.selection.select(r);
      }
    } else {
      for (const r of rows) {
        this.selection.deselect(r);
      }
    }
  }

  checkboxLabel(row?: FaturaListaItem): string {
    if (!row) {
      return `${this.isAllSelected() ? 'Desmarcar' : 'Marcar'} todas as faturas visíveis`;
    }
    return `${this.selection.isSelected(row) ? 'Desmarcar' : 'Marcar'} fatura ${row.id}`;
  }

  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatData(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) {
      return iso;
    }
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatPeriodo(inicioIso: string, fimIso: string): string {
    const [yi, mi, di] = inicioIso.split('-').map(Number);
    const [yf, mf, df] = fimIso.split('-').map(Number);
    const i = new Date(yi, mi - 1, di);
    const f = new Date(yf, mf - 1, df);
    const p1 = i.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const p2 = f.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${p1} – ${p2}`;
  }

  textoEnvio(row: FaturaListaItem): string {
    const e = row.envio;
    if (e.situacao === 'Não enviado') {
      return '—';
    }
    if (e.situacao === 'Agendado') {
      return `Agendado${e.detalhe ? ` · ${e.detalhe}` : ''}`;
    }
    const canal = e.canal ?? '—';
    return e.detalhe ? `${canal} · ${e.detalhe}` : canal;
  }

  statusChipClass(status: FaturaStatusVisao): string {
    const map: Record<FaturaStatusVisao, string> = {
      Pago: 'fat-faturas-chip fat-faturas-chip--pago',
      'Em aberto': 'fat-faturas-chip fat-faturas-chip--aberto',
      Vencido: 'fat-faturas-chip fat-faturas-chip--vencido',
      Parcial: 'fat-faturas-chip fat-faturas-chip--parcial',
      'Aguardando envio': 'fat-faturas-chip fat-faturas-chip--aguardando',
      Cancelada: 'fat-faturas-chip fat-faturas-chip--cancelada'
    };
    return map[status] ?? 'fat-faturas-chip';
  }

  acaoMock(rotulo: string, fatura?: FaturaListaItem): void {
    void rotulo;
    void fatura;
  }

  loteEmail(): void {
    void this.selecionadasVisiveis().map((r) => r.id);
  }

  loteWhatsapp(): void {
    void this.selecionadasVisiveis().map((r) => r.id);
  }

  lotePdf(): void {
    void this.selecionadasVisiveis().map((r) => r.id);
  }

  loteReenviar(): void {
    void this.selecionadasVisiveis().map((r) => r.id);
  }

  private aplicarFiltros(): FaturaListaItem[] {
    const range = this.periodoRangeAtual();
    let rows = this.todas.filter((r) => this.passPeriodo(r, range));

    const tr = this.transportadoraFiltro();
    if (tr !== 'all') {
      rows = rows.filter((r) => r.transportadora === tr);
    }
    const es = this.estacionamentoFiltro();
    if (es !== 'all') {
      rows = rows.filter((r) => r.estacionamento === es);
    }
    const md = this.modalidadeFiltro();
    if (md !== 'all') {
      rows = rows.filter((r) => r.modalidade === md);
    }
    const st = this.statusFiltro();
    if (st !== 'all') {
      rows = rows.filter((r) => r.status === st);
    }

    const q = this.filtroRapido();
    if (q) {
      rows = rows.filter((r) => this.passFiltroRapido(r, q));
    }

    return rows;
  }

  private passFiltroRapido(row: FaturaListaItem, q: FiltroRapidoFaturas): boolean {
    const hoje = this.startOfDay(new Date());
    const venc = this.parseIsoDate(row.vencimento);

    switch (q) {
      case 'vencidas':
        return row.status === 'Vencido' || (row.status === 'Em aberto' && venc < hoje);
      case 'a-vencer': {
        const limite = this.addDays(hoje, 14);
        return row.status === 'Em aberto' && venc > hoje && venc <= limite;
      }
      case 'dentro-prazo':
        return row.status === 'Em aberto' && venc >= hoje;
      case 'pagas':
        return row.status === 'Pago';
      case 'aguardando-envio':
        return row.status === 'Aguardando envio';
      default:
        return true;
    }
  }

  private passPeriodo(row: FaturaListaItem, range: { inicio: Date; fim: Date } | null): boolean {
    if (!range) {
      return true;
    }
    const a0 = this.parseIsoDate(row.periodoInicio);
    const a1 = this.endOfDay(this.parseIsoDate(row.periodoFim));
    return a0 <= range.fim && a1 >= range.inicio;
  }

  private periodoRangeAtual(): { inicio: Date; fim: Date } | null {
    const id = this.periodoFiltro();
    const hoje = this.startOfDay(new Date());

    if (id === 'personalizado') {
      if (!this.dataInicioPersonalizado || !this.dataFimPersonalizado) {
        return null;
      }
      const i = this.parseIsoDate(this.dataInicioPersonalizado);
      const f = this.endOfDay(this.parseIsoDate(this.dataFimPersonalizado));
      if (f < i) {
        return null;
      }
      return { inicio: i, fim: f };
    }

    if (id === 'hoje') {
      const fim = this.endOfDay(hoje);
      return { inicio: hoje, fim };
    }

    if (id === 'semana') {
      const start = this.startOfWeekMonday(hoje);
      const end = this.endOfDay(this.addDays(start, 6));
      return { inicio: start, fim: end };
    }

    if (id === 'mes') {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = this.endOfDay(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
      return { inicio, fim };
    }

    return null;
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private endOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }

  private addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return this.startOfDay(x);
  }

  private startOfWeekMonday(ref: Date): Date {
    const d = this.startOfDay(ref);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d;
  }

  private parseIsoDate(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}
