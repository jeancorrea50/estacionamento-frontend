import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  afterNextRender,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ECOSSISTEMA_ARESTAS,
  ECOSSISTEMA_FILHOS_COLAPSADOS,
  ECOSSISTEMA_NOS,
} from '../../data/ecossistema-mapa.data';
import {
  EVIDENCIA_LABEL,
  GRUPO_LABEL,
  TIPO_CONEXAO_LABEL,
  type EcossistemaAresta,
  type EcossistemaNo,
  type EscopoConexoes,
  type EvidenciaStatus,
  type GrupoEcossistema,
  type TipoConexao,
} from '../../models/ecossistema.models';
import { EcossistemaLayoutService } from '../../services/ecossistema-layout.service';
import { EcossistemaDiagnosticoService } from '../../services/ecossistema-diagnostico.service';
import { EcossistemaProblemaService } from '../../services/ecossistema-problema.service';
import {
  DIAGNOSTICO_CATEGORIA_LABEL,
  DIAGNOSTICO_SEVERIDADE_LABEL,
  type DiagnosticoAchado,
  type DiagnosticoRelatorio,
  type DiagnosticoSeveridade,
} from '../../models/ecossistema-diagnostico.models';
import {
  PROBLEMA_CATEGORIA_LABEL,
  PROBLEMA_STATUS_LABEL,
  type EcossistemaProblema,
  type ProblemaCategoria,
} from '../../models/ecossistema-problema.models';
import { ECOSSISTEMA_FLUXOS_DIAGNOSTICO } from '../../data/ecossistema-fluxos-diagnostico.data';
import {
  edgeCubicPath,
  highlightDiretas,
  highlightFluxoCompleto,
  strokeDashFor,
} from '../../utils/ecossistema-graph.util';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { finalize } from 'rxjs/operators';

type DragMode = 'none' | 'pan' | 'node';

interface EdgeGeom {
  edge: EcossistemaAresta;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mx: number;
  my: number;
  dimmed: boolean;
  highlighted: boolean;
}

@Component({
  selector: 'app-ecossistema-page',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, FormsModule, RouterLink],
  templateUrl: './ecossistema-page.component.html',
  styleUrl: './ecossistema-page.component.scss',
})
export class EcossistemaPageComponent implements OnInit, OnDestroy {
  @ViewChild('viewport', { static: true }) viewportRef?: ElementRef<HTMLDivElement>;

  private readonly layoutStore = inject(EcossistemaLayoutService);
  private readonly diagnosticoApi = inject(EcossistemaDiagnosticoService);
  private readonly problemaStore = inject(EcossistemaProblemaService);
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly permissions = inject(PermissionCacheService);

  readonly evidLabel = EVIDENCIA_LABEL;
  readonly grupoLabel = GRUPO_LABEL;
  readonly tipoLabel = TIPO_CONEXAO_LABEL;
  readonly sevLabel = DIAGNOSTICO_SEVERIDADE_LABEL;
  readonly catLabel = DIAGNOSTICO_CATEGORIA_LABEL;
  readonly problemaCatLabel = PROBLEMA_CATEGORIA_LABEL;
  readonly problemaStatusLabel = PROBLEMA_STATUS_LABEL;
  readonly nosOpcoes = ECOSSISTEMA_NOS.map((n) => ({ id: n.id, label: n.label }));
  readonly fluxosOpcoes = ECOSSISTEMA_FLUXOS_DIAGNOSTICO.map((f) => ({ id: f.id, nome: f.nome }));

  readonly busca = signal('');
  readonly filtroGrupo = signal<GrupoEcossistema | 'todos'>('todos');
  readonly filtroEvidencia = signal<EvidenciaStatus | 'todos'>('todos');
  readonly filtroTipo = signal<TipoConexao | 'todos'>('todos');
  readonly escopo = signal<EscopoConexoes>('diretas');
  readonly selectedId = signal<string | null>(null);
  readonly highlightIds = signal<Set<string>>(new Set());
  readonly expanded = signal<Set<string>>(new Set());
  readonly minimapaAberto = signal(true);
  readonly erro = signal<string | null>(null);

