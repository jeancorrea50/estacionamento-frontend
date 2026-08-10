import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, map } from 'rxjs/operators';
import type { ApiError } from '../../../../core/api/models';
import { ToastService } from '../../../../core/api/services/toast.service';
import { EstacionamentoService } from '../../../cadastro/services/estacionamento.service';
import {
  AMBIENTE_LABEL,
  ISOLATION_LABEL,
  NOME_BANCO_MAX_LENGTH,
  STATUS_MIGRATION_LABEL,
  STATUS_TRANSFERENCIA_LABEL,
  TIPO_BANCO_LABEL,
  type AmbienteBancoDados,
  type BancoDadosConexao,
  type BancoDadosConexaoEstacionamento,
  type BancoDadosConexaoFormPayload,
  type BancoDadosConexaoOpcoes,
  type EstacionamentoSelect,
  type IsolationModeEstacionamento,
  type TipoBancoDados,
  type TransferenciaBancoDados,
} from '../../models/banco-dados-conexao.models';
import { BancoDadosConexaoService } from '../../services/banco-dados-conexao.service';

@Component({
  selector: 'app-banco-dados-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './banco-dados-page.component.html',
  styleUrls: ['./banco-dados-page.component.scss'],
})
export class BancoDadosPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(BancoDadosConexaoService);
  private readonly estacionamentoApi = inject(EstacionamentoService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private formWatchSub?: Subscription;
  private sugerirSub?: Subscription;
  private nomeBancoManual = false;

  readonly loading = signal(true);
  readonly erro = signal<string | null>(null);
  readonly salvando = signal(false);
  readonly testando = signal(false);
  readonly salvandoVinculo = signal(false);
  readonly transferindo = signal(false);
  readonly excluindoId = signal<number | null>(null);
  readonly lista = signal<BancoDadosConexao[]>([]);
  readonly opcoes = signal<BancoDadosConexaoOpcoes | null>(null);
  readonly catalogoEstacionamentos = signal<EstacionamentoSelect[]>([]);

  readonly modalConexaoOpen = signal(false);
  readonly modoNovo = signal(false);
  readonly selecionadoId = signal<number | null>(null);

  readonly modalEstacsOpen = signal(false);
  readonly conexaoEstacs = signal<BancoDadosConexao | null>(null);
  readonly formVinculoOpen = signal(false);
  readonly editandoVinculoCod = signal<string | null>(null);

  readonly modalTransferOpen = signal(false);
  readonly conexaoTransfer = signal<BancoDadosConexao | null>(null);
  readonly ultimaTransferencia = signal<TransferenciaBancoDados | null>(null);

  readonly modalMigrationsOpen = signal(false);
  readonly conexaoMigrations = signal<BancoDadosConexao | null>(null);

  readonly tituloForm = computed(() =>
    this.modoNovo() ? 'Nova conexão' : 'Editar conexão'
  );

  readonly tituloEstacs = computed(() => {
    const nome = this.conexaoEstacs()?.nome?.trim();
    return nome ? `Estacionamentos · ${nome}` : 'Estacionamentos vinculados';
  });

  readonly tituloTransfer = computed(() => {
    const nome = this.conexaoTransfer()?.nome?.trim();
    return nome ? `Transferir banco · ${nome}` : 'Transferir banco de dados';
  });

  readonly tituloMigrations = computed(() => {
    const nome = this.conexaoMigrations()?.nome?.trim();
    return nome ? `Migrations · ${nome}` : 'Migrations do banco';
  });

  readonly migrationsDaConexao = computed(() => {
    const list = this.conexaoMigrations()?.migration ?? [];
    return [...list].sort((a, b) =>
      String(b.dataUltimaAtualizacao || b.dataCriacao).localeCompare(
        String(a.dataUltimaAtualizacao || a.dataCriacao)
      )
    );
  });

  readonly estacionamentosDaConexao = computed(() => {
    const c = this.conexaoTransfer();
    return c?.estacionamentos ?? [];
  });

  readonly bancosDoHost = computed(() => {
    const host = String(this.form.controls.host.value ?? '').trim();
    const bancos = this.opcoes()?.bancos ?? [];
    if (!host) return bancos;
    return bancos.filter((b) => b.host === host);
  });

  /** Catálogo para vincular: todos, com indicação se já está em outro perfil. */
  readonly estacionamentosParaVincular = computed(() => {
    const conexaoId = this.conexaoEstacs()?.id;
    const editCod = this.editandoVinculoCod();
    return (this.catalogoEstacionamentos() ?? []).filter((e) => {
      if (editCod) return e.codExportacao === editCod;
      if (!conexaoId) return true;
      return e.bancoDadosConexaoId !== conexaoId;
    });
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

  readonly formVinculo = this.fb.nonNullable.group({
    codExportacao: ['', Validators.required],
    estacionamentoId: [0],
    isolationMode: [2 as IsolationModeEstacionamento, Validators.required],
    ativo: [true],
  });

  readonly formTransfer = this.fb.nonNullable.group({
    hostFuturo: ['', [Validators.required, Validators.maxLength(255)]],
    portaFuturo: [1433, [Validators.required, Validators.min(1)]],
    usuarioFuturo: ['', [Validators.required, Validators.maxLength(128)]],
    senhaFuturo: ['', Validators.required],
    trustServerCertificate: [true],
    encrypt: [false],
    sobrescreverDestinoSeExistir: [false],
  });

  readonly tipoLabel = TIPO_BANCO_LABEL;
  readonly ambienteLabel = AMBIENTE_LABEL;
  readonly isolationLabel = ISOLATION_LABEL;
  readonly statusTransferLabel = STATUS_TRANSFERENCIA_LABEL;
  readonly statusMigrationLabel = STATUS_MIGRATION_LABEL;
  readonly sugerindoNome = signal(false);
  /** idle | validado | erro */
  readonly nomeBancoStatus = signal<'idle' | 'validado' | 'erro'>('idle');
  readonly nomeBancoStatusMsg = signal('');
  readonly nomeBancoPreview = signal('');
  readonly nomeBancoMaxHint = computed(() => {
    const tipo = Number(this.form.controls.tipoBanco.value) || 1;
    return NOME_BANCO_MAX_LENGTH[tipo] ?? 128;
  });

  ngOnInit(): void {
    this.carregar();
    this.watchNomeBancoSugestao();
  }

  ngOnDestroy(): void {
    this.formWatchSub?.unsubscribe();
    this.sugerirSub?.unsubscribe();
  }

  private watchNomeBancoSugestao(): void {
    const auto$ = merge(
      this.form.controls.nome.valueChanges,
      this.form.controls.ambiente.valueChanges,
      this.form.controls.tipoBanco.valueChanges
    ).pipe(
      debounceTime(350),
      map(() => ({
        nome: String(this.form.controls.nome.value ?? '').trim(),
        ambiente: Number(this.form.controls.ambiente.value) || 1,
        tipo: Number(this.form.controls.tipoBanco.value) || 1,
        novo: this.modoNovo(),
        manual: this.nomeBancoManual,
      })),
      distinctUntilChanged(
        (a, b) =>
          a.nome === b.nome &&
          a.ambiente === b.ambiente &&
          a.tipo === b.tipo &&
          a.novo === b.novo &&
          a.manual === b.manual
      )
    );

    this.formWatchSub = auto$.subscribe((ctx) => {
      if (!this.modalConexaoOpen()) return;
      if (!ctx.novo || ctx.manual) return;
      if (!ctx.nome) return;
      this.solicitarSugestaoNome();
    });
  }

  onNomeBancoInput(): void {
    this.nomeBancoManual = true;
  }

  gerarNomeBanco(): void {
    this.nomeBancoManual = false;
    this.solicitarSugestaoNome(true);
  }

  private solicitarSugestaoNome(forcar = false): void {
    const nome = String(this.form.controls.nome.value ?? '').trim();
    if (!nome) {
      this.nomeBancoStatus.set('idle');
      this.nomeBancoStatusMsg.set('');
      if (forcar) this.toast.error('Informe o Nome para gerar o database.');
      return;
    }

    this.sugerirSub?.unsubscribe();
    this.sugerindoNome.set(true);
    this.nomeBancoStatus.set('idle');
    this.nomeBancoStatusMsg.set('Validando nome do banco...');
    this.sugerirSub = this.api
      .sugerirNome({
        descricao: nome,
        ambiente: Number(this.form.controls.ambiente.value) || 1,
        tipoBanco: Number(this.form.controls.tipoBanco.value) || 1,
        ignorarId: this.modoNovo() ? null : this.selecionadoId(),
      })
      .pipe(finalize(() => this.sugerindoNome.set(false)))
      .subscribe({
        next: (r) => {
          const sugerido = String(r?.nomeBanco ?? '').trim().toLowerCase();
          if (!sugerido) {
            this.nomeBancoStatus.set('erro');
            this.nomeBancoStatusMsg.set('Não foi possível gerar um nome de banco válido.');
            return;
          }
          this.form.controls.nomeBanco.setValue(sugerido, { emitEvent: false });
          this.nomeBancoPreview.set(sugerido);
          this.applyNomeBancoValidators(Number(this.form.controls.tipoBanco.value) || 1, true);
          this.nomeBancoStatus.set('validado');
          this.nomeBancoStatusMsg.set(`Nome do banco validado: ${sugerido}`);
        },
        error: (err: ApiError) => {
          this.nomeBancoStatus.set('erro');
          this.nomeBancoStatusMsg.set(
            err?.status === 404
              ? 'Endpoint sugerir-nome não encontrado. Reinicie a API com a versão atualizada.'
              : err?.message ?? 'Não foi possível validar o nome do banco.'
          );
        },
      });
  }

  carregar(): void {
    this.loading.set(true);
    this.erro.set(null);
    this.api.listar().subscribe({
      next: (lista) => {
        this.lista.set(lista ?? []);
        this.loading.set(false);
        const id = this.conexaoEstacs()?.id;
        if (id) {
          const atual = (lista ?? []).find((x) => x.id === id) ?? null;
          this.conexaoEstacs.set(atual);
        }
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.erro.set(err?.message ?? 'Não foi possível carregar as conexões.');
      },
    });

    this.api.listarOpcoes().subscribe({
      next: (op) => {
        this.opcoes.set(op);
        this.catalogoEstacionamentos.set(op?.estacionamentos ?? []);
      },
      error: () => {
        /* opcional */
      },
    });

    this.api.listarEstacionamentos().subscribe({
      next: (itens) => this.catalogoEstacionamentos.set(itens ?? []),
      error: () => {
        /* fallback: usa opcoes.estacionamentos */
      },
    });
  }

  openNovo(): void {
    this.modoNovo.set(true);
    this.selecionadoId.set(null);
    this.nomeBancoManual = false;
    this.nomeBancoStatus.set('idle');
    this.nomeBancoStatusMsg.set('');
    this.nomeBancoPreview.set('');
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
    this.applyNomeBancoValidators(1, true);
    this.modalConexaoOpen.set(true);
  }

  openEditar(item: BancoDadosConexao): void {
    this.modoNovo.set(false);
    this.selecionadoId.set(item.id);
    this.nomeBancoManual = true;
    const nomeAtual = (item.nomeBanco ?? '').trim();
    this.nomeBancoPreview.set(nomeAtual);
    this.nomeBancoStatus.set(nomeAtual ? 'validado' : 'idle');
    this.nomeBancoStatusMsg.set(nomeAtual ? `Nome do banco: ${nomeAtual}` : '');
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
      nomeBanco: nomeAtual,
      usuario: item.usuario ?? '',
      senha: '',
      trustServerCertificate: item.trustServerCertificate ?? true,
      encrypt: item.encrypt ?? false,
      parametrosExtras: item.parametrosExtras ?? '',
      ativo: item.ativo ?? true,
    });
    this.applyNomeBancoValidators(item.tipoBanco ?? 1, false);
    this.modalConexaoOpen.set(true);
  }

  private applyNomeBancoValidators(tipo: number, exigirPadrao: boolean): void {
    const max = NOME_BANCO_MAX_LENGTH[tipo] ?? 128;
    const validators = [Validators.required, Validators.maxLength(max)];
    if (exigirPadrao) {
      validators.push(Validators.pattern(/^[a-z0-9]+(?:_[a-z0-9]+)*_(dev|hot|prod)_\d{2,}$/));
    }
    this.form.controls.nomeBanco.setValidators(validators);
    this.form.controls.nomeBanco.updateValueAndValidity({ emitEvent: false });
  }

  closeModalConexao(): void {
    if (this.salvando() || this.testando()) return;
    this.modalConexaoOpen.set(false);
  }

  openEstacionamentos(item: BancoDadosConexao): void {
    this.conexaoEstacs.set(item);
    this.formVinculoOpen.set(false);
    this.editandoVinculoCod.set(null);
    this.modalEstacsOpen.set(true);
  }

  closeModalEstacs(): void {
    if (this.salvandoVinculo()) return;
    this.modalEstacsOpen.set(false);
    this.formVinculoOpen.set(false);
    this.editandoVinculoCod.set(null);
    this.conexaoEstacs.set(null);
  }

  openVincular(): void {
    this.editandoVinculoCod.set(null);
    this.formVinculo.reset({
      codExportacao: '',
      estacionamentoId: 0,
      isolationMode: 2,
      ativo: true,
    });
    this.formVinculo.controls.codExportacao.enable();
    this.formVinculoOpen.set(true);
  }

  openEditarVinculo(e: BancoDadosConexaoEstacionamento): void {
    this.editandoVinculoCod.set(e.codExportacao);
    this.formVinculo.reset({
      codExportacao: e.codExportacao,
      estacionamentoId: e.estacionamentoId ?? 0,
      isolationMode: (e.isolationMode ?? 2) as IsolationModeEstacionamento,
      ativo: e.ativo ?? true,
    });
    this.formVinculo.controls.codExportacao.disable();
    this.formVinculoOpen.set(true);
  }

  cancelarVinculo(): void {
    this.formVinculoOpen.set(false);
    this.editandoVinculoCod.set(null);
    this.formVinculo.controls.codExportacao.enable();
  }

  onEstacionamentoSelect(cod: string): void {
    const item = this.catalogoEstacionamentos().find((x) => x.codExportacao === cod);
    this.formVinculo.patchValue({
      codExportacao: cod,
      estacionamentoId: item?.estacionamentoId ?? 0,
    });
  }

  onHostChange(host: string): void {
    this.form.controls.host.setValue(host);
  }

  onTipoChange(tipo: number): void {
    this.form.controls.tipoBanco.setValue(tipo as TipoBancoDados);
    const portaPadrao = tipo === 2 ? 1521 : tipo === 3 ? 5432 : tipo === 4 ? 3306 : 1433;
    this.form.controls.porta.setValue(portaPadrao);
    this.applyNomeBancoValidators(tipo, this.modoNovo());
    if (this.modoNovo() && !this.nomeBancoManual) {
      this.solicitarSugestaoNome();
    }
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
      nomeBanco: v.nomeBanco.trim().toLowerCase(),
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
        : this.api.alterar({ ...payload, id: payload.id! });

    req$.pipe(finalize(() => this.salvando.set(false))).subscribe({
      next: (res) => {
        const msg = String(res.mensagem ?? '').trim();
        this.toast.success(
          msg ||
            (res.migracaoEnfileirada
              ? 'Conexão criada e migrations enfileiradas. Acompanhe pela notificação.'
              : 'Conexão salva com sucesso.')
        );
        this.modalConexaoOpen.set(false);
        this.carregar();
      },
      error: (err: ApiError) => {
        this.toast.error(err?.message ?? 'Não foi possível salvar a conexão.');
      },
    });
  }

  salvarVinculo(): void {
    const conexao = this.conexaoEstacs();
    if (!conexao?.id) return;

    if (this.formVinculo.invalid) {
      this.formVinculo.markAllAsTouched();
      this.toast.error('Selecione o estacionamento.');
      return;
    }

    const v = this.formVinculo.getRawValue();
    const cod = String(v.codExportacao ?? '').trim();
    if (!cod) {
      this.toast.error('CodExportacao é obrigatório.');
      return;
    }

    const jaVinculado = (conexao.estacionamentos ?? []).some(
      (e) => e.codExportacao === cod && this.editandoVinculoCod() !== cod
    );
    if (jaVinculado) {
      this.toast.error('Este estacionamento já está vinculado a esta conexão.');
      return;
    }

    const isolationMode = (Number(v.isolationMode) === 1 ? 1 : 2) as IsolationModeEstacionamento;

    this.salvandoVinculo.set(true);
    this.estacionamentoApi
      .atualizarConexao({
        codExportacao: cod,
        estacionamentoId: v.estacionamentoId > 0 ? v.estacionamentoId : null,
        isolationMode,
        bancoDadosConexaoId: conexao.id,
        ativo: !!v.ativo,
      })
      .pipe(finalize(() => this.salvandoVinculo.set(false)))
      .subscribe({
        next: () => {
          this.toast.success(
            this.editandoVinculoCod() ? 'Vínculo atualizado.' : 'Estacionamento vinculado.'
          );
          this.cancelarVinculo();
          this.carregar();
        },
        error: (err: ApiError) => {
          this.toast.error(err?.message ?? 'Não foi possível salvar o vínculo.');
        },
      });
  }

  labelConexaoAtual(e: EstacionamentoSelect): string {
    const base = e.label || e.descricao || e.codExportacao;
    if (!e.bancoDadosConexaoId) return base;
    const nome = this.lista().find((c) => c.id === e.bancoDadosConexaoId)?.nome;
    return nome ? `${base} (hoje: ${nome})` : `${base} (já vinculado)`;
  }

  openMigrations(item: BancoDadosConexao): void {
    this.conexaoMigrations.set(item);
    this.modalMigrationsOpen.set(true);
    // Recarrega o perfil para garantir histórico atualizado do backend.
    this.api.obterPorId(item.id).subscribe({
      next: (atual) => this.conexaoMigrations.set(atual),
      error: () => {
        /* mantém snapshot da lista */
      },
    });
  }

  closeModalMigrations(): void {
    this.modalMigrationsOpen.set(false);
    this.conexaoMigrations.set(null);
  }

  statusMigrationLabelOf(status: number): string {
    return this.statusMigrationLabel[status] ?? String(status);
  }

  openTransferir(item: BancoDadosConexao): void {
    if (item.tipoBanco !== 1) {
      this.toast.error('Transferência disponível apenas para SQL Server.');
      return;
    }

    this.conexaoTransfer.set(item);
    this.ultimaTransferencia.set(null);
    this.formTransfer.reset({
      hostFuturo: '',
      portaFuturo: item.porta > 0 ? item.porta : 1433,
      usuarioFuturo: item.usuario ?? '',
      senhaFuturo: '',
      trustServerCertificate: item.trustServerCertificate ?? true,
      encrypt: item.encrypt ?? false,
      sobrescreverDestinoSeExistir: false,
    });
    this.modalTransferOpen.set(true);
  }

  closeModalTransfer(): void {
    if (this.transferindo()) return;
    this.modalTransferOpen.set(false);
    this.conexaoTransfer.set(null);
    this.ultimaTransferencia.set(null);
  }

  enfileirarTransferencia(): void {
    const conexao = this.conexaoTransfer();
    if (!conexao?.id) return;

    if (this.formTransfer.invalid) {
      this.formTransfer.markAllAsTouched();
      this.toast.error('Informe host, usuário e senha do destino.');
      return;
    }

    const v = this.formTransfer.getRawValue();
    const host = v.hostFuturo.trim();
    const porta = Number(v.portaFuturo) || 1433;
    if (host.toLowerCase() === (conexao.host ?? '').toLowerCase() && porta === conexao.porta) {
      this.toast.error('Informe um host diferente do atual.');
      return;
    }

    const ok = window.confirm(
      `Transferir "${conexao.nomeBanco}" de ${conexao.host} para ${host}:${porta}?`
    );
    if (!ok) return;

    this.transferindo.set(true);
    this.api
      .transferir({
        bancoDadosConexaoId: conexao.id,
        hostFuturo: host,
        portaFuturo: porta,
        nomeBancoFuturo: conexao.nomeBanco ?? null,
        usuarioFuturo: v.usuarioFuturo.trim(),
        senhaFuturo: v.senhaFuturo,
        trustServerCertificate: !!v.trustServerCertificate,
        encrypt: !!v.encrypt,
        sobrescreverDestinoSeExistir: !!v.sobrescreverDestinoSeExistir,
      })
      .pipe(finalize(() => this.transferindo.set(false)))
      .subscribe({
        next: (r) => {
          this.toast.success(r?.mensagem || 'Transferência iniciada. Acompanhe pelo sino.');
          if (r?.data) this.ultimaTransferencia.set(r.data);
        },
        error: (err: ApiError) => {
          this.toast.error(err?.message ?? 'Não foi possível transferir.');
        },
      });
  }

  statusLabel(status: number): string {
    return this.statusTransferLabel[status] ?? String(status);
  }

  /** Exclusão física só para Desenvolvimento (1) ou Homologação (2). */
  podeExcluirBanco(item: BancoDadosConexao): boolean {
    return item.ambiente === 1 || item.ambiente === 2;
  }

  excluirBanco(item: BancoDadosConexao): void {
    if (!this.podeExcluirBanco(item)) {
      this.toast.error('Exclusão permitida apenas para Desenvolvimento ou Homologação.');
      return;
    }

    const ambiente = this.ambienteLabel[item.ambiente] || String(item.ambiente);
    const qtd = item.quantidadeEstacionamentos ?? item.estacionamentos?.length ?? 0;
    const avisoTenants =
      qtd > 0
        ? `\n\nAtenção: ${qtd} estacionamento(s) vinculado(s) serão desvinculados e desativados.`
        : '';

    const ok = window.confirm(
      `Excluir permanentemente o banco "${item.nomeBanco}" em ${item.host} (${ambiente})?\n\n` +
        `Isso executa DROP DATABASE no servidor e desativa o perfil.${avisoTenants}\n\n` +
        `Esta ação não pode ser desfeita.`
    );
    if (!ok) return;

    this.excluindoId.set(item.id);
    this.api
      .excluir(item.id)
      .pipe(finalize(() => this.excluindoId.set(null)))
      .subscribe({
        next: (r) => {
          this.toast.success(r?.mensagem || 'Exclusão enfileirada. Acompanhe pelo sino.');
          this.carregar();
        },
        error: (err: ApiError) => {
          this.toast.error(err?.message ?? 'Não foi possível enfileirar a exclusão.');
        },
      });
  }
}
