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

import { formatCnpj } from '../../../../../cadastro/directives/cnpj-format.directive';
import {
  ResponsavelFaturamentoFormDialogComponent,
  type ResponsavelFaturamentoFormDialogResult
} from '../../../../../cadastro/components/responsavel-faturamento-form-dialog/responsavel-faturamento-form-dialog.component';
import { ResponsavelFaturamentoLookupFieldComponent } from '../../../../../cadastro/components/responsavel-faturamento-lookup-field/responsavel-faturamento-lookup-field.component';
import { TransportadoraLookupFieldComponent } from '../../../../../movimentos/entrada-saida/components/transportadora-lookup-field/transportadora-lookup-field.component';
import {
  PeriodoDataPickerComponent,
  type PeriodoDataSelecionado
} from '../../../../../../shared/ui/periodo-data-picker/periodo-data-picker.component';
import {
  acordoTemConteudo,
  acordoVazio,
  MESES_ACORDO,
  mesesNoPeriodoAcordo,
  mesesOcupados,
  normalizarAcordo,
  novaListagemAcordo,
  podarMesesForaDoPeriodoAcordo,
  sincronizarVagasDoAcordo,
  TIPO_COBRANCA_EXCEDENTE_OPCOES
} from '../config-cobranca-acordo.util';
import { formatarBrl, parseBrl } from '../config-cobranca-moeda.util';
import {
  EMAIL_FINANCEIRO_MAX,
  MODALIDADE_OPCOES,
  RegraFechamento,
  SERVICO_VALOR_LABELS,
  diaSemanaLabel,
  definicaoValorOpcoes,
  definicaoValorPadrao,
  isDiaSemanaValido,
  isEmailFinanceiroValido,
  modalidadeExigeVencimentoFatura,
  montarRegistroDoFormulario,
  parseEmailsFinanceiros,
  serializeEmailsFinanceiros,
  servicosFromItem,
  servicosVazios,
  valorCobrancaLabel,
  valorInformado,
  validarFormularioConfig,
  type DiaSemanaCobranca
} from '../faturamento-config-cobranca.helpers';
import type {
  ConfigCobrancaAcordo,
  ConfigCobrancaAcordoListagem,
  ConfigCobrancaDefinicaoValor,
  ConfigCobrancaListaItem,
  ConfigCobrancaLookupOption,
  ConfigCobrancaMesAcordo,
  ConfigCobrancaModalidade,
  ConfigCobrancaServicoKey,
  ConfigCobrancaServicos,
  ConfigCobrancaStatus,
  ConfigCobrancaTipoPagador
} from '../faturamento-config-cobranca.types';
import { ConfigCobrancaViewRuleDialogComponent } from './config-cobranca-view-rule-dialog.component';
import { ConfigCobrancaWeekdayDialogComponent } from './config-cobranca-weekday-dialog.component';

class ValorCobrancaErrorStateMatcher implements ErrorStateMatcher {
  constructor(private readonly host: () => boolean) {}

  isErrorState(_control: FormControl | null, _form: FormGroupDirective | NgForm | null): boolean {
    return this.host();
  }
}

export type ConfigCobrancaFormAba = 'cadastro' | 'regraCobranca' | 'valores' | 'responsavel';

/** Agrupa modalidades na UI da aba Regra de Cobrança. */
export type ConfigCobrancaTipoRegra = 'acordo' | 'periodo';

export type ConfigCobrancaFormMode = 'create' | 'edit' | 'duplicate';

export interface ConfigCobrancaFormDialogData {
  mode: ConfigCobrancaFormMode;
  item?: ConfigCobrancaListaItem;
  transportadoras: ConfigCobrancaLookupOption[];
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
    MatSnackBarModule,
    PeriodoDataPickerComponent,
    TransportadoraLookupFieldComponent,
    ResponsavelFaturamentoLookupFieldComponent
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
  readonly EMAIL_FINANCEIRO_MAX = EMAIL_FINANCEIRO_MAX;

  errosVisiveis: string[] = [];
  jurosMultaAberto = false;
  abaAtiva: ConfigCobrancaFormAba = 'cadastro';

