import { ChangeDetectorRef, Component, NgZone, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { EstacionamentoService } from '../../services/estacionamento.service';
import {
  EstacionamentoSearchField,
  EstacionamentoToolbarService,
} from '../../services/estacionamento-toolbar.service';
import { EstacionamentoListItemDTO } from '../../models/estacionamento.dto';
import { formatCnpj } from '../../directives/cnpj-format.directive';
import { formatCpf } from '../../directives/cpf-format.directive';
import { ApiError } from '../../../../core/api/models';
import { ToastService } from '../../../../core/api/services/toast.service';
import { CADASTRO_ESTACIONAMENTOS_ROUTE } from '../../cadastro-rotas';
import { AuthService } from '../../../../core/services/auth.service';
import { EstSummaryMetricComponent } from '../../components/est-summary-metric/est-summary-metric.component';
import { EstStatusPillEstacionamentoComponent } from '../../components/est-status-pill-estacionamento/est-status-pill-estacionamento.component';
import { EstacionamentoViewDialogComponent } from '../../components/estacionamento-view-dialog/estacionamento-view-dialog.component';

/** Colunas ordenáveis (mapeadas para `Propriedade` na API). */
type EstacionamentoListaSortCol =
  | 'id'
  | 'descricao'
  | 'nomeRazaoSocial'
  | 'cnpj'
  | 'capacidadeVeiculo'
  | 'tamanhoTerreno'
  | 'ativo';

@Component({
  selector: 'app-estacionamento-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    EstSummaryMetricComponent,
    EstStatusPillEstacionamentoComponent,
  ],
  templateUrl: './estacionamento-list.component.html',
  styleUrls: ['./estacionamento-list.component.scss'],
})
export class EstacionamentoListComponent {
  protected readonly estacionamentosRoute = CADASTRO_ESTACIONAMENTOS_ROUTE;

