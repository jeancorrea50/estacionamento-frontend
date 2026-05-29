import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
import { ConfigCobrancaViewRuleDialogComponent } from './config-cobranca-view-rule-dialog.component';

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

interface ServicoOpcao {
  key: keyof ServicosChecks;
  label: string;
  icon: string;
}

interface AgrupamentoOpcao {
  key: keyof AgrupamentoChecks;
  label: string;
  icon: string;
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
  private readonly dialog = inject(MatDialog);

  errosVisiveis: string[] = [];

  /** Bloco 5 (juros/multa/descontos) recolhível para não poluir o modal. */
  jurosMultaAberto = false;

  readonly servicosOpcoes: ServicoOpcao[] = [
    { key: 'diaria', label: 'Cobrar diária', icon: 'today' },
    { key: 'semanal', label: 'Cobrar semanal', icon: 'date_range' },
    { key: 'quinzenal', label: 'Cobrar quinzenal', icon: 'calendar_view_week' },
    { key: 'mensal', label: 'Cobrar mensal', icon: 'calendar_month' },
    { key: 'personal', label: 'Cobrar por data personalizada', icon: 'event' },
    { key: 'lavagem', label: 'Cobrar lavagem', icon: 'local_car_wash' },
    { key: 'pernoite', label: 'Cobrar pernoite', icon: 'bedtime' },
    { key: 'extras', label: 'Cobrar serviços extras', icon: 'add_circle' },
    { key: 'beneficio', label: 'Considerar benefício por abastecimento', icon: 'local_gas_station' }
  ];

  readonly agrupamentoOpcoes: AgrupamentoOpcao[] = [
    { key: 'placa', label: 'Agrupar fatura por placa', icon: 'directions_car' },
    { key: 'periodo', label: 'Agrupar fatura por período', icon: 'calendar_month' },
    { key: 'transportadora', label: 'Agrupar fatura por transportadora', icon: 'local_shipping' }
  ];

  transportadora = '';
  estacionamento = '';
  modalidade: ConfigCobrancaModalidade | '' = '';
  diaFechamento = '';
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
  descFixo = false;
  descValor = 0;
  acresFixo = false;
  acresValor = 0;
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
    return 'Configuração de cobrança';
  }

  get subtitulo(): string {
    return 'Defina como a transportadora será faturada neste estacionamento.';
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
    this.jurosMultaAberto = this.multa || this.juros || this.descFixo || this.acresFixo;
  }

  toggleJurosMulta(): void {
    this.jurosMultaAberto = !this.jurosMultaAberto;
  }

  toggleServico(key: keyof ServicosChecks): void {
    this.serv[key] = !this.serv[key];
  }

  toggleAgrupamento(key: keyof AgrupamentoChecks): void {
    this.agr[key] = !this.agr[key];
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

  visualizarRegra(): void {
    this.dialog.open(ConfigCobrancaViewRuleDialogComponent, {
      width: '480px',
      maxWidth: '96vw',
      data: { row: this.montarRegistro('PREVIEW') }
    });
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
    this.ref.close({ record: this.montarRegistro(this.data.item?.id ?? 'NEW') });
  }

  private montarRegistro(id: string): ConfigCobrancaListaItem {
    const emailNorm = this.email?.trim() || null;
    let statusFinal: ConfigCobrancaStatus = this.status;
    if (!emailNorm) {
      statusFinal = 'Sem e-mail financeiro';
    } else if (statusFinal === 'Sem e-mail financeiro') {
      statusFinal = 'Ativa';
    }

    return {
      id,
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
  }
}
