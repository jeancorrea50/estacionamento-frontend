import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  ConviteTransportadoraApiService,
  ConviteTransportadoraDto,
} from '../../services/convite-transportadora-api.service';

type StepKey = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-convite-transportadora-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './convite-transportadora-page.component.html',
  styleUrls: ['./convite-transportadora-page.component.scss'],
})
export class ConviteTransportadoraPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ConviteTransportadoraApiService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  token = '';
  loading = true;
  saving = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  convite: ConviteTransportadoraDto | null = null;
  /** Etapa em que o usuário parou (vem de etapaAtual do backend). */
  step: StepKey = 1;
  concluido = false;
  showPassword = false;
  showConfirmPassword = false;

  readonly steps: { key: StepKey; label: string; icon: string }[] = [
    { key: 1, label: 'Acesso', icon: 'person' },
    { key: 2, label: 'Responsável', icon: 'badge' },
    { key: 3, label: 'Empresa', icon: 'local_shipping' },
    { key: 4, label: 'Endereço', icon: 'home' },
  ];

  acessoForm = this.fb.group({
    userName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(6)]],
    confirmPassword: [''],
  });

  responsavelForm = this.fb.group({
    nome: ['', Validators.required],
    cpf: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefone: [''],
    dataNascimento: [''],
    nomeMae: [''],
  });

  empresaForm = this.fb.group({
    razaoSocial: ['', Validators.required],
    nomeFantasia: ['', Validators.required],
    cnpj: ['', Validators.required],
    inscricaoEstadual: [''],
  });

  enderecoForm = this.fb.group({
    cep: ['', Validators.required],
    logradouro: ['', Validators.required],
    numero: ['', Validators.required],
    complemento: [''],
    bairro: ['', Validators.required],
    cidade: ['', Validators.required],
    estado: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token')?.trim() ?? '';
    if (!this.token) {
      this.loading = false;
      this.errorMessage = 'Link de convite inválido.';
      return;
    }
    this.carregar();
  }

  carregar(): void {
    this.loading = true;
    this.errorMessage = null;
    this.api
      .obterPorToken(this.token)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (c) => {
          this.aplicarConvite(c);
        },
        error: (err) => {
          this.errorMessage = this.msgErro(err, 'Não foi possível abrir o convite.');
        },
      });
  }

  /** Sempre alinha a UI com etapaAtual do backend. */
  private aplicarConvite(c: ConviteTransportadoraDto): void {
    this.convite = c;
    if (c.status === 'Concluido' || c.etapaAtual >= 5) {
      this.concluido = true;
      this.step = 4;
      this.successMessage = 'Cadastro já concluído. Você já pode entrar no sistema.';
      this.preencherForms(c);
      return;
    }
    this.concluido = false;
    this.preencherForms(c);
    this.step = this.resolverStep(c.etapaAtual);
    this.ajustarValidadoresSenha();
    this.successMessage = null;
  }

  isDone(s: StepKey): boolean {
    if (this.concluido) return true;
    const etapa = this.convite?.etapaAtual ?? this.step;
    // etapaAtual = próxima a preencher → etapas menores já foram concluídas
    return etapa > s;
  }

  isActive(s: StepKey): boolean {
    return !this.concluido && this.step === s;
  }

  /** Permite voltar só até etapas já concluídas ou a atual. */
  irParaEtapa(s: StepKey): void {
    if (this.concluido || this.saving) return;
    const max = this.resolverStep(this.convite?.etapaAtual ?? 1);
    if (s <= max) {
      this.step = s;
      this.errorMessage = null;
      this.ajustarValidadoresSenha();
    }
  }

  avancar(): void {
    this.errorMessage = null;
    this.successMessage = null;
    if (this.step === 1) this.salvarAcesso();
    else if (this.step === 2) this.salvarResponsavel();
    else if (this.step === 3) this.salvarEmpresa();
    else this.salvarEndereco();
  }

  voltar(): void {
    if (this.step > 1 && !this.concluido) {
      this.step = (this.step - 1) as StepKey;
      this.ajustarValidadoresSenha();
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  buscarCep(): void {
    const cep = String(this.enderecoForm.value.cep ?? '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    this.http
      .get<{ logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean }>(
        `${environment.viacepBaseUrl}/${cep}/json/`
      )
      .subscribe({
        next: (r) => {
          if (r?.erro) return;
          this.enderecoForm.patchValue({
            logradouro: r.logradouro ?? '',
            bairro: r.bairro ?? '',
            cidade: r.localidade ?? '',
            estado: r.uf ?? '',
          });
          this.cdr.markForCheck();
        },
      });
  }

  private salvarAcesso(): void {
    this.ajustarValidadoresSenha();
    if (this.acessoForm.invalid) {
      this.acessoForm.markAllAsTouched();
      return;
    }
    const v = this.acessoForm.getRawValue();
    const senha = (v.password ?? '').trim();
    const conf = (v.confirmPassword ?? '').trim();
    const jaTemSenha = !!this.convite?.possuiSenha;

    if (!senha && !jaTemSenha) {
      this.errorMessage = 'Informe a senha.';
      return;
    }
    if (senha && senha !== conf) {
      this.errorMessage = 'As senhas não conferem.';
      return;
    }

    this.saving = true;
    this.api
      .salvarAcesso(this.token, {
        userName: v.userName!.trim(),
        email: v.email!.trim(),
        password: senha,
        confirmPassword: senha ? conf : '',
      })
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (c) => {
          this.aplicarConvite(c);
          this.step = this.resolverStep(c.etapaAtual);
          this.successMessage = 'Acesso salvo! Continue de onde parou.';
        },
        error: (err) => {
          this.errorMessage = this.msgErro(err);
        },
      });
  }

  private salvarResponsavel(): void {
    if (this.responsavelForm.invalid) {
      this.responsavelForm.markAllAsTouched();
      return;
    }
    const v = this.responsavelForm.getRawValue();
    this.saving = true;
    this.api
      .salvarResponsavel(this.token, {
        nome: v.nome!.trim(),
        cpf: v.cpf!.trim(),
        email: v.email!.trim(),
        telefone: v.telefone?.trim() || undefined,
        dataNascimento: v.dataNascimento || null,
        nomeMae: v.nomeMae?.trim() || undefined,
      })
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (c) => {
          this.aplicarConvite(c);
          this.step = this.resolverStep(c.etapaAtual);
          this.successMessage = 'Responsável salvo!';
        },
        error: (err) => {
          this.errorMessage = this.msgErro(err);
        },
      });
  }

  private salvarEmpresa(): void {
    if (this.empresaForm.invalid) {
      this.empresaForm.markAllAsTouched();
      return;
    }
    const v = this.empresaForm.getRawValue();
    this.saving = true;
    this.api
      .salvarEmpresa(this.token, {
        razaoSocial: v.razaoSocial!.trim(),
        nomeFantasia: v.nomeFantasia!.trim(),
        cnpj: v.cnpj!.trim(),
        inscricaoEstadual: v.inscricaoEstadual?.trim() || undefined,
      })
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (c) => {
          this.aplicarConvite(c);
          this.step = this.resolverStep(c.etapaAtual);
          this.successMessage = 'Empresa salva!';
        },
        error: (err) => {
          this.errorMessage = this.msgErro(err);
        },
      });
  }

  private salvarEndereco(): void {
    if (this.enderecoForm.invalid) {
      this.enderecoForm.markAllAsTouched();
      return;
    }
    const v = this.enderecoForm.getRawValue();
    this.saving = true;
    this.api
      .salvarEndereco(this.token, {
        cep: v.cep!.trim(),
        logradouro: v.logradouro!.trim(),
        numero: v.numero!.trim(),
        complemento: v.complemento?.trim() || undefined,
        bairro: v.bairro!.trim(),
        cidade: v.cidade!.trim(),
        estado: v.estado!.trim().toUpperCase(),
      })
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (c) => {
          this.aplicarConvite(c);
          this.successMessage = 'Cadastro concluído! Você já pode entrar no sistema.';
        },
        error: (err) => {
          this.errorMessage = this.msgErro(err);
        },
      });
  }

  private preencherForms(c: ConviteTransportadoraDto): void {
    this.acessoForm.patchValue({
      userName: c.userName ?? '',
      email: c.emailAcesso || c.emailConvidado || '',
      password: '',
      confirmPassword: '',
    });
    this.responsavelForm.patchValue({
      nome: c.responsavelNome ?? '',
      cpf: c.responsavelCpf ?? '',
      email: c.responsavelEmail || c.emailConvidado || '',
      telefone: c.responsavelTelefone ?? '',
      dataNascimento: c.responsavelDataNascimento
        ? String(c.responsavelDataNascimento).slice(0, 10)
        : '',
      nomeMae: c.responsavelNomeMae ?? '',
    });
    this.empresaForm.patchValue({
      razaoSocial: c.razaoSocial ?? '',
      nomeFantasia: c.nomeFantasia ?? '',
      cnpj: c.cnpj ?? '',
      inscricaoEstadual: c.inscricaoEstadual ?? '',
    });
    this.enderecoForm.patchValue({
      cep: c.cep ?? '',
      logradouro: c.logradouro ?? '',
      numero: c.numero ?? '',
      complemento: c.complemento ?? '',
      bairro: c.bairro ?? '',
      cidade: c.cidade ?? '',
      estado: c.estado ?? '',
    });
  }

  /**
   * etapaAtual do backend = próxima etapa a preencher (1..4) ou 5 = concluído.
   */
  private resolverStep(etapa: number): StepKey {
    const n = Number(etapa);
    if (!Number.isFinite(n) || n <= 1) return 1;
    if (n === 2) return 2;
    if (n === 3) return 3;
    if (n >= 4) return 4;
    return 1;
  }

  private ajustarValidadoresSenha(): void {
    const jaTem = !!this.convite?.possuiSenha;
    const pass = this.acessoForm.controls.password;
    const conf = this.acessoForm.controls.confirmPassword;
    if (jaTem) {
      pass.clearValidators();
      pass.addValidators([Validators.minLength(6)]);
      conf.clearValidators();
    } else {
      pass.setValidators([Validators.required, Validators.minLength(6)]);
      conf.setValidators([Validators.required]);
    }
    pass.updateValueAndValidity({ emitEvent: false });
    conf.updateValueAndValidity({ emitEvent: false });
  }

  private msgErro(err: unknown, fallback = 'Não foi possível salvar.'): string {
    if (err && typeof err === 'object') {
      const e = err as {
        message?: string;
        error?: { errors?: string[]; message?: string; userMessage?: string };
      };
      if (e.message) return e.message;
      const api = e.error;
      if (api?.userMessage) return api.userMessage;
      if (api?.message) return api.message;
      if (Array.isArray(api?.errors)) return api!.errors!.join(' ');
    }
    return fallback;
  }
}
