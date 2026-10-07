import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { UsuarioApiService } from '../../../../core/api/services/usuario-api.service';
import { environment } from '../../../../../environments/environment';
import { ApiError } from '../../../../core/api/models';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-esqueci-senha-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './esqueci-senha-page.component.html',
  styleUrls: ['../login-page/login-page.component.scss', './esqueci-senha-page.component.scss'],
})
export class EsqueciSenhaPageComponent {
  private fb = inject(FormBuilder);
  private api = inject(UsuarioApiService);
  private cdr = inject(ChangeDetectorRef);

  readonly form: FormGroup;
  loading = false;
  submitted = false;
  successMessage: string | null = null;
  devLink: string | null = null;
  errorMessage: string | null = null;
  cooldownUntil = 0;
  private cooldownMs = 30000;

  readonly isDev = !environment.production;

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get email() {
    return this.form.get('email');
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (Date.now() < this.cooldownUntil) {
      return;
    }

    this.errorMessage = null;
    this.successMessage = null;
    this.devLink = null;
    const email = String(this.form.value.email ?? '').trim();
    this.loading = true;

    this.api
      .esqueciSenha(email)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cooldownUntil = Date.now() + this.cooldownMs;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          this.submitted = true;
          this.successMessage = res.userMessage;
          this.devLink = this.isDev ? res.devLink : null;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.errorMessage = resolveUsuarioPublicError(err);
          this.cdr.markForCheck();
        },
      });
  }

  cooldownSecondsLeft(): number {
    const left = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
    return left > 0 ? left : 0;
  }
}

function resolveUsuarioPublicError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as ApiError).message === 'string') {
    return (err as ApiError).message.trim();
  }
  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (body && typeof body === 'object' && !(body instanceof ProgressEvent)) {
      const b = body as {
        notifications?: string[];
        Notifications?: string[];
        message?: string;
        Message?: string;
        title?: string;
        errors?: Record<string, string[]>;
      };
      const notes = b.notifications ?? b.Notifications;
      if (Array.isArray(notes) && notes.length > 0) {
        const t = notes.filter((n): n is string => typeof n === 'string').join(' ').trim();
        if (t) return t;
      }
      const msg = b.message ?? b.Message ?? b.title;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
      if (b.errors && typeof b.errors === 'object') {
        const flat = Object.values(b.errors)
          .flat()
          .filter((s): s is string => typeof s === 'string')
          .join(' ')
          .trim();
        if (flat) return flat;
      }
    }
    if (typeof body === 'string' && body.trim()) return body.trim();
  }
  return 'Não foi possível enviar a solicitação. Tente novamente.';
}
