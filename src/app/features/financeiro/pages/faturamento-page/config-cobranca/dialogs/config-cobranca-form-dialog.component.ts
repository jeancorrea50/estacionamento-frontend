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

import type {
  ConfigCobrancaListaItem,
  ConfigCobrancaLookupOption,
  ConfigCobrancaModalidade,
  ConfigCobrancaStatus
} from '../faturamento-config-cobranca.types';
import {
  checksFromRegraFlags,
  montarRegistroDoFormulario,
  validarFormularioConfig,
  type AgrupamentoChecks,
  type ServicosChecks,
  RegraFechamento
} from '../faturamento-config-cobranca.helpers';
import { ConfigCobrancaViewRuleDialogComponent } from './config-cobranca-view-rule-dialog.component';

export type ConfigCobrancaFormMode = 'create' | 'edit' | 'duplicate';

export interface ConfigCobrancaFormDialogData {
  mode: ConfigCobrancaFormMode;
  item?: ConfigCobrancaListaItem;
  transportadoras: ConfigCobrancaLookupOption[];
  estacionamentos: ConfigCobrancaLookupOption[];
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

  readonly RegraFechamento = RegraFechamento;

  errosVisiveis: string[] = [];
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

  readonly regraFechamentoOpcoes = [
    { value: RegraFechamento.UltimoDiaDoMes, label: 'Último dia do mês' },
    { value: RegraFechamento.DiaFixo, label: 'Dia fixo' }
  ];

