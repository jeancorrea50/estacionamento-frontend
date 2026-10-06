import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CpfFormatDirective } from '../../directives/cpf-format.directive';
import { cpfCompletoValidator } from '../../validators/cpf-celular.validator';
import { ConviteTransportadoraService } from '../../services/convite-transportadora.service';

@Component({
  selector: 'app-convidar-transportadora-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, CpfFormatDirective],
  templateUrl: './convidar-transportadora-dialog.component.html',
  styleUrl: './convidar-transportadora-dialog.component.scss',
})
export class ConvidarTransportadoraDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly conviteApi = inject(ConviteTransportadoraService);
  readonly ref = inject(MatDialogRef<ConvidarTransportadoraDialogComponent, boolean>);

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    responsavelNome: ['', [Validators.required, Validators.minLength(3)]],
    responsavelCpf: ['', [Validators.required, cpfCompletoValidator()]],
    responsavelEmail: ['', [Validators.required, Validators.email]],
  });

  cancelar(): void {
    if (this.enviando()) return;
    this.ref.close(false);
  }

  enviar(): void {
    this.erro.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enviando()) return;

    this.enviando.set(true);
    const v = this.form.getRawValue();
    this.conviteApi
      .criar({
        responsavelNome: v.responsavelNome,
        responsavelCpf: v.responsavelCpf,
        responsavelEmail: v.responsavelEmail,
      })
      .subscribe({
        next: (res) => {
          this.enviando.set(false);
          if (!res.ok) {
            this.erro.set(res.message ?? 'Não foi possível enviar o convite.');
            return;
          }
          this.ref.close(true);
        },
        error: () => {
          this.enviando.set(false);
          this.erro.set('Não foi possível enviar o convite.');
        },
      });
  }

  fieldError(name: 'responsavelNome' | 'responsavelCpf' | 'responsavelEmail'): string | null {
    const c = this.form.controls[name];
    if (!c.touched || !c.errors) return null;
    if (c.errors['required']) return 'Campo obrigatório.';
    if (c.errors['minlength']) return 'Informe o nome completo.';
    if (c.errors['email']) return 'E-mail inválido.';
    if (c.errors['cpfIncompleto']) return 'CPF deve ter 11 dígitos.';
    if (c.errors['cpfInvalido']) return 'CPF inválido.';
    return 'Valor inválido.';
  }
}
