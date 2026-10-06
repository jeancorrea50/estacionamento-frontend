import { CommonModule, DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import {
  ConviteTransportadoraApiService,
  ConviteTransportadoraDto,
} from '../../../convite/services/convite-transportadora-api.service';
import { CADASTRO_TRANSPORTADORAS_ROUTE } from '../../cadastro-rotas';

type StepKey = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-convites-transportadora-page',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, MatSnackBarModule, RouterLink],
  templateUrl: './convites-transportadora-page.component.html',
  styleUrls: ['./convites-transportadora-page.component.scss'],
})
export class ConvitesTransportadoraPageComponent implements OnInit {
  private readonly api = inject(ConviteTransportadoraApiService);
  private readonly snack = inject(MatSnackBar);

  readonly transportadorasRoute = CADASTRO_TRANSPORTADORAS_ROUTE;
  readonly loading = signal(false);
  readonly reenviandoId = signal<number | null>(null);
  readonly cancelandoId = signal<number | null>(null);
  readonly itens = signal<ConviteTransportadoraDto[]>([]);
  readonly totalCount = signal(0);
  readonly pageCount = signal(0);
  readonly detalhe = signal<ConviteTransportadoraDto | null>(null);

  numeroPagina = 1;
  tamanhoPagina = 10;
  readonly opcoesTamanhoPagina = [5, 10, 20, 50];
  busca = '';
  statusFiltro = '';

  readonly statusOpcoes = [
    { value: '', label: 'Todos' },
    { value: 'Pendente', label: 'Convite enviado' },
    { value: 'EmAndamento', label: 'Em andamento' },
    { value: 'Concluido', label: 'Concluído' },
    { value: 'Expirado', label: 'Expirado' },
    { value: 'Cancelado', label: 'Cancelado' },
  ];

  readonly steps: { key: StepKey; label: string; icon: string }[] = [
    { key: 1, label: 'Acesso', icon: 'person' },
    { key: 2, label: 'Responsável', icon: 'badge' },
    { key: 3, label: 'Empresa', icon: 'local_shipping' },
    { key: 4, label: 'Endereço', icon: 'home' },
  ];

  get totalPaginas(): number {
    return Math.max(1, this.pageCount() || Math.ceil(this.totalCount() / Math.max(this.tamanhoPagina, 1)));
  }

  get intervaloExibicao(): { de: number; ate: number } {
    const total = this.totalCount();
    if (total === 0) return { de: 0, ate: 0 };
    const de = (this.numeroPagina - 1) * this.tamanhoPagina + 1;
    const ate = Math.min(this.numeroPagina * this.tamanhoPagina, total);
    return { de, ate };
  }

