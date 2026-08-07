import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import type { ApiError } from '../../../../core/api/models';
import { ToastService } from '../../../../core/api/services/toast.service';
import {
  AMBIENTE_LABEL,
  ISOLATION_LABEL,
  TIPO_BANCO_LABEL,
  type AmbienteBancoDados,
  type BancoDadosConexao,
  type BancoDadosConexaoFormPayload,
  type BancoDadosConexaoOpcoes,
  type TipoBancoDados,
} from '../../models/banco-dados-conexao.models';
import { BancoDadosConexaoService } from '../../services/banco-dados-conexao.service';

@Component({
  selector: 'app-banco-dados-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './banco-dados-page.component.html',
  styleUrls: ['./banco-dados-page.component.scss'],
})
export class BancoDadosPageComponent implements OnInit {
  private readonly api = inject(BancoDadosConexaoService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly salvando = signal(false);
  readonly testando = signal(false);
  readonly lista = signal<BancoDadosConexao[]>([]);
  readonly opcoes = signal<BancoDadosConexaoOpcoes | null>(null);
  readonly selecionadoId = signal<number | null>(null);
  readonly modoNovo = signal(false);

  readonly tituloForm = computed(() =>
    this.modoNovo() ? 'Nova conexão' : this.selecionadoId() ? 'Editar conexão' : 'Selecione um perfil'
  );

  readonly bancosDoHost = computed(() => {
    const host = String(this.form.controls.host.value ?? '').trim();
    const bancos = this.opcoes()?.bancos ?? [];
    if (!host) return bancos;
    return bancos.filter((b) => b.host === host);
  });

  readonly form = this.fb.nonNullable.group({
    id: [0],
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    descricao: [''],
    tipoBanco: [1 as TipoBancoDados, Validators.required],
    ambiente: [1 as AmbienteBancoDados, Validators.required],
    host: ['', [Validators.required, Validators.maxLength(255)]],
    porta: [1433, [Validators.required, Validators.min(1)]],
    nomeBanco: ['', [Validators.required, Validators.maxLength(128)]],
    usuario: ['', [Validators.required, Validators.maxLength(128)]],
    senha: [''],
    trustServerCertificate: [true],
    encrypt: [false],
    parametrosExtras: [''],
    ativo: [true],
  });

  readonly tipoLabel = TIPO_BANCO_LABEL;
  readonly ambienteLabel = AMBIENTE_LABEL;
  readonly isolationLabel = ISOLATION_LABEL;

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.api.listar().subscribe({
      next: (lista) => {
        this.lista.set(lista ?? []);
        this.loading.set(false);
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.toast.error(err?.message ?? 'Não foi possível carregar as conexões.');
      },
    });

    this.api.listarOpcoes().subscribe({
      next: (op) => this.opcoes.set(op),
      error: () => {
        /* opcional — dropdowns ficam vazios */
      },
    });
  }

  novo(): void {
    this.modoNovo.set(true);
    this.selecionadoId.set(null);
    this.form.reset({
      id: 0,
      nome: '',
      descricao: '',
      tipoBanco: 1,
      ambiente: 1,
      host: '',
      porta: 1433,
      nomeBanco: '',
      usuario: '',
      senha: '',
      trustServerCertificate: true,
      encrypt: false,
      parametrosExtras: '',
      ativo: true,
    });
    this.form.controls.senha.setValidators([Validators.required]);
    this.form.controls.senha.updateValueAndValidity();
  }

  selecionar(item: BancoDadosConexao): void {
    this.modoNovo.set(false);
    this.selecionadoId.set(item.id);
    this.form.controls.senha.clearValidators();
    this.form.controls.senha.updateValueAndValidity();
    this.form.patchValue({
      id: item.id,
      nome: item.nome ?? '',
      descricao: item.descricao ?? '',
      tipoBanco: (item.tipoBanco ?? 1) as TipoBancoDados,
      ambiente: (item.ambiente ?? 1) as AmbienteBancoDados,
      host: item.host ?? '',
      porta: item.porta > 0 ? item.porta : 1433,
      nomeBanco: item.nomeBanco ?? '',
      usuario: item.usuario ?? '',
      senha: '',
      trustServerCertificate: item.trustServerCertificate ?? true,
      encrypt: item.encrypt ?? false,
      parametrosExtras: item.parametrosExtras ?? '',
      ativo: item.ativo ?? true,
    });
  }

