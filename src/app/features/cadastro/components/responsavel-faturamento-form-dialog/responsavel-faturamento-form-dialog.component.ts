import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CepFormatDirective, formatCep } from '../../directives/cep-format.directive';
import { CnpjFormatDirective, formatCnpj } from '../../directives/cnpj-format.directive';
import { CpfFormatDirective, formatCpf } from '../../directives/cpf-format.directive';
import { TelefoneFormatDirective, formatTelefone } from '../../directives/telefone-format.directive';
import type { ResponsavelFaturamentoDTO } from '../../models/responsavel-faturamento.dto';
import { ResponsavelFaturamentoService } from '../../services/responsavel-faturamento.service';
import { ViacepService } from '../../services/viacep.service';
import { ToastService } from '../../../../core/api/services/toast.service';
import { ApiError } from '../../../../core/api/models';

export type ResponsavelFaturamentoFormAba = 'empresa' | 'adicional';

export interface ResponsavelFaturamentoFormDialogData {
  id?: number | null;
  /** Pré-preenche CNPJ ao abrir em modo novo (ex.: lookup externo). */
  cnpjInicial?: string;
}

export interface ResponsavelFaturamentoFormDialogResult {
  saved: true;
  dto: ResponsavelFaturamentoDTO;
}

@Component({
  selector: 'app-responsavel-faturamento-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatSlideToggleModule,
    CnpjFormatDirective,
    CpfFormatDirective,
    TelefoneFormatDirective,
    CepFormatDirective,
  ],
  templateUrl: './responsavel-faturamento-form-dialog.component.html',
  styleUrl: './responsavel-faturamento-form-dialog.component.scss',
})
export class ResponsavelFaturamentoFormDialogComponent implements OnInit {
  readonly ref = inject(
    MatDialogRef<ResponsavelFaturamentoFormDialogComponent, ResponsavelFaturamentoFormDialogResult | undefined>
  );
  readonly data = inject<ResponsavelFaturamentoFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ResponsavelFaturamentoService);
  private readonly viacep = inject(ViacepService);
  private readonly toast = inject(ToastService);

  aba: ResponsavelFaturamentoFormAba = 'empresa';
  salvando = false;
  carregando = false;
  private mergeRaw: Record<string, unknown> | null = null;

  readonly form = this.fb.nonNullable.group({
    id: this.fb.control<number | null>(null),
    pessoaId: this.fb.control<number | null>(null),
    razaoSocial: ['', [Validators.required, Validators.maxLength(150)]],
    nomeFantasia: ['', [Validators.maxLength(150)]],
    cnpj: ['', [Validators.required]],
    ativo: [true],
    responsavelLegal: ['', [Validators.maxLength(150)]],
    responsavelCpf: [''],
    responsavelEmail: ['', [Validators.email, Validators.maxLength(150)]],
    responsavelTelefone: [''],
    endereco: this.fb.nonNullable.group({
      id: this.fb.control<number | null>(null),
      cep: [''],
      logradouro: [''],
      numero: [''],
      bairro: [''],
      cidade: [''],
      estado: ['', [Validators.maxLength(2)]],
      complemento: [''],
    }),
  });

  get titulo(): string {
    return this.form.controls.id.value ? 'Editar responsável de faturamento' : 'Novo responsável de faturamento';
  }

  ngOnInit(): void {
    const id = Number(this.data.id);
    if (Number.isFinite(id) && id > 0) {
      this.carregar(id);
      return;
    }
    const cnpj = formatCnpj(String(this.data.cnpjInicial ?? ''));
    if (cnpj) this.form.controls.cnpj.setValue(cnpj);
  }

  selecionarAba(aba: ResponsavelFaturamentoFormAba): void {
    this.aba = aba;
  }

  buscarCep(): void {
    const cep = this.form.controls.endereco.controls.cep.value;
    this.viacep.buscarPorCep(cep).subscribe((end) => {
      if (!end) {
        this.toast.warning('CEP não encontrado.');
        return;
      }
      this.form.controls.endereco.patchValue({
        logradouro: end.logradouro,
        bairro: end.bairro,
        cidade: end.cidade,
        estado: end.estado,
      });
    });
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.aba = 'empresa';
      this.toast.warning('Preencha os campos obrigatórios (razão social e CNPJ).');
      return;
    }
    const cnpjDigits = String(this.form.controls.cnpj.value ?? '').replace(/\D/g, '');
    if (cnpjDigits.length !== 14) {
      this.toast.warning('CNPJ deve ter 14 dígitos.');
      this.aba = 'empresa';
      return;
    }

    const raw = this.form.getRawValue();
    const dto: ResponsavelFaturamentoDTO = {
      id: raw.id ?? undefined,
      pessoaId: raw.pessoaId,
      razaoSocial: raw.razaoSocial.trim(),
      nomeFantasia: raw.nomeFantasia.trim(),
      cnpj: raw.cnpj,
      ativo: raw.ativo,
      responsavelLegal: raw.responsavelLegal.trim(),
      responsavelCpf: raw.responsavelCpf,
      responsavelEmail: raw.responsavelEmail.trim(),
      responsavelTelefone: raw.responsavelTelefone,
      endereco: {
        id: raw.endereco.id ?? undefined,
        cep: raw.endereco.cep,
        logradouro: raw.endereco.logradouro,
        numero: raw.endereco.numero,
        bairro: raw.endereco.bairro,
        cidade: raw.endereco.cidade,
        estado: raw.endereco.estado,
        complemento: raw.endereco.complemento,
      },
    };

    const payload = this.service.montarPayload(dto, this.mergeRaw);
    const isEdit = Number(dto.id) > 0;
    this.salvando = true;
    const req$ = isEdit ? this.service.alterar(payload) : this.service.gravar(payload);
    req$.subscribe({
      next: (saved) => {
        this.salvando = false;
        this.toast.success(isEdit ? 'Responsável atualizado.' : 'Responsável cadastrado.');
        this.ref.close({ saved: true, dto: { ...dto, ...saved, id: saved.id || dto.id } });
      },
      error: (err: ApiError | unknown) => {
        this.salvando = false;
        const msg =
          (err as ApiError)?.message ||
          (err as { error?: { message?: string } })?.error?.message ||
          'Não foi possível salvar.';
        this.toast.error(String(msg));
      },
    });
  }

  private carregar(id: number): void {
    this.carregando = true;
    this.service.obterPorIdComRaw(id).subscribe({
      next: (res) => {
        this.carregando = false;
        if (!res) {
          this.toast.error('Registro não encontrado.');
          this.ref.close(undefined);
          return;
        }
        this.mergeRaw = res.raw;
        const d = res.dto;
        this.form.patchValue({
          id: d.id ?? id,
          pessoaId: d.pessoaId ?? null,
          razaoSocial: d.razaoSocial,
          nomeFantasia: d.nomeFantasia,
          cnpj: formatCnpj(d.cnpj),
          ativo: d.ativo !== false,
          responsavelLegal: d.responsavelLegal ?? '',
          responsavelCpf: formatCpf(d.responsavelCpf ?? ''),
          responsavelEmail: d.responsavelEmail ?? '',
          responsavelTelefone: formatTelefone(d.responsavelTelefone ?? ''),
          endereco: {
            id: d.endereco?.id ?? null,
            cep: formatCep(d.endereco?.cep ?? ''),
            logradouro: d.endereco?.logradouro ?? '',
            numero: d.endereco?.numero ?? '',
            bairro: d.endereco?.bairro ?? '',
            cidade: d.endereco?.cidade ?? '',
            estado: d.endereco?.estado ?? '',
            complemento: d.endereco?.complemento ?? '',
          },
        });
      },
      error: () => {
        this.carregando = false;
        this.toast.error('Falha ao carregar o responsável.');
        this.ref.close(undefined);
      },
    });
  }
}
