import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DOCUMENT, CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
  FormGroup,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { UsuarioApiService } from '../../../../core/api/services/usuario-api.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { readRawQueryParam } from '../../../../core/utils/url-query.util';
import { ApiError } from '../../../../core/api/models';
import { HttpErrorResponse } from '@angular/common/http';

/** Alinhado a políticas comuns do ASP.NET Identity (mínimo + complexidade básica). */
const SENHA_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;

@Component({
  selector: 'app-redefinir-senha-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './redefinir-senha-page.component.html',
  styleUrls: ['../login-page/login-page.component.scss', './redefinir-senha-page.component.scss'],
})
export class RedefinirSenhaPageComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(UsuarioApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private doc = inject(DOCUMENT);

  readonly form: FormGroup;
  loading = false;
  errorMessage: string | null = null;
  linkInvalido = false;
  /** E-mail lido da query (exibido na tela). */
  emailParam = '';
  private tokenParam = '';

  constructor() {
    this.form = this.fb.group(
      {
        newPassword: [
          '',
          [Validators.required, Validators.minLength(6), Validators.pattern(SENHA_PATTERN)],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: [confirmPasswordMatches] }
    );
  }

  get newPassword() {
    return this.form.get('newPassword');
  }

  get confirmPassword() {
    return this.form.get('confirmPassword');
  }

  ngOnInit(): void {
    const search = this.doc.defaultView?.location.search ?? '';
    const snap = this.route.snapshot.queryParamMap;
    const tokenFromUrl = readRawQueryParam(search, 'token');
    const emailFromUrl = readRawQueryParam(search, 'email');
    this.tokenParam =
      (tokenFromUrl && tokenFromUrl.length > 0 ? tokenFromUrl : null) ??
      snap.get('token') ??
      snap.get('Token') ??
      '';
    this.emailParam =
      (emailFromUrl && emailFromUrl.length > 0 ? emailFromUrl.trim() : '') ||
      (snap.get('email') ?? snap.get('Email') ?? '').trim();

    if (!this.emailParam || !this.tokenParam) {
      this.linkInvalido = true;
    }
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.linkInvalido) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage = null;
    const newPassword = String(this.form.value.newPassword ?? '');
    const confirmPassword = String(this.form.value.confirmPassword ?? '');
    this.loading = true;

    this.api
      .redefinirSenha({
        email: this.emailParam,
        token: this.tokenParam,
        newPassword,
        confirmPassword,
      })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          const msg = 'Senha alterada com sucesso. Você já pode fazer login.';
          this.toast.success(msg);
          void this.router.navigateByUrl('/');
        },
        error: (err: unknown) => {
          this.errorMessage = resolveRedefinirSenhaError(err);
          this.cdr.markForCheck();
        },
      });
  }
}

function confirmPasswordMatches(group: AbstractControl): ValidationErrors | null {
  const p = group.get('newPassword')?.value;
  const c = group.get('confirmPassword')?.value;
  if (p == null || c == null || p === '' || c === '') return null;
  return p === c ? null : { mismatch: true };
}

function resolveRedefinirSenhaError(err: unknown): string {
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
  return 'Não foi possível redefinir a senha. Verifique o link ou solicite um novo.';
}
