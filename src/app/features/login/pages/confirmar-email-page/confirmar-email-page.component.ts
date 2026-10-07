import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { UsuarioApiService } from '../../../../core/api/services/usuario-api.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '../../../../core/api/models';

type Status = 'idle' | 'loading' | 'ok' | 'error';

@Component({
  selector: 'app-confirmar-email-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './confirmar-email-page.component.html',
  styleUrls: ['./confirmar-email-page.component.scss'],
})
export class ConfirmarEmailPageComponent implements OnInit {
  private api = inject(UsuarioApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  status = signal<Status>('idle');
  message = signal<string>('');
  linkLogin = '/';

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((m) => {
      const userIdStr = m.get('userId') ?? m.get('userid');
      const token = m.get('token') ?? m.get('Token');
      if (!userIdStr || !token) {
        this.status.set('error');
        this.message.set('Link inválido. É necessário userId e token na URL.');
        this.cdr.markForCheck();
        return;
      }
      const userId = Number(userIdStr);
      if (!Number.isFinite(userId) || userId < 0) {
        this.status.set('error');
        this.message.set('Identificador de usuário inválido.');
        this.cdr.markForCheck();
        return;
      }
      this.status.set('loading');
      this.cdr.markForCheck();
      this.api.confirmarEmail({ userId, token: token }).subscribe({
        next: () => {
          this.status.set('ok');
          this.message.set('E-mail confirmado. Você já pode fazer login.');
          this.cdr.markForCheck();
          setTimeout(() => this.router.navigateByUrl(this.linkLogin), 2000);
        },
        error: (err: unknown) => {
          this.status.set('error');
          const m =
            (err as ApiError)?.message ??
            (err as HttpErrorResponse)?.error?.message ??
            (typeof (err as HttpErrorResponse)?.error === 'string'
              ? (err as HttpErrorResponse).error
              : 'Não foi possível confirmar o e-mail. Tente novamente ou contate o suporte.');
          this.message.set(typeof m === 'string' ? m : 'Falha na confirmação.');
          this.cdr.markForCheck();
        },
      });
    });
  }
}