  ngOnInit(): void {
    this.carregar();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.detalhe()) this.fecharDetalhe();
  }

  carregar(resetPage = false): void {
    if (resetPage) this.numeroPagina = 1;
    this.loading.set(true);
    this.api
      .listar({
        NumeroPagina: this.numeroPagina,
        TamanhoPagina: this.tamanhoPagina,
        Status: this.statusFiltro || undefined,
        Busca: this.busca.trim() || undefined,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          this.itens.set(page.results);
          this.totalCount.set(page.rowCount);
          this.pageCount.set(page.pageCount);
          this.numeroPagina = page.currentPage || this.numeroPagina;
          this.tamanhoPagina = page.pageSize || this.tamanhoPagina;
          const aberto = this.detalhe();
          if (aberto) {
            const atualizado = page.results.find((x) => x.id === aberto.id);
            if (atualizado) this.detalhe.set(atualizado);
          }
        },
        error: (err: { message?: string } | unknown) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
              ? err.message
              : 'Não foi possível carregar os convites.';
          this.snack.open(msg, 'Fechar', { duration: 5000 });
        },
      });
  }

  buscar(): void {
    this.carregar(true);
  }

  limparFiltros(): void {
    this.busca = '';
    this.statusFiltro = '';
    this.carregar(true);
  }

  onTamanhoPaginaChange(value: number | string): void {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    this.tamanhoPagina = n;
    this.carregar(true);
  }

  irParaPagina(pagina: number): void {
    const dest = Math.min(Math.max(1, pagina), this.totalPaginas);
    if (dest === this.numeroPagina) return;
    this.numeroPagina = dest;
    this.carregar();
  }

  abrirDetalhe(c: ConviteTransportadoraDto): void {
    this.detalhe.set(c);
  }

  fecharDetalhe(): void {
    this.detalhe.set(null);
  }

  isDone(etapaAtual: number, key: StepKey, status: string): boolean {
    if (this.isConcluido(status)) return true;
    return etapaAtual > key;
  }

  isActive(etapaAtual: number, key: StepKey, status: string): boolean {
    if (this.isConcluido(status) || this.isCancelado(status)) return false;
    return etapaAtual === key;
  }

  isConcluido(status: string): boolean {
    return /concluido|concluído/i.test(status ?? '');
  }

  isCancelado(status: string): boolean {
    return /cancelado/i.test(status ?? '');
  }

  isExpirado(status: string): boolean {
    return /expirado/i.test(status ?? '');
  }

  podeReenviar(c: ConviteTransportadoraDto): boolean {
    return !this.isConcluido(c.status) && !this.isCancelado(c.status);
  }

  labelStatus(status: string): string {
    const s = (status ?? '').trim();
    if (/pendente/i.test(s)) return 'Convite enviado';
    if (/emandamento|em_andamento|em andamento/i.test(s)) return 'Cadastro em andamento';
    if (/concluido|concluído/i.test(s)) return 'Concluído';
    if (/expirado/i.test(s)) return 'Expirado';
    if (/cancelado/i.test(s)) return 'Cancelado';
    return s || '—';
  }

  labelEtapa(etapaAtual: number, status: string): string {
    if (this.isConcluido(status)) return 'Todas as etapas';
    const step = this.steps.find((s) => s.key === etapaAtual);
    return step ? `Etapa ${etapaAtual}: ${step.label}` : `Etapa ${etapaAtual}`;
  }

  progressoPercent(c: ConviteTransportadoraDto): number {
    if (this.isConcluido(c.status)) return 100;
    const etapa = Math.min(Math.max(c.etapaAtual || 1, 1), 4);
    return Math.round(((etapa - 1) / 4) * 100);
  }

  reenviar(c: ConviteTransportadoraDto): void {
    if (!this.podeReenviar(c) || this.reenviandoId() != null) return;
    this.reenviandoId.set(c.id);
    this.api
      .reenviar(c.id)
      .pipe(finalize(() => this.reenviandoId.set(null)))
      .subscribe({
        next: (atualizado) => {
          this.patchItem(atualizado);
          const etapa = atualizado.etapaAtual ?? c.etapaAtual;
          const emailOk = atualizado.emailEnviado;
          this.snack.open(
            emailOk
              ? `Convite reenviado. O responsável continua na etapa ${etapa}.`
              : `Link pronto (etapa ${etapa}). E-mail não enviado — use WhatsApp.`,
            'Fechar',
            { duration: 5500 }
          );
        },
        error: (err: { message?: string } | unknown) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
              ? err.message
              : 'Falha ao reenviar convite.';
          this.snack.open(msg, 'Fechar', { duration: 5000 });
        },
      });
  }

  cancelar(c: ConviteTransportadoraDto): void {
    if (this.isConcluido(c.status) || this.isCancelado(c.status) || this.cancelandoId() != null) {
      return;
    }
    if (!confirm(`Cancelar o convite de ${c.emailConvidado}?`)) return;
    this.cancelandoId.set(c.id);
    this.api
      .cancelar(c.id)
      .pipe(finalize(() => this.cancelandoId.set(null)))
      .subscribe({
        next: (atualizado) => {
          this.patchItem(atualizado);
          this.snack.open('Convite cancelado.', 'Fechar', { duration: 3500 });
        },
        error: (err: { message?: string } | unknown) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
              ? err.message
              : 'Falha ao cancelar convite.';
          this.snack.open(msg, 'Fechar', { duration: 5000 });
        },
      });
  }

  async copiarLink(c: ConviteTransportadoraDto): Promise<void> {
    const link = (c.urlConvite ?? '').trim();
    if (!link) {
      this.snack.open('Link do convite indisponível.', 'Fechar', { duration: 3500 });
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      this.snack.open('Link copiado!', 'Fechar', { duration: 2500 });
    } catch {
      this.snack.open('Não foi possível copiar o link.', 'Fechar', { duration: 3500 });
    }
  }

  abrirWhatsApp(c: ConviteTransportadoraDto): void {
    const url = (c.urlWhatsApp ?? '').trim();
    if (!url) {
      this.snack.open('WhatsApp indisponível para este convite.', 'Fechar', { duration: 3500 });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  trackById(_: number, c: ConviteTransportadoraDto): number {
    return c.id;
  }

  private patchItem(atualizado: ConviteTransportadoraDto): void {
    this.itens.update((lista) =>
      lista.map((x) => (x.id === atualizado.id ? { ...x, ...atualizado } : x))
    );
    const aberto = this.detalhe();
    if (aberto?.id === atualizado.id) {
      this.detalhe.set({ ...aberto, ...atualizado });
    }
  }
}