  onHostChange(host: string): void {
    this.form.controls.host.setValue(host);
    const bancos = (this.opcoes()?.bancos ?? []).filter((b) => b.host === host);
    if (bancos.length === 1) {
      this.form.controls.nomeBanco.setValue(bancos[0].nomeBanco);
    }
  }

  onTipoChange(tipo: number): void {
    this.form.controls.tipoBanco.setValue(tipo as TipoBancoDados);
    const portaPadrao = tipo === 2 ? 1521 : tipo === 3 ? 5432 : tipo === 4 ? 3306 : 1433;
    this.form.controls.porta.setValue(portaPadrao);
  }

  private buildPayload(): BancoDadosConexaoFormPayload & { id?: number } {
    const v = this.form.getRawValue();
    const payload: BancoDadosConexaoFormPayload & { id?: number } = {
      nome: v.nome.trim(),
      descricao: v.descricao?.trim() || null,
      tipoBanco: v.tipoBanco,
      ambiente: v.ambiente,
      host: v.host.trim(),
      porta: Number(v.porta) || 1433,
      nomeBanco: v.nomeBanco.trim(),
      usuario: v.usuario.trim(),
      trustServerCertificate: !!v.trustServerCertificate,
      encrypt: !!v.encrypt,
      parametrosExtras: v.parametrosExtras?.trim() || null,
      ativo: !!v.ativo,
    };
    if (v.senha?.trim()) payload.senha = v.senha.trim();
    if (!this.modoNovo() && v.id > 0) payload.id = v.id;
    return payload;
  }

  testar(): void {
    if (this.form.invalid && this.modoNovo()) {
      this.form.markAllAsTouched();
      this.toast.error('Preencha os campos obrigatórios antes de testar.');
      return;
    }
    if (this.modoNovo() && !this.form.controls.senha.value?.trim()) {
      this.toast.error('Informe a senha para testar a conexão.');
      return;
    }

    this.testando.set(true);
    this.api
      .testar(this.buildPayload())
      .pipe(finalize(() => this.testando.set(false)))
      .subscribe({
        next: (r) => {
          if (r?.valido) {
            this.toast.success(r.mensagem || 'Conexão válida.');
          } else {
            this.toast.error(
              [r?.mensagem, r?.detalheErro].filter(Boolean).join(' ') || 'Conexão inválida.'
            );
          }
        },
        error: (err: ApiError) => {
          this.toast.error(err?.message ?? 'Falha ao testar a conexão.');
        },
      });
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Preencha os campos obrigatórios.');
      return;
    }
    if (this.modoNovo() && !this.form.controls.senha.value?.trim()) {
      this.toast.error('Senha é obrigatória para nova conexão.');
      return;
    }

    const payload = this.buildPayload();
    this.salvando.set(true);

    const req$ =
      this.modoNovo() || !payload.id
        ? this.api.gravar(payload)
        : this.api.alterar({ ...payload, id: payload.id });

    req$.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: (salvo) => {
        this.toast.success('Conexão salva com sucesso.');
        this.carregar();
        if (salvo?.id) {
          this.modoNovo.set(false);
          this.selecionadoId.set(salvo.id);
          this.selecionar(salvo);
        }
      },
      error: (err: ApiError) => {
        this.toast.error(err?.message ?? 'Não foi possível salvar a conexão.');
      },
    });
  }

  estacionamentosDoSelecionado(): BancoDadosConexao['estacionamentos'] {
    const id = this.selecionadoId();
    if (!id) return [];
    return this.lista().find((x) => x.id === id)?.estacionamentos ?? [];
  }
}