  /** Painel de diagnóstico ponta a ponta (fluxos vagos, API, sessão). */
  readonly diagnosticoAberto = signal(false);
  readonly diagnosticoLoading = signal(false);
  readonly diagnostico = signal<DiagnosticoRelatorio | null>(null);
  readonly diagnosticoFiltroSev = signal<'todos' | DiagnosticoAchado['severidade']>('todos');

  readonly diagnosticoAchadosFiltrados = computed(() => {
    const rel = this.diagnostico();
    if (!rel) return [];
    const sev = this.diagnosticoFiltroSev();
    if (sev === 'todos') return rel.achados;
    return rel.achados.filter((a) => a.severidade === sev);
  });

  readonly problemasTick = this.problemaStore.problemas;
  readonly mostrarProblemasResolvidos = signal(false);
  readonly formProblemaAberto = signal(false);
  readonly problemaErro = signal<string | null>(null);

  readonly problemasVisiveis = computed(() => {
    this.problemasTick();
    return this.problemaStore.listar({ incluirResolvidos: this.mostrarProblemasResolvidos() });
  });

  /** Problemas do módulo selecionado (abertos + resolvidos), para o painel do nó. */
  readonly problemasDoModuloSelecionado = computed(() => {
    this.problemasTick();
    const id = this.selectedId();
    if (!id) return [];
    return this.problemaStore.porNo(id, { incluirResolvidos: true });
  });

  readonly problemasAbertosDoModulo = computed(() =>
    this.problemasDoModuloSelecionado().filter((p) => p.status === 'aberto')
  );

  readonly nosComProblema = computed(() => {
    this.problemasTick();
    return this.problemaStore.nosDestacados();
  });

  /** Usado no template do painel do módulo (garante vínculo com o nó clicado). */
  problemasDoNo(noId: string): EcossistemaProblema[] {
    this.problemasTick();
    return this.problemaStore.porNo(noId, { incluirResolvidos: true });
  }

  formProblema = {
    titulo: '',
    descricao: '',
    categoria: 'fluxo_vago' as ProblemaCategoria,
    severidade: 'media' as DiagnosticoSeveridade,
    noId: '',
    fluxoId: '',
    destacar: true,
  };

  /** Ponte ngModel ↔ signal de busca. */
  get buscaProxy(): string {
    return this.busca();
  }
  set buscaProxy(v: string) {
    this.busca.set(v ?? '');
    this.erro.set(null);
  }

  readonly viewX = signal(40);
  readonly viewY = signal(24);
  readonly scale = signal(1);