  private EstacionamentoService = inject(EstacionamentoService);
  /** Exposto para o template: `trigger() === 0` = ainda não houve clique em Buscar. */
  readonly toolbar = inject(EstacionamentoToolbarService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  readonly canExcluir = this.auth.isAdmin();

  itens: EstacionamentoListItemDTO[] = [];
  /** Só vira true durante GET Buscar; antes do primeiro clique em "Buscar" não há requisição. */
  loading = false;
  erro: string | null = null;
  /** Durante DELETE /api/Estacionamento/{id} */
  excluindoId: number | null = null;
  numeroPagina = 1;
  totalCount = 0;
  tamanhoPagina = 10;
  readonly opcoesTamanhoPagina: number[] = [10, 25, 50];

  /** Ordenação no backend (`Propriedade` + `Sort`). */
  sortCol: EstacionamentoListaSortCol | null = null;
  sortDir: 'Asc' | 'Desc' = 'Asc';

  constructor() {
    effect(() => {
      const t = this.toolbar.trigger();
      // Admin: espera o clique em Buscar. Perfil Estacionamento: carrega o pátio da sessão.
      if (t === 0 && this.auth.isAdmin()) {
        this.ngZone.run(() => {
          this.loading = false;
          this.itens = [];
          this.erro = null;
          this.totalCount = 0;
          this.cdr.markForCheck();
        });
        return;
      }
      this.buscar();
    });
  }

  get totalPaginas(): number {
    if (this.tamanhoPagina <= 0) return 0;
    return Math.max(1, Math.ceil(this.totalCount / this.tamanhoPagina));
  }

  /** Intervalo exibido no rodapé (“Mostrando X a Y de Z registros”). */
  get intervaloExibicao(): { de: number; ate: number } {
    if (this.totalCount <= 0) {
      return { de: 0, ate: 0 };
    }
    const de = (this.numeroPagina - 1) * this.tamanhoPagina + 1;
    const ate = Math.min(this.numeroPagina * this.tamanhoPagina, this.totalCount);
    return { de, ate };
  }

  /** Contadores derivados da página atual (totais globais só vêm como `totalCount`). */
  get countAtivosPagina(): number {
    return this.itens.filter((i) => i.ativo).length;
  }

  get countInativosPagina(): number {
    return this.itens.filter((i) => !i.ativo).length;
  }

  /** Esclarece que ativos/inativos refletem a página quando há várias páginas. */
  get resumoPaginaHint(): string | null {
    return this.totalPaginas > 1 ? 'Nesta página' : null;
  }

  carregar(): void {
    const field = this.toolbar.searchField();
    const term = this.normalizeSearchTerm(this.toolbar.searchTerm(), field);
    const filterPropriedade = this.resolveSearchProperty(field);
    const sortPropriedade = this.sortCol ? this.mapSortColToPropriedade(this.sortCol) : undefined;
    const propriedade = sortPropriedade ?? filterPropriedade;
    const sort = sortPropriedade ? this.sortDir : undefined;
    this.loading = true;
    this.erro = null;
    this.EstacionamentoService.buscar({
      NumeroPagina: this.numeroPagina,
      TamanhoPagina: this.tamanhoPagina,
      ...(term ? { Termo: term } : {}),
      ...(propriedade ? { Propriedade: propriedade } : {}),
      ...(sort ? { Sort: sort } : {}),
    }).subscribe({
      next: (paged) => {
        this.ngZone.run(() => {
          this.itens = paged.items;
          this.totalCount = paged.totalCount;
          this.numeroPagina = paged.numeroPagina;
          this.tamanhoPagina = paged.tamanhoPagina;
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
      error: (err: unknown) => {
        this.ngZone.run(() => {
          const msg =
            err &&
            typeof err === 'object' &&
            'message' in err &&
            typeof (err as ApiError).message === 'string'
              ? (err as ApiError).message
              : 'Erro ao carregar a lista.';
          this.erro = msg;
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
    });
  }

  /** Cabeçalho clicável: alterna Asc/Desc na mesma coluna. */
  ordenarPor(col: EstacionamentoListaSortCol): void {
    if (this.sortCol === col) {
      this.sortDir = this.sortDir === 'Asc' ? 'Desc' : 'Asc';
    } else {
      this.sortCol = col;
      this.sortDir = 'Asc';
    }
    this.numeroPagina = 1;
    if (this.toolbar.trigger() > 0) {
      this.carregar();
    }
  }

  sortIndicador(col: EstacionamentoListaSortCol): string {
    if (this.sortCol !== col) return '';
    return this.sortDir === 'Asc' ? '↑' : '↓';
  }

  private mapSortColToPropriedade(col: EstacionamentoListaSortCol): string {
    switch (col) {
      case 'id':
        return 'Id';
      case 'descricao':
        return 'Descricao';
      case 'nomeRazaoSocial':
        return 'NomeRazaoSocial';
      case 'cnpj':
        return 'Documento';
      case 'capacidadeVeiculo':
        return 'CapacidadeVeiculo';
      case 'tamanhoTerreno':
        return 'TamanhoTerreno';
      case 'ativo':
        return 'Ativo';
      default:
        return 'Id';
    }
  }

  private resolveSearchProperty(field: EstacionamentoSearchField): string | undefined {
    switch (field) {
      case 'cnpj':
        return 'Documento';
      case 'nomeRazaoSocial':
        return 'NomeRazaoSocial';
      case 'descricao':
        return 'Descricao';
      case 'email':
        return 'Email';
      case 'id':
        return 'Id';
      default:
        return undefined;
    }
  }

  private normalizeSearchTerm(raw: string, field: EstacionamentoSearchField): string {
    const base = (raw ?? '').trim();
    if (!base) return '';
    if (field === 'cnpj') return base.replace(/\D/g, '');
    if (field === 'id') return base.replace(/\D/g, '');
    return base;
  }

  buscar(): void {
    this.numeroPagina = 1;
    this.carregar();
  }

  onTamanhoPaginaChange(size: number | string): void {
    const n = Number(size);
    if (!Number.isFinite(n) || n <= 0) return;
    this.tamanhoPagina = n;
    this.numeroPagina = 1;
    if (this.toolbar.trigger() > 0) {
      this.carregar();
    }
  }

  irParaPagina(pagina: number): void {
    const p = Math.max(1, Math.min(pagina, this.totalPaginas));
    if (p === this.numeroPagina) return;
    this.numeroPagina = p;
    this.carregar();
  }

  /** Exibe CNPJ formatado. */
  formatCnpjItem(item: EstacionamentoListItemDTO): string {
    const cnpj = String(item.cnpj ?? '').replace(/\D/g, '');
    if (cnpj.length === 14) return formatCnpj(cnpj);
    if (cnpj.length === 11) return formatCpf(cnpj);
    return item.cnpj ?? '';
  }

  trackEstacionamento(item: EstacionamentoListItemDTO): string {
    return `${item.id}:${item.codExportacao ?? ''}`;
  }

  queryEditar(item: EstacionamentoListItemDTO): { codExportacao?: string } {
    const cod = String(item.codExportacao ?? '').trim();
    return cod ? { codExportacao: cod } : {};
  }

  visualizarEstacionamento(item: EstacionamentoListItemDTO): void {
    if (!item?.id) return;
    const ref = this.dialog.open(EstacionamentoViewDialogComponent, {
      width: '480px',
      maxWidth: '96vw',
      panelClass: 'trn-view-dialog-panel',
      data: { item }
    });
    ref.afterClosed().subscribe((result) => {
      if (result === 'edit') {
        void this.router.navigate([`${CADASTRO_ESTACIONAMENTOS_ROUTE}/editar`, item.id], {
          queryParams: this.queryEditar(item)
        });
      }
    });
  }

  private shouldRetryDeleteWithPessoaId(err: unknown): boolean {
    const api = err as ApiError | null;
    const msg = String(api?.message ?? '').toLowerCase();
    return /pessoa/.test(msg) && /(nao|não)\s*localiz/.test(msg);
  }

  excluir(item: EstacionamentoListItemDTO): void {
    const label = item.descricao?.trim() || `Id ${item.id}`;
    if (!confirm(`Excluir o Estacionamento "${label}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    this.excluindoId = item.id;
    this.EstacionamentoService.excluir(item.id).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.excluindoId = null;
          this.toast.success('Estacionamento excluído.');
          this.carregar();
          this.cdr.markForCheck();
        });
      },
      error: (err: unknown) => {
        const pessoaId = Number(item.pessoaId ?? 0) || 0;
        const podeTentarPessoaId = pessoaId > 0 && pessoaId !== item.id && this.shouldRetryDeleteWithPessoaId(err);
        if (!podeTentarPessoaId) {
          this.ngZone.run(() => {
            const msg =
              err &&
              typeof err === 'object' &&
              'message' in err &&
              typeof (err as ApiError).message === 'string'
                ? (err as ApiError).message
                : 'Não foi possível excluir o estacionamento.';
            this.toast.error(msg);
            this.excluindoId = null;
            this.cdr.markForCheck();
          });
          return;
        }
        this.EstacionamentoService.excluir(pessoaId).subscribe({
          next: () => {
            this.ngZone.run(() => {
              this.excluindoId = null;
              this.toast.success('Estacionamento excluído.');
              this.carregar();
              this.cdr.markForCheck();
            });
          },
          error: (errPessoa: unknown) => {
            this.ngZone.run(() => {
              const msg =
                errPessoa &&
                typeof errPessoa === 'object' &&
                'message' in errPessoa &&
                typeof (errPessoa as ApiError).message === 'string'
                  ? (errPessoa as ApiError).message
                  : 'Não foi possível excluir o estacionamento.';
              this.toast.error(msg);
              this.excluindoId = null;
              this.cdr.markForCheck();
            });
          },
        });
      },
    });
  }
}
