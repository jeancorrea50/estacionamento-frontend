import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ToastService } from '../../../../core/api/services/toast.service';
import { ApiError } from '../../../../core/api/models';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { CadastroConfirmDialogComponent } from '../../components/cadastro-confirm-dialog/cadastro-confirm-dialog.component';
import { EstStatusPillEstacionamentoComponent } from '../../components/est-status-pill-estacionamento/est-status-pill-estacionamento.component';
import { EstSummaryMetricComponent } from '../../components/est-summary-metric/est-summary-metric.component';
import {
  ResponsavelFaturamentoFormDialogComponent,
  type ResponsavelFaturamentoFormDialogResult,
} from '../../components/responsavel-faturamento-form-dialog/responsavel-faturamento-form-dialog.component';
import { formatCnpj } from '../../directives/cnpj-format.directive';
import { formatTelefone } from '../../directives/telefone-format.directive';
import type { ResponsavelFaturamentoListItemDTO } from '../../models/responsavel-faturamento.dto';
import { ResponsavelFaturamentoService } from '../../services/responsavel-faturamento.service';

@Component({
  selector: 'app-cadastro-responsavel-faturamento-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    EstSummaryMetricComponent,
    EstStatusPillEstacionamentoComponent,
  ],
  templateUrl: './cadastro-responsavel-faturamento-page.component.html',
  styleUrls: ['./cadastro-responsavel-faturamento-page.component.scss'],
})
export class CadastroResponsavelFaturamentoPageComponent implements OnInit {
  private readonly service = inject(ResponsavelFaturamentoService);
  private readonly toast = inject(ToastService);
  private readonly permissionCache = inject(PermissionCacheService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  itens: ResponsavelFaturamentoListItemDTO[] = [];
  loadingList = false;
  erroList: string | null = null;
  jaBuscou = false;
  termoBusca = '';
  filtroAtivo: boolean | null = null;
  numeroPagina = 1;
  totalCount = 0;
  tamanhoPaginaLista = 25;
  readonly opcoesTamanhoPaginaLista: number[] = [10, 25, 50];

  get canGravar(): boolean {
    return this.permissionCache.allows('responsavelfaturamento', 'gravar');
  }

  get canAlterar(): boolean {
    return this.permissionCache.allows('responsavelfaturamento', 'alterar');
  }

  get canExcluir(): boolean {
    return this.permissionCache.allows('responsavelfaturamento', 'excluir');
  }

  get totalPaginasLista(): number {
    if (this.tamanhoPaginaLista <= 0) return 1;
    return Math.max(1, Math.ceil(this.totalCount / this.tamanhoPaginaLista));
  }

  get intervaloLista(): { de: number; ate: number } {
    if (this.totalCount <= 0) return { de: 0, ate: 0 };
    const de = (this.numeroPagina - 1) * this.tamanhoPaginaLista + 1;
    const ate = Math.min(this.numeroPagina * this.tamanhoPaginaLista, this.totalCount);
    return { de, ate };
  }

  get countAtivosPagina(): number {
    return this.itens.filter((i) => i.ativo).length;
  }

  get countInativosPagina(): number {
    return this.itens.filter((i) => !i.ativo).length;
  }

  get resumoListaPaginaHint(): string | null {
    return this.totalPaginasLista > 1 ? 'Nesta página' : null;
  }

  ngOnInit(): void {
    this.onBuscar();
  }

  onBuscar(): void {
    this.numeroPagina = 1;
    this.carregarLista();
  }

  onTamanhoPaginaChange(value: number | string): void {
    this.tamanhoPaginaLista = Number(value) || 25;
    this.numeroPagina = 1;
    this.carregarLista();
  }

  irParaPagina(pagina: number): void {
    const p = Math.max(1, Math.min(this.totalPaginasLista, Math.trunc(pagina)));
    if (p === this.numeroPagina) return;
    this.numeroPagina = p;
    this.carregarLista();
  }

  formatCnpjItem(v: string): string {
    return formatCnpj(v || '');
  }

  formatTelItem(v?: string | null): string {
    return v ? formatTelefone(v) : '—';
  }

  abrirNovo(): void {
    this.openFormDialog();
  }

  editar(item: ResponsavelFaturamentoListItemDTO): void {
    this.openFormDialog(item.id);
  }

  excluir(item: ResponsavelFaturamentoListItemDTO): void {
    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      panelClass: 'cad-confirm-dialog-panel',
      data: {
        titulo: 'Excluir responsável',
        mensagem: `Confirma a exclusão de "${item.nomeFantasia || item.razaoSocial || item.cnpj}"?`,
        confirmLabel: 'Excluir',
        confirmColor: 'warn' as const,
      },
    });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.service.excluir(item.id).subscribe({
        next: () => {
          this.toast.success('Responsável excluído.');
          this.carregarLista();
        },
        error: (err: ApiError | unknown) => {
          const msg = (err as ApiError)?.message || 'Não foi possível excluir.';
          this.toast.error(String(msg));
        },
      });
    });
  }

  private openFormDialog(id?: number): void {
    const ref = this.dialog.open(ResponsavelFaturamentoFormDialogComponent, {
      width: '760px',
      maxWidth: '95vw',
      disableClose: true,
      data: { id: id ?? null },
    });
    ref.afterClosed().subscribe((result: ResponsavelFaturamentoFormDialogResult | undefined) => {
      if (result?.saved) this.carregarLista();
    });
  }

  private carregarLista(): void {
    this.jaBuscou = true;
    this.loadingList = true;
    this.erroList = null;
    const termo = this.termoBusca.trim();
    const cnpjDigits = termo.replace(/\D/g, '');
    const pareceCnpj = cnpjDigits.length >= 8 && /^\d[\d.\-/]*$/.test(termo);

    this.service
      .buscar({
        Descricao: pareceCnpj ? undefined : termo || undefined,
        Cnpj: pareceCnpj ? cnpjDigits : undefined,
        Ativo: this.filtroAtivo,
        NumeroPagina: this.numeroPagina,
        TamanhoPagina: this.tamanhoPaginaLista,
      })
      .subscribe({
        next: (paged) => {
          this.itens = paged.items;
          this.totalCount = paged.totalCount;
          this.loadingList = false;
          this.cdr.markForCheck();
        },
        error: (err: ApiError | unknown) => {
          this.loadingList = false;
          this.erroList = (err as ApiError)?.message || 'Falha ao carregar a listagem.';
          this.cdr.markForCheck();
        },
      });
  }
}