  private positions = signal<Record<string, { x: number; y: number }>>({});
  private dragMode: DragMode = 'none';
  private dragNodeId: string | null = null;
  private dragStart = { x: 0, y: 0, vx: 0, vy: 0, nx: 0, ny: 0 };
  private moved = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  readonly nosVisiveis = computed(() => {
    const pos = this.positions();
    const expanded = this.expanded();
    const g = this.filtroGrupo();
    const ev = this.filtroEvidencia();
    const q = this.busca().trim().toLowerCase();
    const hiddenChildren = new Set<string>();
    for (const n of ECOSSISTEMA_NOS) {
      if (n.childrenIds.length && !expanded.has(n.id)) {
        for (const c of n.childrenIds) hiddenChildren.add(c);
      }
    }
    return ECOSSISTEMA_NOS.filter((n) => {
      if (hiddenChildren.has(n.id)) return false;
      if (g !== 'todos' && n.grupo !== g) return false;
      if (ev !== 'todos' && n.evidencia !== ev) return false;
      if (q && !n.label.toLowerCase().includes(q) && !n.finalidade.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    }).map((n) => {
      const p = pos[n.id] ?? { x: n.x, y: n.y };
      return { ...n, x: p.x, y: p.y };
    });
  });

  readonly arestasGeom = computed((): EdgeGeom[] => {
    const nos = this.nosVisiveis();
    const byId = new Map(nos.map((n) => [n.id, n]));
    const tipo = this.filtroTipo();
    const sel = this.selectedId();
    const hi = this.highlightIds();
    const escopo = this.escopo();

    return ECOSSISTEMA_ARESTAS.filter((e) => {
      if (tipo !== 'todos' && e.tipo !== tipo) return false;
      return byId.has(e.from) && byId.has(e.to);
    }).map((edge) => {
      const a = byId.get(edge.from)!;
      const b = byId.get(edge.to)!;
      const x1 = a.x + a.w;
      const y1 = a.y + a.h / 2;
      const x2 = b.x;
      const y2 = b.y + b.h / 2;
      let highlighted = false;
      let dimmed = false;
      if (sel) {
        if (escopo === 'diretas') {
          highlighted = edge.from === sel || edge.to === sel;
        } else {
          highlighted = hi.has(edge.from) && hi.has(edge.to);
        }
        dimmed = !highlighted;
      }
      return {
        edge,
        x1,
        y1,
        x2,
        y2,
        mx: (x1 + x2) / 2,
        my: (y1 + y2) / 2 - 8,
        highlighted,
        dimmed,
      };
    });
  });

  readonly selecionado = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return ECOSSISTEMA_NOS.find((n) => n.id === id) ?? null;
  });

  readonly worldBounds = computed(() => {
    const nos = this.nosVisiveis();
    if (!nos.length) return { minX: 0, minY: 0, maxX: 1200, maxY: 800 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of nos) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
    return { minX, minY, maxX, maxY };
  });

  private fitOnFirstPaint = false;

  constructor() {
    afterNextRender(() => {
      if (this.fitOnFirstPaint) {
        this.ajustarATela();
      }
    });
  }

  ngOnInit(): void {
    const saved = this.layoutStore.load();
    this.positions.set(saved?.positions ?? this.layoutStore.defaultPositions());
    if (saved?.view) {
      this.viewX.set(saved.view.x);
      this.viewY.set(saved.view.y);
      this.scale.set(saved.view.scale);
    } else {
      this.fitOnFirstPaint = true;
    }
    const exp = new Set<string>();
    if (saved?.expanded?.length) {
      for (const id of saved.expanded) exp.add(id);
    } else {
      for (const n of ECOSSISTEMA_NOS) {
        if (n.childrenIds.length && !ECOSSISTEMA_FILHOS_COLAPSADOS.has(n.childrenIds[0])) {
          exp.add(n.id);
        }
      }
    }
    this.expanded.set(exp);
  }

  ngOnDestroy(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistNow();
  }

  transformStyle(): string {
    return `translate(${this.viewX()}px, ${this.viewY()}px) scale(${this.scale()})`;
  }

  isNodeDimmed(id: string): boolean {
    const sel = this.selectedId();
    if (!sel) return false;
    return !this.highlightIds().has(id);
  }

  isNodeSelected(id: string): boolean {
    return this.selectedId() === id;
  }

  isNodeComProblema(id: string): boolean {
    return this.nosComProblema().has(id);
  }

  isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const el = this.viewportRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const prev = this.scale();
    const next = Math.min(2.2, Math.max(0.35, prev * (ev.deltaY < 0 ? 1.08 : 0.92)));
    if (next === prev) return;
    const wx = (mx - this.viewX()) / prev;
    const wy = (my - this.viewY()) / prev;
    this.scale.set(next);
    this.viewX.set(mx - wx * next);
    this.viewY.set(my - wy * next);
    this.schedulePersist();
  }

  onPointerDownBg(ev: PointerEvent): void {
    if ((ev.target as HTMLElement).closest('.eco-node')) return;
    this.dragMode = 'pan';
    this.moved = false;
    this.dragStart = {
      x: ev.clientX,
      y: ev.clientY,
      vx: this.viewX(),
      vy: this.viewY(),
      nx: 0,
      ny: 0,
    };
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  }

  onPointerDownNode(ev: PointerEvent, id: string): void {
    ev.stopPropagation();
    const n = this.nosVisiveis().find((x) => x.id === id);
    if (!n) return;
    this.dragMode = 'node';
    this.dragNodeId = id;
    this.moved = false;
    this.dragStart = {
      x: ev.clientX,
      y: ev.clientY,
      vx: 0,
      vy: 0,
      nx: n.x,
      ny: n.y,
    };
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  }

  onPointerMove(ev: PointerEvent): void {
    if (this.dragMode === 'none') return;
    const dx = ev.clientX - this.dragStart.x;
    const dy = ev.clientY - this.dragStart.y;
    if (Math.hypot(dx, dy) > 4) this.moved = true;
    if (this.dragMode === 'pan') {
      this.viewX.set(this.dragStart.vx + dx);
      this.viewY.set(this.dragStart.vy + dy);
    } else if (this.dragMode === 'node' && this.dragNodeId) {
      const s = this.scale();
      const map = { ...this.positions() };
      map[this.dragNodeId] = {
        x: this.dragStart.nx + dx / s,
        y: this.dragStart.ny + dy / s,
      };
      this.positions.set(map);
    }
  }

  onPointerUp(ev: PointerEvent): void {
    if (this.dragMode === 'node' && this.dragNodeId && !this.moved) {
      this.selecionar(this.dragNodeId);
    } else if (this.dragMode === 'pan' && !this.moved) {
      this.limparSelecao();
    }
    this.dragMode = 'none';
    this.dragNodeId = null;
    this.schedulePersist();
  }

  onNodeDblClick(id: string): void {
    const n = ECOSSISTEMA_NOS.find((x) => x.id === id);
    if (!n?.childrenIds.length) return;
    const next = new Set(this.expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expanded.set(next);
    this.schedulePersist();
  }

  selecionar(id: string): void {
    this.diagnosticoAberto.set(false);
    this.selectedId.set(id);
    this.recomputeHighlights(id);
  }

  limparSelecao(): void {
    this.selectedId.set(null);
    this.highlightIds.set(new Set());
    if (this.formProblemaAberto() && this.formProblema.noId) {
      this.fecharFormProblema();
    }
  }

  abrirDiagnostico(): void {
    this.limparSelecao();
    this.diagnosticoAberto.set(true);
    this.rodarDiagnostico();
  }

  fecharDiagnostico(): void {
    this.diagnosticoAberto.set(false);
  }

  rodarDiagnostico(): void {
    this.diagnosticoLoading.set(true);
    this.erro.set(null);
    this.diagnosticoApi
      .executar()
      .pipe(finalize(() => this.diagnosticoLoading.set(false)))
      .subscribe({
        next: (rel) => this.diagnostico.set(rel),
        error: () => {
          this.erro.set('Não foi possível concluir o diagnóstico. Tente novamente.');
        },
      });
  }

  focarAchado(a: DiagnosticoAchado): void {
    this.focarNoMapa(a.noId);
  }

  focarNoMapa(noId: string | null | undefined): void {
    if (!noId) return;
    this.diagnosticoAberto.set(false);
    this.selecionar(noId);
    const n = ECOSSISTEMA_NOS.find((x) => x.id === noId);
    if (!n) return;
    const pos = this.positions()[n.id] ?? { x: n.x, y: n.y };
    this.centralizarNo({ ...n, ...pos });
  }

  abrirFormProblema(): void {
    this.formProblemaAberto.set(true);
    this.problemaErro.set(null);
  }

  /** Abre o formulário já preenchido com os dados do módulo selecionado. */
  abrirFormProblemaDoNo(n: EcossistemaNo): void {
    this.preencherFormDoNo(n);
    this.formProblemaAberto.set(true);
    this.problemaErro.set(null);
  }

  fecharFormProblema(): void {
    this.formProblemaAberto.set(false);
    this.problemaErro.set(null);
  }

  salvarProblema(): void {
    this.problemaErro.set(null);
    try {
      const noIdForm = (this.formProblema.noId || this.selectedId() || '').trim() || null;
      const criado = this.problemaStore.criar({
        titulo: this.formProblema.titulo,
        descricao: this.formProblema.descricao,
        categoria: this.formProblema.categoria,
        severidade: this.formProblema.severidade,
        noId: noIdForm,
        fluxoId: this.formProblema.fluxoId || null,
        destacar: this.formProblema.destacar,
      });
      const noId = criado.noId;
      this.formProblema = {
        titulo: '',
        descricao: '',
        categoria: 'fluxo_vago',
        severidade: 'media',
        noId: '',
        fluxoId: '',
        destacar: true,
      };
      this.formProblemaAberto.set(false);
      if (noId) {
        // Mantém o painel do módulo com o problema (e “Como resolver”) visível.
        this.diagnosticoAberto.set(false);
        this.selecionar(noId);
        if (criado.destacar) {
          const n = ECOSSISTEMA_NOS.find((x) => x.id === noId);
          if (n) {
            const pos = this.positions()[n.id] ?? { x: n.x, y: n.y };
            this.centralizarNo({ ...n, ...pos });
          }
        }
      }
    } catch (e) {
      this.problemaErro.set(e instanceof Error ? e.message : 'Não foi possível salvar o problema.');
    }
  }

  private preencherFormDoNo(n: EcossistemaNo): void {
    const fluxo = ECOSSISTEMA_FLUXOS_DIAGNOSTICO.find((f) => f.etapas.includes(n.id));
    this.formProblema = {
      titulo: `Problema em ${n.label}`,
      descricao: this.montarDescricaoDoNo(n),
      categoria: this.inferirCategoriaDoNo(n),
      severidade: n.pendencias.length > 0 ? 'alta' : 'media',
      noId: n.id,
      fluxoId: fluxo?.id ?? '',
      destacar: true,
    };
  }

  private montarDescricaoDoNo(n: EcossistemaNo): string {
    const linhas: string[] = [
      `Módulo: ${n.label}`,
      `Grupo: ${GRUPO_LABEL[n.grupo]}`,
      `Evidência: ${EVIDENCIA_LABEL[n.evidencia]}`,
      `Finalidade: ${n.finalidade}`,
      `Rota: ${n.rota ?? 'sem rota SPA'}`,
    ];
    if (n.pendencias.length) {
      linhas.push(`Pendências: ${n.pendencias.join('; ')}`);
    }
    if (n.regras.length) {
      linhas.push(`Regras: ${n.regras.slice(0, 3).join('; ')}`);
    }
    linhas.push('', 'Descreva o problema observado:');
    return linhas.join('\n');
  }

  private inferirCategoriaDoNo(n: EcossistemaNo): ProblemaCategoria {
    const blob = `${n.regras.join(' ')} ${n.pendencias.join(' ')} ${n.evidenciaDetalhe}`.toLowerCase();
    if (/proxy|smtp|ssl|cors|conexão|conexao|timeout|502|1011/.test(blob)) return 'conexao';
    if (/sessão|sessao|pátio|patio|jwt|claim|estacionamento/.test(blob) && /sess|pátio|patio/.test(blob)) {
      return 'sessao';
    }
    if (/\/api\/|endpoint|swagger|backend|dto|payload/.test(blob)) return 'backend';
    if (n.evidencia === 'proposto' || n.evidencia === 'nao_verificado') return 'fluxo_vago';
    if (n.rota) return 'frontend';
    if (/regra|cobrança|cobranca|acordo|permissão|permissao/.test(blob)) return 'regra_negocio';
    return 'outro';
  }

  resolverProblema(p: EcossistemaProblema): void {
    this.problemaStore.marcarResolvido(p.id);
  }

  reabrirProblema(p: EcossistemaProblema): void {
    this.problemaStore.reabrir(p.id);
  }

  toggleDestacarProblema(p: EcossistemaProblema): void {
    this.problemaStore.toggleDestacar(p.id);
  }

  removerProblema(p: EcossistemaProblema): void {
    if (!confirm(`Remover o problema “${p.titulo}”?`)) return;
    this.problemaStore.remover(p.id);
  }

  /** Helpers tipados para o ng-template (contexto `let-p` chega como any). */
  labelSevProblema(p: EcossistemaProblema): string {
    return this.sevLabel[p.severidade];
  }

  labelCatProblema(p: EcossistemaProblema): string {
    return this.problemaCatLabel[p.categoria];
  }

  labelStatusProblema(p: EcossistemaProblema): string {
    return this.problemaStatusLabel[p.status];
  }

  private recomputeHighlights(id: string): void {
    this.highlightIds.set(
      this.escopo() === 'diretas' ? highlightDiretas(id) : highlightFluxoCompleto(id)
    );
  }

  setEscopo(v: EscopoConexoes): void {
    this.escopo.set(v);
    const id = this.selectedId();
    if (id) this.recomputeHighlights(id);
  }

  buscarECentralizar(): void {
    const q = this.busca().trim().toLowerCase();
    if (!q) return;
    const hit = this.nosVisiveis().find(
      (n) => n.label.toLowerCase().includes(q) || n.finalidade.toLowerCase().includes(q)
    );
    if (!hit) {
      this.erro.set('Nenhum bloco encontrado para a busca.');
      return;
    }
    this.erro.set(null);
    this.selecionar(hit.id);
    this.centralizarNo(hit);
  }

  private centralizarNo(n: EcossistemaNo & { x: number; y: number }): void {
    const el = this.viewportRef?.nativeElement;
    if (!el) return;
    const s = this.scale();
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    this.viewX.set(el.clientWidth / 2 - cx * s);
    this.viewY.set(el.clientHeight / 2 - cy * s);
    this.schedulePersist();
  }

  ajustarATela(): void {
    const el = this.viewportRef?.nativeElement;
    if (!el) return;
    const b = this.worldBounds();
    const pad = 48;
    const w = b.maxX - b.minX + pad * 2;
    const h = b.maxY - b.minY + pad * 2;
    const s = Math.min(el.clientWidth / w, el.clientHeight / h, 1.4);
    this.scale.set(Math.max(0.35, s));
    this.viewX.set((el.clientWidth - (b.minX + b.maxX) * this.scale()) / 2);
    this.viewY.set((el.clientHeight - (b.minY + b.maxY) * this.scale()) / 2);
    this.schedulePersist();
  }

  centralizar(): void {
    const nos = this.nosVisiveis();
    if (!nos.length) return;
    const b = this.worldBounds();
    this.centralizarNo({
      ...nos[0],
      x: (b.minX + b.maxX) / 2 - nos[0].w / 2,
      y: (b.minY + b.maxY) / 2 - nos[0].h / 2,
      w: nos[0].w,
      h: nos[0].h,
    });
  }

  organizarMapa(): void {
    this.layoutStore.clear();
    this.positions.set(this.layoutStore.defaultPositions());
    this.expanded.set(new Set());
    this.limparSelecao();
    this.ajustarATela();
  }

  restaurarLayout(): void {
    this.layoutStore.clear();
    this.positions.set(this.layoutStore.defaultPositions());
    this.expanded.set(new Set());
    this.viewX.set(40);
    this.viewY.set(24);
    this.scale.set(1);
    this.limparSelecao();
    this.erro.set(null);
    this.ajustarATela();
  }

  zoomBy(factor: number): void {
    const el = this.viewportRef?.nativeElement;
    if (!el) return;
    const mx = el.clientWidth / 2;
    const my = el.clientHeight / 2;
    const prev = this.scale();
    const next = Math.min(2.2, Math.max(0.35, prev * factor));
    const wx = (mx - this.viewX()) / prev;
    const wy = (my - this.viewY()) / prev;
    this.scale.set(next);
    this.viewX.set(mx - wx * next);
    this.viewY.set(my - wy * next);
    this.schedulePersist();
  }

  async toggleFullscreen(): Promise<void> {
    const el = this.viewportRef?.nativeElement?.closest('.eco-page') as HTMLElement | null;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      this.erro.set('Não foi possível alternar tela cheia neste navegador.');
    }
  }

  podeAbrirModulo(n: EcossistemaNo): boolean {
    if (!n.rota) return false;
    if (n.permissionKey && !this.permissions.has(n.permissionKey) && !this.permissions.has('*')) {
      return false;
    }
    return this.sessionAccess.canAccessRoute(n.rota);
  }

  edgePath(g: EdgeGeom): string {
    return edgeCubicPath(g.x1, g.y1, g.x2, g.y2);
  }

  strokeDash(e: EcossistemaAresta): string | null {
    return strokeDashFor(e);
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistNow(), 250);
  }

  private persistNow(): void {
    this.layoutStore.save({
      version: 2,
      positions: this.positions(),
      view: { x: this.viewX(), y: this.viewY(), scale: this.scale() },
      expanded: [...this.expanded()],
    });
  }

  @HostListener('window:keydown.escape')
  onEsc(): void {
    if (this.diagnosticoAberto()) {
      this.fecharDiagnostico();
      return;
    }
    this.limparSelecao();
  }

  minimapViewBox(): string {
    const b = this.worldBounds();
    const pad = 40;
    return `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;
  }
}
