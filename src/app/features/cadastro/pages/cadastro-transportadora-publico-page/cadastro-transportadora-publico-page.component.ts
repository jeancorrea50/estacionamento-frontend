import { ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CpfFormatDirective } from '../../directives/cpf-format.directive';
import { CnpjFormatDirective } from '../../directives/cnpj-format.directive';
import { cpfCompletoValidator } from '../../validators/cpf-celular.validator';
import { ConviteTransportadoraService } from '../../services/convite-transportadora.service';
import type {
  CompletarCadastroTransportadoraInput,
  ConviteTransportadoraPublicoDto,
} from '../../models/convite-transportadora.models';
import { STATUS_CADASTRO_TRANSPORTADORA_LABEL } from '../../models/convite-transportadora.models';

type PageState = 'loading' | 'ready' | 'invalid' | 'expired' | 'done' | 'error';

@Component({
  selector: 'app-cadastro-transportadora-publico-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, CpfFormatDirective, CnpjFormatDirective],
  templateUrl: './cadastro-transportadora-publico-page.component.html',
  styleUrl: './cadastro-transportadora-publico-page.component.scss',
})
export class CadastroTransportadoraPublicoPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ConviteTransportadoraService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly state = signal<PageState>('loading');
  readonly message = signal<string>('');
  readonly convite = signal<ConviteTransportadoraPublicoDto | null>(null);
  readonly salvando = signal(false);
  readonly concluindo = signal(false);

  private token = '';

  readonly form = this.fb.nonNullable.group({
    razaoSocial: ['', [Validators.required, Validators.minLength(2)]],
    nomeFantasia: [''],
    cnpj: ['', [Validators.required]],
    inscricaoEstadual: [''],
    email: ['', [Validators.email]],
    telefone: [''],
    responsavelNome: ['', [Validators.required, Validators.minLength(3)]],
    responsavelCpf: ['', [Validators.required, cpfCompletoValidator()]],
    responsavelEmail: ['', [Validators.required, Validators.email]],
    responsavelTelefone: [''],
    cep: [''],
    logradouro: [''],
    numero: [''],
    complemento: [''],
    bairro: [''],
    cidade: [''],
    estado: [''],
  });

  readonly statusLabel = STATUS_CADASTRO_TRANSPORTADORA_LABEL;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.token = (params.get('token') ?? '').trim();
      if (!this.token) {
        this.state.set('invalid');
        this.message.set('Link inválido. Token ausente.');
        this.cdr.markForCheck();
        return;
      }
      this.carregar();
    });
  }

  private carregar(): void {
    this.state.set('loading');
    this.api.obterPorToken(this.token).subscribe({
      next: (dto) => {
        if (!dto) {
          this.state.set('invalid');
          this.message.set('Convite não encontrado ou token inválido.');
          this.cdr.markForCheck();
          return;
        }
        this.convite.set(dto);
        if (dto.status === 'ConviteExpirado' || !dto.tokenValido) {
          this.state.set('expired');
          this.message.set(dto.mensagem || 'Este convite expirou ou já foi utilizado.');
          this.cdr.markForCheck();
          return;
        }
        if (dto.status === 'Ativa') {
          this.state.set('done');
          this.message.set('Cadastro já concluído. Faça login com suas credenciais.');
          this.cdr.markForCheck();
          return;
        }
        this.patchFromConvite(dto);
        this.state.set('ready');
        this.cdr.markForCheck();
      },
      error: () => {
        this.state.set('error');
        this.message.set('Não foi possível carregar o convite. Tente novamente mais tarde.');
        this.cdr.markForCheck();
      },
    });
  }

  private patchFromConvite(dto: ConviteTransportadoraPublicoDto): void {
    const r = dto.rascunho;
    this.form.patchValue({
      razaoSocial: r?.razaoSocial ?? '',
      nomeFantasia: r?.nomeFantasia ?? '',
      cnpj: r?.cnpj ?? '',
      inscricaoEstadual: r?.inscricaoEstadual ?? '',
      email: r?.email ?? dto.responsavelEmail ?? '',
      telefone: r?.telefone ?? '',
      responsavelNome: r?.responsavelNome ?? dto.responsavelNome ?? '',
      responsavelCpf: r?.responsavelCpf ?? dto.responsavelCpf ?? '',
      responsavelEmail: r?.responsavelEmail ?? dto.responsavelEmail ?? '',
      responsavelTelefone: r?.responsavelTelefone ?? '',
      cep: r?.endereco?.cep ?? '',
      logradouro: r?.endereco?.logradouro ?? '',
      numero: r?.endereco?.numero ?? '',
      complemento: r?.endereco?.complemento ?? '',
      bairro: r?.endereco?.bairro ?? '',
      cidade: r?.endereco?.cidade ?? '',
      estado: r?.endereco?.estado ?? '',
    });
  }

  private buildPayload(): CompletarCadastroTransportadoraInput {
    const v = this.form.getRawValue();
    return {
      razaoSocial: v.razaoSocial.trim(),
      nomeFantasia: v.nomeFantasia.trim() || null,
      cnpj: v.cnpj.replace(/\D/g, ''),
      inscricaoEstadual: v.inscricaoEstadual.trim() || null,
      email: v.email.trim() || null,
      telefone: v.telefone.trim() || null,
      responsavelNome: v.responsavelNome.trim(),
      responsavelCpf: v.responsavelCpf.replace(/\D/g, ''),
      responsavelEmail: v.responsavelEmail.trim().toLowerCase(),
      responsavelTelefone: v.responsavelTelefone.trim() || null,
      endereco: {
        cep: v.cep.replace(/\D/g, '') || null,
        logradouro: v.logradouro.trim() || null,
        numero: v.numero.trim() || null,
        complemento: v.complemento.trim() || null,
        bairro: v.bairro.trim() || null,
        cidade: v.cidade.trim() || null,
        estado: v.estado.trim().toUpperCase() || null,
      },
    };
  }

  salvarRascunho(): void {
    this.message.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.salvando()) return;
    this.salvando.set(true);
    this.api.salvarRascunho(this.token, this.buildPayload()).subscribe({
      next: (res) => {
        this.salvando.set(false);
        this.message.set(res.message ?? (res.ok ? 'Progresso salvo.' : 'Falha ao salvar.'));
        this.cdr.markForCheck();
      },
      error: () => {
        this.salvando.set(false);
        this.message.set('Falha ao salvar o progresso.');
        this.cdr.markForCheck();
      },
    });
  }

  concluir(): void {
    this.message.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.concluindo()) return;
    const cnpj = this.form.controls.cnpj.value.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      this.message.set('Informe um CNPJ válido com 14 dígitos.');
      return;
    }
    this.concluindo.set(true);
    this.api.concluir(this.token, this.buildPayload()).subscribe({
      next: (res) => {
        this.concluindo.set(false);
        if (!res.ok) {
          this.message.set(res.message ?? 'Não foi possível concluir o cadastro.');
          this.cdr.markForCheck();
          return;
        }
        this.state.set('done');
        this.message.set(res.message ?? 'Cadastro concluído com sucesso.');
        this.cdr.markForCheck();
      },
      error: () => {
        this.concluindo.set(false);
        this.message.set('Não foi possível concluir o cadastro.');
        this.cdr.markForCheck();
      },
    });
  }
}