  readonly modalidadeOpcoes = MODALIDADE_OPCOES;
  readonly modalidadePeriodoOpcoes = MODALIDADE_OPCOES.filter((o) => o.value !== 'Acordo');
  readonly tipoExcedenteOpcoes = TIPO_COBRANCA_EXCEDENTE_OPCOES;
  readonly mesesAcordo = MESES_ACORDO;
  /** Sentinela só do UI; nunca entra nas vagas/API (meses válidos: 1–12). */
  readonly todosMesesSentinel = 0;

  readonly servicosOpcoes: ServicoOpcao[] = [
    { key: 'lavagem', label: 'Cobrar lavagem', valorLabel: SERVICO_VALOR_LABELS.lavagem, icon: 'local_car_wash' },
    { key: 'limpeza', label: 'Cobrar limpeza', valorLabel: SERVICO_VALOR_LABELS.limpeza, icon: 'cleaning_services' },
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
  transportadoraNome = '';
  tipoPagador: ConfigCobrancaTipoPagador = 'transportadora';
  responsavelFaturamentoId: number | null = null;
  responsavelFaturamentoNome = '';
  modalidade: ConfigCobrancaModalidade | '' = '';
  /** Última frequência de “Por período” para restaurar ao voltar do acordo. */
  private ultimaModalidadePeriodo: ConfigCobrancaModalidade = 'Mensal';
  /** ISO `yyyy-MM-dd`, exigida apenas na modalidade personalizada. */
  dataCobranca: string | null = null;
  diaFechamento: number | null = null;
  regraFechamento: number = RegraFechamento.UltimoDiaDoMes;
  prazoVencimentoDias = 10;
  /** Destinatários do envio automático (persistidos em `emailFinanceiro` separados por vírgula). */
  emails: string[] = [];
  emailRascunho = '';
  envioAuto = false;
  gerarAuto = false;
  multa = false;
  multaPct = 0;
  juros = false;
  jurosPct = 0;
  descFixo = false;
  descValor = 0;
  acresFixo = false;
  acresValor = 0;
  /** Valor numérico enviado à API. */
  valorEstacionamento: number | null = null;
  /** Texto exibido no input (padrão pt-BR: 1.234,56). */
  valorEstacionamentoTexto = '';
  valorEstacionamentoTocado = false;
  status: ConfigCobrancaStatus = 'Ativa';
  servicos: ConfigCobrancaServicos = servicosVazios();
  acordo: ConfigCobrancaAcordo = acordoVazio();
  custoExcedenteTexto = '';
  /** Unidade do valor principal (hora / pernoite / diária / por vaga). */
  definicaoValor: ConfigCobrancaDefinicaoValor = 'diaria';

  readonly valorCobrancaMatcher = new ValorCobrancaErrorStateMatcher(
    () => this.valorEstacionamentoTocado && this.valorCobrancaInvalido
  );

  get titulo(): string {
    return 'Configuração de cobrança';
  }

  get subtitulo(): string {
    return 'Defina como e quando o cliente será faturado.';
  }

  get tipoRegraCobranca(): ConfigCobrancaTipoRegra | null {
    if (!this.modalidade) return null;
    return this.modalidade === 'Acordo' ? 'acordo' : 'periodo';
  }

  get cnpjTransportadoraFormatado(): string {
    const selecionada = this.data.transportadoras.find((t) => t.id === this.transportadoraId);
    const digits = String(selecionada?.cnpj ?? '').replace(/\D/g, '');
    if (!this.transportadoraId) return '';
    if (digits.length === 14) return formatCnpj(digits);
    return selecionada?.cnpj?.trim() || '—';
  }

  get tipoOperacaoLabel(): 'CIF' | 'FOB' {
    return this.tipoPagador === 'terceiro' ? 'FOB' : 'CIF';
  }

  get transportadoraResumoLabel(): string {
    return (this.transportadoraNome || '').trim() || 'Transportadora das Regras';
  }

  get exigeDataCobranca(): boolean {
    return this.modalidade === 'Personalizada';
  }

  get exigeDiaMensal(): boolean {
    return this.modalidade === 'Mensal';
  }

  get exigeDiaSemanal(): boolean {
    return this.modalidade === 'Semanal';
  }

  get exigeAcordo(): boolean {
    return this.modalidade === 'Acordo';
  }

  get acordoCriado(): boolean {
    return acordoTemConteudo(this.acordo);
  }

  get exigeVencimentoFatura(): boolean {
    return modalidadeExigeVencimentoFatura(this.modalidade);
  }

  get diaSemanaSelecionadoLabel(): string {
    return isDiaSemanaValido(this.diaFechamento) ? diaSemanaLabel(this.diaFechamento) : '';
  }

  get valorCobrancaLabel(): string {
    return valorCobrancaLabel(this.modalidade, this.definicaoValor);
  }

  get definicaoValorOpcoesList() {
    return definicaoValorOpcoes(this.modalidade);
  }

  get valorCobrancaInvalido(): boolean {
    return !valorInformado(parseBrl(this.valorEstacionamentoTexto));
  }

  constructor() {
    const r = this.data.item;
    if (r) {
      this.transportadoraId = r.transportadoraId || null;
      this.transportadoraNome = (r.transportadora || '').trim();
      this.tipoPagador = r.tipoPagador === 'terceiro' ? 'terceiro' : 'transportadora';
      this.responsavelFaturamentoId = r.responsavelFaturamentoId ?? null;
      this.responsavelFaturamentoNome = (r.responsavelFaturamentoNome || '').trim();
      this.modalidade = r.modalidade;
      if (r.modalidade && r.modalidade !== 'Acordo') this.ultimaModalidadePeriodo = r.modalidade;
      this.dataCobranca = r.dataCobranca ?? null;
      this.diaFechamento = r.diaFechamento;
      this.regraFechamento = r.regraFechamento || RegraFechamento.UltimoDiaDoMes;
      if (r.modalidade === 'Mensal' || r.modalidade === 'Semanal') {
        this.regraFechamento = RegraFechamento.DiaFixo;
      }
      this.prazoVencimentoDias = r.prazoVencimentoDias || 10;
      this.emails = parseEmailsFinanceiros(r.emailFinanceiro);
      this.emailRascunho = '';
      this.envioAuto = r.envioAutomatico;
      this.gerarAuto = r.gerarFaturaAutomaticamente;
      this.multa = r.multaAplicar;
      this.multaPct = r.multaPercentual;
      this.juros = r.jurosAplicar;
      this.jurosPct = r.jurosPercentual;
      this.descFixo = r.aplicarDescontoFixo;
      this.descValor = r.valorDescontoFixo;
      this.acresFixo = r.aplicarAcrescimoFixo;
      this.acresValor = r.valorAcrescimoFixo;
      this.valorEstacionamento = r.valorEstacionamento;
      this.valorEstacionamentoTexto = formatarBrl(r.valorEstacionamento);
      this.status = r.status === 'Inativa' ? 'Inativa' : 'Ativa';
      this.servicos = servicosFromItem(r);
      this.acordo = normalizarAcordo(r.acordo);
      if (r.modalidade === 'Acordo') this.garantirListagemAcordo();
      this.custoExcedenteTexto = formatarBrl(this.acordo.custoExcedente);
      this.definicaoValor =
        r.definicaoValor && !(r.modalidade !== 'Acordo' && r.definicaoValor === 'porVaga')
          ? r.definicaoValor
          : definicaoValorPadrao(r.modalidade);
    } else {
      this.modalidade = 'Mensal';
      this.regraFechamento = RegraFechamento.DiaFixo;
      this.diaFechamento = null;
      this.prazoVencimentoDias = 10;
      this.gerarAuto = true;
      this.status = 'Ativa';
      this.acordo = acordoVazio();
      this.custoExcedenteTexto = '';
      this.definicaoValor = definicaoValorPadrao('Mensal');
    }
    this.jurosMultaAberto = this.multa || this.juros || this.descFixo || this.acresFixo;
  }

  toggleJurosMulta(): void {
    this.jurosMultaAberto = !this.jurosMultaAberto;
  }

  selecionarAba(aba: ConfigCobrancaFormAba): void {
    this.abaAtiva = aba;
  }

  onTransportadoraLookupId(id: number | null): void {
    this.transportadoraId = id && id > 0 ? id : null;
    if (!this.transportadoraId) {
      this.transportadoraNome = '';
      return;
    }
    const opt = this.data.transportadoras.find((t) => t.id === this.transportadoraId);
    if (opt?.label) this.transportadoraNome = opt.label;
  }

  onTransportadoraLookupNome(nome: string): void {
    this.transportadoraNome = (nome || '').trim();
  }

  selecionarTipoPagador(tipo: ConfigCobrancaTipoPagador): void {
    this.tipoPagador = tipo;
    if (tipo === 'transportadora') {
      this.responsavelFaturamentoId = null;
      this.responsavelFaturamentoNome = '';
    }
  }

  onResponsavelLookupId(id: number | null): void {
    this.responsavelFaturamentoId = id && id > 0 ? id : null;
    if (!this.responsavelFaturamentoId) this.responsavelFaturamentoNome = '';
  }

  onResponsavelLookupNome(nome: string): void {
    this.responsavelFaturamentoNome = (nome || '').trim();
  }

  abrirNovoResponsavel(): void {
    this.dialog
      .open(ResponsavelFaturamentoFormDialogComponent, {
        width: '720px',
        maxWidth: '96vw',
        autoFocus: false,
        panelClass: 'cfg-form-dialog-panel',
        data: {}
      })
      .afterClosed()
      .subscribe((res: ResponsavelFaturamentoFormDialogResult | undefined) => {
        if (!res?.saved || !res.dto?.id) return;
        this.tipoPagador = 'terceiro';
        this.responsavelFaturamentoId = res.dto.id;
        this.responsavelFaturamentoNome =
          (res.dto.nomeFantasia || res.dto.razaoSocial || '').trim() || `Responsável #${res.dto.id}`;
      });
  }

  selecionarTipoRegra(tipo: ConfigCobrancaTipoRegra): void {
    if (tipo === 'acordo') {
      if (this.modalidade && this.modalidade !== 'Acordo') {
        this.ultimaModalidadePeriodo = this.modalidade;
      }
      this.selecionarModalidade('Acordo');
      return;
    }
    if (this.modalidade === 'Acordo' || !this.modalidade) {
      this.selecionarModalidade(this.ultimaModalidadePeriodo || 'Mensal');
    }
  }

  /** Trocar a regra descarta valores específicos da modalidade anterior. */
  selecionarModalidade(value: ConfigCobrancaModalidade): void {
    if (this.modalidade === value) {
      if (value === 'Semanal') this.abrirModalDiaSemana();
      return;
    }
    if (value !== 'Acordo') this.ultimaModalidadePeriodo = value;
    this.modalidade = value;
    if (value !== 'Personalizada') this.dataCobranca = null;
    this.valorEstacionamento = null;
    this.valorEstacionamentoTexto = '';
    this.valorEstacionamentoTocado = false;

    if (value === 'Mensal') {
      this.regraFechamento = RegraFechamento.DiaFixo;
      if (!this.diaFechamento || this.diaFechamento < 1 || this.diaFechamento > 31) {
        this.diaFechamento = null;
      }
      return;
    }

    if (value === 'Semanal') {
      this.regraFechamento = RegraFechamento.DiaFixo;
      this.diaFechamento = isDiaSemanaValido(this.diaFechamento) ? this.diaFechamento : null;
      this.abrirModalDiaSemana();
      return;
    }

    if (value === 'Acordo') {
      if (!acordoTemConteudo(this.acordo)) this.acordo = acordoVazio();
      this.garantirListagemAcordo();
      this.definicaoValor = 'porVaga';
      return;
    }

    if (this.definicaoValor === 'porVaga') {
      this.definicaoValor = 'diaria';
    }
  }

  selecionarDefinicaoValor(value: ConfigCobrancaDefinicaoValor): void {
    if (value === 'porVaga' && this.modalidade !== 'Acordo') return;
    this.definicaoValor = value;
  }

  get mesesDoPeriodoAcordo(): typeof MESES_ACORDO {
    const permitidos = new Set(mesesNoPeriodoAcordo(this.acordo.dataInicio, this.acordo.dataFim));
    return this.mesesAcordo.filter((m) => permitidos.has(m.mes));
  }

  garantirListagemAcordo(): void {
    if (!this.acordo.listagens?.length) {
      this.acordo.listagens = [novaListagemAcordo()];
    }
  }

  adicionarListagemAcordo(): void {
    this.garantirListagemAcordo();
    this.acordo.listagens = [...this.acordo.listagens, novaListagemAcordo()];
  }

  removerListagemAcordo(id: string): void {
    if (this.acordo.listagens.length <= 1) return;
    this.acordo.listagens = this.acordo.listagens.filter((l) => l.id !== id);
  }

  mesOcupadoAcordo(listagem: ConfigCobrancaAcordoListagem, mes: ConfigCobrancaMesAcordo): boolean {
    return mesesOcupados(this.acordo, listagem.id).has(mes);
  }

  mesesDisponiveisAcordo(listagem: ConfigCobrancaAcordoListagem): ConfigCobrancaMesAcordo[] {
    const ocupados = mesesOcupados(this.acordo, listagem.id);
    return mesesNoPeriodoAcordo(this.acordo.dataInicio, this.acordo.dataFim).filter((mes) => !ocupados.has(mes));
  }

  todosMesesSelecionadosAcordo(listagem: ConfigCobrancaAcordoListagem): boolean {
    const disponiveis = this.mesesDisponiveisAcordo(listagem);
    return disponiveis.length > 0 && disponiveis.every((mes) => listagem.meses.includes(mes));
  }

  onMesesAcordoChange(
    listagem: ConfigCobrancaAcordoListagem,
    meses: Array<ConfigCobrancaMesAcordo | number>
  ): void {
    const ocupados = mesesOcupados(this.acordo, listagem.id);
    const doPeriodo = new Set(mesesNoPeriodoAcordo(this.acordo.dataInicio, this.acordo.dataFim));
    const raw = meses ?? [];
    const pediuTodos = raw.some((mes) => Number(mes) === this.todosMesesSentinel);
    if (pediuTodos) {
      listagem.meses = this.todosMesesSelecionadosAcordo(listagem) ? [] : [...this.mesesDisponiveisAcordo(listagem)];
      return;
    }
    listagem.meses = raw
      .map((mes) => Number(mes))
      .filter(
        (mes): mes is ConfigCobrancaMesAcordo =>
          mes >= 1 && mes <= 12 && doPeriodo.has(mes as ConfigCobrancaMesAcordo) && !ocupados.has(mes)
      )
      .sort((a, b) => a - b);
  }

  onPeriodoAcordoChange(periodo: PeriodoDataSelecionado): void {
    if (!periodo.ativo || !periodo.dataInicial || !periodo.dataFinal) {
      this.acordo.dataInicio = null;
      this.acordo.dataFim = null;
      for (const listagem of this.acordo.listagens) listagem.meses = [];
      return;
    }
    this.acordo.dataInicio = periodo.dataInicial;
    this.acordo.dataFim = periodo.dataFinal;
    podarMesesForaDoPeriodoAcordo(this.acordo);
  }

  abrirModalDiaSemana(): void {
    const ref = this.dialog.open(ConfigCobrancaWeekdayDialogComponent, {
      width: '420px',
      maxWidth: '96vw',
      panelClass: 'cfg-form-dialog-panel',
      data: {
        diaSelecionado: isDiaSemanaValido(this.diaFechamento)
          ? (this.diaFechamento as DiaSemanaCobranca)
          : null
      }
    });
    ref.afterClosed().subscribe((dia) => {
      if (dia == null) return;
      this.diaFechamento = dia;
      this.regraFechamento = RegraFechamento.DiaFixo;
    });
  }

  toggleServico(key: ConfigCobrancaServicoKey): void {
    const atual = this.servicos[key];
    const habilitado = !atual.habilitado;
    this.servicos[key] = { habilitado, valor: habilitado ? atual.valor : null };
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  get emailFinanceiroSerializado(): string {
    return serializeEmailsFinanceiros(this.emails);
  }

  get podeAdicionarEmail(): boolean {
    return this.envioAuto && this.emails.length < EMAIL_FINANCEIRO_MAX;
  }

  onEmailRascunhoKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
      event.preventDefault();
      this.adicionarEmailDoRascunho();
      return;
    }
    if (event.key === 'Backspace' && !this.emailRascunho && this.emails.length) {
      this.removerEmail(this.emails[this.emails.length - 1]!);
    }
  }

