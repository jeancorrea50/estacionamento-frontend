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

import { FECHAMENTOS_MOCK } from './faturamento-fechamentos.mock';
import type {
  FechamentoDetalheResumo,
  FechamentoFiltroRapidoId,
  FechamentoListaItem,
  FechamentoModalidade,
  FechamentoPeriodoFiltroId,
  FechamentoSituacao,
  FechamentoValidacaoAlerta
} from './faturamento-fechamentos.types';

@Component({
  selector: 'app-faturamento-fechamentos',
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
  templateUrl: './faturamento-fechamentos.component.html',
  styleUrls: ['./faturamento-fechamentos.component.scss', '../faturas/faturamento-faturas.component.scss']
})
export class FaturamentoFechamentosComponent {
  readonly todas = FECHAMENTOS_MOCK;

  readonly periodoTipo = signal<FechamentoPeriodoFiltroId>('este-mes');
  dataInicioPersonalizado = '';
  dataFimPersonalizado = '';

  readonly transportadoraFiltro = signal<string>('all');
  readonly estacionamentoFiltro = signal<string>('all');
  readonly modalidadeFiltro = signal<string>('all');
  readonly situacaoFiltro = signal<string>('all');
  readonly filtroRapido = signal<FechamentoFiltroRapidoId | null>(null);

  readonly selection = new SelectionModel<FechamentoListaItem>(true, []);

  readonly displayedColumns: string[] = [
    'select',
    'transportadora',
    'estacionamento',
    'modalidade',
    'periodoApurado',
    'movimentacoes',
    'valorEstimado',
    'divergencias',
    'situacao',
    'acoes'
  ];

  readonly modalidades: FechamentoModalidade[] = [
    'Diária',
    'Semanal',
    'Quinzenal',
    'Mensal',
    'Por data personalizada'
  ];

  readonly situacoesFiltro: FechamentoSituacao[] = [
    'Em andamento',
    'Pronto para faturar',
    'Faturado',
    'Com divergência',
    'Cancelado'
  ];

  readonly periodoOpcoes: { id: FechamentoPeriodoFiltroId; label: string }[] = [
    { id: 'este-mes', label: 'Este mês' },
    { id: 'mes-anterior', label: 'Mês anterior' },
    { id: 'ultimos-30', label: 'Últimos 30 dias' },
    { id: 'personalizado', label: 'Por data personalizada' }
  ];

