import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import type { ConfigCobrancaListaItem, ConfigCobrancaModalidade, ConfigCobrancaStatus } from '../faturamento-config-cobranca.types';
import {
  agrupamentoFromChecks,
  checksFromAgrupamento,
  checksFromServicos,
  servicosCobradosFromChecks,
  validarFormularioConfig,
  type AgrupamentoChecks,
  type ServicosChecks
} from '../faturamento-config-cobranca.helpers';

export type ConfigCobrancaFormMode = 'create' | 'edit' | 'duplicate';

export interface ConfigCobrancaFormDialogData {
  mode: ConfigCobrancaFormMode;
  item?: ConfigCobrancaListaItem;
  transportadoras: string[];
  estacionamentos: string[];
  modalidades: ConfigCobrancaModalidade[];
  statusOpcoes: ConfigCobrancaStatus[];
}

export interface ConfigCobrancaFormDialogResult {
  record: ConfigCobrancaListaItem;
}

@Component({
  selector: 'app-config-cobranca-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule
  ],
  templateUrl: './config-cobranca-form-dialog.component.html',
  styleUrl: './config-cobranca-form-dialog.component.scss'
})
export class ConfigCobrancaFormDialogComponent {
  readonly ref = inject(MatDialogRef<ConfigCobrancaFormDialogComponent, ConfigCobrancaFormDialogResult | undefined>);
  readonly data = inject<ConfigCobrancaFormDialogData>(MAT_DIALOG_DATA);
  private readonly snack = inject(MatSnackBar);

  errosVisiveis: string[] = [];

  transportadora = '';
  estacionamento = '';
  modalidade: ConfigCobrancaModalidade | '' = '';
  fechamento = '';
  prazoVencimento = '';
  email = '';
  envioAuto = false;
  gerarAuto = false;
  pagamentoParcial = false;
  multa = false;
  multaPct = 0;
  juros = false;
  jurosPct = 0;
  status: ConfigCobrancaStatus = 'Ativa';

  serv: ServicosChecks = {
    diaria: false,
    semanal: false,
    quinzenal: false,
    mensal: true,
    personal: false,
    lavagem: false,
    pernoite: false,
    extras: false,
    beneficio: false
  };

  agr: AgrupamentoChecks = {
    placa: false,
    periodo: true,
    transportadora: true
  };

  get titulo(): string {
    if (this.data.mode === 'create') return 'Nova Configuração de Cobrança';
    if (this.data.mode === 'edit') return 'Editar Configuração de Cobrança';
    return 'Duplicar Configuração de Cobrança';
  }

  get subtitulo(): string {
    if (this.data.mode === 'create') {
      return 'Selecione uma transportadora e defina a regra de faturamento.';
    }
    return 'Ajuste transportadora, estacionamento e demais parâmetros antes de salvar.';
  }

  constructor() {
    const r = this.data.item;
    if (r) {
      this.transportadora = r.transportadora;
      this.estacionamento = r.estacionamento;
      this.modalidade = r.modalidade;
      this.fechamento = r.fechamento;
      this.prazoVencimento = r.prazoVencimento;
      this.email = r.emailFinanceiro ?? '';
      this.envioAuto = r.envioAutomatico;
      this.gerarAuto = r.envioAutomatico;
      this.pagamentoParcial = r.pagamentoParcial;
      this.multa = r.multaAplicar;
      this.multaPct = r.multaPercentual;
      this.juros = r.jurosAplicar;
      this.jurosPct = r.jurosPercentual;
      this.status = r.status;
      this.serv = checksFromServicos(r.servicosCobrados);
      this.agr = checksFromAgrupamento(r.agrupamentoFatura);
    } else {
      this.modalidade = 'Mensal';
      this.fechamento = 'Último dia do mês';
      this.prazoVencimento = '10 dias após fechamento';
      this.status = 'Ativa';
    }
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  testarEnvio(): void {
    const mail = this.email?.trim();
    if (!mail) {
      this.snack.open('Cadastre um e-mail financeiro para testar o envio.', 'Fechar', { duration: 4500 });
      return;
    }
    this.snack.open(`E-mail de teste enviado para ${mail}.`, 'Fechar', { duration: 4500 });
  }

  salvar(): void {
    const v = validarFormularioConfig({
      transportadora: this.transportadora,
      estacionamento: this.estacionamento,
      modalidade: this.modalidade,
      fechamento: this.fechamento,
      prazoVencimento: this.prazoVencimento,
      email: this.email,
      precisaEmailFin: this.envioAuto || this.gerarAuto,
      multa: this.multa,
      multaPct: this.multaPct,
      juros: this.juros,
      jurosPct: this.jurosPct
    });
    if (!v.ok) {
      this.errosVisiveis = v.mensagens;
      this.snack.open(v.mensagens[0] ?? 'Revise os campos obrigatórios.', 'Fechar', { duration: 5000 });
      return;
    }
    this.errosVisiveis = [];

    const emailNorm = this.email?.trim() || null;
    let statusFinal: ConfigCobrancaStatus = this.status;
    if (!emailNorm) {
      statusFinal = 'Sem e-mail financeiro';
    } else if (statusFinal === 'Sem e-mail financeiro') {
      statusFinal = 'Ativa';
    }

    const base: ConfigCobrancaListaItem = {
      id: this.data.item?.id ?? 'NEW',
      transportadora: this.transportadora.trim(),
      estacionamento: this.estacionamento.trim(),
      modalidade: this.modalidade as ConfigCobrancaModalidade,
      fechamento: this.fechamento.trim(),
      prazoVencimento: this.prazoVencimento.trim(),
      envioAutomatico: this.envioAuto || this.gerarAuto,
      emailFinanceiro: emailNorm,
      status: statusFinal,
      multaAplicar: this.multa,
      multaPercentual: this.multa ? Number(this.multaPct) || 0 : 0,
      jurosAplicar: this.juros,
      jurosPercentual: this.juros ? Number(this.jurosPct) || 0 : 0,
      pagamentoParcial: this.pagamentoParcial,
      servicosCobrados: servicosCobradosFromChecks(this.serv),
      agrupamentoFatura: agrupamentoFromChecks(this.agr)
    };

    this.ref.close({ record: base });
  }
}