  adicionarEmailDoRascunho(): void {
    if (!this.envioAuto) return;
    const candidatos = parseEmailsFinanceiros(this.emailRascunho);
    if (!candidatos.length) {
      const bruto = this.emailRascunho.trim();
      if (bruto) {
        this.snack.open('E-mail financeiro inválido.', 'Fechar', { duration: 3500 });
      }
      return;
    }

    let adicionados = 0;
    for (const email of candidatos) {
      if (!isEmailFinanceiroValido(email)) {
        this.snack.open(`E-mail financeiro inválido: ${email}.`, 'Fechar', { duration: 4000 });
        continue;
      }
      if (this.emails.includes(email)) continue;
      if (this.emails.length >= EMAIL_FINANCEIRO_MAX) {
        this.snack.open(`Informe no máximo ${EMAIL_FINANCEIRO_MAX} e-mails financeiros.`, 'Fechar', {
          duration: 4500
        });
        break;
      }
      this.emails = [...this.emails, email];
      adicionados += 1;
    }

    if (adicionados > 0) this.emailRascunho = '';
  }

  removerEmail(email: string): void {
    this.emails = this.emails.filter((e) => e !== email);
  }

  testarEnvio(): void {
    if (!this.envioAuto) {
      this.snack.open('Ative o envio automático por e-mail para testar o envio.', 'Fechar', { duration: 4500 });
      return;
    }
    this.adicionarEmailDoRascunho();
    const mail = this.emailFinanceiroSerializado;
    if (!mail) {
      this.snack.open('Cadastre um e-mail financeiro para testar o envio.', 'Fechar', { duration: 4500 });
      return;
    }
    // A API publicada não tem rota de teste. O aviso anterior só simulava o envio.
    this.snack.open(
      `Nenhum e-mail foi enviado para ${mail}. A API não expõe envio de teste da configuração de cobrança; o endereço só é gravado ao salvar.`,
      'Fechar',
      { duration: 7000 }
    );
  }

