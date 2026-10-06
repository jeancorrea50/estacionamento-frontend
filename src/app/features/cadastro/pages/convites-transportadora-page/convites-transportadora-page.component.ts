import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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
  imports: [CommonModule, DatePipe, MatSnackBarModule, RouterLink],
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

  readonly steps: { key: StepKey; label: string; icon: string }[] = [
    { key: 1, label: 'Acesso', icon: 'person' },
    { key: 2, label: 'Responsável', icon: 'badge' },
    { key: 3, label: 'Empresa', icon: 'local_shipping' },
    { key: 4, label: 'Endereço', icon: 'home' },
  ];

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.api
      .listar()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (lista) => this.itens.set(lista),
        error: (err: { message?: string } | unknown) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
              ? err.message
              : 'Não foi possível carregar os convites.';
          this.snack.open(msg, 'Fechar', { duration: 5000 });
        },
      });
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

  reenviar(c: ConviteTransportadoraDto): void {
    if (!this.podeReenviar(c) || this.reenviandoId() != null) return;
    this.reenviandoId.set(c.id);
    this.api
      .reenviar(c.id)
      .pipe(finalize(() => this.reenviandoId.set(null)))
      .subscribe({
        next: (atualizado) => {
          this.itens.update((lista) =>
            lista.map((x) => (x.id === atualizado.id ? { ...x, ...atualizado } : x))
          );
          const etapa = atualizado.etapaAtual ?? c.etapaAtual;
          const emailOk = atualizado.emailEnviado;
          this.snack.open(
            emailOk
              ? `Convite reenviado. O responsável continua na etapa ${etapa}.`
              : `Link pronto (etapa ${etapa}). E-mail não enviado — use WhatsApp/SMS.`,
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
          this.itens.update((lista) =>
            lista.map((x) => (x.id === atualizado.id ? { ...x, ...atualizado } : x))
          );
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

  abrirSms(c: ConviteTransportadoraDto): void {
    let url = (c.urlSms ?? '').trim();
    if (!url) {
      // Monta sms: no cliente se a API não trouxe o link.
      const telDigits = String(c.responsavelTelefone ?? '').replace(/\D/g, '');
      let tel = telDigits;
      if (tel.length >= 10 && !tel.startsWith('55') && tel.length <= 11) tel = `55${tel}`;
      const link = (c.urlConvite ?? '').trim();
      if (!tel || !link) {
        this.snack.open('SMS indisponível para este convite.', 'Fechar', { duration: 3500 });
        return;
      }
      const msg = encodeURIComponent(
        `Olá!\n\nCadastre sua transportadora no GTS Sistema:\n${link}\n\nCadastrar Transportadora`
      );
      url = `sms:+${tel}?&body=${msg}`;
    } else if (url.toLowerCase().startsWith('sms:') && !url.includes('?&body=') && url.includes('?body=')) {
      url = url.replace('?body=', '?&body=');
      if (!url.includes('sms:+')) url = url.replace(/^sms:/i, 'sms:+');
    }

    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.snack.open('Abrindo o app de SMS…', 'Fechar', { duration: 2500 });
  }

  trackById(_: number, c: ConviteTransportadoraDto): number {
    return c.id;
  }
}
