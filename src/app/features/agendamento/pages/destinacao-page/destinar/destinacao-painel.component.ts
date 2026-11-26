import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injectable,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Observable, Subject, firstValueFrom, forkJoin, from, of } from 'rxjs';
import { catchError, concatMap, finalize, switchMap, toArray } from 'rxjs/operators';

import { ToastService } from '../../../../../core/api/services/toast.service';
import { AuthService } from '../../../../../core/services/auth.service';
import {
  CadastroConfirmDialogComponent,
  type CadastroConfirmDialogData,
} from '../../../../cadastro/components/cadastro-confirm-dialog/cadastro-confirm-dialog.component';
import type {
  VagaDisponibilidadeResumo,
  VagaReservaTransportadoraItem,
} from '../../../models/vaga-disponibilidade.models';
import { VagaDisponibilidadeService } from '../../../services/vaga-disponibilidade.service';
import {
  Destinacao,
  DestinacaoFormData,
  DestinacaoFormResult,
  Disponibilidade,
  Empresa,
  GrupoDestinacao,
  ItemDestinacao,
  MODALIDADES,
  Modalidade,
  RECORRENCIA_LABEL,
  STATUS_LABEL,
  StatusRegra,
} from './destinacao.models';
import {
  agruparDestinacoes,
  agruparPorTransportadora,
  hojeISO,
  somarDias,
  vagasAtivas,
} from './destinacao.mapper';
import {
  DESTINACAO_DIALOG_CONFIG,
  DestinacaoFormDialogComponent,
} from './destinacao-form/destinacao-form-dialog.component';

type FiltroStatus = StatusRegra | 'todas';
type ModalidadeVisao = 'estacionamento' | 'limpeza';

/** Rótulos pt-BR do paginador (o app não tem MatPaginatorIntl global). */
@Injectable()
export class DestinacaoPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Por página';
  override nextPageLabel = 'Próxima página';
  override previousPageLabel = 'Página anterior';
  override firstPageLabel = 'Primeira página';
  override lastPageLabel = 'Última página';
  override getRangeLabel = (page: number, size: number, total: number): string => {
    if (!total) return '0 de 0';
    const ini = page * size + 1;
    const fim = Math.min(ini + size - 1, total);
    return `${ini}–${fim} de ${total}`;
  };
}

/**
 * Destinação › Destinar: disponibilidade do dia + destinações agrupadas por transportadora.
 * Cada horário de uma destinação é uma reserva da API (`/Agendamento/vagas/reservas`).
 */
