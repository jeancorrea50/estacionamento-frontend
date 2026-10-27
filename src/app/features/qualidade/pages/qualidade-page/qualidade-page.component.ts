import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../core/api/services/toast.service';
import type {
  QualidadeCamada,
  QualidadeCasoView,
  QualidadeSeveridade,
  QualidadeStatus,
  QualidadeTipoCobertura,
} from '../../models/qualidade.models';
import {
  QUALIDADE_CAMADA_LABEL,
  QUALIDADE_SEVERIDADE_LABEL,
  QUALIDADE_STATUS_LABEL,
  QUALIDADE_TIPO_LABEL,
} from '../../models/qualidade.models';
import { LocalQualidadeExecutionRepository } from '../../repositories/local-qualidade-execution.repository';
import { QualidadeExecutionRepository } from '../../repositories/qualidade-execution.repository';
import {
  QualidadeCatalogService,
  type QualidadeCatalogSnapshot,
} from '../../services/qualidade-catalog.service';

@Component({
  selector: 'app-qualidade-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './qualidade-page.component.html',
  styleUrls: ['./qualidade-page.component.scss'],
  providers: [
    { provide: QualidadeExecutionRepository, useExisting: LocalQualidadeExecutionRepository },
  ],
})
export class QualidadePageComponent implements OnInit {
  private readonly catalog = inject(QualidadeCatalogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly snapshot = signal<QualidadeCatalogSnapshot | null>(null);
  readonly selecionadoId = signal<string | null>(null);

  readonly filtroModulo = signal<string>('');
  readonly filtroCamada = signal<string>('');
  readonly filtroSeveridade = signal<string>('');
  readonly filtroStatus = signal<string>('');
  readonly filtroTipo = signal<string>('');
  readonly filtroTexto = signal('');

  readonly statusOpcoes = Object.entries(QUALIDADE_STATUS_LABEL).map(([value, label]) => ({
    value: value as QualidadeStatus,
    label,
  }));
  readonly camadaOpcoes = Object.entries(QUALIDADE_CAMADA_LABEL).map(([value, label]) => ({
    value: value as QualidadeCamada,
    label,
  }));
  readonly severidadeOpcoes = Object.entries(QUALIDADE_SEVERIDADE_LABEL).map(([value, label]) => ({
    value: value as QualidadeSeveridade,
    label,
  }));
  readonly tipoOpcoes = Object.entries(QUALIDADE_TIPO_LABEL).map(([value, label]) => ({
    value: value as QualidadeTipoCobertura,
    label,
  }));
  readonly statusLabel = QUALIDADE_STATUS_LABEL;
  readonly camadaLabel = QUALIDADE_CAMADA_LABEL;
  readonly severidadeLabel = QUALIDADE_SEVERIDADE_LABEL;
  readonly tipoLabel = QUALIDADE_TIPO_LABEL;

  /** Formulário de registro manual. */
  formStatus: QualidadeStatus = 'nao_executado';
  formResultado = '';
  formObs = '';
  formEvidencia = '';
  formAmbiente = 'local';
  formVersao = 'dev';
  formResponsavel = '';
  salvando = signal(false);

  readonly casosFiltrados = computed(() => {
    const snap = this.snapshot();
    if (!snap) return [];
    const mod = this.filtroModulo();
    const camada = this.filtroCamada();
    const sev = this.filtroSeveridade();
    const st = this.filtroStatus();
    const tipo = this.filtroTipo();
    const q = this.filtroTexto().trim().toLowerCase();
    return snap.casos.filter((c) => {
      if (mod && c.moduloId !== mod) return false;
      if (camada && c.caso.camada !== camada) return false;
      if (sev && c.caso.severidade !== sev) return false;
      if (st && c.statusEfetivo !== st) return false;
      if (tipo && c.caso.tipoCobertura !== tipo) return false;
      if (q) {
        const blob = `${c.caso.id} ${c.caso.titulo} ${c.moduloTitulo} ${c.telaTitulo}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  });

  readonly selecionado = computed(() => {
    const id = this.selecionadoId();
    if (!id) return null;
    return this.casosFiltrados().find((c) => c.caso.id === id) ?? null;
  });

  readonly falhas = computed(() =>
    this.casosFiltrados().filter((c) => c.statusEfetivo === 'falhou')
  );

  readonly arvore = computed(() => {
    const grupos = new Map<
      string,
      {
        moduloId: string;
        moduloTitulo: string;
        telas: Map<
          string,
          {
            telaId: string;
            telaTitulo: string;
            funcoes: Map<string, { fnId: string; fnTitulo: string; casos: QualidadeCasoView[] }>;
          }
        >;
      }
    >();
    for (const c of this.casosFiltrados()) {
      if (!grupos.has(c.moduloId)) {
        grupos.set(c.moduloId, {
          moduloId: c.moduloId,
          moduloTitulo: c.moduloTitulo,
          telas: new Map(),
        });
      }
      const mod = grupos.get(c.moduloId)!;
      if (!mod.telas.has(c.telaId)) {
        mod.telas.set(c.telaId, {
          telaId: c.telaId,
          telaTitulo: c.telaTitulo,
          funcoes: new Map(),
        });
      }
      const tela = mod.telas.get(c.telaId)!;
      if (!tela.funcoes.has(c.funcionalidadeId)) {
        tela.funcoes.set(c.funcionalidadeId, {
          fnId: c.funcionalidadeId,
          fnTitulo: c.funcionalidadeTitulo,
          casos: [],
        });
      }
      tela.funcoes.get(c.funcionalidadeId)!.casos.push(c);
    }
    return [...grupos.values()].map((m) => ({
      ...m,
      telas: [...m.telas.values()].map((t) => ({
        ...t,
        funcoes: [...t.funcoes.values()],
      })),
    }));
  });

  ngOnInit(): void {
    this.recarregar();
  }

  recarregar(): void {
    this.loading.set(true);
    this.catalog.carregarSnapshot().subscribe({
      next: (snap) => {
        this.snapshot.set(snap);
        this.loading.set(false);
        const sel = this.selecionadoId();
        if (sel && !snap.casos.some((c) => c.caso.id === sel)) {
          this.selecionadoId.set(null);
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Não foi possível carregar o inventário de qualidade.');
      },
    });
  }

  selecionar(casoId: string): void {
    this.selecionadoId.set(casoId);
    const view = this.snapshot()?.casos.find((c) => c.caso.id === casoId);
    this.formStatus = view?.ultimoRegistro?.status ?? 'nao_executado';
    this.formResultado = view?.ultimoRegistro?.resultadoObtido ?? '';
    this.formObs = view?.ultimoRegistro?.observacoes ?? '';
    this.formEvidencia = view?.ultimoRegistro?.evidenciaTexto ?? '';
  }

  limparFiltros(): void {
    this.filtroModulo.set('');
    this.filtroCamada.set('');
    this.filtroSeveridade.set('');
    this.filtroStatus.set('');
    this.filtroTipo.set('');
    this.filtroTexto.set('');
  }

  registrarManual(): void {
    const sel = this.selecionado();
    if (!sel) {
      this.toast.error('Selecione um caso na árvore.');
      return;
    }
    this.salvando.set(true);
    this.catalog.executionRepo
      .registrarManual({
        casoId: sel.caso.id,
        status: this.formStatus,
        resultadoObtido: this.formResultado,
        observacoes: this.formObs,
        evidenciaTexto: this.formEvidencia,
        ambiente: this.formAmbiente,
        versaoApp: this.formVersao,
        responsavelLocal: this.formResponsavel || 'operador-local',
      })
      .subscribe({
        next: () => {
          this.salvando.set(false);
          this.toast.success('Resultado manual registrado (somente neste navegador).');
          this.recarregar();
        },
        error: (err: unknown) => {
          this.salvando.set(false);
          const msg =
            err instanceof Error ? err.message : 'Não foi possível registrar o resultado.';
          this.toast.error(msg);
        },
      });
  }

  limparCasoLocal(): void {
    const sel = this.selecionado();
    if (!sel) return;
    this.catalog.executionRepo.limparCaso(sel.caso.id).subscribe({
      next: () => {
        this.toast.success('Histórico local do caso removido.');
        this.formResultado = '';
        this.formObs = '';
        this.formEvidencia = '';
        this.formStatus = 'nao_executado';
        this.recarregar();
      },
    });
  }

  exportarJson(): void {
    const snap = this.snapshot();
    if (!snap) return;
    const payload = {
      geradoEm: new Date().toISOString(),
      aviso:
        'Histórico local não é compartilhado entre usuários/dispositivos. Sem dados sensíveis.',
      resumo: snap.resumo,
      specsOrfaos: snap.specsOrfaos,
      vitest: { ...snap.vitest, aviso: snap.vitest.aviso },
      playwright: { ...snap.playwright, aviso: snap.playwright.aviso },
      casos: snap.casos.map((c) => ({
        id: c.caso.id,
        titulo: c.caso.titulo,
        modulo: c.moduloTitulo,
        tela: c.telaTitulo,
        statusEfetivo: c.statusEfetivo,
        tipoCobertura: c.caso.tipoCobertura,
        artefatoStatus: c.artefatoStatus,
        ultimoStatusManual: c.ultimoRegistro?.status ?? null,
        ultimoEm: c.ultimoRegistro?.criadoEm ?? null,
      })),
    };
    this.downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `qualidade-relatorio-${Date.now()}.json`
    );
  }

  exportarCsv(): void {
    const rows = this.casosFiltrados();
    const header = [
      'id',
      'titulo',
      'modulo',
      'tela',
      'status',
      'tipoCobertura',
      'camada',
      'severidade',
    ];
    const lines = [header.join(';')];
    for (const c of rows) {
      lines.push(
        [
          c.caso.id,
          csvEscape(c.caso.titulo),
          csvEscape(c.moduloTitulo),
          csvEscape(c.telaTitulo),
          c.statusEfetivo,
          c.caso.tipoCobertura,
          c.caso.camada,
          c.caso.severidade,
        ].join(';')
      );
    }
    this.downloadBlob(
      new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }),
      `qualidade-casos-${Date.now()}.csv`
    );
  }

  private downloadBlob(blob: Blob, nome: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function csvEscape(value: string): string {
  const v = value.replace(/"/g, '""');
  return `"${v}"`;
}