  visualizarRegra(): void {
    this.sincronizarValorEstacionamentoDoTexto();
    this.sincronizarCustoExcedenteDoTexto();
    this.dialog.open(ConfigCobrancaViewRuleDialogComponent, {
      width: '480px',
      maxWidth: '96vw',
      panelClass: 'cfg-form-dialog-panel',
      data: { row: this.montarRegistro(this.data.mode === 'edit' ? this.data.item?.id ?? 0 : 0) }
    });
  }

  salvar(): void {
    this.valorEstacionamentoTocado = true;
    this.sincronizarValorEstacionamentoDoTexto();
    this.sincronizarCustoExcedenteDoTexto();
    sincronizarVagasDoAcordo(this.acordo);
    if (this.emailRascunho.trim()) {
      this.adicionarEmailDoRascunho();
      if (this.emailRascunho.trim()) {
        this.errosVisiveis = ['E-mail financeiro inválido.'];
        this.abaAtiva = 'cadastro';
        this.snack.open(this.errosVisiveis[0]!, 'Fechar', { duration: 5000 });
        return;
      }
    }
    const v = validarFormularioConfig({
      transportadoraId: this.transportadoraId ?? 0,
      tipoPagador: this.tipoPagador,
      responsavelFaturamentoId: this.responsavelFaturamentoId,
      modalidade: this.modalidade,
      dataCobranca: this.dataCobranca,
      regraFechamento: this.regraFechamento,
      diaFechamento: this.diaFechamento,
      prazoVencimentoDias: Number(this.prazoVencimentoDias) || 0,
      email: this.emailFinanceiroSerializado,
      gerarFaturaAutomaticamente: this.gerarAuto,
      envioAutomaticoEmail: this.envioAuto,
      multa: this.multa,
      multaPct: this.multaPct,
      juros: this.juros,
      jurosPct: this.jurosPct,
      descFixo: this.descFixo,
      descValor: this.descValor,
      acresFixo: this.acresFixo,
      acresValor: this.acresValor,
      valorEstacionamento: this.valorEstacionamento,
      servicos: this.servicos,
      acordo: this.acordo,
      definicaoValor: this.definicaoValor
    });
    if (!v.ok) {
      this.errosVisiveis = v.mensagens;
      this.abaAtiva = this.abaParaMensagemErro(v.mensagens[0] ?? '');
      this.snack.open(v.mensagens[0] ?? 'Revise os campos obrigatórios.', 'Fechar', { duration: 5000 });
      return;
    }
    this.errosVisiveis = [];
    this.valorEstacionamentoTexto = formatarBrl(this.valorEstacionamento);
    this.custoExcedenteTexto = formatarBrl(this.acordo.custoExcedente);
    const id = this.data.mode === 'edit' ? this.data.item?.id ?? 0 : 0;
    this.ref.close({ record: this.montarRegistro(id) });
  }