@Component({
  selector: 'app-destinacao-painel',
  standalone: true,
  imports: [FormsModule, DatePipe, MatMenuModule, MatPaginatorModule],
  providers: [{ provide: MatPaginatorIntl, useClass: DestinacaoPaginatorIntl }],
  templateUrl: './destinacao-painel.component.html',
  styleUrl: './destinacao-painel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DestinacaoPainelComponent implements OnInit {
  private readonly api = inject(VagaDisponibilidadeService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly podeGerenciar = input(false);

  readonly modalidadesVisao = MODALIDADES.filter((m) => m.id !== 'ambos');
  readonly statusLabel = STATUS_LABEL;
  readonly recorrenciaLabel = RECORRENCIA_LABEL;
  readonly modalidadeLabel = Object.fromEntries(MODALIDADES.map((m) => [m.id, m.label])) as Record<
    Modalidade,
    string
  >;

  /** Destinador nulo = o próprio pátio (estacionamento da sessão). */
  readonly patio: Empresa = {
    id: 0,
    nome: this.auth.getSessionEstacionamento()?.nome?.trim() || 'Pátio',
  };

  // ─── Dados ────────────────────────────────────────────────────────────
  private readonly reservas = signal<VagaReservaTransportadoraItem[]>([]);
  private readonly resumo = signal<VagaDisponibilidadeResumo | null>(null);
  readonly carregando = signal(false);
  readonly erroCarga = signal(false);
  private readonly recarregar$ = new Subject<void>();

  readonly destinacoes = computed(() => agruparDestinacoes(this.reservas(), this.patio, hojeISO()));

  // ─── Painel do dia ────────────────────────────────────────────────────
  readonly visao = signal<ModalidadeVisao>('estacionamento');
  readonly data = signal(hojeISO());
  readonly ehHoje = computed(() => this.data() === hojeISO());

  private dispoDe(m: ModalidadeVisao): Disponibilidade {
    const r = this.resumo();
    if (!r) return { capacidade: null, reservadas: 0 };
    return m === 'estacionamento'
      ? { capacidade: r.capacidadeEstacionamento, reservadas: r.vagasReservadasEstacionamento }
      : { capacidade: r.capacidadeLimpeza, reservadas: r.vagasReservadasLimpeza };
  }

  readonly dispo = computed(() => this.dispoDe(this.visao()));
  readonly dispoOutra = computed(() => {
    const id: ModalidadeVisao = this.visao() === 'estacionamento' ? 'limpeza' : 'estacionamento';
    const d = this.dispoDe(id);
    return {
      label: this.modalidadeLabel[id],
      ...d,
      disponiveis: d.capacidade == null ? null : Math.max(d.capacidade - d.reservadas, 0),
    };
  });
  readonly disponiveis = computed(() => {
    const { capacidade, reservadas } = this.dispo();
    return capacidade == null ? null : Math.max(capacidade - reservadas, 0);
  });
  readonly ocupacao = computed(() => {
    const { capacidade, reservadas } = this.dispo();
    return capacidade ? Math.min(100, Math.round((reservadas / capacidade) * 100)) : 0;
  });
  readonly nivel = computed<'ok' | 'warn' | 'danger'>(() => {
    const o = this.ocupacao();
    return o >= 90 ? 'danger' : o >= 70 ? 'warn' : 'ok';
  });
  readonly nivelLabel = computed(
    () => ({ ok: 'Com folga', warn: 'Atenção', danger: 'Lotando' })[this.nivel()],
  );
  readonly destinacoesAtivas = computed(
    () => this.destinacoes().filter((d) => d.status === 'ativa').length,
  );
  readonly vagasDestinadasDia = computed(() =>
    this.destinacoes().reduce((s, d) => s + vagasAtivas(d), 0),
  );

  // ─── Filtros ──────────────────────────────────────────────────────────
  /** O texto só é aplicado no Buscar/Enter (padrão de toolbar do projeto). */
  readonly buscaDigitada = signal('');
  readonly filtroTexto = signal('');
  readonly filtroModalidade = signal<Modalidade | 'todas'>('todas');
  readonly filtroStatus = signal<FiltroStatus>('ativa');

  readonly temFiltro = computed(
    () =>
      !!this.filtroTexto() ||
      this.filtroModalidade() !== 'todas' ||
      this.filtroStatus() !== 'ativa',
  );

  // ─── Lista + paginação ────────────────────────────────────────────────
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly abertos = signal<ReadonlySet<string>>(new Set());
  /** Ação em lote em andamento (evita clique duplo). */
  readonly ocupado = signal(false);

  readonly grupos = computed<GrupoDestinacao[]>(() =>
    agruparPorTransportadora(this.destinacoes(), {
      termo: this.filtroTexto(),
      modalidade: this.filtroModalidade(),
      status: this.filtroStatus(),
    }),
  );

  readonly gruposPagina = computed(() => {
    const ini = this.pageIndex() * this.pageSize();
    return this.grupos().slice(ini, ini + this.pageSize());
  });

  readonly resumoLista = computed(() => {
    const ds = this.destinacoes();
    const transp = new Set(ds.filter((d) => d.transportadoraId).map((d) => d.transportadoraId))
      .size;
    return { transportadoras: transp, ativas: this.destinacoesAtivas(), total: ds.length };
  });

  ngOnInit(): void {
    this.recarregar$
      .pipe(
        switchMap(() => {
          const data = this.data();
          this.carregando.set(true);
          return forkJoin({
            resumo: this.api.resumoParaTransportadora(data).pipe(catchError(() => of(null))),
            reservas: this.api.listarReservas(data).pipe(catchError(() => of(null))),
          }).pipe(finalize(() => this.carregando.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ resumo, reservas }) => {
        this.erroCarga.set(reservas == null);
        this.resumo.set(resumo);
        this.reservas.set(reservas ?? []);
        this.ajustarPagina();
      });
    this.atualizar();
  }

  // ─── Helpers de template ──────────────────────────────────────────────
  vagasAtivas(d: Destinacao): number {
    return vagasAtivas(d);
  }

  usadasHoje(d: Destinacao): number {
    return d.itens.filter((i) => i.status === 'ativa').reduce((s, i) => s + i.usadasHoje, 0);
  }

  plural(n: number, um: string, varios: string): string {
    return `${n} ${n === 1 ? um : varios}`;
  }

  // ─── Painel do dia ────────────────────────────────────────────────────
  setData(iso: string | null): void {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    this.data.set(iso);
    this.atualizar();
  }

  mudarDia(delta: number): void {
    this.setData(somarDias(this.data(), delta));
  }

  irParaHoje(): void {
    this.setData(hojeISO());
  }

  atualizar(): void {
    this.recarregar$.next();
  }

  // ─── Filtros / paginação ──────────────────────────────────────────────
  buscar(): void {
    this.filtroTexto.set(this.buscaDigitada());
    this.pageIndex.set(0);
  }

  setFiltroModalidade(v: Modalidade | 'todas'): void {
    this.filtroModalidade.set(v);
    this.pageIndex.set(0);
  }

  setFiltroStatus(v: FiltroStatus): void {
    this.filtroStatus.set(v);
    this.pageIndex.set(0);
  }

  limparFiltros(): void {
    this.buscaDigitada.set('');
    this.filtroTexto.set('');
    this.filtroModalidade.set('todas');
    this.filtroStatus.set('ativa');
    this.pageIndex.set(0);
  }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  private ajustarPagina(): void {
    const ultima = Math.max(0, Math.ceil(this.grupos().length / this.pageSize()) - 1);
    if (this.pageIndex() > ultima) this.pageIndex.set(ultima);
  }

  alternarGrupo(id: string): void {
    this.abertos.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  expandirPagina(): void {
    this.abertos.set(new Set(this.gruposPagina().map((g) => g.id)));
  }

  recolherTodos(): void {
    this.abertos.set(new Set());
  }

  // ─── Modal ────────────────────────────────────────────────────────────
  async abrirFormulario(data: Omit<DestinacaoFormData, 'reservas'>): Promise<void> {
    if (!this.podeGerenciar()) return;
    const ref = this.dialog.open<
      DestinacaoFormDialogComponent,
      DestinacaoFormData,
      DestinacaoFormResult
    >(DestinacaoFormDialogComponent, {
      ...DESTINACAO_DIALOG_CONFIG,
      data: { ...data, reservas: this.reservas() },
    });
    const res = await firstValueFrom(ref.afterClosed());
    if (!res) return;

    if (res.gravadas) {
      const msg =
        data.modo === 'editar'
          ? 'Destinação atualizada.'
          : `${this.plural(res.gravadas, 'horário gravado', 'horários gravados')}.`;
      if (res.falhas) {
        this.toast.warning(
          `${msg} ${this.plural(res.falhas, 'horário falhou', 'horários falharam')} — confira a lista.`,
        );
      } else {
        this.toast.success(msg);
      }
    } else if (res.falhas) {
      this.toast.error('Nada foi gravado. Tente novamente.');
    }
    // Abre o grupo afetado para o usuário ver o resultado.
    this.abertos.update((s) => new Set([...s, ...res.grupos]));
    this.atualizar();
  }

  /** Chamado também pelo CTA "Nova destinação" do cabeçalho da página. */
  nova(g?: GrupoDestinacao): void {
    const transportadora =
      g && !g.avulso && g.transportadoraId ? { id: g.transportadoraId, nome: g.nome } : undefined;
    void this.abrirFormulario({ modo: 'criar', transportadora });
  }

  editar(d: Destinacao): void {
    void this.abrirFormulario({ modo: 'editar', destinacao: d });
  }

  duplicar(d: Destinacao): void {
    void this.abrirFormulario({ modo: 'duplicar', destinacao: d });
  }

  // ─── Ações dos menus ⋮ ────────────────────────────────────────────────
  async alternarPausa(d: Destinacao, item?: ItemDestinacao): Promise<void> {
    const atual = item ? item.status : d.status;
    const pausar = atual === 'ativa';
    const alvo = item
      ? `${d.transportadoraNome} · ${item.janela}`
      : `${d.transportadoraNome} · período inteiro`;
    if (pausar) {
      const ok = await this.confirmar({
        titulo: item ? 'Pausar horário?' : 'Pausar período?',
        mensagem: `${alvo}: as vagas voltam para o saldo livre até reativar.`,
        confirmLabel: 'Pausar',
        confirmColor: 'primary',
      });
      if (!ok) return;
    }
    const alvos = item
      ? [item]
      : d.itens.filter((i) => (pausar ? i.status === 'ativa' : i.status !== 'ativa'));
    await this.executarEmLote(
      alvos.map((i) => i.id),
      (id) => this.api.alterarStatusReserva(id, !pausar),
      pausar ? 'Pausado.' : 'Reativado.',
    );
  }

  async pausarGrupo(g: GrupoDestinacao): Promise<void> {
    const ok = await this.confirmar({
      titulo: 'Pausar todas as destinações?',
      mensagem: `${g.nome}: ${this.plural(g.destinacoes.length, 'período', 'períodos')} serão pausados. As vagas voltam para o saldo livre.`,
      confirmLabel: 'Pausar todas',
      confirmColor: 'primary',
    });
    if (!ok) return;
    const ids = g.destinacoes.flatMap((d) =>
      d.itens.filter((i) => i.status === 'ativa').map((i) => i.id),
    );
    await this.executarEmLote(
      ids,
      (id) => this.api.alterarStatusReserva(id, false),
      'Destinações pausadas.',
    );
  }

  async excluir(d: Destinacao, item?: ItemDestinacao): Promise<void> {
    const ok = await this.confirmar({
      titulo: item ? 'Excluir horário?' : 'Excluir período?',
      mensagem: item
        ? `${d.transportadoraNome} · ${item.janela} (${this.plural(item.vagas, 'vaga', 'vagas')}/dia). Agendamentos já feitos não são afetados.`
        : `${d.transportadoraNome} · ${this.plural(d.itens.length, 'horário', 'horários')}. Agendamentos já feitos não são afetados. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      confirmColor: 'warn',
    });
    if (!ok) return;
    const ids = item ? [item.id] : d.itens.map((i) => i.id);
    await this.executarEmLote(ids, (id) => this.api.inativarReserva(id), 'Excluído.');
  }

  /** Aplica a ação em sequência e recarrega; avisa se algum horário falhou. */
  private async executarEmLote(
    ids: number[],
    acao: (id: number) => Observable<boolean>,
    sucesso: string,
  ): Promise<void> {
    if (!ids.length || this.ocupado()) return;
    this.ocupado.set(true);
    try {
      const resultados = await firstValueFrom(
        from(ids).pipe(
          concatMap((id) => acao(id).pipe(catchError(() => of(false)))),
          toArray(),
        ),
      );
      const falhas = resultados.filter((ok) => !ok).length;
      if (!falhas) this.toast.success(sucesso);
      else if (falhas < ids.length)
        this.toast.warning(
          `${this.plural(falhas, 'horário não foi atualizado', 'horários não foram atualizados')}.`,
        );
      else this.toast.error('Não foi possível concluir a ação.');
    } finally {
      this.ocupado.set(false);
      this.atualizar();
    }
  }

  private confirmar(data: CadastroConfirmDialogData): Promise<boolean> {
    const ref = this.dialog.open(CadastroConfirmDialogComponent, {
      data,
      width: '420px',
      maxWidth: '96vw',
      autoFocus: 'dialog',
      panelClass: 'cad-confirm-dialog-panel',
    });
    return firstValueFrom(ref.afterClosed()).then((r) => r === true);
  }
}
