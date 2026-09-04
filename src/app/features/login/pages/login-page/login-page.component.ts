import { ChangeDetectorRef, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { ThemeService, ThemeMode } from '../../../../core/services/theme.service';
import { ToastService } from '../../../../core/api/services/toast.service';

const REMEMBER_USERNAME_KEY = 'gts_login_remember_username';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.scss'],
})
export class LoginPageComponent {
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form: FormGroup;
  loading = false;
  readonly showPassword = signal(false);

  private readonly themeMode = signal<ThemeMode>(this.themeService.getCurrentTheme().mode);
  readonly currentMode = computed(() => this.themeMode());

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef
  ) {
    const rememberedUsername = this.readRememberedUsername();

    this.form = this.fb.group({
      username: [rememberedUsername, [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(5)]],
      rememberMe: [Boolean(rememberedUsername)],
    });

    this.themeService.theme$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((theme) => {
      this.themeMode.set(theme.mode);
    });
  }

  get username() {
    return this.form.get('username');
  }

  get password() {
    return this.form.get('password');
  }

  toggleTheme(): void {
    const next = this.currentMode() === 'dark' ? 'light' : 'dark';
    this.themeService.setThemeMode(next);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password, rememberMe } = this.form.value as {
      username: string;
      password: string;
      rememberMe: boolean;
    };

    this.persistRememberedUsername(username, rememberMe);
    this.loading = true;

    this.authService
      .login(username, password)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (result) => {
          if (result.success) {
            this.toast.success('Login realizado com sucesso.');
            this.router.navigateByUrl(this.authService.getDefaultAuthorizedRoute());
          } else {
            this.toast.error(result.message);
            this.cdr.detectChanges();
          }
        },
        error: () => {
          this.toast.error('Erro ao conectar. Tente novamente.');
          this.cdr.detectChanges();
        },
      });
  }

  private readRememberedUsername(): string {
    try {
      return localStorage.getItem(REMEMBER_USERNAME_KEY)?.trim() ?? '';
    } catch {
      return '';
    }
  }

  private persistRememberedUsername(username: string, rememberMe: boolean): void {
    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_USERNAME_KEY, username.trim());
      } else {
        localStorage.removeItem(REMEMBER_USERNAME_KEY);
      }
    } catch {
      // Ignora falhas de storage (modo privado, quota, etc.).
    }
  }
}
