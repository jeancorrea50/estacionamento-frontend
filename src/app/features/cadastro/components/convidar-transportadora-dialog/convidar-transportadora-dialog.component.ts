import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CpfFormatDirective } from '../../directives/cpf-format.directive';
import { TelefoneFormatDirective } from '../../directives/telefone-format.directive';
import { cpfCompletoValidator, celularCompletoValidator } from '../../validators/cpf-celular.validator';
import { ConviteTransportadoraService } from '../../services/convite-transportadora.service';
import type { ConviteTransportadoraResult } from '../../models/convite-transportadora.models';

@Component({
  selector: 'app-convidar-transportadora-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    CpfFormatDirective,
    TelefoneFormatDirective,
  ],
  templateUrl: './convidar-transportadora-dialog.component.html',
  styleUrl: './convidar-transportadora-dialog.component.scss',
})
export class ConvidarTransportadoraDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly conviteApi = inject(ConviteTransportadoraService);
  readonly ref = inject(MatDialogRef<ConvidarTransportadoraDialogComponent, boolean>);

  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly sucesso = signal<string | null>(null);
  readonly resultado = signal<ConviteTransportadoraResult | null>(null);
  /** Celular digitado no formulário (para montar WhatsApp se a API não devolver). */
  private telefoneInformado = '';

  readonly form = this.fb.nonNullable.group({
    responsavelNome: ['', [Validators.required, Validators.minLength(3)]],
    responsavelCpf: ['', [Validators.required, cpfCompletoValidator()]],
    responsavelEmail: ['', [Validators.required, Validators.email]],
    responsavelTelefone: ['', [Validators.required, celularCompletoValidator()]],
  });

  readonly podeWhatsApp = computed(() => !!this.resolveWhatsAppUrl());

  cancelar(): void {
    if (this.enviando()) return;
    this.ref.close(!!this.resultado());
  }

  enviar(): void {
    this.erro.set(null);
    this.sucesso.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enviando()) return;

    this.enviando.set(true);
    const v = this.form.getRawValue();
    this.telefoneInformado = v.responsavelTelefone;
    this.conviteApi
      .criar({
        responsavelNome: v.responsavelNome,
        responsavelCpf: v.responsavelCpf,
        responsavelEmail: v.responsavelEmail,
        responsavelTelefone: v.responsavelTelefone,
      })
      .subscribe({
        next: (res) => {
          this.enviando.set(false);
          if (!res.ok || !res.data) {
            this.erro.set(res.message ?? 'Não foi possível enviar o convite.');
            return;
          }
          this.resultado.set(this.enrichShareLinks(res.data, v.responsavelTelefone));
          this.sucesso.set(
            res.data.emailEnviado
              ? 'E-mail enviado com o botão Cadastrar Transportadora. Compartilhe também por WhatsApp.'
              : (res.message ??
                'Convite criado. O e-mail pode ter falhado — use WhatsApp ou copie o link abaixo.')
          );
        },
        error: () => {
          this.enviando.set(false);
          this.erro.set('Não foi possível enviar o convite.');
        },
      });
  }

  abrirWhatsApp(): void {
    const url = this.resolveWhatsAppUrl();
    if (!url) {
      this.erro.set('WhatsApp indisponível — verifique o celular informado.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async copiarLink(): Promise<void> {
    const link = this.resultado()?.linkConviteFrontend;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.sucesso.set('Link copiado! Envie para o responsável.');
    } catch {
      this.erro.set('Não foi possível copiar. Selecione o link manualmente.');
    }
  }

  fieldError(
    name: 'responsavelNome' | 'responsavelCpf' | 'responsavelEmail' | 'responsavelTelefone'
  ): string | null {
    const c = this.form.controls[name];
    if (!c.touched || !c.errors) return null;
    if (c.errors['required']) return 'Campo obrigatório.';
    if (c.errors['minlength']) return 'Informe o nome completo.';
    if (c.errors['email']) return 'E-mail inválido.';
    if (c.errors['cpfIncompleto']) return 'CPF deve ter 11 dígitos.';
    if (c.errors['cpfInvalido']) return 'CPF inválido.';
    if (c.errors['celularIncompleto'] || c.errors['telefoneIncompleto'])
      return 'Informe DDD + número (11 dígitos). O DDI +55 é fixo.';
    if (c.errors['celularInvalido']) return 'Celular deve ter o 9 após o DDD.';
    return 'Valor inválido.';
  }

  private resolveWhatsAppUrl(): string | null {
    const r = this.resultado();
    if (r?.urlWhatsApp?.trim()) return r.urlWhatsApp.trim();
    const built = this.buildWhatsAppUrl(r?.linkConviteFrontend, this.telefoneInformado);
    return built;
  }

  private enrichShareLinks(
    data: ConviteTransportadoraResult,
    telefoneRaw: string
  ): ConviteTransportadoraResult {
    const wa = data.urlWhatsApp?.trim() || this.buildWhatsAppUrl(data.linkConviteFrontend, telefoneRaw);
    return {
      ...data,
      urlWhatsApp: wa,
      urlSms: null,
    };
  }

  private buildWhatsAppUrl(link: string | null | undefined, telefoneRaw: string): string | null {
    const linkTrim = (link ?? '').trim();
    const tel = this.normalizePhoneBr(telefoneRaw);
    if (!linkTrim || !tel) return null;
    const mensagem = `Olá!\n\nVocê foi convidado(a) a cadastrar sua transportadora no GTS Sistema.\n\n${linkTrim}\n\nCadastrar Transportadora`;
    return `https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}`;
  }

  private normalizePhoneBr(raw: string): string | null {
    let digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (!digits.startsWith('55') && digits.length <= 11) digits = `55${digits}`;
    return digits;
  }
}