  onValorEstacionamentoBlur(): void {
    this.valorEstacionamentoTocado = true;
    this.sincronizarValorEstacionamentoDoTexto();
    if (this.valorEstacionamento != null) this.valorEstacionamentoTexto = formatarBrl(this.valorEstacionamento);
  }

  onValorEstacionamentoFocus(): void {
    // Mantém texto inválido para o usuário corrigir sem perder o que digitou.
    if (this.valorEstacionamento == null) return;
    this.valorEstacionamentoTexto = formatarBrl(this.valorEstacionamento);
  }

  onCustoExcedenteBlur(): void {
    this.sincronizarCustoExcedenteDoTexto();
    if (this.acordo.custoExcedente != null) this.custoExcedenteTexto = formatarBrl(this.acordo.custoExcedente);
  }

  private sincronizarValorEstacionamentoDoTexto(): void {
    this.valorEstacionamento = parseBrl(this.valorEstacionamentoTexto);
  }

  private sincronizarCustoExcedenteDoTexto(): void {
    this.acordo.custoExcedente = parseBrl(this.custoExcedenteTexto);
  }

  private abaParaMensagemErro(mensagem: string): ConfigCobrancaFormAba {
    const texto = mensagem.toLowerCase();
    if (texto.includes('responsável') || texto.includes('terceiro') || texto.includes('pagador')) {
      return 'responsavel';
    }
    if (
      texto.includes('excedente') ||
      texto.includes('valor') ||
      texto.includes('juros') ||
      texto.includes('multa') ||
      texto.includes('desconto') ||
      texto.includes('acréscimo') ||
      texto.includes('acrescimo') ||
      texto.includes('serviço') ||
      texto.includes('servico') ||
      texto.includes('lavagem') ||
      texto.includes('pernoite') ||
      texto.includes('benefício') ||
      texto.includes('beneficio')
    ) {
      return 'valores';
    }
    if (
      texto.includes('modalidade') ||
      texto.includes('acordo') ||
      texto.includes('fechamento') ||
      texto.includes('dia da semana') ||
      texto.includes('data da cobrança') ||
      texto.includes('data de cobrança') ||
      texto.includes('regra de cobrança')
    ) {
      return 'regraCobranca';
    }
    return 'cadastro';
  }