  transportadoraId: number | null = null;
  estacionamentoId: number | null = null;
  modalidade: ConfigCobrancaModalidade | '' = '';
  diaFechamento: number | null = null;
  regraFechamento: number = RegraFechamento.UltimoDiaDoMes;
  prazoVencimentoDias = 10;
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
  /** Valor numérico enviado à API. */
  valorEstadia: number | null = null;
  /** Texto exibido no input (padrão pt-BR: 1.234,56). */
  valorEstadiaTexto = '';
  status: ConfigCobrancaStatus = 'Ativa';
  private regraId = 0;

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
      this.transportadoraId = r.transportadoraId || null;
      this.estacionamentoId = r.estacionamentoId || null;
      this.modalidade = r.modalidade;
      this.diaFechamento = r.diaFechamento;
      this.regraFechamento = r.regraFechamento || RegraFechamento.UltimoDiaDoMes;
      this.prazoVencimentoDias = r.prazoVencimentoDias || 10;
      this.email = r.emailFinanceiro ?? '';
      this.envioAuto = r.envioAutomatico;
      this.gerarAuto = r.gerarFaturaAutomaticamente;
      this.pagamentoParcial = r.pagamentoParcial;
      this.multa = r.multaAplicar;
      this.multaPct = r.multaPercentual;
      this.juros = r.jurosAplicar;
      this.jurosPct = r.jurosPercentual;
      this.descFixo = r.aplicarDescontoFixo;
      this.descValor = r.valorDescontoFixo;
      this.acresFixo = r.aplicarAcrescimoFixo;
      this.acresValor = r.valorAcrescimoFixo;
      this.valorEstadia = r.valorEstadia;
      this.valorEstadiaTexto = this.formatarBrl(r.valorEstadia);
      this.status = r.status === 'Inativa' ? 'Inativa' : 'Ativa';
      this.regraId = this.data.mode === 'edit' ? r.regra?.id ?? 0 : 0;
      this.serv = checksFromRegraFlags(r.regra);
      this.agr = {
        placa: r.agruparPorPlaca,
        periodo: r.agruparPorPeriodo,
        transportadora: r.agruparPorTransportadora
      };
    } else {
      this.modalidade = 'Mensal';
      this.regraFechamento = RegraFechamento.UltimoDiaDoMes;
      this.prazoVencimentoDias = 10;
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
    this.sincronizarValorEstadiaDoTexto();
    this.dialog.open(ConfigCobrancaViewRuleDialogComponent, {
      width: '480px',
      maxWidth: '96vw',
      data: { row: this.montarRegistro(this.data.mode === 'edit' ? this.data.item?.id ?? 0 : 0) }
    });
  }

  salvar(): void {
    this.sincronizarValorEstadiaDoTexto();
    const v = validarFormularioConfig({
      transportadoraId: this.transportadoraId ?? 0,
      estacionamentoId: this.estacionamentoId ?? 0,
      modalidade: this.modalidade,
      regraFechamento: this.regraFechamento,
      diaFechamento: this.diaFechamento,
      prazoVencimentoDias: Number(this.prazoVencimentoDias) || 0,
      email: this.email,
      multa: this.multa,
      multaPct: this.multaPct,
      juros: this.juros,
      jurosPct: this.jurosPct,
      descFixo: this.descFixo,
      descValor: this.descValor,
      acresFixo: this.acresFixo,
      acresValor: this.acresValor,
      valorEstadia: this.valorEstadia,
      serv: this.serv
    });
    if (!v.ok) {
      this.errosVisiveis = v.mensagens;
      this.snack.open(v.mensagens[0] ?? 'Revise os campos obrigatórios.', 'Fechar', { duration: 5000 });
      return;
    }
    this.errosVisiveis = [];
    this.valorEstadiaTexto = this.formatarBrl(this.valorEstadia);
    const id = this.data.mode === 'edit' ? this.data.item?.id ?? 0 : 0;
    this.ref.close({ record: this.montarRegistro(id) });
  }

  onValorEstadiaBlur(): void {
    this.sincronizarValorEstadiaDoTexto();
    this.valorEstadiaTexto = this.formatarBrl(this.valorEstadia);
  }

  onValorEstadiaFocus(): void {
    if (this.valorEstadia == null) {
      this.valorEstadiaTexto = '';
      return;
    }
    // Em edição, mantém formato BR mas sem ruído de zeros desnecessários além de 2 casas.
    this.valorEstadiaTexto = this.formatarBrl(this.valorEstadia);
  }

  private sincronizarValorEstadiaDoTexto(): void {
    this.valorEstadia = this.parseBrl(this.valorEstadiaTexto);
  }

  private formatarBrl(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(Number(value))) return '';
    return Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private parseBrl(raw: string | null | undefined): number | null {
    const texto = String(raw ?? '').trim();
    if (!texto) return null;

    // Aceita "1.234,56", "1234,56", "1234.56" e "R$ 1.234,56"
    let limpo = texto.replace(/[^\d.,-]/g, '');
    if (!limpo || limpo === '-' || limpo === ',' || limpo === '.') return null;

    const temVirgula = limpo.includes(',');
    const temPonto = limpo.includes('.');

    if (temVirgula && temPonto) {
      // Assume ponto = milhar e vírgula = decimal (padrão BR)
      limpo = limpo.replace(/\./g, '').replace(',', '.');
    } else if (temVirgula) {
      limpo = limpo.replace(',', '.');
    } else if (temPonto) {
      // Um único ponto: se parecer decimal (ex.: 12.5), mantém; se milhar (1.250), remove
      const parts = limpo.split('.');
      if (parts.length === 2 && parts[1].length <= 2) {
        // decimal com ponto
      } else {
        limpo = limpo.replace(/\./g, '');
      }
    }

    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  }

  private montarRegistro(id: number): ConfigCobrancaListaItem {
    const transportadora = this.data.transportadoras.find((t) => t.id === this.transportadoraId);
    const estacionamento = this.data.estacionamentos.find((e) => e.id === this.estacionamentoId);
    return montarRegistroDoFormulario({
      id,
      transportadoraId: this.transportadoraId ?? 0,
      transportadoraNome: transportadora?.label ?? '',
      estacionamentoId: this.estacionamentoId ?? 0,
      estacionamentoNome: estacionamento?.label ?? '',
      status: this.status === 'Inativa' ? 'Inativa' : 'Ativa',
      modalidade: this.modalidade as ConfigCobrancaModalidade,
      regraFechamento: this.regraFechamento,
      diaFechamento: this.diaFechamento,
      prazoVencimentoDias: Number(this.prazoVencimentoDias) || 0,
      email: this.email,
      envioAuto: this.envioAuto,
      gerarAuto: this.gerarAuto,
      pagamentoParcial: this.pagamentoParcial,
      multa: this.multa,
      multaPct: this.multaPct,
      juros: this.juros,
      jurosPct: this.jurosPct,
      descFixo: this.descFixo,
      descValor: this.descValor,
      acresFixo: this.acresFixo,
      acresValor: this.acresValor,
      valorEstadia: this.valorEstadia,
      regraId: this.regraId,
      serv: this.serv,
      agr: this.agr
    });
  }
}
