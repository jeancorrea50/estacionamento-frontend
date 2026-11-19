import { Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ApiError } from '../../../../core/api/models';
import { ToastService } from '../../../../core/api/services/toast.service';
import { PermissionCacheService } from '../../../../core/services/permission-cache.service';
import { SessionAccessService } from '../../../../core/services/session-access.service';
import {
  CadastroConfirmDialogComponent,
  CadastroConfirmDialogData,
} from '../../../cadastro/components/cadastro-confirm-dialog/cadastro-confirm-dialog.component';
import { AGENDAMENTO_PAINEL_ROUTE, JANELAS_ROUTE } from '../../agendamento-rotas';
import {
  JanelaDuplicarDialogComponent,
  JanelaDuplicarDialogData,
  JanelaDuplicarDialogResult,
} from '../../components/janela-duplicar-dialog/janela-duplicar-dialog.component';
import {
  JanelaFormDialogComponent,
  JanelaFormDialogData,
  JanelaFormDialogResult,
} from '../../components/janela-form-dialog/janela-form-dialog.component';
import {
  JanelaAgendamentoListItem,
  MODALIDADE_JANELA_OPCOES,
  ModalidadeJanela,
  modalidadeJanelaLabel,
} from '../../models/janela-agendamento.models';
import { JanelaAgendamentoService } from '../../services/janela-agendamento.service';
import { JanelaDisponibilidadeRealtimeService } from '../../services/janela-disponibilidade-realtime.service';
import { formatIsoDateBr } from '../agendamentos-page/agendamento-dashboard.util';

type FiltroAtivo = 'todas' | 'ativas' | 'inativas';

const TAMANHO_PAGINA = 20;

/**
 * Janelas de agendamento (`/app/patio/agendamentos/janelas`) — claims `janelas.*`.
 * Lista por modalidade (Estacionamento | Limpeza); CRUD e duplicação via dialogs.
 */
