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
  /** Celular digitado no formulário (para montar WA/SMS se a API não devolver). */
  private telefoneInformado = '';

  readonly form = this.fb.nonNullable.group({
    responsavelNome: ['', [Validators.required, Validators.minLength(3)]],
    responsavelCpf: ['', [Validators.required, cpfCompletoValidator()]],
    responsavelEmail: ['', [Validators.required, Validators.email]],
    responsavelTelefone: ['', [Validators.required, celularCompletoValidator()]],
  });

  readonly podeWhatsApp = computed(() => !!this.resolveWhatsAppUrl());
  readonly podeSms = computed(() => !!this.resolveSmsUrl());

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
              ? 'E-mail enviado com o botão Cadastrar Transportadora. Compartilhe também por WhatsApp ou SMS.'
              : (res.message ??
                'Convite criado. O e-mail pode ter falhado — use WhatsApp ou SMS abaixo.')
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

  abrirSms(): void {
    this.erro.set(null);
    const url = this.resolveSmsUrl();
    const msg = this.mensagemShare();
    if (!url) {
      this.erro.set('SMS indisponível — verifique o celular informado.');
      return;
    }

    // Disparo via <a> é mais confiável que location.href em alguns browsers.
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Fallback desktop: se o app de SMS não abrir, copia a mensagem.
    window.setTimeout(() => {
      void this.copiarTexto(
        msg,
        'App de SMS aberto (ou mensagem copiada — cole no SMS se o app não abriu).'
      );
    }, 400);
  }

  async copiarLink(): Promise<void> {
    const link = this.resultado()?.linkConviteFrontend;
    if (!link) return;
    await this.copiarTexto(link, 'Link copiado! Envie para o responsável.');
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
    const built = this.buildShareUrls(r?.linkConviteFrontend, this.telefoneInformado);
    return built.urlWhatsApp;
  }

  private resolveSmsUrl(): string | null {
    const r = this.resultado();
    if (r?.urlSms?.trim()) return this.normalizeSmsUrl(r.urlSms.trim());
    const built = this.buildShareUrls(r?.linkConviteFrontend, this.telefoneInformado);
    return built.urlSms;
  }

  private mensagemShare(): string {
    const r = this.resultado();
    if (r?.mensagemCompartilhamento?.trim()) return r.mensagemCompartilhamento.trim();
    const link = r?.linkConviteFrontend ?? '';
    const nome = r?.responsavelNome?.trim() || 'responsável';
    return `Olá, ${nome}!\n\nVocê foi convidado(a) a cadastrar sua transportadora no GTS Sistema.\nToque no link abaixo para abrir o cadastro:\n\n${link}\n\nCadastrar Transportadora`;
  }

  private enrichShareLinks(
    data: ConviteTransportadoraResult,
    telefoneRaw: string
  ): ConviteTransportadoraResult {
    const built = this.buildShareUrls(data.linkConviteFrontend, telefoneRaw, data.mensagemCompartilhamento);
    return {
      ...data,
      urlWhatsApp: data.urlWhatsApp?.trim() || built.urlWhatsApp,
      urlSms: data.urlSms?.trim() ? this.normalizeSmsUrl(data.urlSms.trim()) : built.urlSms,
      mensagemCompartilhamento: data.mensagemCompartilhamento ?? built.mensagem,
    };
  }

  private buildShareUrls(
    link: string | null | undefined,
    telefoneRaw: string,
    mensagemExistente?: string | null
  ): { urlWhatsApp: string | null; urlSms: string | null; mensagem: string } {
    const linkTrim = (link ?? '').trim();
    const tel = this.normalizePhoneBr(telefoneRaw);
    const mensagem =
      (mensagemExistente ?? '').trim() ||
      `Olá!\n\nVocê foi convidado(a) a cadastrar sua transportadora no GTS Sistema.\n\n${linkTrim}\n\nCadastrar Transportadora`;
    if (!linkTrim || !tel) {
      return { urlWhatsApp: null, urlSms: null, mensagem };
    }
    const texto = encodeURIComponent(mensagem);
    return {
      urlWhatsApp: `https://wa.me/${tel}?text=${texto}`,
      urlSms: `sms:+${tel}?&body=${texto}`,
      mensagem,
    };
  }

  private normalizePhoneBr(raw: string): string | null {
    let digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (!digits.startsWith('55') && digits.length <= 11) digits = `55${digits}`;
    return digits;
  }

  /** Garante +DDI e query híbrida (?&body=) para Android/iOS. */
  private normalizeSmsUrl(url: string): string {
    try {
      if (!url.toLowerCase().startsWith('sms:')) return url;
      const rest = url.slice(4);
      const qIdx = rest.search(/[?&]/);
      const phonePart = (qIdx >= 0 ? rest.slice(0, qIdx) : rest).replace(/[^\d+]/g, '');
      const phone = phonePart.startsWith('+') ? phonePart : `+${phonePart.replace(/^\+/, '')}`;
      let body = '';
      const bodyMatch = rest.match(/[?&]body=([^&]*)/);
      if (bodyMatch) body = bodyMatch[1] ?? '';
      return body ? `sms:${phone}?&body=${body}` : `sms:${phone}`;
    } catch {
      return url;
    }
  }

  private async copiarTexto(texto: string, okMsg: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texto);
      this.sucesso.set(okMsg);
    } catch {
      this.erro.set('Não foi possível copiar. Selecione o texto manualmente.');
    }
  }
}
