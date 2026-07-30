import { Component, inject } from '@angular/core';
import { FormControl, FormGroupDirective, FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { formatarBrl, parseBrl } from '../config-cobranca-moeda.util';
import type {
  ConfigCobrancaListaItem,
  ConfigCobrancaLookupOption,
  ConfigCobrancaModalidade,
  ConfigCobrancaServicoKey,
  ConfigCobrancaServicos,
  ConfigCobrancaStatus
} from '../faturamento-config-cobranca.types';
import {
  MODALIDADE_OPCOES,
  RegraFechamento,
  SERVICO_VALOR_LABELS,
  montarRegistroDoFormulario,
  servicosFromItem,
  servicosVazios,
  valorCobrancaLabel,
  valorInformado,
  validarFormularioConfig
} from '../faturamento-config-cobranca.helpers';
import { ConfigCobrancaViewRuleDialogComponent } from './config-cobranca-view-rule-dialog.component';

class ValorCobrancaErrorStateMatcher implements ErrorStateMatcher {
  constructor(private readonly host: () => boolean) {}

  isErrorState(_control: FormControl | null, _form: FormGroupDirective | NgForm | null): boolean {
    return this.host();
  }
}

export type ConfigCobrancaFormMode = 'create' | 'edit' | 'duplicate';

export interface ConfigCobrancaFormDialogData {
  mode: ConfigCobrancaFormMode;
  item?: ConfigCobrancaListaItem;
  transportadoras: ConfigCobrancaLookupOption[];
  estacionamentos: ConfigCobrancaLookupOption[];
  statusOpcoes: ConfigCobrancaStatus[];
}

export interface ConfigCobrancaFormDialogResult {
  record: ConfigCobrancaListaItem;
}

interface ServicoOpcao {
  key: ConfigCobrancaServicoKey;
  label: string;
  valorLabel: string;
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

  readonly modalidadeOpcoes = MODALIDADE_OPCOES;

  readonly servicosOpcoes: ServicoOpcao[] = [
    { key: 'lavagem', label: 'Cobrar lavagem', valorLabel: SERVICO_VALOR_LABELS.lavagem, icon: 'local_car_wash' },
    { key: 'pernoite', label: 'Cobrar pernoite', valorLabel: SERVICO_VALOR_LABELS.pernoite, icon: 'bedtime' },
    { key: 'extras', label: 'Cobrar serviços extras', valorLabel: SERVICO_VALOR_LABELS.extras, icon: 'add_circle' },
    {
      key: 'beneficio',
      label: 'Considerar benefício por abastecimento',
      valorLabel: SERVICO_VALOR_LABELS.beneficio,
      icon: 'local_gas_station'
    }
  ];

  readonly regraFechamentoOpcoes = [
    { value: RegraFechamento.UltimoDiaDoMes, label: 'Último dia do mês' },
    { value: RegraFechamento.DiaFixo, label: 'Dia fixo' }
  ];

  transportadoraId: number | null = null;
  estacionamentoId: number | null = null;
  modalidade: ConfigCobrancaModalidade | '' = '';
  /** ISO `yyyy-MM-dd`, exigida apenas na modalidade personalizada. */
  dataCobranca: string | null = null;
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
  valorEstadiaTocado = false;
  status: ConfigCobrancaStatus = 'Ativa';
  servicos: ConfigCobrancaServicos = servicosVazios();

  readonly valorCobrancaMatcher = new ValorCobrancaErrorStateMatcher(
    () => this.valorEstadiaTocado && this.valorCobrancaInvalido
  );

  get titulo(): string {
    return 'Configuração de cobrança';
  }

  get subtitulo(): string {
    return 'Defina como a transportadora será faturada neste estacionamento.';
  }

  get exigeDataCobranca(): boolean {
    return this.modalidade === 'Personalizada';
  }

  get valorCobrancaLabel(): string {
    return valorCobrancaLabel(this.modalidade);
  }

  get valorCobrancaInvalido(): boolean {
    return !valorInformado(parseBrl(this.valorEstadiaTexto));
  }

  constructor() {
    const r = this.data.item;
    if (r) {
      this.transportadoraId = r.transportadoraId || null;
      this.estacionamentoId = r.estacionamentoId || null;
      this.modalidade = r.modalidade;
      this.dataCobranca = r.dataCobranca ?? null;
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
      this.valorEstadiaTexto = formatarBrl(r.valorEstadia);
      this.status = r.status === 'Inativa' ? 'Inativa' : 'Ativa';
      this.servicos = servicosFromItem(r);
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

  /** Trocar a regra descarta valores específicos da modalidade anterior. */
  selecionarModalidade(value: ConfigCobrancaModalidade): void {
    if (this.modalidade === value) return;
    this.modalidade = value;
    if (value !== 'Personalizada') this.dataCobranca = null;
    this.valorEstadia = null;
    this.valorEstadiaTexto = '';
    this.valorEstadiaTocado = false;
  }

  toggleServico(key: ConfigCobrancaServicoKey): void {
    const atual = this.servicos[key];
    const habilitado = !atual.habilitado;
    this.servicos[key] = { habilitado, valor: habilitado ? atual.valor : null };
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
    this.valorEstadiaTocado = true;
    this.sincronizarValorEstadiaDoTexto();
    const v = validarFormularioConfig({
      transportadoraId: this.transportadoraId ?? 0,
      estacionamentoId: this.estacionamentoId ?? 0,
      modalidade: this.modalidade,
      dataCobranca: this.dataCobranca,
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
      servicos: this.servicos
    });
    if (!v.ok) {
      this.errosVisiveis = v.mensagens;
      this.snack.open(v.mensagens[0] ?? 'Revise os campos obrigatórios.', 'Fechar', { duration: 5000 });
      return;
    }
    this.errosVisiveis = [];
    this.valorEstadiaTexto = formatarBrl(this.valorEstadia);
    const id = this.data.mode === 'edit' ? this.data.item?.id ?? 0 : 0;
    this.ref.close({ record: this.montarRegistro(id) });
  }

  onValorEstadiaBlur(): void {
    this.valorEstadiaTocado = true;
    this.sincronizarValorEstadiaDoTexto();
    if (this.valorEstadia != null) this.valorEstadiaTexto = formatarBrl(this.valorEstadia);
  }

  onValorEstadiaFocus(): void {
    // Mantém texto inválido para o usuário corrigir sem perder o que digitou.
    if (this.valorEstadia == null) return;
    this.valorEstadiaTexto = formatarBrl(this.valorEstadia);
  }

  private sincronizarValorEstadiaDoTexto(): void {
    this.valorEstadia = parseBrl(this.valorEstadiaTexto);
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
      dataCobranca: this.dataCobranca,
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
      servicos: this.servicos
    });
  }
}