@Component({
  selector: 'app-janelas-page',
  standalone: true,
  imports: [MatDialogModule, RouterLink],
  templateUrl: './janelas-page.component.html',
  styleUrls: ['./janelas-page.component.scss'],
})
export class JanelasPageComponent implements OnInit {
  private readonly api = inject(JanelaAgendamentoService);
  private readonly realtime = inject(JanelaDisponibilidadeRealtimeService);
  private readonly permissions = inject(PermissionCacheService);
  private readonly sessionAccess = inject(SessionAccessService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly agendamentosRoute = AGENDAMENTO_PAINEL_ROUTE;
  readonly modalidadeOpcoes = MODALIDADE_JANELA_OPCOES;
  readonly modalidadeLabel = modalidadeJanelaLabel;

  readonly modalidade = signal<ModalidadeJanela>(1);
  readonly filtroAtivo = signal<FiltroAtivo>('todas');
  readonly items = signal<JanelaAgendamentoListItem[]>([]);
  readonly totalCount = signal(0);
  readonly numeroPagina = signal(1);
  readonly loading = signal(false);
  readonly abrindoId = signal<number | null>(null);
  readonly erro = signal<string | null>(null);

  readonly outraModalidade = computed<ModalidadeJanela>(() => (this.modalidade() === 1 ? 2 : 1));
  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.totalCount() / TAMANHO_PAGINA)));
  readonly intervalo = computed(() => {
    const total = this.totalCount();
    if (!total) return { de: 0, ate: 0 };
    const de = (this.numeroPagina() - 1) * TAMANHO_PAGINA + 1;
    return { de, ate: Math.min(total, de + this.items().length - 1) };
  });

  private versaoVista = this.realtime.versao();

  constructor() {
    // CRUD nesta aba (notifyLocal) ou evento do hub → recarrega a lista.
    effect(() => {
      const versao = this.realtime.versao();
      untracked(() => {
        if (versao === this.versaoVista) return;
        this.versaoVista = versao;
        if (this.canVisualizar) this.carregar();
      });
    });
  }

  get canVisualizar(): boolean {
    return (
      this.sessionAccess.canAccessRoute(this.router.url) ||
      this.sessionAccess.canAccessRoute(JANELAS_ROUTE) ||
      this.permissions.allows('janelas', 'visualizar')
    );
  }

  get podeCriar(): boolean {
    return this.canVisualizar && this.permissions.allows('janelas', 'gravar');
  }

  get podeAlterar(): boolean {
    return this.canVisualizar && this.permissions.allows('janelas', 'alterar');
  }

  get podeExcluir(): boolean {
    return this.canVisualizar && this.permissions.allows('janelas', 'excluir');
  }

  ngOnInit(): void {
    // Hub opcional: se indisponível, a lista segue funcionando (só sem push remoto).
    void this.realtime.connect();
    this.destroyRef.onDestroy(() => void this.realtime.disconnect());
    if (this.canVisualizar) this.carregar();
  }

  selecionarModalidade(m: ModalidadeJanela): void {
    if (this.modalidade() === m) return;
    this.modalidade.set(m);
    this.numeroPagina.set(1);
    this.carregar();
  }

  onFiltroAtivo(valor: string): void {
    this.filtroAtivo.set(valor === 'ativas' || valor === 'inativas' ? valor : 'todas');
    this.numeroPagina.set(1);
    this.carregar();
  }

  irParaPagina(pagina: number): void {
    const alvo = Math.min(Math.max(1, pagina), this.totalPaginas());
    if (alvo === this.numeroPagina()) return;
    this.numeroPagina.set(alvo);
    this.carregar();
  }

  carregar(): void {
    const ativo = this.filtroAtivo();
    this.loading.set(true);
    this.erro.set(null);
    this.api
      .buscar({
        modalidade: this.modalidade(),
        ativo: ativo === 'todas' ? null : ativo === 'ativas',
        numeroPagina: this.numeroPagina(),
        tamanhoPagina: TAMANHO_PAGINA,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (p) => {
          this.items.set(p.items);
          this.totalCount.set(p.totalCount);
        },
        error: (err: ApiError) => {
          this.items.set([]);
          this.totalCount.set(0);
          this.erro.set(err?.message || 'Não foi possível carregar as janelas.');
        },
      });
  }

  novaJanela(): void {
    if (!this.podeCriar) {
      this.toast.error('Sem permissão para criar janela (janelas.gravar).');
      return;
    }
    this.abrirForm({ mode: 'create', modalidade: this.modalidade() });
  }

  editar(item: JanelaAgendamentoListItem): void {
    if (!this.podeAlterar) {
      this.toast.error('Sem permissão para alterar janela (janelas.alterar).');
      return;
    }
    this.abrindoId.set(item.id);
    this.api
      .obterPorId(item.id)
      .pipe(finalize(() => this.abrindoId.set(null)))
      .subscribe({
        next: (janela) => this.abrirForm({ mode: 'edit', modalidade: janela.modalidade, janela }),
        error: (err: ApiError) => {
          if (!err?.toastShown) this.toast.error(err?.message || 'Não foi possível abrir a janela.');
        },
      });
  }

  /** Duplicar a partir da linha (origem fixa) ou "da outra modalidade" (origem a escolher). */
  duplicar(origem?: JanelaAgendamentoListItem): void {
    if (!this.podeCriar) {
      this.toast.error('Sem permissão para duplicar janela (janelas.gravar).');
      return;
    }
    const data: JanelaDuplicarDialogData = { origem, modalidadeAtual: this.modalidade() };
    this.dialog
      .open<JanelaDuplicarDialogComponent, JanelaDuplicarDialogData, JanelaDuplicarDialogResult>(
        JanelaDuplicarDialogComponent,
        { width: '560px', maxWidth: '96vw', autoFocus: false, panelClass: 'cfg-form-dialog-panel', data }
      )
      .afterClosed()
      .subscribe((res) => {
        // A lista recarrega via `realtime.versao` (notifyLocal no service); só ajusta a aba se mudou.
        if (res?.saved) this.focarModalidade(res.janela.modalidade);
      });
  }

  excluir(item: JanelaAgendamentoListItem): void {
    if (!this.podeExcluir) {
      this.toast.error('Sem permissão para excluir janela (janelas.excluir).');
      return;
    }
    this.dialog
      .open(CadastroConfirmDialogComponent, {
        width: '420px',
        maxWidth: '96vw',
        autoFocus: 'dialog',
        panelClass: 'cad-confirm-dialog-panel',
        data: {
          titulo: 'Excluir janela',
          mensagem: `Excluir a janela "${item.nome}"? Esta ação não pode ser desfeita.`,
          confirmLabel: 'Excluir',
          confirmColor: 'warn',
        } satisfies CadastroConfirmDialogData,
      })
      .afterClosed()
      .subscribe((ok) => {
        if (!ok) return;
        this.api.excluir(item.id).subscribe({
          next: () => this.toast.success('Janela excluída.'),
          error: (err: ApiError) => {
            if (!err?.toastShown) this.toast.error(err?.message || 'Não foi possível excluir a janela.');
          },
        });
      });
  }

  vigenciaLabel(item: JanelaAgendamentoListItem): string {
    const ini = formatIsoDateBr(item.dataVigenciaInicio);
    return item.dataVigenciaFim ? `${ini} a ${formatIsoDateBr(item.dataVigenciaFim)}` : `${ini} (sem fim)`;
  }

  private abrirForm(data: JanelaFormDialogData): void {
    this.dialog
      .open<JanelaFormDialogComponent, JanelaFormDialogData, JanelaFormDialogResult>(
        JanelaFormDialogComponent,
        { width: '900px', maxWidth: '96vw', autoFocus: false, panelClass: 'cfg-form-dialog-panel', data }
      )
      .afterClosed()
      .subscribe((res) => {
        if (res?.saved) this.focarModalidade(res.janela.modalidade);
      });
  }

  /**
   * Se a janela salva é de outra modalidade, segue para a aba dela. O refresh por `realtime.versao`
   * já disparou (notifyLocal ocorre antes do fechamento do dialog) com a modalidade antiga,
   * então recarrega aqui explicitamente.
   */
  private focarModalidade(m: ModalidadeJanela): void {
    if (this.modalidade() === m) return;
    this.modalidade.set(m);
    this.numeroPagina.set(1);
    this.carregar();
  }
}