  readonly filtroRapidoOpcoes: { id: FechamentoFiltroRapidoId; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'prontos', label: 'Prontos' },
    { id: 'andamento', label: 'Em andamento' },
    { id: 'divergencia', label: 'Com divergência' },
    { id: 'faturados', label: 'Faturados' },
    { id: 'cancelados', label: 'Cancelados' }
  ];

  readonly validacoes: FechamentoValidacaoAlerta[] = [
    { id: 'v1', texto: '3 movimentações sem transportadora vinculada', severidade: 'atencao' },
    { id: 'v2', texto: '2 placas sem vínculo com cadastro', severidade: 'atencao' },
    { id: 'v3', texto: '1 item com valor zerado', severidade: 'atencao' },
    { id: 'v4', texto: '2 movimentações já faturadas anteriormente', severidade: 'critico' }
  ];

  readonly transportadorasOpcoes = computed(() => {
    const u = new Set(this.todas.map((r) => r.transportadora));
    return [...u].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly estacionamentosOpcoes = computed(() => {
    const u = new Set(this.todas.map((r) => r.estacionamento));
    return [...u].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly contagemPorSituacao = computed(() => {
    const m = new Map<FechamentoSituacao, number>();
    for (const s of this.situacoesFiltro) m.set(s, 0);
    for (const r of this.todas) {
      m.set(r.situacao, (m.get(r.situacao) ?? 0) + 1);
    }
    return m;
  });

  chipBadge(id: FechamentoFiltroRapidoId): number {
    const c = this.contagemPorSituacao();
    switch (id) {
      case 'todos':
        return this.todas.length;
      case 'prontos':
        return c.get('Pronto para faturar') ?? 0;
      case 'andamento':
        return c.get('Em andamento') ?? 0;
      case 'divergencia':
        return c.get('Com divergência') ?? 0;
      case 'faturados':
        return c.get('Faturado') ?? 0;
      case 'cancelados':
        return c.get('Cancelado') ?? 0;
      default:
        return 0;
    }
  }

  readonly linhasFiltradas = computed(() => this.aplicarFiltros());

  /** KPIs do conjunto completo (mock), alinhados à especificação da aba. */
  readonly kpisGlobais = computed(() => {
    const todas = this.todas;
    const c = this.contagemPorSituacao();
    const valorEstimado = todas.reduce((a, r) => a + r.valorEstimado, 0);
    return {
      disponiveis: todas.length,
      prontos: c.get('Pronto para faturar') ?? 0,
      valorEstimado,
      divergencias: c.get('Com divergência') ?? 0
    };
  });

  readonly resumoSelecionado = computed(() => {
    const sel = this.selection.selected;
    if (sel.length !== 1) return null;
    return sel[0];
  });

  readonly detalheResumo = computed(() => {
    const row = this.resumoSelecionado();
    if (!row) return null;
    return this.buildDetalhe(row);
  });

  constructor() {
    effect(() => {
      const vis = this.linhasFiltradas();
      for (const r of this.selection.selected) {
        if (!vis.includes(r)) this.selection.deselect(r);
      }
    });
  }

  setPeriodoTipo(id: FechamentoPeriodoFiltroId): void {
    this.periodoTipo.set(id);
  }

  setFiltroRapido(id: FechamentoFiltroRapidoId): void {
    this.filtroRapido.update((cur) => (cur === id ? null : id));
  }

  isFiltroRapidoAtivo(id: FechamentoFiltroRapidoId): boolean {
    return this.filtroRapido() === id;
  }

  aplicarFiltros(): FechamentoListaItem[] {
    let rows = [...this.todas];
    const tr = this.transportadoraFiltro();
    const es = this.estacionamentoFiltro();
    const md = this.modalidadeFiltro();
    const st = this.situacaoFiltro();
    const rap = this.filtroRapido();

    if (tr !== 'all') rows = rows.filter((r) => r.transportadora === tr);
    if (es !== 'all') rows = rows.filter((r) => r.estacionamento === es);
    if (md !== 'all') rows = rows.filter((r) => r.modalidade === md);
    if (st !== 'all') rows = rows.filter((r) => r.situacao === st);

    if (rap === 'prontos') rows = rows.filter((r) => r.situacao === 'Pronto para faturar');
    else if (rap === 'andamento') rows = rows.filter((r) => r.situacao === 'Em andamento');
    else if (rap === 'divergencia') rows = rows.filter((r) => r.situacao === 'Com divergência');
    else if (rap === 'faturados') rows = rows.filter((r) => r.situacao === 'Faturado');
    else if (rap === 'cancelados') rows = rows.filter((r) => r.situacao === 'Cancelado');

    return rows;
  }

  private buildDetalhe(row: FechamentoListaItem): FechamentoDetalheResumo {
    if (row.id === 'FC-001') {
      return {
        diarias: 7_200,
        mensalistas: 2_500,
        lavagens: 850,
        servicosExtras: 600,
        descontos: -310,
        acrescimos: 0,
        beneficios: 0,
        totalEstimado: 10_840
      };
    }
    const t = row.valorEstimado;
    if (t <= 0) {
      return {
        diarias: 0,
        mensalistas: 0,
        lavagens: 0,
        servicosExtras: 0,
        descontos: 0,
        acrescimos: 0,
        beneficios: 0,
        totalEstimado: 0
      };
    }
    const diarias = Math.round(t * 0.55);
    const mensalistas = Math.round(t * 0.2);
    const lavagens = Math.round(t * 0.1);
    const servicosExtras = Math.round(t * 0.08);
    const descontos = -Math.round(t * 0.03);
    const sub = diarias + mensalistas + lavagens + servicosExtras + descontos;
    const totalEstimado = Math.max(0, sub);
    return {
      diarias,
      mensalistas,
      lavagens,
      servicosExtras,
      descontos,
      acrescimos: 0,
      beneficios: 0,
      totalEstimado
    };
  }

  isAllSelected(): boolean {
    const vis = this.linhasFiltradas();
    return vis.length > 0 && this.selection.selected.length === vis.length;
  }

  masterToggle(ev: MatCheckboxChange): void {
    const vis = this.linhasFiltradas();
    if (ev.checked) {
      for (const r of vis) this.selection.select(r);
    } else {
      for (const r of vis) this.selection.deselect(r);
    }
  }

  checkboxLabel(row?: FechamentoListaItem): string {
    if (!row) return 'Selecionar todos os fechamentos visíveis';
    return `${this.selection.isSelected(row) ? 'Desmarcar' : 'Marcar'} fechamento ${row.id}`;
  }

  formatCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  situacaoChipClass(s: FechamentoSituacao): string {
    const map: Record<FechamentoSituacao, string> = {
      'Pronto para faturar': 'fat-fech-chip fat-fech-chip--pronto',
      'Em andamento': 'fat-fech-chip fat-fech-chip--andamento',
      Faturado: 'fat-fech-chip fat-fech-chip--faturado',
      'Com divergência': 'fat-fech-chip fat-fech-chip--divergencia',
      Cancelado: 'fat-fech-chip fat-fech-chip--cancelado'
    };
    return map[s] ?? 'fat-fech-chip';
  }

  bloquearGeracao(s: FechamentoSituacao): boolean {
    return s === 'Com divergência' || s === 'Cancelado' || s === 'Faturado';
  }

  acaoMock(acao: string, row?: FechamentoListaItem): void {
    void row;
    void acao;
  }
}
