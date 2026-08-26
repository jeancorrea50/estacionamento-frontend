import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { formatCnpj } from '../../../../../cadastro/directives/cnpj-format.directive';
import {
  cloneAcordo,
  MESES_ACORDO,
  mensagensValidacaoAcordo,
  mesesOcupados,
  novaListagemAcordo,
  sincronizarVagasDoAcordo,
  TIPO_COBRANCA_EXCEDENTE_OPCOES
} from '../config-cobranca-acordo.util';
import { formatarBrl, parseBrl } from '../config-cobranca-moeda.util';
import type {
  ConfigCobrancaAcordo,
  ConfigCobrancaAcordoListagem,
  ConfigCobrancaLookupOption,
  ConfigCobrancaMesAcordo
} from '../faturamento-config-cobranca.types';

export interface ConfigCobrancaAcordoDialogData {
  acordo: ConfigCobrancaAcordo;
  /** true = edição de acordo já existente */
  editando: boolean;
  transportadoraId: number | null;
  transportadoras: ConfigCobrancaLookupOption[];
  /** Transportadoras que já possuem acordo (exceto a do registro em edição). */
  transportadoraIdsComAcordo: number[];
}

export interface ConfigCobrancaAcordoDialogResult {
  acordo: ConfigCobrancaAcordo;
  transportadoraId: number;
}

@Component({
  selector: 'app-config-cobranca-acordo-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  templateUrl: './config-cobranca-acordo-dialog.component.html',
  styleUrl: './config-cobranca-acordo-dialog.component.scss'
})
export class ConfigCobrancaAcordoDialogComponent {
  readonly ref = inject(
    MatDialogRef<ConfigCobrancaAcordoDialogComponent, ConfigCobrancaAcordoDialogResult | undefined>
  );
  readonly data = inject<ConfigCobrancaAcordoDialogData>(MAT_DIALOG_DATA);
  private readonly snack = inject(MatSnackBar);

  readonly mesesAcordo = MESES_ACORDO;
  readonly tipoExcedenteOpcoes = TIPO_COBRANCA_EXCEDENTE_OPCOES;

  filtroTransportadora = '';
  transportadoraId: number | null = this.data.transportadoraId;
  custoExcedenteTexto = formatarBrl(this.data.acordo?.custoExcedente ?? null);

  acordo: ConfigCobrancaAcordo = (() => {
    const rascunho = cloneAcordo(this.data.acordo);
    if (!rascunho.listagens.length) rascunho.listagens = [novaListagemAcordo()];
    return rascunho;
  })();

  erros: string[] = [];

  get titulo(): string {
    return this.data.editando ? 'Editar acordo' : 'Criar acordo';
  }

  get cnpjFormatado(): string {
    const selecionada = this.data.transportadoras.find((t) => t.id === this.transportadoraId);
    const digits = String(selecionada?.cnpj ?? '').replace(/\D/g, '');
    if (!this.transportadoraId) return '';
    if (digits.length === 14) return formatCnpj(digits);
    return selecionada?.cnpj?.trim() || '—';
  }

  get transportadorasDisponiveis(): ConfigCobrancaLookupOption[] {
    const bloqueadas = new Set(this.data.transportadoraIdsComAcordo ?? []);
    const q = this.filtroTransportadora.trim().toLowerCase();
    const digits = this.filtroTransportadora.replace(/\D/g, '');
    return this.data.transportadoras.filter((t) => {
      const jaTemAcordo = bloqueadas.has(t.id) && t.id !== this.data.transportadoraId;
      if (jaTemAcordo) return false;
      if (!q && !digits) return true;
      const label = String(t.label ?? '').toLowerCase();
      const cnpj = String(t.cnpj ?? '').replace(/\D/g, '');
      return (q.length > 0 && label.includes(q)) || (digits.length > 0 && cnpj.includes(digits));
    });
  }

  adicionarListagem(): void {
    this.acordo.listagens = [...this.acordo.listagens, novaListagemAcordo()];
  }

  removerListagem(id: string): void {
    if (this.acordo.listagens.length <= 1) return;
    this.acordo.listagens = this.acordo.listagens.filter((l) => l.id !== id);
  }

  mesOcupado(listagem: ConfigCobrancaAcordoListagem, mes: ConfigCobrancaMesAcordo): boolean {
    return mesesOcupados(this.acordo, listagem.id).has(mes);
  }

  onMesesChange(listagem: ConfigCobrancaAcordoListagem, meses: ConfigCobrancaMesAcordo[]): void {
    const ocupados = mesesOcupados(this.acordo, listagem.id);
    listagem.meses = (meses ?? []).filter((mes) => !ocupados.has(mes)).sort((a, b) => a - b);
  }

  onCustoExcedenteBlur(): void {
    this.acordo.custoExcedente = parseBrl(this.custoExcedenteTexto);
    if (this.acordo.custoExcedente != null) {
      this.custoExcedenteTexto = formatarBrl(this.acordo.custoExcedente);
    }
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  concluir(): void {
    if (this.transportadoraId == null || this.transportadoraId <= 0) {
      this.erros = ['Selecione a transportadora do acordo.'];
      this.snack.open(this.erros[0], 'Fechar', { duration: 4500 });
      return;
    }
    if (
      this.data.transportadoraIdsComAcordo.includes(this.transportadoraId) &&
      this.transportadoraId !== this.data.transportadoraId
    ) {
      this.erros = ['Já existe um acordo para esta transportadora. Só é permitido 1 por transportadora.'];
      this.snack.open(this.erros[0], 'Fechar', { duration: 5000 });
      return;
    }

    this.acordo.custoExcedente = parseBrl(this.custoExcedenteTexto);
    this.acordo.listagens = this.acordo.listagens.filter((l) => l.meses.length > 0);
    sincronizarVagasDoAcordo(this.acordo);
    const erros = mensagensValidacaoAcordo(this.acordo, { validarExcedente: true });
    if (erros.length) {
      this.erros = erros;
      this.snack.open(erros[0], 'Fechar', { duration: 4500 });
      if (!this.acordo.listagens.length) this.acordo.listagens = [novaListagemAcordo()];
      return;
    }
    this.ref.close({
      acordo: cloneAcordo(this.acordo),
      transportadoraId: this.transportadoraId
    });
  }
}
