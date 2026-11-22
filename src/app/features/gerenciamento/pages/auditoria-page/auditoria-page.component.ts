import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import type { ApiError } from '../../../../core/api/models';
import type { AuditoriaEvento } from '../../models/banco-dados-conexao.models';
import { BancoDadosConexaoService } from '../../services/banco-dados-conexao.service';

const TAMANHO_PAGINA = 25;
const ENTIDADE_PADRAO = 'BancoDadosConexao';

@Component({
  selector: 'app-auditoria-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './auditoria-page.component.html',
  styleUrls: ['./auditoria-page.component.scss'],
})
export class AuditoriaPageComponent implements OnInit {
  private readonly api = inject(BancoDadosConexaoService);

  readonly loading = signal(true);
  readonly erro = signal<string | null>(null);
  readonly itens = signal<AuditoriaEvento[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly tamanho = signal(TAMANHO_PAGINA);
  readonly entidadeFiltro = signal(ENTIDADE_PADRAO);

  readonly totalPaginas = computed(() => {
    const t = this.total();
    const tam = this.tamanho();
    if (!t || !tam) return 1;
    return Math.max(1, Math.ceil(t / tam));
  });

  readonly podeAnterior = computed(() => this.pagina() > 1);
  readonly podeProxima = computed(() => this.pagina() < this.totalPaginas());

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.erro.set(null);
    const entidade = this.entidadeFiltro().trim() || undefined;
    this.api
      .listarAuditoria({
        entidade,
        pagina: this.pagina(),
        tamanho: this.tamanho(),
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => {
          this.itens.set(r?.itens ?? []);
          this.total.set(r?.total ?? 0);
          if (r?.pagina) this.pagina.set(r.pagina);
          if (r?.tamanho) this.tamanho.set(r.tamanho);
        },
        error: (err: ApiError) => {
          this.erro.set(err?.message ?? 'Não foi possível carregar a auditoria.');
          this.itens.set([]);
          this.total.set(0);
        },
      });
  }

  aplicarFiltroEntidade(): void {
    this.pagina.set(1);
    this.carregar();
  }

  paginaAnterior(): void {
    if (!this.podeAnterior()) return;
    this.pagina.update((p) => Math.max(1, p - 1));
    this.carregar();
  }

  paginaProxima(): void {
    if (!this.podeProxima()) return;
    this.pagina.update((p) => p + 1);
    this.carregar();
  }

  detalheResumido(detalhe?: string | null, max = 96): string {
    const t = String(detalhe ?? '').trim();
    if (!t) return '—';
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  }

  usuarioLabel(ev: AuditoriaEvento): string {
    const nome = String(ev.usuarioNome ?? '').trim();
    if (nome) return nome;
    if (ev.usuarioId != null && ev.usuarioId > 0) return `#${ev.usuarioId}`;
    return '—';
  }
}