  private montarRegistro(id: number): ConfigCobrancaListaItem {
    const transportadora = this.data.transportadoras.find((t) => t.id === this.transportadoraId);
    return montarRegistroDoFormulario({
      id,
      transportadoraId: this.transportadoraId ?? 0,
      transportadoraNome: (this.transportadoraNome || transportadora?.label || '').trim(),
      tipoPagador: this.tipoPagador,
      responsavelFaturamentoId: this.responsavelFaturamentoId,
      responsavelFaturamentoNome: this.responsavelFaturamentoNome,
      status: this.status === 'Inativa' ? 'Inativa' : 'Ativa',
      modalidade: this.modalidade as ConfigCobrancaModalidade,
      dataCobranca: this.dataCobranca,
      regraFechamento: this.regraFechamento,
      diaFechamento: this.diaFechamento,
      prazoVencimentoDias: Number(this.prazoVencimentoDias) || 0,
      email: this.emailFinanceiroSerializado,
      envioAuto: this.envioAuto,
      gerarAuto: this.gerarAuto,
      multa: this.multa,
      multaPct: this.multaPct,
      juros: this.juros,
      jurosPct: this.jurosPct,
      descFixo: this.descFixo,
      descValor: this.descValor,
      acresFixo: this.acresFixo,
      acresValor: this.acresValor,
      valorEstacionamento: this.valorEstacionamento,
      servicos: this.servicos,
      acordo: this.acordo,
      definicaoValor: this.definicaoValor
    });
  }
}
